/**
 * PaperWise Content Script
 * Runs on arXiv pages to enhance user experience
 */

class ArxivContentScript {
  constructor() {
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
    // Check if we're on an arXiv page
    if (this.isArxivPage()) {
      this.enhancePage();
    }
  }

  isArxivPage() {
    return window.location.hostname.includes('arxiv.org');
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
    try {
      const pdfUrl = this.extractPdfUrl();
      if (!pdfUrl) {
        this.showMessage('Could not find PDF for this paper', 'error');
        return;
      }

      // Send message to background script
      chrome.runtime.sendMessage({
        type: 'analyze_paper',
        url: pdfUrl
      });

      this.showMessage('Analysis started! Check the extension popup for progress.', 'success');

    } catch (error) {
      console.error('Analysis error:', error);
      this.showMessage('Failed to start analysis', 'error');
    }
  }

  extractPdfUrl() {
    const currentUrl = window.location.href;

    // If already on PDF page
    if (currentUrl.includes('/pdf/')) {
      return currentUrl;
    }

    // Extract arXiv ID from current URL
    const arxivMatch = currentUrl.match(/arxiv\.org\/(?:abs|html)\/([0-9]+\.[0-9]+)/);
    if (arxivMatch) {
      return `https://arxiv.org/pdf/${arxivMatch[1]}.pdf`;
    }

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

    // Try to extract title
    const titleElement = document.querySelector('h1.title, .title');
    if (titleElement) {
      metadata.title = titleElement.textContent.trim();
    }

    // Try to extract authors
    const authorElements = document.querySelectorAll('.authors a, .author');
    if (authorElements.length > 0) {
      metadata.authors = Array.from(authorElements).map(el => el.textContent.trim());
    }

    // Try to extract abstract
    const abstractElement = document.querySelector('.abstract, #abstract');
    if (abstractElement) {
      metadata.abstract = abstractElement.textContent.trim();
    }

    return metadata;
  }
}

// Initialize content script
const contentScript = new ArxivContentScript();
