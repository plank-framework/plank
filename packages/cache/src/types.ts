/**
 * @fileoverview Cache types and interfaces
 */

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Cached value */
  value: T;
  /** Associated tags */
  tags: string[];
  /** Expiration timestamp (ms) */
  expiresAt?: number | undefined;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number | undefined;
  /** Tags for invalidation */
  tags?: string[] | undefined;
}

/**
 * Cache adapter interface
 */
export interface CacheAdapter {
  /** Get value by key */
  get<T>(key: string): Promise<T | null>;
  /** Set value with options */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  /** Delete value by key */
  delete(key: string): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Clear all cached values */
  clear(): Promise<void>;
  /** Get all keys with a specific tag */
  getKeysByTag(tag: string): Promise<string[]>;
  /** Invalidate all entries with a tag */
  invalidateTag(tag: string): Promise<void>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries */
  totalEntries: number;
  /** Number of tags */
  totalTags: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Total size in bytes */
  totalSize: number;
}
