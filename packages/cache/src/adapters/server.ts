/**
 * @fileoverview Server-side cache adapter (in-memory)
 * Supports Node.js and Bun runtimes
 */

import type { CacheAdapter, CacheEntry, CacheOptions } from '../types.js';

/**
 * In-memory cache adapter for server-side caching
 */
export class ServerCacheAdapter implements CacheAdapter {
  private cache = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const expiresAt = options?.ttl ? Date.now() + options.ttl * 1000 : undefined;
    const tags = options?.tags || [];

    const entry: CacheEntry<T> = {
      key,
      value,
      tags,
      expiresAt,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)?.add(key);
    }
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);

    if (entry) {
      // Remove from tag index
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }

    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  async getKeysByTag(tag: string): Promise<string[]> {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.getKeysByTag(tag);

    for (const key of keys) {
      await this.delete(key);
    }

    this.tagIndex.delete(tag);
  }
}

/**
 * Create a server cache adapter
 */
export function createServerAdapter(): ServerCacheAdapter {
  return new ServerCacheAdapter();
}
