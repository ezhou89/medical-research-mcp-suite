// tests/clinicalTrials.test.ts

import { ClinicalTrialsClient } from '../src/apis/clinicalTrials';

describe('ClinicalTrialsClient', () => {
  let client: ClinicalTrialsClient;

  beforeEach(() => {
    client = new ClinicalTrialsClient();
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('searchStudies', () => {
    test('should search studies successfully', async () => {
      const params = {
        query: {
          condition: 'diabetes',
        },
        pageSize: 5,
      };

      const result = await client.searchStudies(params);
      
      expect(result).toHaveProperty('studies');
      expect(result).toHaveProperty('totalCount');
      expect(Array.isArray(result.studies)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
      
      if (result.studies.length > 0) {
        const study = result.studies[0];
        expect(study).toHaveProperty('protocolSection');
        expect(study.protocolSection).toHaveProperty('identificationModule');
        expect(study.protocolSection.identificationModule).toHaveProperty('nctId');
      }
    }, 10000);

    test('should handle empty search results', async () => {
      const params = {
        query: {
          condition: 'extremely_rare_condition_that_does_not_exist_12345',
        },
        pageSize: 5,
      };

      const result = await client.searchStudies(params);
      
      expect(result).toHaveProperty('studies');
      expect(result).toHaveProperty('totalCount');
      expect(Array.isArray(result.studies)).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.studies.length).toBe(0);
    }, 10000);

    test('should cache search results', async () => {
      const params = {
        query: {
          condition: 'diabetes',
        },
        pageSize: 3,
      };

      // First call
      const start1 = Date.now();
      const result1 = await client.searchStudies(params);
      const time1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const result2 = await client.searchStudies(params);
      const time2 = Date.now() - start2;

      expect(result1).toEqual(result2);
      expect(time2).toBeLessThan(time1); // Cached call should be faster
    }, 15000);
  });

  describe('getStudyById', () => {
    test('should get study by valid NCT ID', async () => {
      // Use a known NCT ID that should exist
      const nctId = 'NCT03654092';
      
      const study = await client.getStudyById(nctId);
      
      if (study) {
        expect(study).toHaveProperty('protocolSection');
        expect(study.protocolSection).toHaveProperty('identificationModule');
        expect(study.protocolSection.identificationModule.nctId).toBe(nctId);
      }
    }, 10000);

    test('should return null for invalid NCT ID', async () => {
      const nctId = 'NCT99999999'; // Invalid ID
      
      const study = await client.getStudyById(nctId);
      
      expect(study).toBeNull();
    }, 10000);

    test('should throw error for malformed NCT ID', async () => {
      const invalidId = 'invalid-id';
      
      await expect(client.getStudyById(invalidId)).rejects.toThrow();
    }, 5000);
  });

  describe('getAllPages', () => {
    test('should handle pagination correctly', async () => {
      const params = {
        query: {
          condition: 'cancer',
        },
        pageSize: 10,
      };

      const studies = await client.getAllPages(params, 2); // Limit to 2 pages
      
      expect(Array.isArray(studies)).toBe(true);
      expect(studies.length).toBeGreaterThan(0);
      expect(studies.length).toBeLessThanOrEqual(20); // Max 2 pages × 10 per page
    }, 15000);

    test('should respect max pages limit', async () => {
      const params = {
        query: {
          condition: 'diabetes',
        },
        pageSize: 5,
      };

      const studies = await client.getAllPages(params, 1); // Limit to 1 page
      
      expect(studies.length).toBeLessThanOrEqual(5);
    }, 10000);
  });

  describe('caching', () => {
    test('should clear cache successfully', () => {
      // Add some data to cache first
      client.searchStudies({
        query: { condition: 'test' },
      });

      // Clear cache
      expect(() => client.clearCache()).not.toThrow();
    });
  });
});
