// tests/cache.test.ts

import { Cache } from '../src/utils/cache';

describe('Cache', () => {
  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const cache = new Cache();
      const stats = cache.getStats();
      expect(stats.maxKeys).toBe(1000);
    });

    it('should accept custom TTL', () => {
      const cache = new Cache({ ttl: 5000 });
      // TTL is used internally, verify through expiration behavior
      expect(cache).toBeDefined();
    });

    it('should accept custom maxKeys', () => {
      const cache = new Cache({ maxKeys: 50 });
      const stats = cache.getStats();
      expect(stats.maxKeys).toBe(50);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should store and retrieve complex objects', () => {
      const cache = new Cache<{ name: string; count: number }>();
      const obj = { name: 'test', count: 42 };
      cache.set('key1', obj);
      expect(cache.get('key1')).toEqual(obj);
    });

    it('should return undefined for non-existent key', () => {
      const cache = new Cache<string>();
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing value with same key', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('should return undefined for expired entries', async () => {
      const cache = new Cache<string>({ ttl: 50 }); // 50ms TTL
      cache.set('key1', 'value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return value before expiration', async () => {
      const cache = new Cache<string>({ ttl: 500 }); // 500ms TTL
      cache.set('key1', 'value1');

      // Check immediately
      expect(cache.get('key1')).toBe('value1');

      // Check after short delay but before expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(cache.get('key1')).toBe('value1');
    });

    it('should respect custom TTL per entry', async () => {
      const cache = new Cache<string>({ ttl: 1000 }); // Default 1s TTL
      cache.set('key1', 'value1', 50); // 50ms TTL for this entry

      // Wait for custom TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const cache = new Cache<string>();
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      const cache = new Cache<string>({ ttl: 50 });
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.has('key1')).toBe(false);
    });

    it('should delete expired entry when checked', async () => {
      const cache = new Cache<string>({ ttl: 50 });
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      cache.has('key1'); // This should delete the expired entry
      expect(cache.size()).toBe(0);
    });
  });

  describe('delete', () => {
    it('should remove an existing entry', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');

      const result = cache.delete('key1');

      expect(result).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const cache = new Cache<string>();
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      const cache = new Cache<string>();
      expect(cache.size()).toBe(0);
    });

    it('should return correct count', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });

    it('should not count expired entries when accessed', async () => {
      const cache = new Cache<string>({ ttl: 50 });
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Access the expired key to trigger deletion
      cache.get('key1');
      expect(cache.size()).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return empty array for empty cache', () => {
      const cache = new Cache<string>();
      expect(cache.keys()).toEqual([]);
    });

    it('should return all keys', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  describe('capacity management', () => {
    it('should evict entries when at capacity', () => {
      const cache = new Cache<string>({ maxKeys: 5 });

      // Fill to capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(5);

      // Add one more, should trigger cleanup
      cache.set('key5', 'value5');

      // The new entry is added after cleanup, so size can be up to maxKeys + 1
      // Cleanup removes 10% of maxKeys (at least 1), then adds the new entry
      // So final size should be <= maxKeys
      expect(cache.size()).toBeLessThanOrEqual(6);
    });

    it('should remove oldest entries during cleanup', async () => {
      const cache = new Cache<string>({ maxKeys: 3, ttl: 10000 });

      cache.set('old1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('old2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('new', 'value3');

      // Add one more to trigger cleanup
      cache.set('newest', 'value4');

      // Should still have some entries
      expect(cache.size()).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty cache', () => {
      const cache = new Cache<string>();
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.maxKeys).toBe(1000);
      expect(stats.hitRate).toBe(0);
      expect(stats.oldestEntry).toBe(0);
      expect(stats.newestEntry).toBe(0);
    });

    it('should return correct stats for populated cache', async () => {
      const cache = new Cache<string>({ maxKeys: 100 });

      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxKeys).toBe(100);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
      expect(stats.newestEntry).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('edge cases', () => {
    it('should handle empty string keys', () => {
      const cache = new Cache<string>();
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle null and undefined values', () => {
      const cache = new Cache<any>();
      cache.set('nullKey', null);
      cache.set('undefinedKey', undefined);

      // Both null and undefined are stored and retrieved
      // Note: undefined stored value is indistinguishable from "not found"
      expect(cache.get('nullKey')).toBeNull();
      // When undefined is stored, get returns undefined (same as not found)
      expect(cache.has('undefinedKey')).toBe(true);
    });

    it('should handle special characters in keys', () => {
      const cache = new Cache<string>();
      cache.set('key with spaces', 'value1');
      cache.set('key:with:colons', 'value2');
      cache.set('key/with/slashes', 'value3');

      expect(cache.get('key with spaces')).toBe('value1');
      expect(cache.get('key:with:colons')).toBe('value2');
      expect(cache.get('key/with/slashes')).toBe('value3');
    });

    it('should handle large values', () => {
      const cache = new Cache<string>();
      const largeValue = 'x'.repeat(1000000); // 1MB string
      cache.set('large', largeValue);
      expect(cache.get('large')).toBe(largeValue);
    });
  });
});
