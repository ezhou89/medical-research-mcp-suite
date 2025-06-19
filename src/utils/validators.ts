// src/utils/validators.ts

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export class Validator {
  static validate<T>(data: any, rules: ValidationRule<T>[]): ValidationResult {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = data[rule.field];
      const fieldName = String(rule.field);

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldName} is required`);
        continue;
      }

      // Skip validation if field is not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type) {
        if (!this.validateType(value, rule.type)) {
          errors.push(`${fieldName} must be of type ${rule.type}`);
          continue;
        }
      }

      // String validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${fieldName} must be no more than ${rule.maxLength} characters long`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${fieldName} format is invalid`);
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${fieldName} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${fieldName} must be no more than ${rule.max}`);
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${fieldName} must be one of: ${rule.enum.join(', ')}`);
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push(typeof customResult === 'string' ? customResult : `${fieldName} is invalid`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

// Predefined validation rules for common use cases
export const CommonValidators = {
  nctId: (value: string) => {
    const nctPattern = /^NCT\d{8}$/;
    return nctPattern.test(value) || 'NCT ID must be in format NCT########';
  },

  pmid: (value: string) => {
    const pmidPattern = /^\d+$/;
    return pmidPattern.test(value) || 'PMID must be a numeric string';
  },

  drugName: (value: string) => {
    if (!value || value.trim().length === 0) {
      return 'Drug name cannot be empty';
    }
    if (value.length > 200) {
      return 'Drug name too long';
    }
    // Basic sanitation check
    const dangerousPattern = /<script|javascript:|data:/i;
    return !dangerousPattern.test(value) || 'Drug name contains invalid characters';
  },

  dateRange: (dateRange: { from?: string; to?: string }) => {
    if (!dateRange || typeof dateRange !== 'object') {
      return 'Date range must be an object';
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    
    if (dateRange.from && !datePattern.test(dateRange.from)) {
      return 'From date must be in YYYY-MM-DD format';
    }
    
    if (dateRange.to && !datePattern.test(dateRange.to)) {
      return 'To date must be in YYYY-MM-DD format';
    }

    if (dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      
      if (fromDate > toDate) {
        return 'From date must be before to date';
      }
    }

    return true;
  },

  pageSize: (value: number) => {
    if (value < 1) return 'Page size must be at least 1';
    if (value > 1000) return 'Page size cannot exceed 1000';
    return true;
  },

  analysisDepth: (value: string) => {
    const validDepths = ['basic', 'detailed', 'comprehensive'];
    return validDepths.includes(value) || `Analysis depth must be one of: ${validDepths.join(', ')}`;
  },

  timeframe: (value: string) => {
    const validTimeframes = ['1year', '2years', '5years', 'all'];
    return validTimeframes.includes(value) || `Timeframe must be one of: ${validTimeframes.join(', ')}`;
  },

  email: (value: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value) || 'Invalid email format';
  },

  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return 'Invalid URL format';
    }
  },
};

// Validation rule sets for different API endpoints
export const ValidationRules = {
  clinicalTrialsSearch: [
    { field: 'condition' as const, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'intervention' as const, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'pageSize' as const, type: 'number' as const, custom: CommonValidators.pageSize },
    { field: 'phase' as const, type: 'array' as const },
    { field: 'status' as const, type: 'array' as const },
  ],

  clinicalTrialsStudy: [
    { field: 'nctId' as const, required: true, type: 'string' as const, custom: CommonValidators.nctId },
  ],

  pubmedSearch: [
    { field: 'query' as const, required: true, type: 'string' as const, minLength: 1, maxLength: 500 },
    { field: 'maxResults' as const, type: 'number' as const, custom: CommonValidators.pageSize },
    { field: 'dateRange' as const, type: 'object' as const, custom: CommonValidators.dateRange },
  ],

  fdaDrugSearch: [
    { field: 'drugName' as const, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'activeIngredient' as const, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'limit' as const, type: 'number' as const, custom: CommonValidators.pageSize },
  ],

  fdaAdverseEvents: [
    { field: 'drugName' as const, required: true, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'dateRange' as const, type: 'object' as const, custom: CommonValidators.dateRange },
    { field: 'limit' as const, type: 'number' as const, custom: CommonValidators.pageSize },
  ],

  comprehensiveAnalysis: [
    { field: 'drugName' as const, required: true, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'condition' as const, required: true, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'analysisDepth' as const, type: 'string' as const, custom: CommonValidators.analysisDepth },
  ],

  drugSafetyProfile: [
    { field: 'drugName' as const, required: true, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'timeframe' as const, type: 'string' as const, custom: CommonValidators.timeframe },
    { field: 'includeTrials' as const, type: 'boolean' as const },
    { field: 'includeFDA' as const, type: 'boolean' as const },
  ],

  competitiveLandscape: [
    { field: 'targetCondition' as const, required: true, type: 'string' as const, custom: CommonValidators.drugName },
    { field: 'competitorDrugs' as const, type: 'array' as const },
    { field: 'includeGlobal' as const, type: 'boolean' as const },
  ],
};

// Sanitization functions
export const Sanitizer = {
  cleanString: (input: string): string => {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  },

  cleanArray: (input: any[]): any[] => {
    if (!Array.isArray(input)) return [];
    
    return input
      .filter(item => item !== null && item !== undefined)
      .map(item => typeof item === 'string' ? Sanitizer.cleanString(item) : item)
      .slice(0, 100); // Limit array size
  },

  cleanObject: (input: any): any => {
    if (typeof input !== 'object' || input === null) return {};
    
    const cleaned: any = {};
    const allowedKeys = 50; // Limit object size
    let keyCount = 0;
    
    for (const [key, value] of Object.entries(input)) {
      if (keyCount >= allowedKeys) break;
      
      const cleanKey = Sanitizer.cleanString(key);
      if (cleanKey.length > 0) {
        if (typeof value === 'string') {
          cleaned[cleanKey] = Sanitizer.cleanString(value);
        } else if (Array.isArray(value)) {
          cleaned[cleanKey] = Sanitizer.cleanArray(value);
        } else if (typeof value === 'object' && value !== null) {
          cleaned[cleanKey] = Sanitizer.cleanObject(value);
        } else {
          cleaned[cleanKey] = value;
        }
        keyCount++;
      }
    }
    
    return cleaned;
  },
};

export default Validator;
