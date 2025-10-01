/**
 * @fileoverview Client-side cache adapter
 * Uses IndexedDB with localStorage fallback
 */

import type { CacheAdapter, CacheEntry, CacheOptions } from '../types.js';

/**
 * Client cache adapter using IndexedDB
 */
export class ClientCacheAdapter implements CacheAdapter {
  private dbName = 'plank-cache';
  private storeName = 'cache-entries';
  private db: IDBDatabase | null = null;
  private initialized = false;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.init();

      if (!this.db) {
        return this.getFromLocalStorage<T>(key);
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;

          if (!entry) {
            resolve(null);
            return;
          }

          // Check expiration
          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.delete(key).then(() => resolve(null));
            return;
          }

          resolve(entry.value);
        };

        request.onerror = () => reject(request.error);
      });
    } catch {
      return this.getFromLocalStorage<T>(key);
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        return this.setInLocalStorage(key, value, options);
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        tags: options?.tags || [],
        expiresAt: options?.ttl ? Date.now() + options.ttl * 1000 : undefined,
        createdAt: Date.now(),
      };

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      return this.setInLocalStorage(key, value, options);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        localStorage.removeItem(`plank:cache:${key}`);
        return;
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      localStorage.removeItem(`plank:cache:${key}`);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        // Clear localStorage cache entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('plank:cache:')) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
        return;
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback: clear localStorage
      localStorage.clear();
    }
  }

  async getKeysByTag(tag: string): Promise<string[]> {
    try {
      await this.init();

      if (!this.db) {
        return [];
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('tags');
        const request = index.getAll(tag);

        request.onsuccess = () => {
          const entries = request.result as CacheEntry[];
          resolve(entries.map((entry) => entry.key));
        };

        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.getKeysByTag(tag);

    for (const key of keys) {
      await this.delete(key);
    }
  }

  /**
   * Fallback: Get from localStorage
   */
  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`plank:cache:${key}`);

      if (!raw) {
        return null;
      }

      const entry = JSON.parse(raw) as CacheEntry<T>;

      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        localStorage.removeItem(`plank:cache:${key}`);
        return null;
      }

      return entry.value;
    } catch {
      return null;
    }
  }

  /**
   * Fallback: Set in localStorage
   */
  private setInLocalStorage<T>(key: string, value: T, options?: CacheOptions): void {
    try {
      const entry: CacheEntry<T> = {
        key,
        value,
        tags: options?.tags || [],
        expiresAt: options?.ttl ? Date.now() + options.ttl * 1000 : undefined,
        createdAt: Date.now(),
      };

      localStorage.setItem(`plank:cache:${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('localStorage cache error:', error);
    }
  }
}

/**
 * Create a client cache adapter
 */
export function createClientAdapter(): ClientCacheAdapter {
  return new ClientCacheAdapter();
}
