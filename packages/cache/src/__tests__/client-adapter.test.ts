/**
 * @fileoverview Tests for client cache adapter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ClientCacheAdapter, createClientAdapter } from '../adapters/client.js';

describe('ClientCacheAdapter', () => {
  let adapter: ClientCacheAdapter;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    adapter = createClientAdapter();
  });

  it('should use localStorage fallback when IndexedDB unavailable', async () => {
    await adapter.set('key1', 'value');

    const result = await adapter.get('key1');

    expect(result).toBe('value');
  });

  it('should handle tags in localStorage', async () => {
    await adapter.set('key1', 'value1', { tags: ['tag1'] });
    await adapter.set('key2', 'value2', { tags: ['tag1'] });

    // Note: Tag queries won't work in localStorage fallback
    // but set/get should still work
    expect(await adapter.get('key1')).toBe('value1');
    expect(await adapter.get('key2')).toBe('value2');
  });

  it('should handle TTL expiration', async () => {
    await adapter.set('key1', 'value', { ttl: 1 }); // 1 second

    expect(await adapter.has('key1')).toBe(true);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(await adapter.has('key1')).toBe(false);
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

    expect(await adapter.get('key1')).toBeNull();
    expect(await adapter.get('key2')).toBeNull();
  });

  it('should handle invalid JSON gracefully', async () => {
    // Manually corrupt localStorage
    localStorage.setItem('plank:cache:corrupted', 'invalid json');

    const result = await adapter.get('corrupted');

    expect(result).toBeNull();
  });

  it('should handle localStorage quota errors', async () => {
    // Mock localStorage.setItem to throw quota error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    await expect(adapter.set('key1', 'value')).resolves.toBeUndefined();

    Storage.prototype.setItem = originalSetItem;
  });

  it('should support multiple values', async () => {
    await adapter.set('key1', 'value1');
    await adapter.set('key2', 'value2');
    await adapter.set('key3', 'value3');

    expect(await adapter.get('key1')).toBe('value1');
    expect(await adapter.get('key2')).toBe('value2');
    expect(await adapter.get('key3')).toBe('value3');
  });

  it('should overwrite existing values', async () => {
    await adapter.set('key1', 'old value');
    await adapter.set('key1', 'new value');

    expect(await adapter.get('key1')).toBe('new value');
  });

  it('should handle complex objects', async () => {
    const complexObject = {
      user: { id: '123', name: 'John' },
      posts: [{ id: '1', title: 'Post 1' }],
      meta: { count: 42 },
    };

    await adapter.set('complex', complexObject);

    const result = await adapter.get('complex');

    expect(result).toEqual(complexObject);
  });

  it('should handle arrays', async () => {
    const array = [1, 2, 3, 4, 5];

    await adapter.set('array', array);

    const result = await adapter.get('array');

    expect(result).toEqual(array);
  });

  it('should handle null values', async () => {
    await adapter.set('null-key', null);

    const result = await adapter.get('null-key');

    expect(result).toBeNull();
  });

  it('should handle boolean values', async () => {
    await adapter.set('bool-true', true);
    await adapter.set('bool-false', false);

    expect(await adapter.get('bool-true')).toBe(true);
    expect(await adapter.get('bool-false')).toBe(false);
  });

  it('should handle number values', async () => {
    await adapter.set('num', 42);
    await adapter.set('float', 3.14);
    await adapter.set('negative', -10);

    expect(await adapter.get('num')).toBe(42);
    expect(await adapter.get('float')).toBe(3.14);
    expect(await adapter.get('negative')).toBe(-10);
  });

  it('should not return expired entries on get', async () => {
    await adapter.set('key1', 'value', { ttl: 1 });

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await adapter.get('key1');

    expect(result).toBeNull();
  });

  it('should handle getKeysByTag returning empty array', async () => {
    const keys = await adapter.getKeysByTag('nonexistent-tag');

    expect(keys).toEqual([]);
  });

  it('should handle invalidateTag on nonexistent tag', async () => {
    // Should not throw
    await expect(adapter.invalidateTag('nonexistent')).resolves.toBeUndefined();
  });
});
