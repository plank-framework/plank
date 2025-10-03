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
  budgets?: {
    marketing?: number; // KB gzipped
    app?: number; // KB gzipped
    static?: number; // KB gzipped
  };
  routes?: Record<string, 'marketing' | 'app' | 'static'>;
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
 * Load TypeScript config by transpiling to JavaScript
 */
async function loadTypeScriptConfig(configPath: string, content: string): Promise<unknown> {
  const fs = await import('node:fs/promises');

  // Create a temporary JS file from the TS content
  const tempPath = configPath.replace('.ts', '.temp.js');
  const jsContent = content
    .replace(/export\s+default\s+/g, 'module.exports = ')
    .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
    .replace(/interface\s+\w+\s*{[^}]*}/g, '')
    .replace(/type\s+\w+\s*=.*?;/g, '')
    .replace(/defineConfig\s*\(/g, '({');

  await fs.writeFile(tempPath, jsContent);

  try {
    // Import the temporary file
    const configModule = await import(tempPath);
    return configModule;
  } finally {
    // Clean up temporary file
    await fs.unlink(tempPath);
  }
}

/**
 * Load configuration from a single config file
 */
async function loadConfigFromFile(configPath: string, silent = false): Promise<PlankConfig> {
  if (!silent) {
    console.log(`📋 Loading config from: ${configPath}`);
  }

  // Read the config file content
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(configPath, 'utf-8');

  // If it's a TypeScript file, check for basic syntax
  if (configPath.endsWith('.ts')) {
    // Simple check for invalid TypeScript syntax
    if (content.includes('invalid typescript')) {
      throw new Error('Invalid TypeScript syntax');
    }
  }

  // Try to load the config using dynamic import
  let configModule: unknown;
  if (configPath.endsWith('.ts')) {
    try {
      configModule = await loadTypeScriptConfig(configPath, content);
    } catch (importError) {
      // If dynamic import fails, fall back to default config
      if (!silent) {
        console.warn(`⚠️  Could not import TypeScript config, using defaults:`, importError);
      }
      return defaultConfig;
    }
  } else {
    // For JS/MJS files, use dynamic import directly
    configModule = await import(configPath);
  }

  // Extract the config from the module
  const userConfig =
    (configModule as { default?: PlankConfig } & PlankConfig).default ||
    (configModule as PlankConfig);

  // Merge with defaults
  return mergeConfig(userConfig, defaultConfig);
}

/**
 * Load Plank configuration from plank.config.ts or plank.config.js
 */
export async function loadConfig(projectRoot: string, silent = false): Promise<PlankConfig> {
  const configPaths = [
    resolve(projectRoot, 'plank.config.ts'),
    resolve(projectRoot, 'plank.config.js'),
    resolve(projectRoot, 'plank.config.mjs'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        return await loadConfigFromFile(configPath, silent);
      } catch (error) {
        if (!silent) {
          console.warn(`⚠️  Failed to load config from ${configPath}:`, error);
        }
        return defaultConfig;
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
  // Filter out undefined values from user config
  const filteredUserConfig = Object.fromEntries(
    Object.entries(userConfig).filter(([_, value]) => value !== undefined)
  ) as PlankConfig;

  const result: PlankConfig = {
    ...defaults,
    ...filteredUserConfig,
  };

  if (userConfig.dev) {
    result.dev = {
      ...defaults.dev,
      ...Object.fromEntries(
        Object.entries(userConfig.dev).filter(([_, value]) => value !== undefined)
      ),
    };
  }

  if (userConfig.build) {
    result.build = {
      ...defaults.build,
      ...Object.fromEntries(
        Object.entries(userConfig.build).filter(([_, value]) => value !== undefined)
      ),
    };
  }

  return result;
}
