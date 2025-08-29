/**
 * PaperWise Content Script
 * Runs on arXiv pages to enhance user experience
 */

console.log('🧠 PaperWise content script loaded on:', window.location.href);

class ArxivContentScript {
  constructor() {
    console.log('🧠 ArxivContentScript constructor called');
    this.init();
  }

  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onPageLoad());
    } else {
      this.onPageLoad();
    }
  }

  onPageLoad() {
    console.log('🧠 Content script onPageLoad called');
    // Check if we're on an arXiv page
    if (this.isArxivPage()) {
      console.log('🧠 On arXiv page, enhancing page');
      this.enhancePage();
    } else {
      console.log('🧠 Not on arXiv page, skipping enhancement');
    }
  }

  isArxivPage() {
    const isArxiv = window.location.hostname.includes('arxiv.org');
    console.log('🧠 isArxivPage check:', {
      hostname: window.location.hostname,
      url: window.location.href,
      isArxiv: isArxiv
    });
    return isArxiv;
  }

  enhancePage() {
    // Add PaperWise indicator to page
    this.addPaperWiseIndicator();

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Watch for URL changes (for single-page navigation)
    this.watchUrlChanges();
  }

  addPaperWiseIndicator() {
    // Create indicator element
    const indicator = document.createElement('div');
    indicator.id = 'paperwise-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4285f4;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span>🧠</span>
        <span>Analyze with PaperWise</span>
      </div>
    `;

    // Add click handler
    indicator.addEventListener('click', () => {
      this.analyzeCurrentPage();
    });

    // Add to page
    document.body.appendChild(indicator);

    // Add hover effect
    indicator.addEventListener('mouseenter', () => {
      indicator.style.background = '#3367d6';
    });

    indicator.addEventListener('mouseleave', () => {
      indicator.style.background = '#4285f4';
    });
  }

  async analyzeCurrentPage() {
    console.log('🧠 analyzeCurrentPage called');
    try {
      const pdfUrl = this.extractPdfUrl();
      console.log('🧠 Extracted PDF URL:', pdfUrl);
      
      if (!pdfUrl) {
        console.log('🧠 No PDF URL found');
        this.showMessage('Could not find PDF for this paper', 'error');
        return;
      }

      const metadata = this.getPaperMetadata();
      console.log('🧠 Extracted metadata for analysis:', metadata);

      console.log('🧠 Sending analyze_paper message to background script');
      // Send message to background script and wait for response
      const response = await chrome.runtime.sendMessage({
        type: 'analyze_paper',
        url: pdfUrl,
        metadata: metadata
      });

      console.log('🧠 Background script response:', response);

      if (response && response.success) {
        console.log('🧠 Analysis started successfully with jobId:', response.jobId);
        this.showMessage('Analysis started! Check the extension popup for progress.', 'success');
      } else if (response && response.error) {
        console.log('🧠 Analysis failed with error:', response.error);
        this.showMessage(`Failed to start analysis: ${response.error}`, 'error');
      } else {
        console.log('🧠 Analysis failed: No response or invalid response format');
        this.showMessage('Failed to start analysis: No response from background script', 'error');
      }

    } catch (error) {
      console.error('🧠 Analysis error:', error);
      this.showMessage('Failed to start analysis', 'error');
    }
  }

  extractPdfUrl() {
    const currentUrl = window.location.href;
    console.log('🧠 extractPdfUrl called with current URL:', currentUrl);

    // If already on PDF page
    if (currentUrl.includes('/pdf/')) {
      console.log('🧠 Already on PDF page, returning current URL');
      return currentUrl;
    }

    // Extract arXiv ID from current URL (note: arXiv PDFs don't have .pdf extension)
    const arxivMatch = currentUrl.match(/arxiv\.org\/(?:abs|html)\/([0-9]+\.[0-9]+)/);
    if (arxivMatch) {
      const pdfUrl = `https://arxiv.org/pdf/${arxivMatch[1]}`;
      console.log('🧠 Converted abstract URL to PDF URL:', pdfUrl);
      return pdfUrl;
    }

    console.log('🧠 Could not extract PDF URL from:', currentUrl);
    return null;
  }

  showMessage(text, type = 'info') {
    // Remove existing message
    const existing = document.getElementById('paperwise-message');
    if (existing) {
      existing.remove();
    }

    // Create new message
    const message = document.createElement('div');
    message.id = 'paperwise-message';
    message.textContent = text;

    const colors = {
      success: '#4caf50',
      error: '#f44336',
      info: '#2196f3'
    };

    message.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-width: 300px;
      word-wrap: break-word;
    `;

    document.body.appendChild(message);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 5000);
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'analysis_started':
        this.showMessage('Analysis started!', 'success');
        break;

      case 'analysis_complete':
        this.showMessage('Analysis complete! Click the extension icon to view results.', 'success');
        break;

      case 'analysis_error':
        this.showMessage(`Analysis failed: ${message.error}`, 'error');
        break;
    }
  }

  watchUrlChanges() {
    // Watch for URL changes in single-page apps
    let currentUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.onUrlChange();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  onUrlChange() {
    // Re-enhance page if still on arXiv
    if (this.isArxivPage()) {
      // Remove old indicator
      const oldIndicator = document.getElementById('paperwise-indicator');
      if (oldIndicator) {
        oldIndicator.remove();
      }

      // Add new indicator
      this.addPaperWiseIndicator();
    }
  }

  // Utility method to get paper metadata
  getPaperMetadata() {
    const metadata = {};

    // Extract arXiv ID from URL
    const arxivMatch = window.location.href.match(/arxiv\.org\/(?:abs|pdf|html)\/([0-9]+\.[0-9]+)/);
    if (arxivMatch) {
      metadata.arxiv_id = arxivMatch[1];
    }

    // Try to extract title
    const titleElement = document.querySelector('h1.title, .title');
    if (titleElement) {
      let title = titleElement.textContent.trim();
      
      // Clean up common prefixes that might be included
      const prefixesToRemove = ['Title:', 'Title', 'Paper:', 'Paper'];
      for (const prefix of prefixesToRemove) {
        if (title.startsWith(prefix)) {
          title = title.substring(prefix.length).trim();
          break;
        }
      }
      
      metadata.title = title;
    }

    // Try to extract authors
    const authorElements = document.querySelectorAll('.authors a, .author');
    if (authorElements.length > 0) {
      metadata.authors = Array.from(authorElements).map(el => el.textContent.trim());
      // Also set the first author as the main author
      if (metadata.authors.length > 0) {
        metadata.author = metadata.authors[0];
      }
    }

    // Try to extract abstract
    const abstractElement = document.querySelector('.abstract, #abstract');
    if (abstractElement) {
      let abstract = abstractElement.textContent.trim();
      
      // Clean up common prefixes that might be included
      const prefixesToRemove = ['Abstract:', 'Abstract', 'Summary:', 'Summary'];
      for (const prefix of prefixesToRemove) {
        if (abstract.startsWith(prefix)) {
          abstract = abstract.substring(prefix.length).trim();
          break;
        }
      }
      
      metadata.abstract = abstract;
    }

    // Try to extract submission date
    const submissionElement = document.querySelector('.dateline');
    if (submissionElement) {
      const submissionText = submissionElement.textContent;
      const dateMatch = submissionText.match(/Submitted on (\d+ \w+ \d+)/);
      if (dateMatch) {
        metadata.submission_date = dateMatch[1];
      }
    }

    // Try to extract subjects/categories
    const subjectsElement = document.querySelector('.primary-subject');
    if (subjectsElement) {
      metadata.subjects = subjectsElement.textContent.trim();
    }

    console.log('🧠 Extracted metadata from arXiv page:', metadata);
    return metadata;
  }
}

// Initialize content script
const contentScript = new ArxivContentScript();
