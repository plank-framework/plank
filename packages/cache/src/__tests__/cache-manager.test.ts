/**
 * @fileoverview Tests for cache manager
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerAdapter } from '../adapters/server.js';
import { type CacheManager, createCacheManager } from '../cache-manager.js';

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    const adapter = createServerAdapter();
    manager = createCacheManager(adapter);
  });

  describe('cache', () => {
    it('should cache and retrieve values', async () => {
      const fn = vi.fn().mockResolvedValue('computed value');

      const result = await manager.cache('test-key', ['tag1'], fn);

      expect(result).toBe('computed value');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should return cached value on second call', async () => {
      const fn = vi.fn().mockResolvedValue('computed value');

      await manager.cache('test-key', ['tag1'], fn);
      const result = await manager.cache('test-key', ['tag1'], fn);

      expect(result).toBe('computed value');
      expect(fn).toHaveBeenCalledOnce(); // Not called again
    });

    it('should track cache hits and misses', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await manager.cache('key1', [], fn); // Miss
      await manager.cache('key1', [], fn); // Hit

      const stats = await manager.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should support TTL', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await manager.cache('key1', [], fn, 1); // 1 second TTL

      // Should be cached
      const result1 = await manager.cache('key1', [], fn);
      expect(result1).toBe('value');
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('get/set/delete', () => {
    it('should get and set values', async () => {
      await manager.set('key1', { data: 'test' });

      const result = await manager.get('key1');

      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for missing keys', async () => {
      const result = await manager.get('missing-key');

      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await manager.set('key1', 'value');
      await manager.delete('key1');

      const result = await manager.get('key1');

      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      await manager.set('key1', 'value');

      expect(await manager.has('key1')).toBe(true);
      expect(await manager.has('missing')).toBe(false);
    });
  });

  describe('tag-based invalidation', () => {
    it('should invalidate by tag', async () => {
      await manager.set('key1', 'value1', { tags: ['user:123'] });
      await manager.set('key2', 'value2', { tags: ['user:123'] });
      await manager.set('key3', 'value3', { tags: ['user:456'] });

      await manager.invalidate('user:123');

      expect(await manager.get('key1')).toBeNull();
      expect(await manager.get('key2')).toBeNull();
      expect(await manager.get('key3')).toBe('value3'); // Different tag
    });

    it('should invalidate multiple tags', async () => {
      await manager.set('key1', 'value1', { tags: ['tag1'] });
      await manager.set('key2', 'value2', { tags: ['tag2'] });
      await manager.set('key3', 'value3', { tags: ['tag3'] });

      await manager.invalidateTags(['tag1', 'tag2']);

      expect(await manager.get('key1')).toBeNull();
      expect(await manager.get('key2')).toBeNull();
      expect(await manager.get('key3')).toBe('value3');
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await manager.cache('key1', [], fn); // Miss
      await manager.cache('key1', [], fn); // Hit
      await manager.cache('key2', [], fn); // Miss

      const stats = await manager.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3);
    });

    it('should reset statistics', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await manager.cache('key1', [], fn);
      manager.resetStats();

      const stats = await manager.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      await manager.set('key1', 'value1');
      await manager.set('key2', 'value2');

      await manager.clear();

      expect(await manager.get('key1')).toBeNull();
      expect(await manager.get('key2')).toBeNull();
    });

    it('should reset statistics when clearing', async () => {
      const fn = vi.fn().mockResolvedValue('value');

      await manager.cache('key1', [], fn);
      await manager.clear();

      const stats = await manager.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
