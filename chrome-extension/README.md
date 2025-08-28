# PaperWise Chrome Extension

A Chrome extension that integrates with the PaperWise AI research paper analysis system, allowing you to analyze arXiv papers with just a right-click.

## Features

- 🖱️ **Context Menu Integration**: Right-click on any arXiv paper to analyze it
- 📊 **Real-time Progress**: Live progress updates during analysis via SSE
- 🔔 **Smart Notifications**: Get notified when analysis is complete
- ⚙️ **Configurable API**: Point to your local or production PaperWise API
- 🎯 **arXiv Optimized**: Works seamlessly with arXiv.org papers

## Installation

### Development Setup

1. **Clone and set up the backend** (see main project README)

2. **Load the extension in Chrome**:
   ```
   Open Chrome and go to: chrome://extensions/
   Enable "Developer mode" (top right)
   Click "Load unpacked"
   Select the `chrome-extension` folder from this project
   ```

3. **Configure the API**:
   ```
   Click the PaperWise extension icon
   Click the ⚙️ settings icon (top right)
   Set your API URL (default: http://localhost:8000/api/v1)
   ```

## Usage

### Method 1: Context Menu (Recommended)
1. Go to any arXiv paper page (e.g., `https://arxiv.org/abs/XXXX.XXXX`)
2. Right-click anywhere on the page
3. Select **"Analyze with PaperWise"**
4. The analysis will start automatically

### Method 2: Extension Icon
1. Go to any arXiv paper page
2. Click the PaperWise extension icon in your toolbar
3. Click the blue "Analyze with PaperWise" button
4. The analysis will start automatically

### Method 3: Direct URL
- The extension automatically detects arXiv URLs
- Works on abstract pages, HTML pages, and PDF pages

## How It Works

1. **URL Detection**: Extension detects arXiv paper URLs
2. **PDF Extraction**: Automatically converts abstract URLs to PDF URLs
3. **API Submission**: Sends PDF URL to PaperWise backend for analysis
4. **Real-time Updates**: Receives progress via Server-Sent Events (SSE)
5. **Completion**: Shows notification when analysis is ready
6. **Results Access**: Click notification to view detailed analysis

## Configuration

### API Settings
- **API URL**: Point to your PaperWise backend
  - Local: `http://localhost:8000/api/v1`
  - Production: `https://your-domain.com/api/v1`

### Preferences
- **Auto-open Results**: Automatically open results in new tab when complete

## Development

### File Structure
```
chrome-extension/
├── manifest.json      # Extension configuration
├── background.js      # Background service worker
├── popup.html         # Extension popup UI
├── popup.js          # Popup logic
├── content.js        # Content script for arXiv pages
├── options.html      # Settings page
├── options.js        # Settings logic
├── icons/            # Extension icons (16x16, 48x48, 128x128)
└── README.md         # This file
```

### Key Components

**Background Script (`background.js`)**:
- Handles context menu creation
- Manages SSE connections to backend
- Shows notifications
- Coordinates API calls

**Popup (`popup.html` + `popup.js`)**:
- Shows current analysis jobs
- Displays progress and status
- Provides action buttons (view results, cancel)

**Content Script (`content.js`)**:
- Runs on arXiv pages
- Adds visual indicators
- Enhances user experience

**Options Page (`options.html` + `options.js`)**:
- API configuration
- User preferences
- Connection testing

## Troubleshooting

### Extension Not Working
1. Check if backend is running: `curl http://localhost:8000/health`
2. Verify API URL in extension settings
3. Check browser console for errors (F12 → Console)

### Analysis Not Starting
1. Make sure you're on an arXiv page
2. Check if PDF URL extraction is working
3. Look at extension popup for error messages

### No Progress Updates
1. SSE connection might have failed
2. Check network tab for connection issues
3. Backend might not be streaming events properly

### API Connection Issues
1. Verify API URL in settings
2. Check CORS headers on backend
3. Ensure backend allows your origin

## API Integration

The extension communicates with the PaperWise backend via:

- **POST** `/api/v1/analyze/async` - Submit analysis job
- **GET** `/api/v1/jobs/{job_id}` - Get job status
- **GET** `/api/v1/jobs/{job_id}/stream` - SSE progress stream
- **GET** `/api/v1/jobs/{job_id}/result` - Get final results

## Browser Compatibility

- **Chrome**: Full support (Manifest V3)
- **Edge**: Full support
- **Firefox**: Limited support (different manifest format needed)
- **Safari**: Not supported (limited extension API)

## Privacy & Security

- Only sends arXiv PDF URLs to your backend
- No user data or browsing history is collected
- All analysis happens on your configured API server
- No third-party tracking or analytics

## Contributing

1. Fork the repository
2. Make your changes
3. Test with both local and production API
4. Submit a pull request

## License

Same as main PaperWise project.
