// tests/responseSizeMonitor.test.ts

import { ResponseSizeMonitor, checkResponseSize } from '../src/utils/responseSizeMonitor';

describe('ResponseSizeMonitor', () => {
  let monitor: ResponseSizeMonitor;

  beforeEach(() => {
    // Reset the singleton for each test by accessing private constructor through getInstance
    // and updating config to ensure clean state
    monitor = ResponseSizeMonitor.getInstance();
    monitor.updateConfig({
      maxResponseSize: 1048576, // 1MB
      warningThreshold: 0.8,
      truncationMode: 'fail',
      enableSizeTracking: true,
    });
    monitor.clearMetrics();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ResponseSizeMonitor.getInstance();
      const instance2 = ResponseSizeMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('calculateSize', () => {
    it('should calculate size of simple string', () => {
      const data = 'hello world';
      const size = monitor.calculateSize(data);
      // JSON string: "hello world" = 13 bytes (including quotes)
      expect(size).toBe(13);
    });

    it('should calculate size of object', () => {
      const data = { name: 'test', value: 42 };
      const size = monitor.calculateSize(data);
      // JSON: {"name":"test","value":42}
      expect(size).toBeGreaterThan(0);
    });

    it('should calculate size of array', () => {
      const data = [1, 2, 3, 4, 5];
      const size = monitor.calculateSize(data);
      // JSON: [1,2,3,4,5]
      expect(size).toBe(11);
    });

    it('should calculate size of nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        }
      };
      const size = monitor.calculateSize(data);
      expect(size).toBeGreaterThan(30);
    });

    it('should handle unicode characters', () => {
      const data = { emoji: '😀🎉' };
      const size = monitor.calculateSize(data);
      // Unicode characters take more bytes
      expect(size).toBeGreaterThan(10);
    });
  });

  describe('checkSizeLimit', () => {
    it('should return withinLimit true for small data', () => {
      const data = { small: 'data' };
      const result = monitor.checkSizeLimit(data);

      expect(result.withinLimit).toBe(true);
      expect(result.metrics.truncated).toBe(false);
      expect(result.exceededInfo).toBeUndefined();
    });

    it('should return withinLimit false for oversized data', () => {
      // Set a very small limit for testing
      monitor.updateConfig({ maxResponseSize: 50 });

      const data = { large: 'x'.repeat(100) };
      const result = monitor.checkSizeLimit(data);

      expect(result.withinLimit).toBe(false);
      expect(result.exceededInfo).toBeDefined();
      expect(result.exceededInfo?.exceedsByBytes).toBeGreaterThan(0);
      expect(result.exceededInfo?.exceedsByPercent).toBeGreaterThan(0);
    });

    it('should include suggested actions for oversized data', () => {
      monitor.updateConfig({ maxResponseSize: 50 });

      const data = { large: 'x'.repeat(100) };
      const result = monitor.checkSizeLimit(data);

      expect(result.exceededInfo?.suggestedActions).toBeDefined();
      expect(result.exceededInfo?.suggestedActions?.length).toBeGreaterThan(0);
    });

    it('should track metrics when enabled', () => {
      const data = { test: 'value' };
      monitor.checkSizeLimit(data, 'test-context');

      const metrics = monitor.getMetrics('test-context');
      expect(metrics).toBeDefined();
      expect(metrics?.responseSize).toBeGreaterThan(0);
    });

    it('should include clinical trial suggestions for clinical context', () => {
      monitor.updateConfig({ maxResponseSize: 50 });

      const data = { large: 'x'.repeat(100) };
      const result = monitor.checkSizeLimit(data, 'clinical-trials-search');

      const suggestions = result.exceededInfo?.suggestedActions || [];
      expect(suggestions.some(s => s.includes('phase'))).toBe(true);
    });

    it('should include pubmed suggestions for publication context', () => {
      monitor.updateConfig({ maxResponseSize: 50 });

      const data = { large: 'x'.repeat(100) };
      const result = monitor.checkSizeLimit(data, 'pubmed-search');

      const suggestions = result.exceededInfo?.suggestedActions || [];
      expect(suggestions.some(s => s.includes('date range') || s.includes('journal'))).toBe(true);
    });
  });

  describe('truncateResponse', () => {
    it('should truncate arrays to 30%', () => {
      const data = Array(100).fill({ item: 'test' });
      const result = monitor.truncateResponse(data);

      expect(Array.isArray(result.truncatedData)).toBe(true);
      expect(result.truncatedData.length).toBe(30);
      expect(result.metrics.truncated).toBe(true);
      expect(result.truncationSummary).toContain('30 of 100');
    });

    it('should truncate object with studies array', () => {
      const data = {
        studies: Array(50).fill({ id: 1, name: 'Study' }),
        totalCount: 50,
      };
      const result = monitor.truncateResponse(data);

      expect(result.truncatedData.studies.length).toBe(15); // 30% of 50
      expect(result.truncationSummary).toContain('15 of 50');
    });

    it('should preserve original size in metrics', () => {
      const data = Array(100).fill('item');
      const originalSize = monitor.calculateSize(data);

      const result = monitor.truncateResponse(data);

      expect(result.metrics.originalSize).toBe(originalSize);
    });

    it('should track truncated metrics', () => {
      const data = Array(100).fill('item');
      monitor.truncateResponse(data, 'truncate-context');

      const metrics = monitor.getMetrics('truncate-context');
      expect(metrics?.truncated).toBe(true);
    });

    it('should handle non-array/non-object data', () => {
      const data = 'simple string';
      const result = monitor.truncateResponse(data);

      expect(result.truncatedData).toBe(data);
    });
  });

  describe('metrics management', () => {
    it('should get metrics for specific context', () => {
      const data = { test: 'value' };
      monitor.checkSizeLimit(data, 'context1');

      const metrics = monitor.getMetrics('context1');
      expect(metrics).toBeDefined();
    });

    it('should return undefined for non-existent context', () => {
      const metrics = monitor.getMetrics('nonexistent');
      expect(metrics).toBeUndefined();
    });

    it('should return all metrics', () => {
      monitor.checkSizeLimit({ a: 1 }, 'ctx1');
      monitor.checkSizeLimit({ b: 2 }, 'ctx2');

      const allMetrics = monitor.getAllMetrics();
      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('ctx1')).toBe(true);
      expect(allMetrics.has('ctx2')).toBe(true);
    });

    it('should clear specific context metrics', () => {
      monitor.checkSizeLimit({ a: 1 }, 'ctx1');
      monitor.checkSizeLimit({ b: 2 }, 'ctx2');

      monitor.clearMetrics('ctx1');

      expect(monitor.getMetrics('ctx1')).toBeUndefined();
      expect(monitor.getMetrics('ctx2')).toBeDefined();
    });

    it('should clear all metrics', () => {
      monitor.checkSizeLimit({ a: 1 }, 'ctx1');
      monitor.checkSizeLimit({ b: 2 }, 'ctx2');

      monitor.clearMetrics();

      expect(monitor.getAllMetrics().size).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should return current config', () => {
      const config = monitor.getConfig();

      expect(config).toHaveProperty('maxResponseSize');
      expect(config).toHaveProperty('warningThreshold');
      expect(config).toHaveProperty('truncationMode');
      expect(config).toHaveProperty('enableSizeTracking');
    });

    it('should update config partially', () => {
      monitor.updateConfig({ maxResponseSize: 2000000 });

      const config = monitor.getConfig();
      expect(config.maxResponseSize).toBe(2000000);
      expect(config.warningThreshold).toBe(0.8); // Should retain other settings
    });

    it('should disable size tracking when configured', () => {
      monitor.updateConfig({ enableSizeTracking: false });

      monitor.checkSizeLimit({ test: 'value' }, 'no-track');

      expect(monitor.getMetrics('no-track')).toBeUndefined();
    });
  });

  describe('isApproachingLimit', () => {
    it('should return false when well below threshold', () => {
      monitor.updateConfig({
        maxResponseSize: 1000,
        warningThreshold: 0.8,
      });

      expect(monitor.isApproachingLimit(500)).toBe(false);
    });

    it('should return true when at or above threshold', () => {
      monitor.updateConfig({
        maxResponseSize: 1000,
        warningThreshold: 0.8,
      });

      expect(monitor.isApproachingLimit(800)).toBe(true);
      expect(monitor.isApproachingLimit(900)).toBe(true);
    });
  });

  describe('formatSize', () => {
    it('should format bytes', () => {
      expect(monitor.formatSize(500)).toBe('500.00 B');
    });

    it('should format kilobytes', () => {
      expect(monitor.formatSize(1024)).toBe('1.00 KB');
      expect(monitor.formatSize(2048)).toBe('2.00 KB');
    });

    it('should format megabytes', () => {
      expect(monitor.formatSize(1048576)).toBe('1.00 MB');
      expect(monitor.formatSize(2097152)).toBe('2.00 MB');
    });

    it('should format gigabytes', () => {
      expect(monitor.formatSize(1073741824)).toBe('1.00 GB');
    });

    it('should format with decimals', () => {
      expect(monitor.formatSize(1536)).toBe('1.50 KB');
    });
  });
});

describe('checkResponseSize convenience function', () => {
  beforeEach(() => {
    // Reset config before each test
    const monitor = ResponseSizeMonitor.getInstance();
    monitor.updateConfig({
      maxResponseSize: 1048576,
      warningThreshold: 0.8,
    });
  });

  it('should check size using singleton monitor', () => {
    const data = { test: 'value' };
    const result = checkResponseSize(data, 'convenience-test');

    expect(result.withinLimit).toBe(true);
    expect(result.metrics).toBeDefined();
  });

  it('should use updated config from singleton', () => {
    // Update the singleton config directly
    const monitor = ResponseSizeMonitor.getInstance();
    monitor.updateConfig({ maxResponseSize: 50 });

    const data = { large: 'x'.repeat(100) };
    const result = checkResponseSize(data, 'config-test');

    expect(result.withinLimit).toBe(false);
  });
});
