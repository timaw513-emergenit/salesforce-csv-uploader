# Installation Guide

## Quick Start

1. **Download the Extension**
   ```bash
   git clone https://github.com/timaw513-emergenit/salesforce-csv-uploader.git
   cd salesforce-csv-uploader
   ```

2. **Create Salesforce Connected App**
   - Log into Salesforce Setup
   - Go to App Manager → New Connected App
   - Enable OAuth with callback URL: `chrome-extension://[EXTENSION_ID]/oauth/callback`
   - Note the Consumer Key (Client ID)

3. **Configure Extension**
   - Update `manifest.json` with your Client ID
   - Update `auth.js` with your Client ID

4. **Install in Chrome**
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the extension folder

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Main user interface
- `popup.js` - Main application logic
- `auth.js` - Authentication service
- `auth.html` - OAuth callback page
- `salesforce-api.js` - Salesforce API wrapper
- `csv-processor.js` - CSV processing and field mapping
- `background.js` - Service worker for Chrome extension
- `content.js` - Script injected into Salesforce pages

## Features

✅ OAuth 2.0 authentication
✅ CSV file parsing and validation
✅ Intelligent field mapping
✅ Bulk API integration
✅ Progress tracking
✅ Error handling
✅ Floating action button on Salesforce pages

Ready to use!