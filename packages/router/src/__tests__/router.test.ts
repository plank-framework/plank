/**
 * @fileoverview Tests for main router functionality
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, defaultRouterConfig, FileBasedRouter } from '../router.js';
import type { RouterConfig } from '../types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  watch: vi.fn(),
}));

describe('FileBasedRouter', () => {
  let config: RouterConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      routesDir: '/app/routes',
      layoutsDir: '/app/layouts',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should create router with default config', () => {
    const router = createRouter(defaultRouterConfig);
    expect(router).toBeInstanceOf(FileBasedRouter);
  });

  test('should initialize router', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    expect(router.getRoutes()).toHaveLength(0);
    expect(router.getLayouts()).toHaveLength(0);
  });

  test('should destroy router and cleanup', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();
    router.destroy();

    expect(router.getRoutes()).toHaveLength(0);
    expect(router.getLayouts()).toHaveLength(0);
  });

  test('should get layout hierarchy', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    const hierarchy = router.getLayoutHierarchy('/users');
    expect(hierarchy).toHaveLength(0);
  });

  test('should get routes by layout', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    const routes = router.getRoutesByLayout('/app/layouts/main.plk');
    expect(routes).toHaveLength(0);
  });

  test('should get route statistics', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    const stats = router.getRouteStats();
    expect(stats.total).toBe(0);
    expect(stats.static).toBe(0);
    expect(stats.dynamic).toBe(0);
    expect(stats.catchAll).toBe(0);
    expect(stats.withLayouts).toBe(0);
  });

  test('should match routes with parameters', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    const match = router.match('/users/123');
    expect(match).toBeNull(); // No routes configured
  });

  test('should handle catch-all route matching', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    const match = router.match('/posts/hello/world');
    expect(match).toBeNull(); // No routes configured
  });
});
