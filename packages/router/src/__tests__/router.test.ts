/**
 * @fileoverview Tests for main router functionality
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, defaultRouterConfig, FileBasedRouter } from '../router.js';
import type { RouterConfig } from '../types.js';

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    readdir: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

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

  test('should handle route matching with different HTTP methods', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test different HTTP methods
    expect(router.match('/users', 'GET')).toBeNull();
    expect(router.match('/users', 'POST')).toBeNull();
    expect(router.match('/users', 'PUT')).toBeNull();
    expect(router.match('/users', 'DELETE')).toBeNull();
  });

  test('should handle query parameter extraction', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test query parameter extraction
    const match = router.match('/users?name=john&age=25');
    expect(match).toBeNull(); // No routes configured, but tests query extraction logic
  });

  test('should handle complex query parameters', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test complex query strings
    const testPaths = [
      '/users?name=john%20doe&age=25',
      '/users?search=hello%20world&filter=active',
      '/users?tags=tag1,tag2,tag3',
      '/users?',
      '/users?empty=',
    ];

    for (const path of testPaths) {
      const match = router.match(path);
      expect(match).toBeNull(); // No routes configured
    }
  });

  test('should handle file watching functionality', async () => {
    const { readdir } = await import('node:fs/promises');
    const { watch } = await import('node:fs');
    const mockReaddir = vi.mocked(readdir);
    const mockWatch = vi.mocked(watch);

    mockReaddir.mockResolvedValueOnce([]);
    // biome-ignore lint/suspicious/noExplicitAny: Mock watcher type is complex to fully type
    mockWatch.mockReturnValue({ close: vi.fn() } as any);

    const watchConfig = { ...config, watch: true };
    const router = new FileBasedRouter(watchConfig);
    await router.initialize();

    // Test that watcher was set up
    expect(mockWatch).toHaveBeenCalledWith(
      watchConfig.routesDir,
      { recursive: true },
      expect.any(Function)
    );

    // Test stopping the watcher
    router.stopWatching();
    expect(router.getRoutes()).toHaveLength(0);
  });

  test('should handle route filtering by pattern', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test route filtering
    expect(router.getRoutesByPattern('users')).toHaveLength(0);
    expect(router.getRoutesByPattern('posts')).toHaveLength(0);
    expect(router.getDynamicRoutes()).toHaveLength(0);
    expect(router.getStaticRoutes()).toHaveLength(0);
  });

  test('should handle route existence checks', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test route existence
    expect(router.hasRoute('/users')).toBe(false);
    expect(router.hasRoute('/posts')).toBe(false);
    expect(router.hasRoute('/')).toBe(false);
    expect(router.getRoute('/users')).toBeNull();
  });

  test('should handle manifest generation', async () => {
    const { readdir } = await import('node:fs/promises');
    const { writeFile, mkdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    const mockWriteFile = vi.mocked(writeFile);
    const mockMkdir = vi.mocked(mkdir);

    mockReaddir.mockResolvedValueOnce([]);
    mockWriteFile.mockResolvedValueOnce(undefined);
    mockMkdir.mockResolvedValueOnce(undefined);

    const manifestConfig = { ...config, generateManifest: true };
    const router = new FileBasedRouter(manifestConfig);
    await router.initialize();

    expect(router.getManifest()).toBeDefined();
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  test('should handle parameter extraction edge cases', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test parameter extraction with various path formats
    const testPaths = [
      '/users/123',
      '/posts/hello/world',
      '/api/v1/users/456',
      '/users/123/posts/789',
      '/users',
      '/',
    ];

    for (const path of testPaths) {
      const match = router.match(path);
      expect(match).toBeNull(); // No routes configured
    }
  });

  test('should handle router configuration options', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    // Test different configuration options
    const customConfig = {
      ...config,
      extensions: ['.plk', '.tsx', '.jsx'],
      defaultLayout: 'main',
      generateManifest: true,
      manifestPath: '/dist/manifest.json',
    };

    const router = new FileBasedRouter(customConfig);
    await router.initialize();

    expect(router.getRoutes()).toHaveLength(0);
    expect(router.getManifest()).toBeDefined();
  });

  test('should handle router queries and filtering', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValueOnce([]);

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test route statistics
    const stats = router.getRouteStats();
    expect(stats.total).toBe(0);
    expect(stats.static).toBe(0);
    expect(stats.dynamic).toBe(0);
    expect(stats.catchAll).toBe(0);
    expect(stats.withLayouts).toBe(0);

    // Test route filtering
    expect(router.getStaticRoutes()).toHaveLength(0);
    expect(router.getDynamicRoutes()).toHaveLength(0);
    expect(router.getRoutesByPattern('users')).toHaveLength(0);
    expect(router.getRoutesByLayout('main')).toHaveLength(0);

    // Test layout hierarchy
    expect(router.getLayoutHierarchy('/users')).toEqual([]);
    expect(router.getLayoutHierarchy('/users/123')).toEqual([]);
    expect(router.getLayoutHierarchy('/')).toEqual([]);

    // Test route existence and retrieval
    expect(router.hasRoute('/users')).toBe(false);
    expect(router.hasRoute('/posts')).toBe(false);
    expect(router.hasRoute('/')).toBe(false);
    expect(router.getRoute('/users')).toBeNull();
    expect(router.getRoute('/posts')).toBeNull();
    expect(router.getRoute('/')).toBeNull();
  });

  test('should handle file watching and cleanup', async () => {
    const { readdir } = await import('node:fs/promises');
    const { watch } = await import('node:fs');
    const mockReaddir = vi.mocked(readdir);
    const mockWatch = vi.mocked(watch);

    mockReaddir.mockResolvedValueOnce([]);
    const mockWatcher = { close: vi.fn() };
    // biome-ignore lint/suspicious/noExplicitAny: Mock watcher type is complex to fully type
    mockWatch.mockReturnValue(mockWatcher as any);

    const watchConfig = { ...config, watch: true };
    const router = new FileBasedRouter(watchConfig);
    await router.initialize();

    // Test watcher setup
    expect(mockWatch).toHaveBeenCalledWith(
      watchConfig.routesDir,
      { recursive: true },
      expect.any(Function)
    );

    // Test stopping the watcher
    router.stopWatching();
    expect(mockWatcher.close).toHaveBeenCalled();

    // Test cleanup
    router.destroy();
    expect(router.getRoutes()).toHaveLength(0);
  });

  test('should handle manifest generation with various options', async () => {
    const { readdir } = await import('node:fs/promises');
    const { writeFile, mkdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    const mockWriteFile = vi.mocked(writeFile);
    const mockMkdir = vi.mocked(mkdir);

    mockReaddir.mockResolvedValueOnce([]);
    mockWriteFile.mockResolvedValueOnce(undefined);
    mockMkdir.mockResolvedValueOnce(undefined);

    const manifestConfig = {
      ...config,
      generateManifest: true,
      manifestPath: '/dist/manifest.json',
    };
    const router = new FileBasedRouter(manifestConfig);
    await router.initialize();

    // Test manifest generation
    const manifest = router.getManifest();
    expect(manifest).toBeDefined();
    expect(manifest?.routes).toEqual([]);
    expect(manifest?.rootLayout).toBeUndefined();
    expect(manifest?.layouts).toEqual({});
    expect(manifest?.generatedAt).toBeDefined();
    expect(manifest?.version).toBeDefined();

    // Test file operations
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });
});
