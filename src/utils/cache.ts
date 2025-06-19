// src/utils/cache.ts

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  maxKeys: number; // Maximum number of keys to store
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      ttl: options.ttl || 3600000, // 1 hour default
      maxKeys: options.maxKeys || 1000,
    };
  }

  set(key: string, data: T, customTTL?: number): void {
    // Clean up if we're at capacity
    if (this.store.size >= this.options.maxKeys) {
      this.cleanup();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.options.ttl,
    };

    this.store.set(key, entry);
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    // Delete expired entries
    keysToDelete.forEach(key => this.store.delete(key));

    // If still at capacity, remove oldest entries
    if (this.store.size >= this.options.maxKeys) {
      const entries = Array.from(this.store.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.options.maxKeys * 0.1)); // Remove 10%
      toRemove.forEach(([key]) => this.store.delete(key));
    }
  }

  getStats(): {
    size: number;
    maxKeys: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.store.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.store.size,
      maxKeys: this.options.maxKeys,
      hitRate: 0, // Would need to track hits/misses to calculate
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }
}

// Global cache instances for different data types
export const clinicalTrialsCache = new Cache({
  ttl: 3600000, // 1 hour
  maxKeys: 500,
});

export const pubmedCache = new Cache({
  ttl: 21600000, // 6 hours
  maxKeys: 300,
});

export const fdaCache = new Cache({
  ttl: 86400000, // 24 hours
  maxKeys: 200,
});
