// Salesforce API Service
class SalesforceAPI {
  constructor(accessToken, instanceUrl) {
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
    this.apiVersion = 'v58.0';
  }

  // Generic API request method
  async makeRequest(endpoint, options = {}) {
    const url = `${this.instanceUrl}/services/data/${this.apiVersion}${endpoint}`;
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    const config = {
      method: 'GET',
      headers: { ...defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Get all accessible objects
  async getObjects() {
    try {
      const response = await this.makeRequest('/sobjects/');
      return response.sobjects.filter(obj => 
        obj.createable && obj.queryable && !obj.name.endsWith('__History')
      );
    } catch (error) {
      throw new Error(`Failed to fetch objects: ${error.message}`);
    }
  }

  // Get object metadata including fields
  async getObjectMetadata(objectName) {
    try {
      const response = await this.makeRequest(`/sobjects/${objectName}/describe/`);
      return {
        name: response.name,
        label: response.label,
        fields: response.fields.map(field => ({
          name: field.name,
          label: field.label,
          type: field.type,
          required: !field.nillable && !field.defaultedOnCreate,
          createable: field.createable,
          updateable: field.updateable,
          length: field.length,
          picklistValues: field.picklistValues || []
        }))
      };
    } catch (error) {
      throw new Error(`Failed to fetch object metadata: ${error.message}`);
    }
  }

  // Create a new custom field
  async createCustomField(objectName, fieldDefinition) {
    const endpoint = `/tooling/sobjects/CustomField/`;
    
    const fieldData = {
      DeveloperName: fieldDefinition.developerName,
      Label: fieldDefinition.label,
      TableEnumOrId: objectName,
      Type: fieldDefinition.type,
      Length: fieldDefinition.length,
      Required: fieldDefinition.required || false
    };

    // Add type-specific properties
    if (fieldDefinition.type === 'Picklist') {
      fieldData.Metadata = {
        values: fieldDefinition.picklistValues.map(value => ({
          fullName: value,
          default: false,
          label: value
        }))
      };
    }

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(fieldData)
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to create custom field: ${error.message}`);
    }
  }

  // Bulk API methods
  async createBulkJob(objectName, operation = 'insert') {
    const bulkUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest`;
    
    const jobData = {
      object: objectName,
      operation: operation,
      contentType: 'CSV',
      lineEnding: 'LF'
    };

    try {
      const response = await fetch(bulkUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create bulk job: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Bulk job creation failed: ${error.message}`);
    }
  }

  async uploadBulkData(jobId, csvData) {
    const uploadUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/batches`;
    
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'text/csv'
        },
        body: csvData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload data: ${response.status}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Data upload failed: ${error.message}`);
    }
  }

  async closeBulkJob(jobId) {
    const closeUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;
    
    try {
      const response = await fetch(closeUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: 'UploadComplete' })
      });

      if (!response.ok) {
        throw new Error(`Failed to close job: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Job closure failed: ${error.message}`);
    }
  }

  async getBulkJobStatus(jobId) {
    try {
      const response = await this.makeRequest(`/jobs/ingest/${jobId}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to get job status: ${error.message}`);
    }
  }

  async getBulkJobResults(jobId) {
    const resultsUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/successfulResults`;
    const failuresUrl = `${this.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/failedResults`;
    
    try {
      const [successResponse, failureResponse] = await Promise.all([
        fetch(resultsUrl, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }),
        fetch(failuresUrl, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        })
      ]);

      const successData = successResponse.ok ? await successResponse.text() : '';
      const failureData = failureResponse.ok ? await failureResponse.text() : '';

      return {
        successful: successData,
        failed: failureData
      };
    } catch (error) {
      throw new Error(`Failed to get job results: ${error.message}`);
    }
  }

  // Complete bulk upload process
  async performBulkUpload(objectName, csvData, operation = 'insert') {
    try {
      // Create bulk job
      const job = await this.createBulkJob(objectName, operation);
      console.log('Bulk job created:', job.id);

      // Upload data
      await this.uploadBulkData(job.id, csvData);
      console.log('Data uploaded to job:', job.id);

      // Close job
      await this.closeBulkJob(job.id);
      console.log('Job closed:', job.id);

      // Monitor job status
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 30;

      do {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        jobStatus = await this.getBulkJobStatus(job.id);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error('Job monitoring timeout');
        }
      } while (jobStatus.state === 'InProgress' || jobStatus.state === 'JobInProgress');

      // Get results
      const results = await this.getBulkJobResults(job.id);
      
      return {
        jobId: job.id,
        status: jobStatus,
        results: results,
        recordsProcessed: jobStatus.numberRecordsProcessed,
        recordsFailed: jobStatus.numberRecordsFailed
      };
    } catch (error) {
      throw new Error(`Bulk upload failed: ${error.message}`);
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SalesforceAPI;
} else {
  window.SalesforceAPI = SalesforceAPI;
}