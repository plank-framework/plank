/**
 * @fileoverview Tests for server cache adapter
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createServerAdapter, type ServerCacheAdapter } from '../adapters/server.js';

describe('ServerCacheAdapter', () => {
  let adapter: ServerCacheAdapter;

  beforeEach(() => {
    adapter = createServerAdapter();
  });

  it('should get and set values', async () => {
    await adapter.set('key1', { data: 'test' });

    const result = await adapter.get('key1');

    expect(result).toEqual({ data: 'test' });
  });

  it('should return null for missing keys', async () => {
    const result = await adapter.get('missing');

    expect(result).toBeNull();
  });

  it('should handle TTL expiration', async () => {
    await adapter.set('key1', 'value', { ttl: 1 }); // 1 second

    // Should exist immediately
    expect(await adapter.has('key1')).toBe(true);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be expired
    expect(await adapter.has('key1')).toBe(false);
  });

  it('should support tags', async () => {
    await adapter.set('key1', 'value1', { tags: ['user:123', 'posts'] });
    await adapter.set('key2', 'value2', { tags: ['user:123'] });

    const keys = await adapter.getKeysByTag('user:123');

    expect(keys).toHaveLength(2);
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  it('should invalidate by tag', async () => {
    await adapter.set('key1', 'value1', { tags: ['user:123'] });
    await adapter.set('key2', 'value2', { tags: ['user:123'] });
    await adapter.set('key3', 'value3', { tags: ['user:456'] });

    await adapter.invalidateTag('user:123');

    expect(await adapter.get('key1')).toBeNull();
    expect(await adapter.get('key2')).toBeNull();
    expect(await adapter.get('key3')).toBe('value3');
  });

  it('should delete entries', async () => {
    await adapter.set('key1', 'value');
    await adapter.delete('key1');

    expect(await adapter.get('key1')).toBeNull();
  });

  it('should clear all entries', async () => {
    await adapter.set('key1', 'value1');
    await adapter.set('key2', 'value2');

    await adapter.clear();

    expect(await adapter.get('key1')).toBeNull();
    expect(await adapter.get('key2')).toBeNull();
  });

  it('should check if key exists', async () => {
    await adapter.set('key1', 'value');

    expect(await adapter.has('key1')).toBe(true);
    expect(await adapter.has('missing')).toBe(false);
  });

  it('should handle multiple tags per entry', async () => {
    await adapter.set('key1', 'value', { tags: ['tag1', 'tag2', 'tag3'] });

    const keys1 = await adapter.getKeysByTag('tag1');
    const keys2 = await adapter.getKeysByTag('tag2');
    const keys3 = await adapter.getKeysByTag('tag3');

    expect(keys1).toContain('key1');
    expect(keys2).toContain('key1');
    expect(keys3).toContain('key1');
  });
});
