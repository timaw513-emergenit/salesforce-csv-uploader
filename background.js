// Background service worker for Salesforce CSV Uploader Chrome Extension

// Installation and update handlers
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Salesforce CSV Uploader installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set({
      'sf_settings': {
        apiVersion: 'v58.0',
        batchSize: 200,
        enableLogging: false
      }
    });
  }
});

// Handle OAuth callback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'oauth_callback') {
    // Handle OAuth callback from auth popup
    handleOAuthCallback(request.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === 'get_access_token') {
    // Get stored access token
    getStoredAccessToken()
      .then(token => sendResponse({ success: true, token: token }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (request.type === 'clear_auth') {
    // Clear stored authentication data
    clearAuthData()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (request.type === 'log_event') {
    // Log events for debugging
    console.log('[SF CSV Uploader]', request.event, request.data);
  }
});

// Handle OAuth callback
async function handleOAuthCallback(callbackUrl) {
  try {
    const url = new URL(callbackUrl);
    const urlParams = new URLSearchParams(url.hash.substring(1)); // Remove # and parse
    
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const instanceUrl = urlParams.get('instance_url');
    const error = urlParams.get('error');
    
    if (error) {
      throw new Error(`OAuth error: ${error} - ${urlParams.get('error_description')}`);
    }
    
    if (!accessToken) {
      throw new Error('No access token received from Salesforce');
    }
    
    // Store tokens securely
    const authData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      instanceUrl: instanceUrl,
      expiresAt: Date.now() + (3600 * 1000), // 1 hour from now
      createdAt: Date.now()
    };
    
    await chrome.storage.local.set({ 'sf_auth': authData });
    
    return authData;
  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  }
}

// Get stored access token
async function getStoredAccessToken() {
  try {
    const result = await chrome.storage.local.get(['sf_auth']);
    const authData = result.sf_auth;
    
    if (!authData || !authData.accessToken) {
      throw new Error('No authentication data found');
    }
    
    // Check if token is expired
    if (Date.now() >= authData.expiresAt) {
      // Try to refresh token
      if (authData.refreshToken) {
        return await refreshAccessToken(authData);
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }
    
    return authData;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Refresh access token
async function refreshAccessToken(authData) {
  try {
    const response = await fetch(`${authData.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: authData.refreshToken,
        client_id: 'YOUR_SALESFORCE_CONNECTED_APP_CLIENT_ID' // This should be replaced with actual client ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const tokenData = await response.json();
    
    // Update stored auth data
    const updatedAuthData = {
      ...authData,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (3600 * 1000) // 1 hour from now
    };
    
    await chrome.storage.local.set({ 'sf_auth': updatedAuthData });
    
    return updatedAuthData;
  } catch (error) {
    console.error('Token refresh error:', error);
    // Clear invalid auth data
    await clearAuthData();
    throw new Error('Token refresh failed. Please re-authenticate.');
  }
}

// Clear authentication data
async function clearAuthData() {
  try {
    await chrome.storage.local.remove(['sf_auth']);
    console.log('Authentication data cleared');
  } catch (error) {
    console.error('Error clearing auth data:', error);
    throw error;
  }
}

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is a Salesforce page
    if (tab.url.includes('salesforce.com') || tab.url.includes('force.com')) {
      // Inject content script if not already present
      chrome.tabs.sendMessage(tabId, { type: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not present, inject it
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).catch(error => {
            console.log('Content script injection failed:', error);
          });
        }
      });
    }
  }
});

// Handle storage changes for debugging
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed in', areaName, ':', changes);
});

// Alarm handlers for periodic tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup_auth') {
    // Periodic cleanup of expired auth data
    cleanupExpiredAuth();
  }
});

// Set up periodic cleanup
chrome.alarms.create('cleanup_auth', { periodInMinutes: 60 });

// Cleanup expired authentication data
async function cleanupExpiredAuth() {
  try {
    const result = await chrome.storage.local.get(['sf_auth']);
    const authData = result.sf_auth;
    
    if (authData && Date.now() >= authData.expiresAt + (24 * 60 * 60 * 1000)) {
      // Remove auth data that's more than 24 hours expired
      await clearAuthData();
      console.log('Cleaned up expired authentication data');
    }
  } catch (error) {
    console.error('Error during auth cleanup:', error);
  }
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleOAuthCallback,
    getStoredAccessToken,
    refreshAccessToken,
    clearAuthData
  };
}