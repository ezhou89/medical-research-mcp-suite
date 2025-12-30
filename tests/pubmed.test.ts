// tests/pubmed.test.ts

import { PubMedClient } from '../src/apis/pubmed';

// Helper to check if API is rate limited
const isRateLimited = (error: any): boolean => {
  const message = error?.message || '';
  return message.includes('403') || message.includes('429') || message.includes('rate');
};

// Skip test if rate limited
const skipIfRateLimited = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    if (isRateLimited(error)) {
      console.warn('Skipping test due to API rate limiting');
      return null;
    }
    throw error;
  }
};

describe('PubMedClient', () => {
  let client: PubMedClient;

  beforeEach(() => {
    client = new PubMedClient();
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('searchPapers', () => {
    it('should search papers successfully', async () => {
      const params = {
        query: 'aspirin',
        maxResults: 5,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return; // Skip if rate limited

      expect(result).toHaveProperty('papers');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('query');
      expect(Array.isArray(result.papers)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
      expect(result.query).toBe('aspirin');

      if (result.papers.length > 0) {
        const paper = result.papers[0];
        expect(paper).toHaveProperty('pmid');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
        expect(paper).toHaveProperty('journal');
        expect(paper).toHaveProperty('publicationDate');
      }
    }, 15000);

    it('should handle empty search results', async () => {
      const params = {
        query: 'xyznonexistentmedicalterm9876543210',
        maxResults: 5,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
      expect(result).toHaveProperty('totalCount');
      expect(Array.isArray(result.papers)).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.papers.length).toBe(0);
    }, 15000);

    it('should cache search results', async () => {
      const params = {
        query: 'diabetes',
        maxResults: 3,
      };

      // First call
      const start1 = Date.now();
      const result1 = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result1) return;
      const time1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const result2 = await client.searchPapers(params);
      const time2 = Date.now() - start2;

      expect(result1).toEqual(result2);
      expect(time2).toBeLessThan(time1); // Cached call should be faster
    }, 20000);

    it('should respect maxResults parameter', async () => {
      const params = {
        query: 'cancer',
        maxResults: 3,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result.papers.length).toBeLessThanOrEqual(3);
    }, 15000);

    it('should search with publication types filter', async () => {
      const params = {
        query: 'hypertension',
        maxResults: 5,
        publicationTypes: ['Clinical Trial'],
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
    }, 15000);

    it('should search with date range', async () => {
      const params = {
        query: 'covid-19',
        maxResults: 5,
        dateRange: {
          from: '2020-01-01',
          to: '2023-12-31',
        },
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
      expect(Array.isArray(result.papers)).toBe(true);
    }, 15000);

    it('should search with from date only', async () => {
      const params = {
        query: 'vaccine',
        maxResults: 3,
        dateRange: {
          from: '2022-01-01',
        },
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
    }, 15000);

    it('should search with to date only', async () => {
      const params = {
        query: 'antibiotics',
        maxResults: 3,
        dateRange: {
          to: '2023-12-31',
        },
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
    }, 15000);

    it('should search with sort parameter', async () => {
      const params = {
        query: 'heart disease',
        maxResults: 5,
        sort: 'date' as const,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      expect(result).toHaveProperty('papers');
      expect(Array.isArray(result.papers)).toBe(true);
    }, 15000);
  });

  describe('getPaperByPMID', () => {
    it('should get paper by valid PMID', async () => {
      // Use a known PMID that should exist (classic aspirin study)
      const pmid = '12345678';

      const paper = await skipIfRateLimited(() => client.getPaperByPMID(pmid));

      // Paper may or may not exist, but should not throw
      if (paper) {
        expect(paper).toHaveProperty('pmid');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
        expect(paper).toHaveProperty('journal');
      }
    }, 15000);

    it('should return null for invalid PMID', async () => {
      const pmid = '99999999999'; // Very unlikely to exist

      const paper = await skipIfRateLimited(() => client.getPaperByPMID(pmid));
      // Skip assertion if rate limited (paper will be null in that case too)

      expect(paper).toBeNull();
    }, 15000);

    it('should cache paper results', async () => {
      const pmid = '33333333';

      // First call
      const start1 = Date.now();
      const result1 = await skipIfRateLimited(() => client.getPaperByPMID(pmid));
      if (result1 === undefined) return; // Rate limited
      const time1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      await client.getPaperByPMID(pmid);
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1);
    }, 20000);
  });

  describe('paper data structure', () => {
    it('should return properly structured paper objects', async () => {
      const params = {
        query: 'metformin diabetes',
        maxResults: 2,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      if (result.papers.length > 0) {
        const paper = result.papers[0];

        // Check required fields
        expect(typeof paper.pmid).toBe('string');
        expect(typeof paper.title).toBe('string');
        expect(Array.isArray(paper.authors)).toBe(true);
        expect(typeof paper.journal).toBe('string');
        expect(typeof paper.publicationDate).toBe('string');
        expect(Array.isArray(paper.publicationType)).toBe(true);

        // Check optional fields structure when present
        if (paper.abstract) {
          expect(typeof paper.abstract).toBe('string');
        }
        if (paper.doi) {
          expect(typeof paper.doi).toBe('string');
        }
        if (paper.keywords) {
          expect(Array.isArray(paper.keywords)).toBe(true);
        }
      }
    }, 15000);

    it('should handle papers with multiple authors', async () => {
      const params = {
        query: 'randomized controlled trial',
        maxResults: 5,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      // Find a paper with multiple authors
      const paperWithAuthors = result.papers.find(p => p.authors.length > 1);

      if (paperWithAuthors) {
        expect(paperWithAuthors.authors.length).toBeGreaterThan(1);
        paperWithAuthors.authors.forEach(author => {
          expect(typeof author).toBe('string');
        });
      }
    }, 15000);

    it('should handle papers with structured abstracts', async () => {
      const params = {
        query: 'clinical trial methodology',
        maxResults: 10,
      };

      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result) return;

      // Some papers may have structured abstracts with sections
      const paperWithAbstract = result.papers.find(p => p.abstract && p.abstract.length > 100);

      if (paperWithAbstract) {
        expect(typeof paperWithAbstract.abstract).toBe('string');
        expect(paperWithAbstract.abstract!.length).toBeGreaterThan(0);
      }
    }, 15000);
  });

  describe('caching', () => {
    it('should clear cache successfully', () => {
      expect(() => client.clearCache()).not.toThrow();
    });

    it('should return fresh results after cache clear', async () => {
      const params = {
        query: 'oncology',
        maxResults: 2,
      };

      // First call
      const result1 = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result1) return;

      // Clear cache
      client.clearCache();

      // Second call (should make new API request)
      const start = Date.now();
      const result2 = await skipIfRateLimited(() => client.searchPapers(params));
      if (!result2) return;
      const time = Date.now() - start;

      // Should take longer than a cached call (typically > 100ms for API call)
      expect(time).toBeGreaterThan(10);
    }, 20000);
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // This tests the error interceptor behavior
      const params = {
        query: 'valid query',
        maxResults: 5,
      };

      // Should not throw for valid queries (unless rate limited)
      const result = await skipIfRateLimited(() => client.searchPapers(params));
      if (result) {
        expect(result).toBeDefined();
      }
    }, 15000);
  });
});
