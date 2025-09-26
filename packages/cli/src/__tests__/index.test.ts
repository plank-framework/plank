/**
 * @fileoverview Tests for CLI main index file
 */

import { describe, expect, it } from 'vitest';
import { defineConfig } from '../define-config.js';

describe('CLI index', () => {
  it('should export defineConfig function', () => {
    expect(defineConfig).toBeDefined();
    expect(typeof defineConfig).toBe('function');
  });

  it('should allow defineConfig to be called with a config object', () => {
    const config = {
      routesDir: './app/routes',
      dev: {
        port: 3000,
      },
    };

    const result = defineConfig(config);
    expect(result).toEqual(config);
  });
});
