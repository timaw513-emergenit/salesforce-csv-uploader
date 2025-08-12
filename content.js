// Content script for Salesforce CSV Uploader Chrome Extension
// This script runs on Salesforce pages to provide additional functionality

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.salesforceCSVUploaderInjected) {
    return;
  }
  window.salesforceCSVUploaderInjected = true;
  
  console.log('Salesforce CSV Uploader content script loaded');
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ping') {
      sendResponse({ status: 'ready' });
      return;
    }
    
    if (request.type === 'get_page_info') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        isSalesforce: isSalesforcePage()
      });
      return;
    }
    
    if (request.type === 'show_upload_button') {
      showFloatingUploadButton();
      sendResponse({ success: true });
      return;
    }
    
    if (request.type === 'hide_upload_button') {
      hideFloatingUploadButton();
      sendResponse({ success: true });
      return;
    }
  });
  
  // Check if this is a Salesforce page
  function isSalesforcePage() {
    return window.location.hostname.includes('salesforce.com') || 
           window.location.hostname.includes('force.com') ||
           document.querySelector('meta[name="salesforce-community"]') !== null ||
           document.querySelector('.slds-scope') !== null;
  }
  
  // Create and show floating upload button
  function showFloatingUploadButton() {
    // Remove existing button if present
    hideFloatingUploadButton();
    
    const button = document.createElement('div');
    button.id = 'sf-csv-uploader-button';
    button.innerHTML = `
      <div class="sf-csv-btn-container">
        <button class="sf-csv-btn" title="Open CSV Uploader">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          CSV Upload
        </button>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #sf-csv-uploader-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .sf-csv-btn-container {
        background: linear-gradient(135deg, #1976d2, #1565c0);
        border-radius: 25px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.3s ease;
      }
      
      .sf-csv-btn-container:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
      }
      
      .sf-csv-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      
      .sf-csv-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .sf-csv-btn:active {
        transform: scale(0.98);
      }
      
      .sf-csv-btn svg {
        width: 18px;
        height: 18px;
      }
      
      @media (max-width: 768px) {
        #sf-csv-uploader-button {
          bottom: 10px;
          right: 10px;
        }
        
        .sf-csv-btn {
          padding: 10px 16px;
          font-size: 13px;
        }
        
        .sf-csv-btn svg {
          width: 16px;
          height: 16px;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(button);
    
    // Add click handler
    button.addEventListener('click', () => {
      // Open the extension popup
      chrome.runtime.sendMessage({ type: 'open_popup' });
    });
    
    // Animation on load
    setTimeout(() => {
      button.style.animation = 'slideInUp 0.5s ease-out';
    }, 100);
  }
  
  // Hide floating upload button
  function hideFloatingUploadButton() {
    const existingButton = document.getElementById('sf-csv-uploader-button');
    if (existingButton) {
      existingButton.remove();
    }
  }
  
  // Check if we're on a relevant Salesforce page and show button
  function checkAndShowButton() {
    if (isSalesforcePage()) {
      // Show button on list views, object pages, etc.
      const isRelevantPage = 
        window.location.pathname.includes('/lightning/o/') || // Object home
        window.location.pathname.includes('/lightning/r/') || // Record pages
        window.location.pathname.includes('/setup/') ||       // Setup pages
        document.querySelector('[data-aura-class*="forceListView"]') || // List views
        document.querySelector('.slds-page-header'); // Any page with SLDS header
      
      if (isRelevantPage) {
        showFloatingUploadButton();
      }
    }
  }
  
  // Utility function to extract Salesforce org information
  function getSalesforceOrgInfo() {
    try {
      // Try to get org info from various sources
      let orgInfo = {};
      
      // From global variables if available
      if (window.$A && window.$A.get) {
        try {
          orgInfo.orgId = window.$A.get('$Global.organization.id');
          orgInfo.userId = window.$A.get('$Global.user.id');
          orgInfo.apiVersion = window.$A.get('$Global.apiVersion');
        } catch (e) {
          console.log('Could not get org info from $A.get');
        }
      }
      
      // From meta tags
      const orgIdMeta = document.querySelector('meta[name="salesforce-org-id"]');
      if (orgIdMeta) {
        orgInfo.orgId = orgIdMeta.content;
      }
      
      // From URL
      const urlMatch = window.location.hostname.match(/([a-zA-Z0-9-]+)\.(?:my\.)?salesforce\.com/);
      if (urlMatch) {
        orgInfo.instance = urlMatch[1];
      }
      
      return orgInfo;
    } catch (error) {
      console.warn('Error getting Salesforce org info:', error);
      return {};
    }
  }
  
  // Function to detect current Salesforce object
  function getCurrentSalesforceObject() {
    try {
      // From URL pattern matching
      const urlPatterns = [
        /\/lightning\/o\/([^\/]+)/, // Object home: /lightning/o/Account/
        /\/lightning\/r\/([^\/]+)/, // Record page: /lightning/r/Account/003.../view
        /\/setup\/ObjectManager\/([^\/]+)/ // Setup object manager
      ];
      
      for (const pattern of urlPatterns) {
        const match = window.location.pathname.match(pattern);
        if (match) {
          return match[1];
        }
      }
      
      // From page elements
      const pageHeader = document.querySelector('.slds-page-header__title, .slds-page-header__object-switcher');
      if (pageHeader) {
        const text = pageHeader.textContent.trim();
        if (text && text !== 'Home') {
          return text;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Error detecting current Salesforce object:', error);
      return null;
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowButton);
  } else {
    checkAndShowButton();
  }
  
  // Handle navigation in single-page applications
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(checkAndShowButton, 1000); // Delay to let page load
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Expose utility functions for the extension
  window.salesforceCSVUploader = {
    getOrgInfo: getSalesforceOrgInfo,
    getCurrentObject: getCurrentSalesforceObject,
    showButton: showFloatingUploadButton,
    hideButton: hideFloatingUploadButton
  };
  
})();