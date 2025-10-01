/**
 * @fileoverview Edge runtime cache adapter (Cloudflare Workers, Vercel Edge)
 * Uses KV storage for persistence
 */

import type { CacheAdapter, CacheEntry, CacheOptions } from '../types.js';

/**
 * Edge cache adapter configuration
 */
export interface EdgeAdapterConfig {
  /** KV namespace binding */
  kv?: KVNamespace;
  /** Prefix for all keys */
  prefix?: string;
}

/**
 * Cloudflare Workers KV namespace interface
 */
export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}

/**
 * Edge cache adapter for Cloudflare Workers / Vercel Edge
 */
export class EdgeCacheAdapter implements CacheAdapter {
  private kv: KVNamespace | null;
  private prefix: string;
  private fallbackCache = new Map<string, CacheEntry>();

  constructor(config: EdgeAdapterConfig = {}) {
    this.kv = config.kv || null;
    this.prefix = config.prefix || 'plank:cache:';

    if (!this.kv) {
      console.warn('⚠️  No KV namespace provided, using in-memory fallback');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefix + key;

    if (this.kv) {
      try {
        const raw = await this.kv.get(prefixedKey, { type: 'text' });

        if (!raw) {
          return null;
        }

        const entry = JSON.parse(raw) as CacheEntry<T>;

        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          await this.delete(key);
          return null;
        }

        return entry.value;
      } catch (error) {
        console.error('Edge cache get error:', error);
        return null;
      }
    }

    // Fallback to in-memory
    const entry = this.fallbackCache.get(prefixedKey);

    if (!entry) {
      return null;
    }

    // Check expiration in fallback
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = this.prefix + key;
    const entry: CacheEntry<T> = {
      key,
      value,
      tags: options?.tags || [],
      expiresAt: options?.ttl ? Date.now() + options.ttl * 1000 : undefined,
      createdAt: Date.now(),
    };

    if (this.kv) {
      await this.setInKV(prefixedKey, key, entry, options);
    } else {
      this.fallbackCache.set(prefixedKey, entry);
    }
  }

  /**
   * Store entry in KV with tag mappings
   */
  private async setInKV<T>(
    prefixedKey: string,
    key: string,
    entry: CacheEntry<T>,
    options?: CacheOptions
  ): Promise<void> {
    try {
      if (!this.kv) return;

      const putOptions: { expirationTtl?: number } = {};
      if (options?.ttl !== undefined) {
        putOptions.expirationTtl = options.ttl;
      }

      await this.kv.put(prefixedKey, JSON.stringify(entry), putOptions);
      await this.updateTagMappings(key, entry.tags);
    } catch (error) {
      console.error('Edge cache set error:', error);
    }
  }

  /**
   * Update tag-to-key mappings in KV
   */
  private async updateTagMappings(key: string, tags: string[]): Promise<void> {
    if (!this.kv) return;

    for (const tag of tags) {
      await this.addKeyToTag(key, tag);
    }
  }

  /**
   * Add key to tag mapping
   */
  private async addKeyToTag(key: string, tag: string): Promise<void> {
    if (!this.kv) return;

    const tagKey = `${this.prefix}tag:${tag}`;
    const existing = await this.kv.get(tagKey, { type: 'text' });
    const keys = existing ? (JSON.parse(existing) as string[]) : [];

    if (!keys.includes(key)) {
      keys.push(key);
      await this.kv.put(tagKey, JSON.stringify(keys));
    }
  }

  async delete(key: string): Promise<void> {
    const prefixedKey = this.prefix + key;

    if (this.kv) {
      await this.kv.delete(prefixedKey);
    } else {
      this.fallbackCache.delete(prefixedKey);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    if (this.kv) {
      // List all keys with prefix and delete
      const result = await this.kv.list({ prefix: this.prefix });

      for (const item of result.keys) {
        await this.kv.delete(item.name);
      }
    } else {
      this.fallbackCache.clear();
    }
  }

  async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = `${this.prefix}tag:${tag}`;

    if (this.kv) {
      const raw = await this.kv.get(tagKey, { type: 'text' });
      return raw ? (JSON.parse(raw) as string[]) : [];
    }

    // Fallback: scan all entries
    const keys: string[] = [];
    for (const entry of this.fallbackCache.values()) {
      if (entry.tags.includes(tag)) {
        keys.push(entry.key);
      }
    }
    return keys;
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.getKeysByTag(tag);

    for (const key of keys) {
      await this.delete(key);
    }

    // Delete tag index
    const tagKey = `${this.prefix}tag:${tag}`;
    if (this.kv) {
      await this.kv.delete(tagKey);
    }
  }
}

/**
 * Create an edge cache adapter
 */
export function createEdgeAdapter(config?: EdgeAdapterConfig): EdgeCacheAdapter {
  return new EdgeCacheAdapter(config);
}
