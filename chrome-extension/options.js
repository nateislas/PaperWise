/**
 * PaperWise Options Page Script
 * Manages extension settings and configuration
 */

class PaperWiseOptions {
  constructor() {
    this.init();
  }

  async init() {
    // Load current settings
    await this.loadSettings();

    // Set up event listeners
    this.setupEventListeners();

    // Test API connection
    this.testApiConnection();
  }

  setupEventListeners() {
    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Auto-save on input change
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (input.type === 'checkbox') {
          this.autoSave();
        }
      });

      input.addEventListener('blur', () => {
        if (input.type !== 'checkbox') {
          this.autoSave();
        }
      });
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'apiUrl',
        'autoOpenResults'
      ]);

      // Set form values
      const apiUrlInput = document.getElementById('apiUrl');
      const autoOpenInput = document.getElementById('autoOpenResults');

      apiUrlInput.value = result.apiUrl || 'http://localhost:8000/api/v1';
      autoOpenInput.checked = result.autoOpenResults || false;

    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  async saveSettings() {
    try {
      const apiUrl = document.getElementById('apiUrl').value.trim();
      const autoOpenResults = document.getElementById('autoOpenResults').checked;

      // Validate API URL
      if (!this.isValidUrl(apiUrl)) {
        this.showStatus('Please enter a valid API URL', 'error');
        return;
      }

      // Save to storage
      await chrome.storage.sync.set({
        apiUrl,
        autoOpenResults
      });

      this.showStatus('Settings saved successfully!', 'success');

      // Notify background script of API URL change
      chrome.runtime.sendMessage({
        type: 'settings_updated',
        settings: { apiUrl, autoOpenResults }
      });

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  async autoSave() {
    // Debounced auto-save
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.saveSettings();
    }, 1000);
  }

  async resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      // Clear all settings
      await chrome.storage.sync.clear();

      // Reload the page to show defaults
      window.location.reload();

    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showStatus('Failed to reset settings', 'error');
    }
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  async testApiConnection() {
    try {
      const apiUrl = document.getElementById('apiUrl').value.trim();
      if (!apiUrl) return;

      // Try to fetch health endpoint
      const healthUrl = apiUrl.replace('/api/v1', '/health');
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'healthy') {
          this.showStatus('✅ API connection successful', 'success');
        } else {
          this.showStatus('⚠️ API responded but may not be fully ready', 'error');
        }
      } else {
        this.showStatus(`❌ API connection failed (${response.status})`, 'error');
      }

    } catch (error) {
      console.error('API connection test failed:', error);
      this.showStatus('❌ Could not connect to API. Make sure the server is running.', 'error');
    }
  }

  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 5000);
    }
  }

  // Handle messages from background script
  handleMessage(message) {
    switch (message.type) {
      case 'settings_updated':
        this.showStatus('Settings updated successfully!', 'success');
        break;
    }
  }
}

// Initialize options page
let options;
document.addEventListener('DOMContentLoaded', () => {
  options = new PaperWiseOptions();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(options.handleMessage.bind(options));
});
