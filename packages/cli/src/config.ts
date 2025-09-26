/**
 * @fileoverview CLI configuration utilities
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PlankConfig {
  routesDir?: string;
  layoutsDir?: string;
  publicDir?: string;
  outputDir?: string;
  dev?: {
    port?: number;
    host?: string;
    open?: boolean;
    https?: boolean;
  };
  build?: {
    minify?: boolean;
    sourcemap?: boolean;
  };
}

export const defaultConfig: PlankConfig = {
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
};

/**
 * Load Plank configuration from plank.config.ts or plank.config.js
 */
export async function loadConfig(projectRoot: string): Promise<PlankConfig> {
  const configPaths = [
    resolve(projectRoot, 'plank.config.ts'),
    resolve(projectRoot, 'plank.config.js'),
    resolve(projectRoot, 'plank.config.mjs'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        // TODO: Implement proper config loading
        // This would involve transpiling TypeScript config files
        // and importing the configuration
        console.log(`📋 Loading config from: ${configPath}`);

        // For now, return default config
        return defaultConfig;
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${configPath}:`, error);
      }
    }
  }

  return defaultConfig;
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig: PlankConfig,
  defaults: PlankConfig = defaultConfig
): PlankConfig {
  return {
    ...defaults,
    ...userConfig,
    dev: {
      ...defaults.dev,
      ...userConfig.dev,
    },
    build: {
      ...defaults.build,
      ...userConfig.build,
    },
  };
}
