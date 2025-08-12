// Salesforce Authentication Service
class SalesforceAuth {
  constructor() {
    this.clientId = 'YOUR_SALESFORCE_CONNECTED_APP_CLIENT_ID';
    this.redirectUri = chrome.identity.getRedirectURL();
    this.loginUrl = 'https://login.salesforce.com';
  }

  // Get stored access token
  async getAccessToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sf_access_token', 'sf_instance_url', 'sf_token_expires'], (result) => {
        if (result.sf_access_token && result.sf_token_expires && Date.now() < result.sf_token_expires) {
          resolve({
            accessToken: result.sf_access_token,
            instanceUrl: result.sf_instance_url
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // Perform OAuth authentication
  async authenticate() {
    try {
      const authUrl = this.buildAuthUrl();
      
      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, async (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!responseUrl) {
            reject(new Error('Authentication was cancelled'));
            return;
          }

          try {
            const authCode = this.extractAuthCode(responseUrl);
            const tokenData = await this.exchangeCodeForToken(authCode);
            await this.storeTokenData(tokenData);
            resolve(tokenData);
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  buildAuthUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'api refresh_token full',
      prompt: 'consent'
    });

    return `${this.loginUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  extractAuthCode(responseUrl) {
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    
    if (!code) {
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');
      throw new Error(errorDescription || error || 'Failed to get authorization code');
    }
    
    return code;
  }

  async exchangeCodeForToken(authCode) {
    const tokenUrl = `${this.loginUrl}/services/oauth2/token`;
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code: authCode
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `Token exchange failed: ${response.status}`);
    }

    const tokenData = await response.json();
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      instanceUrl: tokenData.instance_url,
      expiresIn: tokenData.expires_in || 3600
    };
  }

  async storeTokenData(tokenData) {
    const expirationTime = Date.now() + (tokenData.expiresIn * 1000);
    
    return new Promise((resolve) => {
      chrome.storage.local.set({
        sf_access_token: tokenData.accessToken,
        sf_refresh_token: tokenData.refreshToken,
        sf_instance_url: tokenData.instanceUrl,
        sf_token_expires: expirationTime
      }, resolve);
    });
  }

  async refreshAccessToken() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['sf_refresh_token'], async (result) => {
        if (!result.sf_refresh_token) {
          reject(new Error('No refresh token available'));
          return;
        }

        try {
          const tokenUrl = `${this.loginUrl}/services/oauth2/token`;
          
          const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.clientId,
            refresh_token: result.sf_refresh_token
          });

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
          });

          if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.status}`);
          }

          const tokenData = await response.json();
          await this.storeTokenData({
            accessToken: tokenData.access_token,
            refreshToken: result.sf_refresh_token, // Keep existing refresh token
            instanceUrl: tokenData.instance_url,
            expiresIn: tokenData.expires_in || 3600
          });

          resolve({
            accessToken: tokenData.access_token,
            instanceUrl: tokenData.instance_url
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async logout() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([
        'sf_access_token',
        'sf_refresh_token',
        'sf_instance_url',
        'sf_token_expires'
      ], resolve);
    });
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SalesforceAuth;
} else {
  window.SalesforceAuth = SalesforceAuth;
}