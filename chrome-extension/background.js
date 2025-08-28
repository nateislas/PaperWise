/**
 * PaperWise Chrome Extension - Background Script
 * Handles SSE streams, API communication, and notifications
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Store active jobs and their SSE connections
const activeJobs = new Map();
const sseConnections = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('PaperWise extension installed');

  // Create context menu
  chrome.contextMenus.create({
    id: 'analyze-paper',
    title: 'Analyze with PaperWise',
    contexts: ['link', 'page'],
    documentUrlPatterns: ['https://arxiv.org/*']
  });

  // Load settings
  loadSettings();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyze-paper') {
    const url = info.linkUrl || info.pageUrl;
    if (url && isArxivUrl(url)) {
      await analyzePaper(url);
    }
  }
});

// Check if URL is from arXiv
function isArxivUrl(url) {
  return url.includes('arxiv.org') && (
    url.includes('/pdf/') ||
    url.includes('/abs/') ||
    url.includes('/html/')
  );
}

// Extract PDF URL from arXiv page
function extractPdfUrl(arxivUrl) {
  if (arxivUrl.includes('/pdf/')) {
    return arxivUrl;
  }

  // Convert abstract URL to PDF URL
  const match = arxivUrl.match(/arxiv\.org\/(?:abs|html)\/([0-9]+\.[0-9]+)/);
  if (match) {
    return `https://arxiv.org/pdf/${match[1]}.pdf`;
  }

  return null;
}

// Main analysis function
async function analyzePaper(url) {
  try {
    const pdfUrl = extractPdfUrl(url);
    if (!pdfUrl) {
      showNotification('Invalid arXiv URL', 'Could not extract PDF URL from: ' + url);
      return;
    }

    // Submit job
    const jobResponse = await submitJob(pdfUrl);
    if (!jobResponse.job_id) {
      throw new Error('Failed to submit job');
    }

    const jobId = jobResponse.job_id;
    activeJobs.set(jobId, { url: pdfUrl, submittedAt: Date.now() });

    // Start SSE stream
    await startSseStream(jobId);

    // Show initial notification
    showNotification('Analysis Started', `Analyzing paper: ${pdfUrl.split('/').pop()}`);

  } catch (error) {
    console.error('Analysis error:', error);
    showNotification('Analysis Failed', error.message);
  }
}

// Submit job to PaperWise API
async function submitJob(pdfUrl) {
  const response = await fetch(`${API_BASE_URL}/analyze/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pdf_url: pdfUrl
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Start SSE stream for job progress
async function startSseStream(jobId) {
  const sseUrl = `${API_BASE_URL}/jobs/${jobId}/stream`;

  try {
    const response = await fetch(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    sseConnections.set(jobId, { reader, decoder });

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(`SSE stream ended for job ${jobId}`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            handleSseEvent(jobId, data);
          } catch (e) {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }
  } catch (error) {
    console.error(`SSE error for job ${jobId}:`, error);
    showNotification('Connection Error', 'Lost connection to analysis service');
  } finally {
    sseConnections.delete(jobId);
  }
}

// Handle SSE events
function handleSseEvent(jobId, event) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  console.log('SSE Event:', event);

  switch (event.type) {
    case 'status':
      updateJobProgress(jobId, event);
      break;

    case 'done':
      handleJobComplete(jobId, event);
      break;

    case 'error':
      handleJobError(jobId, event);
      break;

    default:
      console.log('Unhandled SSE event type:', event.type);
  }
}

// Update job progress in UI
function updateJobProgress(jobId, event) {
  const progress = event.progress || 0;
  const stage = event.stage || 'Processing...';

  // Update extension icon badge
  chrome.action.setBadgeText({ text: `${progress}%` });
  chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

  // Notify popup if open
  chrome.runtime.sendMessage({
    type: 'job_progress',
    jobId,
    progress,
    stage
  }).catch(() => {
    // Popup might not be open, ignore
  });
}

// Handle job completion
async function handleJobComplete(jobId, event) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  // Fetch result
  try {
    const result = await fetchJobResult(jobId);
    showNotification(
      'Analysis Complete!',
      `Paper analysis finished. Click to view results.`,
      jobId
    );

    // Update job status
    job.completedAt = Date.now();
    job.result = result;

    // Notify popup
    chrome.runtime.sendMessage({
      type: 'job_complete',
      jobId,
      result
    }).catch(() => {});

  } catch (error) {
    console.error('Failed to fetch result:', error);
    showNotification('Analysis Complete', 'Results may take a moment to load');
  }
}

// Handle job errors
function handleJobError(jobId, event) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  const errorMsg = event.error || 'Unknown error';
  showNotification('Analysis Failed', errorMsg);

  // Notify popup
  chrome.runtime.sendMessage({
    type: 'job_error',
    jobId,
    error: errorMsg
  }).catch(() => {});
}

// Fetch job result
async function fetchJobResult(jobId) {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/result`);
  if (!response.ok) {
    throw new Error(`Failed to fetch result: ${response.status}`);
  }
  return await response.json();
}

// Show notification
function showNotification(title, message, jobId = null) {
  const options = {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  };

  if (jobId) {
    options.buttons = [{ title: 'View Results' }];
  }

  chrome.notifications.create(`paperwise-${Date.now()}`, options, (notificationId) => {
    if (jobId) {
      // Store job ID for when user clicks notification
      chrome.storage.local.set({ [`notification_${notificationId}`]: jobId });
    }
  });
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get([`notification_${notificationId}`], (result) => {
    const jobId = result[`notification_${notificationId}`];
    if (jobId) {
      // Open results page (for now, just log - we'll implement this)
      console.log('Open results for job:', jobId);
      // TODO: Open results page or popup
    }
  });
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (result.apiUrl) {
      // Update API_BASE_URL if custom URL is set
      // This allows users to point to production deployment
    }
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get_active_jobs':
      sendResponse(Array.from(activeJobs.entries()));
      break;

    case 'cancel_job':
      cancelJob(message.jobId);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
  return true; // Keep message channel open
});

// Cancel job (if possible)
function cancelJob(jobId) {
  // For now, just remove from tracking
  // TODO: Implement actual job cancellation in backend
  activeJobs.delete(jobId);

  const connection = sseConnections.get(jobId);
  if (connection) {
    connection.reader.cancel();
    sseConnections.delete(jobId);
  }

  chrome.action.setBadgeText({ text: '' });
}
