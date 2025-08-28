/**
 * PaperWise Popup Script
 * Manages the extension popup UI and user interactions
 */

class PaperWisePopup {
  constructor() {
    this.jobs = new Map();
    this.currentView = 'jobs';
    this.init();
  }

  async init() {
    // Set up message listeners
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Load initial data
    await this.loadJobs();

    // Set up event listeners
    this.setupEventListeners();

    // Auto-refresh every 5 seconds
    setInterval(() => this.loadJobs(), 5000);
  }

  setupEventListeners() {
    // Settings link
    const settingsLink = document.querySelector('.settings-link');
    if (settingsLink) {
      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }

  async loadJobs() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get_active_jobs' });
      const jobsArray = response || [];

      this.jobs.clear();
      jobsArray.forEach(([jobId, jobData]) => {
        this.jobs.set(jobId, jobData);
      });

      this.render();
    } catch (error) {
      console.error('Failed to load jobs:', error);
      this.showError('Failed to load jobs');
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'job_progress':
        this.updateJobProgress(message.jobId, message.progress, message.stage);
        break;

      case 'job_complete':
        this.handleJobComplete(message.jobId, message.result);
        break;

      case 'job_error':
        this.handleJobError(message.jobId, message.error);
        break;
    }
  }

  updateJobProgress(jobId, progress, stage) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.stage = stage;
      this.render();
    }
  }

  handleJobComplete(jobId, result) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'done';
      job.result = result;
      job.completedAt = Date.now();
      this.render();
    }
  }

  handleJobError(jobId, error) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error;
      this.render();
    }
  }

  render() {
    const content = document.getElementById('content');

    if (this.jobs.size === 0) {
      content.innerHTML = this.renderEmptyState();
    } else {
      content.innerHTML = this.renderJobsList();
    }
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <span class="icon">📄</span>
        <div>No active analyses</div>
        <div style="font-size: 12px; margin-top: 8px; color: #999;">
          Right-click on an arXiv paper and select "Analyze with PaperWise"
        </div>
      </div>
    `;
  }

  renderJobsList() {
    const jobElements = Array.from(this.jobs.entries())
      .sort(([,a], [,b]) => (b.submittedAt || 0) - (a.submittedAt || 0))
      .map(([jobId, job]) => this.renderJob(jobId, job))
      .join('');

    return `
      <div class="jobs-list">
        ${jobElements}
      </div>
    `;
  }

  renderJob(jobId, job) {
    const progress = job.progress || 0;
    const stage = job.stage || 'Processing...';
    const status = this.getJobStatus(job);
    const statusClass = this.getStatusClass(status);

    return `
      <div class="job-item" data-job-id="${jobId}">
        <div class="job-url">${this.formatUrl(job.url)}</div>

        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">${progress}% - ${stage}</div>
        </div>

        <div class="status ${statusClass}">${status}</div>

        <div class="actions">
          ${this.renderJobActions(jobId, job)}
        </div>

        ${job.error ? `<div class="error-message">${job.error}</div>` : ''}
      </div>
    `;
  }

  renderJobActions(jobId, job) {
    const actions = [];

    if (job.status === 'done' && job.result) {
      actions.push(`
        <button class="btn primary" onclick="popup.viewResults('${jobId}')">
          View Results
        </button>
      `);
    }

    if (job.status === 'processing' || job.status === 'queued') {
      actions.push(`
        <button class="btn danger" onclick="popup.cancelJob('${jobId}')">
          Cancel
        </button>
      `);
    }

    if (job.status === 'error') {
      actions.push(`
        <button class="btn" onclick="popup.retryJob('${jobId}')">
          Retry
        </button>
      `);
    }

    return actions.join('');
  }

  getJobStatus(job) {
    if (job.status === 'done') return 'Complete';
    if (job.status === 'error') return 'Failed';
    if (job.status === 'processing') return 'Processing';
    return 'Queued';
  }

  getStatusClass(status) {
    switch (status) {
      case 'Complete': return 'done';
      case 'Failed': return 'error';
      case 'Processing': return 'processing';
      default: return 'queued';
    }
  }

  formatUrl(url) {
    if (!url) return 'Unknown paper';

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Extract arXiv ID from PDF URL
      if (pathParts.includes('pdf')) {
        const pdfIndex = pathParts.indexOf('pdf');
        if (pdfIndex + 1 < pathParts.length) {
          return `arXiv:${pathParts[pdfIndex + 1]}`;
        }
      }

      return urlObj.hostname;
    } catch (e) {
      return url.substring(0, 50) + '...';
    }
  }

  showError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="error-message">
        ${message}
      </div>
      ${this.renderEmptyState()}
    `;
  }

  // Public methods called from HTML buttons
  async viewResults(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.result) {
      // For now, just log the result
      // TODO: Open results in a new tab or show in popup
      console.log('Viewing results for job:', jobId, job.result);

      // You could open a new tab with the results:
      // chrome.tabs.create({ url: `results.html?jobId=${jobId}` });
    }
  }

  async cancelJob(jobId) {
    try {
      await chrome.runtime.sendMessage({
        type: 'cancel_job',
        jobId: jobId
      });

      this.jobs.delete(jobId);
      this.render();
    } catch (error) {
      console.error('Failed to cancel job:', error);
      this.showError('Failed to cancel job');
    }
  }

  async retryJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Clear error state and retry
    delete job.error;
    job.status = 'queued';
    job.progress = 0;
    job.stage = 'Retrying...';

    this.render();

    // TODO: Implement actual retry logic
    console.log('Retrying job:', jobId);
  }
}

// Initialize popup when DOM is ready
let popup;
document.addEventListener('DOMContentLoaded', () => {
  popup = new PaperWisePopup();
});
