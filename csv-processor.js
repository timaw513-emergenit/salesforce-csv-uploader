// CSV Processing and Field Mapping
class CSVProcessor {
  constructor() {
    this.csvData = null;
    this.headers = [];
    this.rowCount = 0;
    this.mappings = {};
  }

  // Parse CSV file
  parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const parsed = this.parseCSVText(csvText);
          
          this.csvData = parsed.data;
          this.headers = parsed.headers;
          this.rowCount = parsed.data.length;
          
          resolve({
            headers: this.headers,
            rowCount: this.rowCount,
            preview: parsed.data.slice(0, 5) // First 5 rows for preview
          });
        } catch (error) {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('File reading failed'));
      };
      
      reader.readAsText(file);
    });
  }

  parseCSVText(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const row = this.parseCSVLine(lines[i]);
        const rowObject = {};
        
        headers.forEach((header, index) => {
          rowObject[header] = row[index] || '';
        });
        
        data.push(rowObject);
      }
    }

    return { headers, data };
  }

  parseCSVLine(line) {
    const result = [];
    let inQuotes = false;
    let currentField = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field delimiter
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    result.push(currentField.trim());
    return result;
  }

  // Generate field mapping suggestions
  generateMappingSuggestions(csvHeaders, salesforceFields) {
    const suggestions = {};
    
    csvHeaders.forEach(csvHeader => {
      const normalizedCsvHeader = this.normalizeFieldName(csvHeader);
      let bestMatch = null;
      let bestScore = 0;
      
      salesforceFields.forEach(sfField => {
        const score = this.calculateFieldMatchScore(normalizedCsvHeader, sfField);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = sfField;
        }
      });
      
      // Only suggest if confidence is high enough
      if (bestScore > 0.6) {
        suggestions[csvHeader] = bestMatch.name;
      }
    });
    
    return suggestions;
  }

  normalizeFieldName(fieldName) {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/id$/, '');
  }

  calculateFieldMatchScore(csvField, sfField) {
    const csvNormalized = this.normalizeFieldName(csvField);
    const sfNormalized = this.normalizeFieldName(sfField.name);
    const sfLabelNormalized = this.normalizeFieldName(sfField.label);
    
    // Exact match
    if (csvNormalized === sfNormalized || csvNormalized === sfLabelNormalized) {
      return 1.0;
    }
    
    // Partial matches
    let score = 0;
    
    // Check if one contains the other
    if (csvNormalized.includes(sfNormalized) || sfNormalized.includes(csvNormalized)) {
      score = Math.max(score, 0.8);
    }
    
    if (csvNormalized.includes(sfLabelNormalized) || sfLabelNormalized.includes(csvNormalized)) {
      score = Math.max(score, 0.7);
    }
    
    // Common field mappings
    const commonMappings = {
      'firstname': ['firstname', 'fname', 'givenname'],
      'lastname': ['lastname', 'lname', 'surname', 'familyname'],
      'email': ['email', 'emailaddress', 'mail'],
      'phone': ['phone', 'phonenumber', 'telephone', 'mobile'],
      'company': ['company', 'companyname', 'organization', 'account'],
      'title': ['title', 'jobtitle', 'position'],
      'street': ['street', 'address', 'address1', 'streetaddress'],
      'city': ['city', 'town'],
      'state': ['state', 'province', 'region'],
      'postalcode': ['zip', 'zipcode', 'postalcode', 'postcode'],
      'country': ['country', 'nation']
    };
    
    for (const [sfPattern, csvPatterns] of Object.entries(commonMappings)) {
      if (sfNormalized.includes(sfPattern)) {
        for (const csvPattern of csvPatterns) {
          if (csvNormalized.includes(csvPattern)) {
            score = Math.max(score, 0.9);
            break;
          }
        }
      }
    }
    
    return score;
  }

  // Set field mapping
  setMapping(csvField, salesforceField) {
    this.mappings[csvField] = salesforceField;
  }

  // Get current mappings
  getMappings() {
    return { ...this.mappings };
  }

  // Validate mappings
  validateMappings(salesforceFields) {
    const errors = [];
    const requiredFields = salesforceFields.filter(field => field.required);
    const mappedSfFields = Object.values(this.mappings);
    
    // Check for required fields
    requiredFields.forEach(field => {
      if (!mappedSfFields.includes(field.name)) {
        errors.push(`Required field '${field.label}' is not mapped`);
      }
    });
    
    // Check for duplicate mappings
    const duplicates = mappedSfFields.filter((field, index) => 
      mappedSfFields.indexOf(field) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate mappings found for: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    return errors;
  }

  // Generate CSV for upload based on mappings
  generateMappedCSV() {
    if (!this.csvData || Object.keys(this.mappings).length === 0) {
      throw new Error('No data or mappings available');
    }
    
    const mappedHeaders = Object.values(this.mappings);
    const csvLines = [mappedHeaders.join(',')];
    
    this.csvData.forEach(row => {
      const mappedRow = [];
      
      Object.entries(this.mappings).forEach(([csvField, sfField]) => {
        let value = row[csvField] || '';
        
        // Clean and format the value
        value = this.formatValue(value);
        
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        mappedRow.push(value);
      });
      
      csvLines.push(mappedRow.join(','));
    });
    
    return csvLines.join('\n');
  }

  formatValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    // Trim whitespace
    value = value.trim();
    
    // Handle common data formatting
    // Email validation and normalization
    if (value.includes('@')) {
      value = value.toLowerCase();
    }
    
    // Phone number normalization (basic)
    if (/^[\d\s\-\(\)\.+]+$/.test(value) && value.length >= 10) {
      value = value.replace(/[^\d+]/g, '');
    }
    
    // Boolean conversion
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
      const booleanMap = {
        'true': 'true',
        'yes': 'true',
        '1': 'true',
        'false': 'false',
        'no': 'false',
        '0': 'false'
      };
      value = booleanMap[value.toLowerCase()];
    }
    
    return value;
  }

  // Suggest new fields that need to be created
  suggestNewFields(csvHeaders, salesforceFields) {
    const existingFieldNames = salesforceFields.map(f => f.name.toLowerCase());
    const unmappedHeaders = csvHeaders.filter(header => 
      !Object.keys(this.mappings).includes(header)
    );
    
    const suggestions = [];
    
    unmappedHeaders.forEach(header => {
      const suggestion = this.generateFieldSuggestion(header);
      
      // Check if field doesn't already exist
      if (!existingFieldNames.includes(suggestion.developerName.toLowerCase())) {
        suggestions.push(suggestion);
      }
    });
    
    return suggestions;
  }

  generateFieldSuggestion(csvHeader) {
    // Clean the header name for developer name
    let developerName = csvHeader
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(developerName)) {
      developerName = 'X' + developerName;
    }
    
    // Add __c suffix for custom fields
    if (!developerName.endsWith('__c')) {
      developerName += '__c';
    }
    
    // Generate label (more user-friendly)
    const label = csvHeader
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    // Determine field type based on sample data
    const fieldType = this.determineFieldType(csvHeader);
    
    return {
      csvHeader: csvHeader,
      developerName: developerName,
      label: label,
      type: fieldType.type,
      length: fieldType.length,
      required: false
    };
  }

  determineFieldType(csvHeader) {
    if (!this.csvData || this.csvData.length === 0) {
      return { type: 'Text', length: 255 };
    }
    
    // Sample values from this column
    const sampleValues = this.csvData
      .slice(0, 20) // Check first 20 rows
      .map(row => row[csvHeader])
      .filter(val => val && val.trim() !== '');
    
    if (sampleValues.length === 0) {
      return { type: 'Text', length: 255 };
    }
    
    // Check for email
    if (sampleValues.some(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
      return { type: 'Email', length: null };
    }
    
    // Check for phone
    if (sampleValues.some(val => /^[\d\s\-\(\)\.+]{10,}$/.test(val))) {
      return { type: 'Phone', length: null };
    }
    
    // Check for URL
    if (sampleValues.some(val => /^https?:\/\//.test(val))) {
      return { type: 'Url', length: null };
    }
    
    // Check for boolean
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0'];
    if (sampleValues.every(val => booleanValues.includes(val.toLowerCase()))) {
      return { type: 'Checkbox', length: null };
    }
    
    // Check for number
    if (sampleValues.every(val => !isNaN(val) && !isNaN(parseFloat(val)))) {
      const hasDecimals = sampleValues.some(val => val.includes('.'));
      if (hasDecimals) {
        return { type: 'Number', length: null, precision: 18, scale: 2 };
      } else {
        return { type: 'Number', length: null, precision: 18, scale: 0 };
      }
    }
    
    // Check for date
    if (sampleValues.some(val => !isNaN(Date.parse(val)))) {
      return { type: 'Date', length: null };
    }
    
    // Default to text, determine length based on content
    const maxLength = Math.max(...sampleValues.map(val => val.length));
    let textLength = 255;
    
    if (maxLength > 255) {
      if (maxLength <= 32768) {
        return { type: 'LongTextArea', length: 32768 };
      } else {
        return { type: 'LongTextArea', length: 131072 };
      }
    } else if (maxLength > 80) {
      textLength = 255;
    } else {
      textLength = 80;
    }
    
    return { type: 'Text', length: textLength };
  }

  // Get statistics about the CSV data
  getDataStatistics() {
    if (!this.csvData) {
      return null;
    }
    
    const stats = {
      totalRows: this.rowCount,
      totalColumns: this.headers.length,
      emptyRows: 0,
      columnStats: {}
    };
    
    // Initialize column stats
    this.headers.forEach(header => {
      stats.columnStats[header] = {
        nonEmpty: 0,
        empty: 0,
        unique: new Set(),
        maxLength: 0
      };
    });
    
    // Analyze data
    this.csvData.forEach(row => {
      let isEmpty = true;
      
      this.headers.forEach(header => {
        const value = row[header] || '';
        const trimmedValue = value.trim();
        
        if (trimmedValue) {
          isEmpty = false;
          stats.columnStats[header].nonEmpty++;
          stats.columnStats[header].unique.add(trimmedValue);
          stats.columnStats[header].maxLength = Math.max(
            stats.columnStats[header].maxLength,
            trimmedValue.length
          );
        } else {
          stats.columnStats[header].empty++;
        }
      });
      
      if (isEmpty) {
        stats.emptyRows++;
      }
    });
    
    // Convert Sets to counts for serialization
    Object.keys(stats.columnStats).forEach(header => {
      stats.columnStats[header].uniqueCount = stats.columnStats[header].unique.size;
      delete stats.columnStats[header].unique;
    });
    
    return stats;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVProcessor;
} else {
  window.CSVProcessor = CSVProcessor;
}