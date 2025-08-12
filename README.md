# Salesforce CSV Uploader Chrome Extension

A powerful Chrome extension that enables bulk CSV uploads to Salesforce with intelligent field mapping, field creation, and comprehensive error handling using the Salesforce Bulk API.

## Features

- 🔐 **OAuth 2.0 Authentication** - Secure connection to Salesforce
- 📊 **CSV Processing** - Parse and validate CSV files with preview
- 🎯 **Intelligent Field Mapping** - Automatically suggest field mappings
- ⚡ **Bulk API Integration** - Handle large datasets efficiently
- 🆕 **Dynamic Field Creation** - Create custom fields on the fly
- 📋 **Object Discovery** - Browse and select from all available Salesforce objects
- 🔍 **Validation & Error Handling** - Comprehensive validation and detailed error reporting
- 📈 **Progress Tracking** - Real-time upload progress and results

## Prerequisites

1. **Salesforce Connected App**
   - You need to create a Connected App in your Salesforce org
   - Enable OAuth settings with appropriate scopes

2. **Chrome Browser**
   - Chrome browser with developer mode enabled

## Setup Instructions

### 1. Create Salesforce Connected App

1. Log into your Salesforce org
2. Go to **Setup** → **App Manager**
3. Click **New Connected App**
4. Fill in the basic information:
   - **Connected App Name**: Salesforce CSV Uploader
   - **API Name**: Salesforce_CSV_Uploader
   - **Contact Email**: Your email

5. Enable OAuth Settings:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `chrome-extension://[EXTENSION_ID]/oauth/callback`
     - Replace `[EXTENSION_ID]` with your actual extension ID after installation
   - **Selected OAuth Scopes**:
     - Access and manage your data (api)
     - Perform requests on your behalf at any time (refresh_token, offline_access)
     - Access all data (full)

6. Save the Connected App
7. Copy the **Consumer Key** (Client ID) for later use

### 2. Install the Extension

#### Option A: Developer Mode (Recommended for testing)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the extension folder
6. Note the **Extension ID** from the loaded extension

#### Option B: Package and Install

1. Package the extension as a .crx file
2. Install through Chrome Web Store or enterprise deployment

### 3. Configure the Extension

1. Open `manifest.json`
2. Replace `YOUR_SALESFORCE_CONNECTED_APP_CLIENT_ID` with your actual Client ID
3. Update the callback URL in your Connected App settings to use the real extension ID

### 4. Update Salesforce Settings

1. Go back to your Connected App in Salesforce
2. Edit the OAuth settings
3. Update the **Callback URL** to: `chrome-extension://[YOUR_ACTUAL_EXTENSION_ID]/oauth/callback`
4. Save the changes

### 5. Test the Extension

1. Click the extension icon in Chrome
2. Click **Connect to Salesforce**
3. Complete the OAuth flow
4. Test with a sample CSV file

## Usage

### Basic Workflow

1. **Connect to Salesforce**
   - Click the extension icon
   - Click "Connect to Salesforce"
   - Complete OAuth authentication

2. **Upload CSV File**
   - Select a CSV file from your computer
   - Review file information and headers

3. **Select Salesforce Object**
   - Choose the target Salesforce object (e.g., Contact, Account, Custom Object)

4. **Map Fields**
   - Review automatic field mapping suggestions
   - Manually adjust mappings as needed
   - Create new custom fields if required

5. **Upload Data**
   - Click "Upload to Salesforce"
   - Monitor progress and review results

### Advanced Features

#### Automatic Field Mapping
The extension intelligently suggests field mappings based on:
- Exact field name matches
- Label similarity
- Common field patterns (email, phone, address, etc.)
- Data type analysis

#### Field Creation
- Automatically detect unmapped CSV columns
- Suggest appropriate field types based on data
- Create custom fields with proper naming conventions
- Set appropriate field lengths and properties

#### Data Validation
- Validate required field mappings
- Check for duplicate mappings
- Analyze data types and formats
- Provide detailed error messages

#### Bulk API Benefits
- Handle large datasets (thousands of records)
- Asynchronous processing
- Detailed success/failure reporting
- Resume capability for large uploads

## File Structure

```
salesforce-csv-uploader/
├── manifest.json           # Extension manifest
├── popup.html             # Main UI
├── popup.js               # Main application logic
├── auth.js                # Authentication service
├── salesforce-api.js      # Salesforce API wrapper
├── csv-processor.js       # CSV processing and mapping
├── background.js          # Service worker
├── content.js             # Content script for Salesforce pages
└── README.md              # This file
```

## Configuration Options

### OAuth Settings
Update in `auth.js`:
```javascript
this.clientId = 'YOUR_SALESFORCE_CONNECTED_APP_CLIENT_ID';
this.loginUrl = 'https://login.salesforce.com'; // or https://test.salesforce.com for sandbox
```

### API Version
Update in `salesforce-api.js`:
```javascript
this.apiVersion = 'v58.0'; // Use latest API version
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify Connected App Client ID is correct
   - Check callback URL matches extension ID
   - Ensure OAuth scopes are properly configured

2. **Field Mapping Issues**
   - Check field permissions for your user
   - Verify object is accessible and createable
   - Review field-level security settings

3. **Upload Failures**
   - Check bulk API limits
   - Verify data format and required fields
   - Review Salesforce field validation rules

4. **Extension Not Loading**
   - Check for JavaScript errors in Chrome DevTools
   - Verify all files are present
   - Ensure manifest.json is valid

### Debug Mode

Enable console logging by adding to any file:
```javascript
console.log('Debug information:', data);
```

View logs in:
- Chrome DevTools → Console (for popup)
- Chrome Extensions page → Inspect views (for background script)

## Security Considerations

- OAuth tokens are stored securely in Chrome's local storage
- Tokens are automatically refreshed when expired
- No sensitive data is transmitted to external servers
- All communication is directly with Salesforce APIs

## Limitations

- Maximum file size depends on Chrome's memory limits
- Bulk API has daily limits (check your Salesforce edition)
- Some field types may require manual configuration
- Complex validation rules may cause upload failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Salesforce API documentation
3. Create an issue in the repository
4. Contact your Salesforce administrator for org-specific issues