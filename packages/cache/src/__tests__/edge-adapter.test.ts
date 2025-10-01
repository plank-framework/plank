/**
 * @fileoverview Tests for edge cache adapter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeAdapter, type EdgeCacheAdapter, type KVNamespace } from '../adapters/edge.js';

describe('EdgeCacheAdapter', () => {
  describe('with KV namespace', () => {
    let mockKV: KVNamespace;
    let adapter: EdgeCacheAdapter;

    beforeEach(() => {
      // Mock KV namespace
      const storage = new Map<string, string>();

      mockKV = {
        get: vi.fn(async (key: string) => storage.get(key) || null),
        put: vi.fn(async (key: string, value: string) => {
          storage.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          storage.delete(key);
        }),
        list: vi.fn(async (options?: { prefix?: string }) => {
          const keys = Array.from(storage.keys())
            .filter((k) => !options?.prefix || k.startsWith(options.prefix))
            .map((name) => ({ name }));
          return { keys };
        }),
      };

      adapter = createEdgeAdapter({ kv: mockKV });
    });

    it('should get and set values', async () => {
      await adapter.set('key1', { data: 'test' });

      const result = await adapter.get('key1');

      expect(result).toEqual({ data: 'test' });
      expect(mockKV.put).toHaveBeenCalled();
      expect(mockKV.get).toHaveBeenCalled();
    });

    it('should return null for missing keys', async () => {
      const result = await adapter.get('missing');

      expect(result).toBeNull();
    });

    it('should support TTL', async () => {
      await adapter.set('key1', 'value', { ttl: 3600 });

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 3600 })
      );
    });

    it('should support tags', async () => {
      await adapter.set('key1', 'value1', { tags: ['user:123'] });

      const keys = await adapter.getKeysByTag('user:123');

      expect(keys).toContain('key1');
    });

    it('should invalidate by tag', async () => {
      await adapter.set('key1', 'value1', { tags: ['user:123'] });
      await adapter.set('key2', 'value2', { tags: ['user:123'] });

      await adapter.invalidateTag('user:123');

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
    });

    it('should delete entries', async () => {
      await adapter.set('key1', 'value');
      await adapter.delete('key1');

      expect(await adapter.get('key1')).toBeNull();
    });

    it('should check if key exists', async () => {
      await adapter.set('key1', 'value');

      expect(await adapter.has('key1')).toBe(true);
      expect(await adapter.has('missing')).toBe(false);
    });

    it('should clear all entries', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      await adapter.clear();

      expect(mockKV.delete).toHaveBeenCalled();
    });

    it('should handle TTL expiration', async () => {
      await adapter.set('key1', 'value', { ttl: 1 });

      expect(await adapter.has('key1')).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await adapter.has('key1')).toBe(false);
    });

    it('should handle multiple tags', async () => {
      await adapter.set('key1', 'value', { tags: ['tag1', 'tag2'] });

      const keys1 = await adapter.getKeysByTag('tag1');
      const keys2 = await adapter.getKeysByTag('tag2');

      expect(keys1).toContain('key1');
      expect(keys2).toContain('key1');
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.get = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await adapter.get('key1');

      expect(result).toBeNull();
    });

    it('should handle KV set errors', async () => {
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV error'));

      // Should not throw
      await expect(adapter.set('key1', 'value')).resolves.toBeUndefined();
    });
  });

  describe('without KV namespace (fallback)', () => {
    let adapter: EdgeCacheAdapter;

    beforeEach(() => {
      adapter = createEdgeAdapter(); // No KV
    });

    it('should fall back to in-memory cache', async () => {
      await adapter.set('key1', 'value');

      const result = await adapter.get('key1');

      expect(result).toBe('value');
    });

    it('should handle tags in fallback mode', async () => {
      await adapter.set('key1', 'value', { tags: ['tag1'] });

      const keys = await adapter.getKeysByTag('tag1');

      expect(keys).toContain('key1');
    });

    it('should invalidate by tag in fallback mode', async () => {
      await adapter.set('key1', 'value', { tags: ['tag1'] });
      await adapter.invalidateTag('tag1');

      expect(await adapter.get('key1')).toBeNull();
    });

    it('should handle TTL in fallback mode', async () => {
      await adapter.set('key1', 'value', { ttl: 1 });

      expect(await adapter.has('key1')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await adapter.has('key1')).toBe(false);
    });

    it('should delete in fallback mode', async () => {
      await adapter.set('key1', 'value');
      await adapter.delete('key1');

      expect(await adapter.get('key1')).toBeNull();
    });

    it('should clear in fallback mode', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      await adapter.clear();

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
    });
  });
});
