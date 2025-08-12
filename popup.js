// Main Extension Logic
class SalesforceCSVUploader {
  constructor() {
    this.auth = new SalesforceAuth();
    this.api = null;
    this.csvProcessor = new CSVProcessor();
    this.isConnected = false;
    this.currentFile = null;
    this.salesforceObjects = [];
    this.selectedObject = null;
    this.objectFields = [];
    
    this.initializeEventListeners();
    this.checkAuthStatus();
  }

  initializeEventListeners() {
    // Authentication
    document.getElementById('connect-btn').addEventListener('click', () => this.authenticate());
    document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());
    
    // File upload
    document.getElementById('csv-file').addEventListener('change', (e) => this.handleFileUpload(e));
    
    // Object selection
    document.getElementById('object-select').addEventListener('change', (e) => this.handleObjectSelection(e));
    
    // Field creation
    document.getElementById('create-fields-btn').addEventListener('click', () => this.createMissingFields());
    
    // Upload
    document.getElementById('upload-btn').addEventListener('click', () => this.uploadData());
  }

  async checkAuthStatus() {
    try {
      const tokenData = await this.auth.getAccessToken();
      if (tokenData) {
        this.api = new SalesforceAPI(tokenData.accessToken, tokenData.instanceUrl);
        this.updateConnectionStatus(true);
        this.loadSalesforceObjects();
      }
    } catch (error) {
      console.log('No valid auth token found');
    }
  }

  async authenticate() {
    try {
      this.showLoading('connect-btn', 'Connecting...');
      
      const tokenData = await this.auth.authenticate();
      this.api = new SalesforceAPI(tokenData.accessToken, tokenData.instanceUrl);
      this.updateConnectionStatus(true);
      
      await this.loadSalesforceObjects();
      this.hideError();
      
    } catch (error) {
      this.showError(`Authentication failed: ${error.message}`);
    } finally {
      this.hideLoading('connect-btn', 'Connect to Salesforce');
    }
  }

  async disconnect() {
    try {
      await this.auth.logout();
      this.api = null;
      this.updateConnectionStatus(false);
      this.resetForm();
    } catch (error) {
      this.showError(`Disconnect failed: ${error.message}`);
    }
  }

  updateConnectionStatus(connected) {
    this.isConnected = connected;
    const statusEl = document.getElementById('status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const stepFile = document.getElementById('step-file');
    
    if (connected) {
      statusEl.textContent = 'Connected to Salesforce';
      statusEl.className = 'status connected';
      connectBtn.classList.add('hidden');
      disconnectBtn.classList.remove('hidden');
      stepFile.classList.remove('disabled');
    } else {
      statusEl.textContent = 'Not Connected to Salesforce';
      statusEl.className = 'status disconnected';
      connectBtn.classList.remove('hidden');
      disconnectBtn.classList.add('hidden');
      stepFile.classList.add('disabled');
    }
  }

  async loadSalesforceObjects() {
    try {
      this.showElementLoading('object-loading');
      
      this.salesforceObjects = await this.api.getObjects();
      this.populateObjectSelect();
      
    } catch (error) {
      this.showError(`Failed to load objects: ${error.message}`);
    } finally {
      this.hideElementLoading('object-loading');
    }
  }

  populateObjectSelect() {
    const select = document.getElementById('object-select');
    select.innerHTML = '<option value="">Select an object...</option>';
    
    // Sort objects by label
    this.salesforceObjects.sort((a, b) => a.label.localeCompare(b.label));
    
    this.salesforceObjects.forEach(obj => {
      const option = document.createElement('option');
      option.value = obj.name;
      option.textContent = `${obj.label} (${obj.name})`;
      select.appendChild(option);
    });
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showError('Please select a CSV file');
      return;
    }
    
    try {
      this.currentFile = file;
      const parseResult = await this.csvProcessor.parseCSV(file);
      
      this.displayFileInfo(file, parseResult);
      this.enableStep('step-object');
      this.hideError();
      
    } catch (error) {
      this.showError(`File processing failed: ${error.message}`);
    }
  }

  displayFileInfo(file, parseResult) {
    const fileInfoEl = document.getElementById('file-info');
    fileInfoEl.innerHTML = `
      <strong>File:</strong> ${file.name}<br>
      <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
      <strong>Rows:</strong> ${parseResult.rowCount}<br>
      <strong>Columns:</strong> ${parseResult.headers.length}<br>
      <strong>Headers:</strong> ${parseResult.headers.join(', ')}
    `;
    fileInfoEl.classList.remove('hidden');
  }

  async handleObjectSelection(event) {
    const objectName = event.target.value;
    if (!objectName) return;
    
    try {
      this.selectedObject = objectName;
      this.showLoading('object-select', 'Loading fields...');
      
      const metadata = await this.api.getObjectMetadata(objectName);
      this.objectFields = metadata.fields;
      
      this.generateFieldMappings();
      this.enableStep('step-mapping');
      
    } catch (error) {
      this.showError(`Failed to load object fields: ${error.message}`);
    } finally {
      this.hideLoading('object-select');
    }
  }

  generateFieldMappings() {
    const csvHeaders = this.csvProcessor.headers;
    const suggestions = this.csvProcessor.generateMappingSuggestions(csvHeaders, this.objectFields);
    
    // Apply suggestions as default mappings
    Object.entries(suggestions).forEach(([csvField, sfField]) => {
      this.csvProcessor.setMapping(csvField, sfField);
    });
    
    this.renderMappingInterface();
  }

  renderMappingInterface() {
    const container = document.getElementById('mapping-container');
    container.innerHTML = '';
    
    const csvHeaders = this.csvProcessor.headers;
    const currentMappings = this.csvProcessor.getMappings();
    
    csvHeaders.forEach(header => {
      const row = document.createElement('div');
      row.className = 'mapping-row';
      
      const label = document.createElement('label');
      label.textContent = header;
      
      const select = document.createElement('select');
      select.innerHTML = '<option value="">-- Select Field --</option>';
      
      // Add Salesforce fields
      this.objectFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.name;
        option.textContent = `${field.label} (${field.name})`;
        if (field.required) {
          option.textContent += ' *';
        }
        select.appendChild(option);
      });
      
      // Set current mapping
      if (currentMappings[header]) {
        select.value = currentMappings[header];
      }
      
      // Update mapping on change
      select.addEventListener('change', (e) => {
        if (e.target.value) {
          this.csvProcessor.setMapping(header, e.target.value);
        } else {
          delete this.csvProcessor.mappings[header];
        }
        this.updateUploadStep();
      });
      
      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    });
    
    this.updateUploadStep();
  }

  updateUploadStep() {
    const mappings = this.csvProcessor.getMappings();
    const hasValidMappings = Object.keys(mappings).length > 0;
    
    if (hasValidMappings) {
      this.enableStep('step-upload');
      
      // Validate mappings
      const errors = this.csvProcessor.validateMappings(this.objectFields);
      if (errors.length > 0) {
        this.showError('Mapping validation errors:\n' + errors.join('\n'));
      } else {
        this.hideError();
      }
    } else {
      this.disableStep('step-upload');
    }
  }

  async createMissingFields() {
    try {
      const csvHeaders = this.csvProcessor.headers;
      const suggestions = this.csvProcessor.suggestNewFields(csvHeaders, this.objectFields);
      
      if (suggestions.length === 0) {
        alert('No new fields need to be created');
        return;
      }
      
      const confirmed = confirm(`Create ${suggestions.length} new fields?\n\n${suggestions.map(s => s.label).join('\n')}`);
      if (!confirmed) return;
      
      this.showLoading('create-fields-btn', 'Creating fields...');
      
      for (const suggestion of suggestions) {
        try {
          await this.api.createCustomField(this.selectedObject, suggestion);
          console.log(`Created field: ${suggestion.developerName}`);
        } catch (error) {
          console.error(`Failed to create field ${suggestion.developerName}:`, error);
        }
      }
      
      // Reload object metadata
      const metadata = await this.api.getObjectMetadata(this.selectedObject);
      this.objectFields = metadata.fields;
      this.renderMappingInterface();
      
      alert('Fields created successfully! Please refresh your mapping.');
      
    } catch (error) {
      this.showError(`Field creation failed: ${error.message}`);
    } finally {
      this.hideLoading('create-fields-btn', 'Create Missing Fields');
    }
  }

  async uploadData() {
    try {
      const mappings = this.csvProcessor.getMappings();
      const errors = this.csvProcessor.validateMappings(this.objectFields);
      
      if (errors.length > 0) {
        this.showError('Please fix mapping errors before uploading');
        return;
      }
      
      // Show progress
      this.showUploadProgress();
      this.updateProgress(10, 'Preparing data...');
      
      // Generate mapped CSV
      const mappedCSV = this.csvProcessor.generateMappedCSV();
      this.updateProgress(30, 'Starting bulk upload...');
      
      // Perform bulk upload
      const result = await this.api.performBulkUpload(this.selectedObject, mappedCSV, 'insert');
      this.updateProgress(100, 'Upload complete!');
      
      // Show results
      this.displayUploadResults(result);
      
    } catch (error) {
      this.showError(`Upload failed: ${error.message}`);
      this.hideUploadProgress();
    }
  }

  showUploadProgress() {
    document.getElementById('upload-progress').classList.remove('hidden');
    document.getElementById('upload-btn').disabled = true;
  }

  hideUploadProgress() {
    document.getElementById('upload-progress').classList.add('hidden');
    document.getElementById('upload-btn').disabled = false;
  }

  updateProgress(percentage, text) {
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = text;
  }

  displayUploadResults(result) {
    const resultsEl = document.getElementById('upload-results');
    const processedCount = result.recordsProcessed || 0;
    const failedCount = result.recordsFailed || 0;
    const successCount = processedCount - failedCount;
    
    resultsEl.innerHTML = `
      <h4>Upload Results</h4>
      <p><strong>Job ID:</strong> ${result.jobId}</p>
      <p><strong>Records Processed:</strong> ${processedCount}</p>
      <p><strong>Successful:</strong> ${successCount}</p>
      <p><strong>Failed:</strong> ${failedCount}</p>
      <p><strong>Status:</strong> ${result.status.state}</p>
    `;
    
    if (failedCount > 0 && result.results.failed) {
      resultsEl.innerHTML += `
        <h5>Failed Records:</h5>
        <pre style="font-size: 10px; max-height: 100px; overflow: auto;">${result.results.failed}</pre>
      `;
    }
    
    resultsEl.classList.remove('hidden');
    this.hideUploadProgress();
  }

  // Utility methods
  enableStep(stepId) {
    document.getElementById(stepId).classList.remove('disabled');
  }

  disableStep(stepId) {
    document.getElementById(stepId).classList.add('disabled');
  }

  showLoading(elementId, text = 'Loading...') {
    const element = document.getElementById(elementId);
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.textContent = text;
  }

  hideLoading(elementId, originalText = null) {
    const element = document.getElementById(elementId);
    element.disabled = false;
    element.textContent = originalText || element.dataset.originalText || 'Button';
  }

  showElementLoading(elementId) {
    document.getElementById(elementId).classList.remove('hidden');
  }

  hideElementLoading(elementId) {
    document.getElementById(elementId).classList.add('hidden');
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error-message').classList.add('hidden');
  }

  resetForm() {
    // Reset all form elements and state
    document.getElementById('csv-file').value = '';
    document.getElementById('object-select').value = '';
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('mapping-container').innerHTML = '';
    document.getElementById('upload-results').classList.add('hidden');
    
    // Disable steps
    this.disableStep('step-file');
    this.disableStep('step-object');
    this.disableStep('step-mapping');
    this.disableStep('step-upload');
    
    // Reset state
    this.currentFile = null;
    this.selectedObject = null;
    this.objectFields = [];
    this.csvProcessor = new CSVProcessor();
    
    this.hideError();
  }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SalesforceCSVUploader();
});