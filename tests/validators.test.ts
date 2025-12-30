// tests/validators.test.ts

import { Validator, CommonValidators, Sanitizer, ValidationRules } from '../src/utils/validators';

describe('Validator', () => {
  describe('validate', () => {
    it('should pass validation when all required fields are present', () => {
      const data = { name: 'John', age: 25 };
      const rules = [
        { field: 'name' as const, required: true, type: 'string' as const },
        { field: 'age' as const, required: true, type: 'number' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when required field is missing', () => {
      const data = { age: 25 };
      const rules = [
        { field: 'name' as const, required: true, type: 'string' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name is required');
    });

    it('should fail validation when required field is empty string', () => {
      const data = { name: '' };
      const rules = [
        { field: 'name' as const, required: true, type: 'string' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name is required');
    });

    it('should skip validation for optional empty fields', () => {
      const data = { name: 'John' };
      const rules = [
        { field: 'name' as const, required: true, type: 'string' as const },
        { field: 'age' as const, required: false, type: 'number' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(true);
    });

    it('should validate type correctly for string', () => {
      const data = { name: 123 };
      const rules = [
        { field: 'name' as const, type: 'string' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be of type string');
    });

    it('should validate type correctly for number', () => {
      const data = { age: 'twenty-five' };
      const rules = [
        { field: 'age' as const, type: 'number' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('age must be of type number');
    });

    it('should validate type correctly for boolean', () => {
      const data = { active: 'yes' };
      const rules = [
        { field: 'active' as const, type: 'boolean' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('active must be of type boolean');
    });

    it('should validate type correctly for array', () => {
      const data = { items: 'not-an-array' };
      const rules = [
        { field: 'items' as const, type: 'array' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('items must be of type array');
    });

    it('should validate type correctly for object', () => {
      const data = { config: [] };
      const rules = [
        { field: 'config' as const, type: 'object' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('config must be of type object');
    });

    it('should reject NaN as invalid number', () => {
      const data = { age: NaN };
      const rules = [
        { field: 'age' as const, type: 'number' as const },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('age must be of type number');
    });

    it('should validate string minLength', () => {
      const data = { name: 'ab' };
      const rules = [
        { field: 'name' as const, type: 'string' as const, minLength: 3 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be at least 3 characters long');
    });

    it('should validate string maxLength', () => {
      const data = { name: 'a very long name that exceeds the maximum' };
      const rules = [
        { field: 'name' as const, type: 'string' as const, maxLength: 10 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be no more than 10 characters long');
    });

    it('should validate string pattern', () => {
      const data = { email: 'invalid-email' };
      const rules = [
        { field: 'email' as const, type: 'string' as const, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('email format is invalid');
    });

    it('should validate number min', () => {
      const data = { age: -5 };
      const rules = [
        { field: 'age' as const, type: 'number' as const, min: 0 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('age must be at least 0');
    });

    it('should validate number max', () => {
      const data = { age: 150 };
      const rules = [
        { field: 'age' as const, type: 'number' as const, max: 120 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('age must be no more than 120');
    });

    it('should validate enum values', () => {
      const data = { status: 'invalid' };
      const rules = [
        { field: 'status' as const, enum: ['active', 'pending', 'completed'] },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('status must be one of: active, pending, completed');
    });

    it('should pass enum validation for valid value', () => {
      const data = { status: 'active' };
      const rules = [
        { field: 'status' as const, enum: ['active', 'pending', 'completed'] },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(true);
    });

    it('should handle custom validation returning true', () => {
      const data = { value: 10 };
      const rules = [
        { field: 'value' as const, custom: (v: number) => v > 5 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(true);
    });

    it('should handle custom validation returning false', () => {
      const data = { value: 3 };
      const rules = [
        { field: 'value' as const, custom: (v: number) => v > 5 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('value is invalid');
    });

    it('should handle custom validation returning error message', () => {
      const data = { value: 3 };
      const rules = [
        { field: 'value' as const, custom: (v: number) => v > 5 ? true : 'Value must be greater than 5' },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Value must be greater than 5');
    });

    it('should collect multiple errors', () => {
      const data = { name: '', age: -5 };
      const rules = [
        { field: 'name' as const, required: true },
        { field: 'age' as const, type: 'number' as const, min: 0 },
      ];

      const result = Validator.validate(data, rules);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
});

describe('CommonValidators', () => {
  describe('nctId', () => {
    it('should accept valid NCT ID format', () => {
      expect(CommonValidators.nctId('NCT12345678')).toBe(true);
    });

    it('should reject NCT ID with wrong prefix', () => {
      expect(CommonValidators.nctId('ABC12345678')).toBe('NCT ID must be in format NCT########');
    });

    it('should reject NCT ID with wrong digit count', () => {
      expect(CommonValidators.nctId('NCT1234567')).toBe('NCT ID must be in format NCT########');
      expect(CommonValidators.nctId('NCT123456789')).toBe('NCT ID must be in format NCT########');
    });

    it('should reject NCT ID with lowercase prefix', () => {
      expect(CommonValidators.nctId('nct12345678')).toBe('NCT ID must be in format NCT########');
    });
  });

  describe('pmid', () => {
    it('should accept valid PMID', () => {
      expect(CommonValidators.pmid('12345678')).toBe(true);
    });

    it('should accept PMID with varying length', () => {
      expect(CommonValidators.pmid('1')).toBe(true);
      expect(CommonValidators.pmid('123456789012345')).toBe(true);
    });

    it('should reject PMID with non-numeric characters', () => {
      expect(CommonValidators.pmid('12345abc')).toBe('PMID must be a numeric string');
    });

    it('should reject empty PMID', () => {
      expect(CommonValidators.pmid('')).toBe('PMID must be a numeric string');
    });
  });

  describe('drugName', () => {
    it('should accept valid drug name', () => {
      expect(CommonValidators.drugName('Aspirin')).toBe(true);
    });

    it('should accept drug name with special characters', () => {
      expect(CommonValidators.drugName('Acetylsalicylic Acid (ASA)')).toBe(true);
    });

    it('should reject empty drug name', () => {
      expect(CommonValidators.drugName('')).toBe('Drug name cannot be empty');
    });

    it('should reject whitespace-only drug name', () => {
      expect(CommonValidators.drugName('   ')).toBe('Drug name cannot be empty');
    });

    it('should reject drug name that is too long', () => {
      const longName = 'a'.repeat(201);
      expect(CommonValidators.drugName(longName)).toBe('Drug name too long');
    });

    it('should reject drug name with script tags', () => {
      expect(CommonValidators.drugName('<script>alert("xss")</script>')).toBe('Drug name contains invalid characters');
    });

    it('should reject drug name with javascript protocol', () => {
      expect(CommonValidators.drugName('javascript:alert(1)')).toBe('Drug name contains invalid characters');
    });

    it('should reject drug name with data protocol', () => {
      expect(CommonValidators.drugName('data:text/html,<script>alert(1)</script>')).toBe('Drug name contains invalid characters');
    });
  });

  describe('dateRange', () => {
    it('should accept valid date range', () => {
      const range = { from: '2020-01-01', to: '2023-12-31' };
      expect(CommonValidators.dateRange(range)).toBe(true);
    });

    it('should accept date range with only from date', () => {
      const range = { from: '2020-01-01' };
      expect(CommonValidators.dateRange(range)).toBe(true);
    });

    it('should accept date range with only to date', () => {
      const range = { to: '2023-12-31' };
      expect(CommonValidators.dateRange(range)).toBe(true);
    });

    it('should accept empty date range object', () => {
      const range = {};
      expect(CommonValidators.dateRange(range)).toBe(true);
    });

    it('should reject non-object date range', () => {
      expect(CommonValidators.dateRange(null as any)).toBe('Date range must be an object');
      expect(CommonValidators.dateRange('2020-01-01' as any)).toBe('Date range must be an object');
    });

    it('should reject invalid from date format', () => {
      const range = { from: '01-01-2020' };
      expect(CommonValidators.dateRange(range)).toBe('From date must be in YYYY-MM-DD format');
    });

    it('should reject invalid to date format', () => {
      const range = { to: '12/31/2023' };
      expect(CommonValidators.dateRange(range)).toBe('To date must be in YYYY-MM-DD format');
    });

    it('should reject date range where from is after to', () => {
      const range = { from: '2023-12-31', to: '2020-01-01' };
      expect(CommonValidators.dateRange(range)).toBe('From date must be before to date');
    });
  });

  describe('pageSize', () => {
    it('should accept valid page size', () => {
      expect(CommonValidators.pageSize(10)).toBe(true);
      expect(CommonValidators.pageSize(1)).toBe(true);
      expect(CommonValidators.pageSize(1000)).toBe(true);
    });

    it('should reject page size less than 1', () => {
      expect(CommonValidators.pageSize(0)).toBe('Page size must be at least 1');
      expect(CommonValidators.pageSize(-5)).toBe('Page size must be at least 1');
    });

    it('should reject page size greater than 1000', () => {
      expect(CommonValidators.pageSize(1001)).toBe('Page size cannot exceed 1000');
    });
  });

  describe('analysisDepth', () => {
    it('should accept valid analysis depths', () => {
      expect(CommonValidators.analysisDepth('basic')).toBe(true);
      expect(CommonValidators.analysisDepth('detailed')).toBe(true);
      expect(CommonValidators.analysisDepth('comprehensive')).toBe(true);
    });

    it('should reject invalid analysis depth', () => {
      expect(CommonValidators.analysisDepth('invalid')).toBe('Analysis depth must be one of: basic, detailed, comprehensive');
    });
  });

  describe('timeframe', () => {
    it('should accept valid timeframes', () => {
      expect(CommonValidators.timeframe('1year')).toBe(true);
      expect(CommonValidators.timeframe('2years')).toBe(true);
      expect(CommonValidators.timeframe('5years')).toBe(true);
      expect(CommonValidators.timeframe('all')).toBe(true);
    });

    it('should reject invalid timeframe', () => {
      expect(CommonValidators.timeframe('3years')).toBe('Timeframe must be one of: 1year, 2years, 5years, all');
    });
  });

  describe('email', () => {
    it('should accept valid email addresses', () => {
      expect(CommonValidators.email('test@example.com')).toBe(true);
      expect(CommonValidators.email('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(CommonValidators.email('invalid')).toBe('Invalid email format');
      expect(CommonValidators.email('missing@domain')).toBe('Invalid email format');
      expect(CommonValidators.email('@domain.com')).toBe('Invalid email format');
    });
  });

  describe('url', () => {
    it('should accept valid URLs', () => {
      expect(CommonValidators.url('https://example.com')).toBe(true);
      expect(CommonValidators.url('http://localhost:3000/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(CommonValidators.url('not-a-url')).toBe('Invalid URL format');
      expect(CommonValidators.url('example.com')).toBe('Invalid URL format');
    });
  });
});

describe('Sanitizer', () => {
  describe('cleanString', () => {
    it('should trim whitespace', () => {
      expect(Sanitizer.cleanString('  hello  ')).toBe('hello');
    });

    it('should remove angle brackets', () => {
      expect(Sanitizer.cleanString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });

    it('should remove javascript protocol', () => {
      expect(Sanitizer.cleanString('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should remove data protocol', () => {
      expect(Sanitizer.cleanString('data:text/html,test')).toBe('text/html,test');
    });

    it('should remove event handlers', () => {
      expect(Sanitizer.cleanString('onclick=alert(1)')).toBe('alert(1)');
      expect(Sanitizer.cleanString('onmouseover=evil()')).toBe('evil()');
    });

    it('should limit string length to 1000 characters', () => {
      const longString = 'a'.repeat(2000);
      expect(Sanitizer.cleanString(longString).length).toBe(1000);
    });

    it('should return empty string for non-string input', () => {
      expect(Sanitizer.cleanString(123 as any)).toBe('');
      expect(Sanitizer.cleanString(null as any)).toBe('');
    });
  });

  describe('cleanArray', () => {
    it('should filter out null and undefined values', () => {
      const input = [1, null, 'test', undefined, true];
      const result = Sanitizer.cleanArray(input);
      expect(result).toEqual([1, 'test', true]);
    });

    it('should sanitize string elements', () => {
      const input = ['  hello  ', '<script>bad</script>'];
      const result = Sanitizer.cleanArray(input);
      expect(result[0]).toBe('hello');
      expect(result[1]).toBe('scriptbad/script');
    });

    it('should limit array size to 100 elements', () => {
      const input = Array(200).fill('item');
      const result = Sanitizer.cleanArray(input);
      expect(result.length).toBe(100);
    });

    it('should return empty array for non-array input', () => {
      expect(Sanitizer.cleanArray('not-an-array' as any)).toEqual([]);
    });
  });

  describe('cleanObject', () => {
    it('should sanitize string values', () => {
      const input = { name: '  John  ', script: '<script>bad</script>' };
      const result = Sanitizer.cleanObject(input);
      expect(result.name).toBe('John');
      expect(result.script).toBe('scriptbad/script');
    });

    it('should recursively clean arrays', () => {
      const input = { items: ['  hello  ', null, 'world'] };
      const result = Sanitizer.cleanObject(input);
      expect(result.items).toEqual(['hello', 'world']);
    });

    it('should recursively clean nested objects', () => {
      const input = { nested: { name: '  Test  ' } };
      const result = Sanitizer.cleanObject(input);
      expect(result.nested.name).toBe('Test');
    });

    it('should sanitize object keys', () => {
      const input = { '  key  ': 'value' };
      const result = Sanitizer.cleanObject(input);
      expect(result['key']).toBe('value');
    });

    it('should limit object to 50 keys', () => {
      const input: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        input[`key${i}`] = 'value';
      }
      const result = Sanitizer.cleanObject(input);
      expect(Object.keys(result).length).toBe(50);
    });

    it('should return empty object for non-object input', () => {
      expect(Sanitizer.cleanObject(null)).toEqual({});
      expect(Sanitizer.cleanObject('string' as any)).toEqual({});
    });

    it('should preserve non-string/array/object values', () => {
      const input = { count: 42, active: true };
      const result = Sanitizer.cleanObject(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
    });
  });
});

describe('ValidationRules', () => {
  describe('clinicalTrialsStudy', () => {
    it('should validate correct NCT ID', () => {
      const data = { nctId: 'NCT12345678' };
      const result = Validator.validate(data, ValidationRules.clinicalTrialsStudy);
      expect(result.isValid).toBe(true);
    });

    it('should reject missing NCT ID', () => {
      const data = {};
      const result = Validator.validate(data, ValidationRules.clinicalTrialsStudy);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('nctId is required');
    });

    it('should reject invalid NCT ID format', () => {
      const data = { nctId: 'INVALID123' };
      const result = Validator.validate(data, ValidationRules.clinicalTrialsStudy);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NCT ID must be in format NCT########');
    });
  });

  describe('pubmedSearch', () => {
    it('should validate correct search params', () => {
      const data = { query: 'cancer treatment' };
      const result = Validator.validate(data, ValidationRules.pubmedSearch);
      expect(result.isValid).toBe(true);
    });

    it('should reject missing query', () => {
      const data = {};
      const result = Validator.validate(data, ValidationRules.pubmedSearch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('query is required');
    });

    it('should reject query that is too long', () => {
      const data = { query: 'a'.repeat(501) };
      const result = Validator.validate(data, ValidationRules.pubmedSearch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('query must be no more than 500 characters long');
    });
  });

  describe('fdaAdverseEvents', () => {
    it('should validate correct adverse event params', () => {
      const data = { drugName: 'Aspirin' };
      const result = Validator.validate(data, ValidationRules.fdaAdverseEvents);
      expect(result.isValid).toBe(true);
    });

    it('should reject missing drug name', () => {
      const data = {};
      const result = Validator.validate(data, ValidationRules.fdaAdverseEvents);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('drugName is required');
    });

    it('should validate date range format', () => {
      const data = { drugName: 'Aspirin', dateRange: { from: 'invalid' } };
      const result = Validator.validate(data, ValidationRules.fdaAdverseEvents);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('From date must be in YYYY-MM-DD format');
    });
  });
});
