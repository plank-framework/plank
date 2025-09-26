/**
 * @fileoverview Tests for route discovery
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  discoverRouteFiles,
  matchesRoutePattern,
  normalizeRoutePath,
  validateRoutePath,
} from '../route-discovery.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
}));

describe('Route Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle non-existent directory', async () => {
    // Test with a path that doesn't exist - this should return empty array
    const files = await discoverRouteFiles('/definitely-does-not-exist-12345', ['.plk']);

    expect(files).toHaveLength(0);
  });

  test('should validate route paths', () => {
    expect(validateRoutePath('/users')).toBe(true);
    expect(validateRoutePath('/users/[id]')).toBe(true);
    expect(validateRoutePath('/users/[...slug]')).toBe(true);
    expect(validateRoutePath('/users/[[id]]')).toBe(true);

    expect(validateRoutePath('users')).toBe(false); // No leading slash
    expect(validateRoutePath('/users//profile')).toBe(false); // Double slash
    expect(validateRoutePath('/users/[]')).toBe(false); // Empty brackets
    expect(validateRoutePath('/users/[[id]]]')).toBe(false); // Nested brackets
  });

  test('should normalize route paths', () => {
    expect(normalizeRoutePath('/users')).toBe('/users');
    expect(normalizeRoutePath('users')).toBe('/users');
    expect(normalizeRoutePath('/users/')).toBe('/users');
    expect(normalizeRoutePath('')).toBe('/');
    expect(normalizeRoutePath('/')).toBe('/');
  });

  test('should match route patterns', () => {
    expect(matchesRoutePattern('/users/123', '/users/[id]')).toBe(true);
    expect(matchesRoutePattern('/users/123', '/users/[id]/profile')).toBe(false);
    expect(matchesRoutePattern('/users/123/profile', '/users/[id]/profile')).toBe(true);
    expect(matchesRoutePattern('/users/123/456', '/users/[...slug]')).toBe(true);
  });
});
