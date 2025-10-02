/**
 * @fileoverview Core cache manager with tag-based invalidation
 */

import type { CacheAdapter, CacheOptions, CacheStats } from './types.js';

/**
 * Cache manager with tag-based invalidation
 */
export class CacheManager {
  private adapter: CacheAdapter;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(adapter: CacheAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get cached value or compute and cache it
   */
  async cache<T>(key: string, tags: string[], fn: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);

    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;

    // Compute value
    const value = await fn();

    // Cache it
    await this.set(key, value, { tags, ttl });

    return value;
  }

  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<T | null> {
    return this.adapter.get<T>(key);
  }

  /**
   * Set value with options
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.adapter.set(key, value, options);
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.adapter.has(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.stats.hits = 0;
    this.stats.misses = 0;
    return this.adapter.clear();
  }

  /**
   * Invalidate all entries with a tag
   */
  async invalidate(tag: string): Promise<void> {
    return this.adapter.invalidateTag(tag);
  }

  /**
   * Invalidate multiple tags
   */
  async invalidateTags(tags: string[]): Promise<void> {
    await Promise.all(tags.map((tag) => this.invalidate(tag)));
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const keys = await this.adapter.getKeysByTag('*'); // All keys
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Calculate unique tags and total size
    const uniqueTags = new Set<string>();
    let totalSize = 0;

    // Get all entries to calculate tags and size
    for (const key of keys) {
      try {
        const entry = await this.adapter.get(key);
        if (entry && typeof entry === 'object' && 'tags' in entry) {
          const cacheEntry = entry as { tags: string[]; value: unknown };
          // Add tags to unique set
          for (const tag of cacheEntry.tags) {
            uniqueTags.add(tag);
          }
          // Estimate size (rough calculation)
          totalSize += JSON.stringify(cacheEntry.value).length;
        }
      } catch (error) {
        // Skip entries that can't be read
        console.warn(`Failed to read cache entry ${key}:`, error);
      }
    }

    return {
      totalEntries: keys.length,
      totalTags: uniqueTags.size,
      hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalSize,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }
}

/**
 * Create a cache manager instance
 */
export function createCacheManager(adapter: CacheAdapter): CacheManager {
  return new CacheManager(adapter);
}
