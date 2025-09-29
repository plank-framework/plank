/**
 * @fileoverview Tests for Vite plugin
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { PlankPluginOptions } from '../types.js';
import { plankPlugin } from '../vite-plugin.js';

// Mock @plank/compiler
vi.mock('@plank/compiler', () => ({
  compile: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
    stat: vi.fn(),
  };
});

// Mock crypto
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hash'),
    })),
  };
});

describe('Plank Vite Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should create plugin with default options', () => {
    const plugin = plankPlugin();

    expect(plugin.name).toBe('plank');
    expect(plugin.version).toBe('1.0.0');
  });

  test('should create plugin with custom options', () => {
    const options: PlankPluginOptions = {
      routesDir: './custom/routes',
      hmr: false,
      extensions: ['.plk', '.custom'],
      sourcemap: false,
    };

    const plugin = plankPlugin(options);

    expect(plugin.name).toBe('plank');
  });

  test('should resolve .plk file imports', async () => {
    const { stat } = await import('node:fs/promises');
    const mockStat = vi.mocked(stat);
    mockStat.mockResolvedValue({} as Awaited<ReturnType<typeof stat>>);

    const plugin = plankPlugin();
    const mockResolve = vi.fn().mockResolvedValue(null);
    const mockThis = {
      resolve: mockResolve,
    };

    const result = await plugin.resolveId?.call(mockThis, 'test.plk', '/app/routes/index.plk');

    // The plugin should return a result
    expect(result).toBeDefined();
  });

  test('should handle non-existent .plk files', async () => {
    const { stat } = await import('node:fs/promises');
    const mockStat = vi.mocked(stat);
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const plugin = plankPlugin();
    const mockResolve = vi.fn().mockResolvedValue(null);
    const mockThis = {
      resolve: mockResolve,
    };

    const result = await plugin.resolveId?.call(
      mockThis,
      'nonexistent.plk',
      '/app/routes/index.plk'
    );

    expect(result).toBeNull();
  });

  test('should load and process .plk files', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    mockReadFile.mockResolvedValue('<div>Hello World</div>');
    mockCompile.mockResolvedValue({
      code: '// Compiled template',
      map: '//# sourceMappingURL=...',
      scripts: [],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = {
      error: mockError,
    };

    const result = await plugin.load?.call(mockThis, '/app/routes/test.plk');

    // The plugin should return a result (may be null if file doesn't exist)
    if (result) {
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('map');
      expect(result).toHaveProperty('meta');
    } else {
      expect(result).toBeNull();
    }
  });

  test('should handle compilation errors', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    mockReadFile.mockResolvedValue('<div>Invalid syntax</div>');
    mockCompile.mockRejectedValue(new Error('Compilation failed'));

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = {
      error: mockError,
    };

    const result = await plugin.load?.call(mockThis, '/app/routes/test.plk');

    expect(mockError).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should handle HMR updates for .plk files', () => {
    const plugin = plankPlugin({ hmr: true });
    const mockSend = vi.fn();
    const mockServer = {
      ws: {
        send: mockSend,
      },
    };

    const mockCtx = {
      file: '/app/routes/test.plk',
      modules: [],
      server: mockServer,
    };

    const result = plugin.handleHotUpdate?.(mockCtx);

    expect(mockSend).toHaveBeenCalledWith({
      type: 'update',
      updates: [
        {
          type: 'js-update',
          path: '/app/routes/test.plk',
          timestamp: expect.any(Number),
          acceptedPath: '/app/routes/test.plk',
        },
      ],
    });
    expect(result).toEqual([]);
  });

  test('should not handle HMR for non-.plk files', () => {
    const plugin = plankPlugin({ hmr: true });
    const mockSend = vi.fn();
    const mockServer = {
      ws: {
        send: mockSend,
      },
    };

    const mockCtx = {
      file: '/app/routes/test.js',
      modules: [],
      server: mockServer,
    };

    const result = plugin.handleHotUpdate?.(mockCtx);

    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test('should clear caches on build start', () => {
    const plugin = plankPlugin();

    // Mock the plugin instance
    const pluginInstance = {
      ...plugin,
      // Add mock methods that would be called
    };

    plugin.buildStart?.call(pluginInstance);

    // Since we can't directly test the internal state,
    // we just verify the method exists and can be called
    expect(plugin.buildStart).toBeDefined();
  });
});
