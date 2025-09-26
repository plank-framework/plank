/**
 * @fileoverview Tests for configuration system
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig, loadConfig, mergeConfig } from '../config.js';

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
};

vi.stubGlobal('console', mockConsole);
vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn(() => '/tmp/plank-test-config'),
});

describe('configuration system', () => {
  const testDir = '/tmp/plank-test-config';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.warn.mockClear();

    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('defaultConfig', () => {
    it('should have correct default values', () => {
      expect(defaultConfig).toEqual({
        routesDir: './app/routes',
        layoutsDir: './app/layouts',
        publicDir: './public',
        outputDir: './dist',
        dev: {
          port: 3000,
          host: 'localhost',
          open: true,
          https: false,
        },
        build: {
          minify: true,
          sourcemap: false,
        },
      });
    });
  });

  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      const config = await loadConfig(testDir);

      expect(config).toEqual(defaultConfig);
    });

    it('should return default config when plank.config.ts exists but cannot be loaded', async () => {
      // Create a malformed config file
      await writeFile(resolve(testDir, 'plank.config.ts'), 'invalid typescript');

      const config = await loadConfig(testDir);

      expect(config).toEqual(defaultConfig);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config from'),
        expect.any(Error)
      );
    });

    it('should log when loading config from plank.config.ts', async () => {
      // Create a valid config file
      const configContent = `import { defineConfig } from 'plank';

export default defineConfig({
  routesDir: './src/pages',
  dev: {
    port: 4000,
  },
});`;

      await writeFile(resolve(testDir, 'plank.config.ts'), configContent);

      await loadConfig(testDir);

      expect(mockConsole.log).toHaveBeenCalledWith(
        `📋 Loading config from: ${resolve(testDir, 'plank.config.ts')}`
      );
    });

    it('should try multiple config file extensions', async () => {
      // Create plank.config.js
      await writeFile(resolve(testDir, 'plank.config.js'), 'export default {};');

      await loadConfig(testDir);

      expect(mockConsole.log).toHaveBeenCalledWith(
        `📋 Loading config from: ${resolve(testDir, 'plank.config.js')}`
      );
    });

    it('should try plank.config.mjs', async () => {
      // Create plank.config.mjs
      await writeFile(resolve(testDir, 'plank.config.mjs'), 'export default {};');

      await loadConfig(testDir);

      expect(mockConsole.log).toHaveBeenCalledWith(
        `📋 Loading config from: ${resolve(testDir, 'plank.config.mjs')}`
      );
    });
  });

  describe('mergeConfig', () => {
    it('should merge user config with defaults', () => {
      const userConfig = {
        routesDir: './src/pages',
        dev: {
          port: 4000,
          https: true,
        },
        build: {
          minify: false,
        },
      };

      const merged = mergeConfig(userConfig);

      expect(merged).toEqual({
        routesDir: './src/pages',
        layoutsDir: './app/layouts',
        publicDir: './public',
        outputDir: './dist',
        dev: {
          port: 4000,
          host: 'localhost',
          open: true,
          https: true,
        },
        build: {
          minify: false,
          sourcemap: false,
        },
      });
    });

    it('should use provided defaults when merging', () => {
      const customDefaults = {
        routesDir: './custom/routes',
        dev: {
          port: 5000,
        },
      };

      const userConfig = {
        dev: {
          https: true,
        },
      };

      const merged = mergeConfig(userConfig, customDefaults);

      expect(merged).toEqual({
        routesDir: './custom/routes',
        dev: {
          port: 5000,
          https: true,
        },
      });
    });

    it('should handle empty user config', () => {
      const merged = mergeConfig({});

      expect(merged).toEqual(defaultConfig);
    });

    it('should handle partial dev config', () => {
      const userConfig = {
        dev: {
          port: 4000,
        },
      };

      const merged = mergeConfig(userConfig);

      expect(merged.dev).toEqual({
        port: 4000,
        host: 'localhost',
        open: true,
        https: false,
      });
    });

    it('should handle partial build config', () => {
      const userConfig = {
        build: {
          sourcemap: true,
        },
      };

      const merged = mergeConfig(userConfig);

      expect(merged.build).toEqual({
        minify: true,
        sourcemap: true,
      });
    });

    it('should handle undefined values in user config', () => {
      const userConfig = {
        routesDir: undefined,
        dev: {
          port: undefined,
          https: true,
        },
      };

      const merged = mergeConfig(userConfig);

      expect(merged.routesDir).toBe('./app/routes'); // Should use default
      expect(merged.dev?.port).toBe(3000); // Should use default
      expect(merged.dev?.https).toBe(true); // Should use user value
    });
  });
});
