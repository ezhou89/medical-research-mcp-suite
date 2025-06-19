// tests/setup.ts

import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console.error and console.warn during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate random test data
  randomString: (length: number = 8) => {
    return Math.random().toString(36).substring(2, length + 2);
  },
  
  // Helper to generate valid NCT ID for testing
  generateNCTId: () => {
    const randomNum = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    return `NCT${randomNum}`;
  },
  
  // Helper to create test date range
  createDateRange: (daysBack: number = 365) => {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    return { from, to };
  },
};

// Declare global types for TypeScript
declare global {
  var testUtils: {
    wait: (ms: number) => Promise<void>;
    randomString: (length?: number) => string;
    generateNCTId: () => string;
    createDateRange: (daysBack?: number) => { from: string; to: string };
  };
}

// Custom Jest matchers
expect.extend({
  toBeValidNCTId(received: string) {
    const nctPattern = /^NCT\d{8}$/;
    const pass = nctPattern.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid NCT ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid NCT ID (format: NCT########)`,
        pass: false,
      };
    }
  },
  
  toBeValidPMID(received: string) {
    const pmidPattern = /^\d+$/;
    const pass = pmidPattern.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid PMID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid PMID (numeric string)`,
        pass: false,
      };
    }
  },
  
  toBeWithinTimeRange(received: number, expected: number, tolerance: number = 1000) {
    const diff = Math.abs(received - expected);
    const pass = diff <= tolerance;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${tolerance}ms of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${tolerance}ms of ${expected} (actual difference: ${diff}ms)`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers interface
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidNCTId(): R;
      toBeValidPMID(): R;
      toBeWithinTimeRange(expected: number, tolerance?: number): R;
    }
  }
}

export {};
