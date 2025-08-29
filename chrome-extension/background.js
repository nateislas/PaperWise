/**
 * PaperWise Chrome Extension - Background Script
 * Handles SSE streams, API communication, and notifications
 */

console.log('🧠 PaperWise background script loaded');

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Store active jobs and their SSE connections
const activeJobs = new Map();
const sseConnections = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('🧠 PaperWise extension installed');

  // Create context menu
  chrome.contextMenus.create({
    id: 'analyze-paper',
    title: 'Analyze with PaperWise',
    contexts: ['link', 'page'],
    documentUrlPatterns: ['https://arxiv.org/*']
  });

  console.log('🧠 Context menu created for https://arxiv.org/*');

  // Load settings
  loadSettings();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🧠 Context menu clicked:', {
    menuItemId: info.menuItemId,
    pageUrl: info.pageUrl,
    linkUrl: info.linkUrl,
    tabUrl: tab?.url
  });
  
  if (info.menuItemId === 'analyze-paper') {
    const url = info.linkUrl || info.pageUrl;
    console.log('🧠 Extracted URL from context menu:', url);
    
    if (url && isArxivUrl(url)) {
      console.log('🧠 URL is valid arXiv URL, starting analysis');
      await analyzePaper(url);
    } else {
      console.log('🧠 URL is not a valid arXiv URL:', url);
    }
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🧠 Background received message:', {
    type: message.type,
    url: message.url,
    pdfUrl: message.pdfUrl,
    sender: sender.tab?.url || 'unknown'
  });
  
  if (message.type === 'analyze_paper') {
    console.log('🧠 Processing analyze_paper message with URL:', message.url);
    
    // Use Promise.resolve().then() to handle async operations synchronously
    Promise.resolve().then(async () => {
      try {
        const result = await analyzePaper(message.url);
        console.log('🧠 Analysis started successfully, jobId:', result.jobId);
        sendResponse({ success: true, jobId: result.jobId });
      } catch (error) {
        console.error('🧠 Analysis error from content script:', error);
        sendResponse({ success: false, error: error.message });
      }
    }).catch(error => {
      console.error('🧠 Unexpected error in analyze_paper:', error);
      sendResponse({ success: false, error: 'Unexpected error occurred' });
    });
    
    return true; // Keep message channel open for async response
  } else if (message.type === 'get_active_jobs') {
    console.log('🧠 Returning active jobs');
    // Convert Map to array for serialization
    const jobsArray = Array.from(activeJobs.entries());
    sendResponse(jobsArray);
    return false; // Synchronous response, no need to keep channel open
  } else if (message.type === 'cancel_job') {
    console.log('🧠 Cancelling job:', message.jobId);
    cancelJob(message.jobId);
    sendResponse({ success: true });
    return false; // Synchronous response, no need to keep channel open
  } else {
    console.log('🧠 Unknown message type:', message.type);
    sendResponse({ error: 'Unknown message type' });
    return false; // Synchronous response, no need to keep channel open
  }
});

// Check if URL is from arXiv
function isArxivUrl(url) {
  console.log('🧠 Checking if URL is arXiv:', url);
  const isArxiv = url.includes('arxiv.org') && (
    url.includes('/pdf/') ||
    url.includes('/abs/') ||
    url.includes('/html/')
  );
  console.log('🧠 Is arXiv URL:', isArxiv);
  return isArxiv;
}

// Extract PDF URL from arXiv page
function extractPdfUrl(arxivUrl) {
  console.log('🧠 Extracting PDF URL from:', arxivUrl);
  
  if (arxivUrl.includes('/pdf/')) {
    console.log('🧠 Already a PDF URL, returning as-is');
    return arxivUrl;
  }

  // Convert abstract URL to PDF URL (note: arXiv PDFs don't have .pdf extension)
  const match = arxivUrl.match(/arxiv\.org\/(?:abs|html)\/([0-9]+\.[0-9]+)/);
  if (match) {
    const pdfUrl = `https://arxiv.org/pdf/${match[1]}`;
    console.log('🧠 Converted to PDF URL:', pdfUrl);
    return pdfUrl;
  }

  console.log('🧠 Could not extract PDF URL');
  return null;
}

// Main analysis function
async function analyzePaper(url) {
  console.log('🧠 Starting analysis for URL:', url);
  
  try {
    const pdfUrl = extractPdfUrl(url);
    if (!pdfUrl) {
      throw new Error('Could not extract PDF URL from: ' + url);
    }

    console.log('🧠 Submitting job for PDF URL:', pdfUrl);
    
    // Submit job
    const jobResponse = await submitJob(pdfUrl);
    console.log('🧠 Job submission response:', jobResponse);
    
    if (!jobResponse.job_id) {
      throw new Error('Failed to submit job');
    }

    const jobId = jobResponse.job_id;
    console.log('🧠 Job created with ID:', jobId);
    
    activeJobs.set(jobId, { url: pdfUrl, submittedAt: Date.now() });
    console.log('🧠 Job added to active jobs. Total active jobs:', activeJobs.size);

    // Start SSE stream (don't await this - let it run in background)
    console.log('🧠 Starting SSE stream for job:', jobId);
    startSseStream(jobId).catch(error => {
      console.error('🧠 SSE stream error:', error);
    });

    // Show initial notification
    showNotification('Analysis Started', `Analyzing paper: ${pdfUrl.split('/').pop()}`);

    return { success: true, jobId };

  } catch (error) {
    console.error('🧠 Analysis error:', error);
    showNotification('Analysis Failed', error.message);
    throw error; // Re-throw so caller can handle it
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
  console.log('🧠 Starting SSE stream for job:', jobId);
  
  // Note: Our backend doesn't have /jobs/{jobId}/stream endpoint
  // We need to use the general streaming endpoint with file_id
  // For now, let's just log that we're not implementing SSE yet
  console.log('🧠 SSE streaming not implemented yet - job tracking will be done via polling');
  
  // TODO: Implement proper SSE streaming when backend supports it
  return;
  
  /*
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
  */
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
    iconUrl: 'icons/brain-circuit.png',
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

// Note: Message handling is done in the main onMessage listener above

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
