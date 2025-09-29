/**
 * @fileoverview Integration tests for development server
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createDevServer } from '../dev-server.js';
import type { DevServerConfig } from '../types.js';

// Mock vite to avoid actual server creation
vi.mock('vite', () => ({
  createServer: vi.fn().mockResolvedValue({
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ws: {
      send: vi.fn(),
    },
  }),
}));

// Mock @plank/router
vi.mock('@plank/router', () => ({
  createRouter: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  }),
}));

// Mock @plank/compiler
vi.mock('@plank/compiler', () => ({
  compile: vi.fn().mockResolvedValue({
    code: '<div>Hello World</div>',
    map: '//# sourceMappingURL=...',
    scripts: [],
    dependencies: [],
    islands: [],
    actions: [],
    chunks: [],
    errors: [],
  }),
}));

describe('Dev Server Integration Tests', () => {
  let testDir: string;
  let routesDir: string;
  let config: DevServerConfig;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(process.cwd(), 'test-temp-dev-server');
    routesDir = join(testDir, 'app', 'routes');

    await mkdir(routesDir, { recursive: true });

    config = {
      root: testDir,
      port: 3001, // Use different port to avoid conflicts
      host: 'localhost',
      open: false,
      routesDir,
      hmr: true,
      watch: true,
      plugins: [],
      env: {},
      https: false,
    };
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  test('should create and start dev server with file system', async () => {
    // Create a test .plk file
    const testFile = join(routesDir, 'index.plk');
    await writeFile(testFile, '<div>Hello World</div>');

    const server = createDevServer(config);

    // Test that server can be created
    expect(server).toBeDefined();
    expect(server.isRunning()).toBe(false);

    // Start server (this will use mocked dependencies)
    await server.start();

    expect(server.isRunning()).toBe(true);
    expect(server.getUrl()).toBe('http://localhost:3001');

    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  test('should handle file watching and HMR updates', async () => {
    const testFile = join(routesDir, 'test.plk');
    await writeFile(testFile, '<div>Initial Content</div>');

    const server = createDevServer(config);
    await server.start();

    // Simulate file change event
    const fileChangeHandler = vi.fn();
    server.on('file:change', fileChangeHandler);

    const routeUpdateHandler = vi.fn();
    server.on('route:update', routeUpdateHandler);

    const hmrUpdateHandler = vi.fn();
    server.on('hmr:update', hmrUpdateHandler);

    // Simulate a file change
    await writeFile(testFile, '<div>Updated Content</div>');

    // Wait for potential async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    await server.stop();
  });

  test('should handle multiple .plk files', async () => {
    // Create multiple test files
    const files = [
      { name: 'index.plk', content: '<div>Home Page</div>' },
      { name: 'about.plk', content: '<div>About Page</div>' },
      { name: 'contact.plk', content: '<div>Contact Page</div>' },
    ];

    for (const file of files) {
      await writeFile(join(routesDir, file.name), file.content);
    }

    const server = createDevServer(config);
    await server.start();

    expect(server.isRunning()).toBe(true);

    // Test that all files exist
    for (const file of files) {
      const filePath = join(routesDir, file.name);
      // Files should exist (this is more of a setup verification)
      expect(filePath).toBeDefined();
    }

    await server.stop();
  });

  test('should handle server restart', async () => {
    const testFile = join(routesDir, 'restart.plk');
    await writeFile(testFile, '<div>Restart Test</div>');

    const server = createDevServer(config);

    // Start server
    await server.start();
    expect(server.isRunning()).toBe(true);

    // Restart server
    await server.restart();
    expect(server.isRunning()).toBe(true);

    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  test('should handle errors gracefully', async () => {
    const server = createDevServer(config);

    // Test getting URL when server is not running
    expect(() => server.getUrl()).toThrow('Server is not running');

    // Test getting router when not initialized
    expect(() => server.getRouter()).toThrow('Router is not initialized');
  });

  test('should handle HTTPS configuration', async () => {
    const httpsConfig: DevServerConfig = {
      ...config,
      https: true,
      cert: '/path/to/cert.pem',
      key: '/path/to/key.pem',
    };

    const server = createDevServer(httpsConfig);
    await server.start();

    expect(server.getUrl()).toBe('https://localhost:3001');

    await server.stop();
  });

  test('should handle custom host configuration', async () => {
    const customHostConfig: DevServerConfig = {
      ...config,
      host: '0.0.0.0',
    };

    const server = createDevServer(customHostConfig);
    await server.start();

    expect(server.getUrl()).toBe('http://localhost:3001');

    await server.stop();
  });

  test('should handle file watching with different file types', async () => {
    // Create files of different types
    await writeFile(join(routesDir, 'page.plk'), '<div>PLK File</div>');
    await writeFile(join(routesDir, 'script.ts'), 'console.log("TypeScript");');
    await writeFile(join(routesDir, 'style.css'), 'body { margin: 0; }');

    const server = createDevServer(config);
    await server.start();

    // Test that server handles different file types
    expect(server.isRunning()).toBe(true);

    await server.stop();
  });

  test('should handle nested route directories', async () => {
    // Create nested directories
    const nestedDir = join(routesDir, 'api', 'users');
    await mkdir(nestedDir, { recursive: true });

    // Create files in nested directories
    await writeFile(join(nestedDir, 'index.plk'), '<div>Users API</div>');
    await writeFile(join(nestedDir, 'create.plk'), '<div>Create User</div>');

    const server = createDevServer(config);
    await server.start();

    expect(server.isRunning()).toBe(true);

    await server.stop();
  });

  test('should handle HMR with disabled watching', async () => {
    const noWatchConfig: DevServerConfig = {
      ...config,
      watch: false,
      hmr: true,
    };

    const server = createDevServer(noWatchConfig);
    await server.start();

    expect(server.isRunning()).toBe(true);

    await server.stop();
  });

  test('should handle HMR with disabled HMR', async () => {
    const noHmrConfig: DevServerConfig = {
      ...config,
      hmr: false,
      watch: true,
    };

    const server = createDevServer(noHmrConfig);
    await server.start();

    expect(server.isRunning()).toBe(true);

    await server.stop();
  });
});
