/**
 * @fileoverview Configuration helper for plank.config.ts files
 */

import type { PlankConfig } from './config.js';

/**
 * Define Plank configuration with type safety
 */
export function defineConfig(config: PlankConfig): PlankConfig {
  return config;
}

// Re-export types for convenience
export type { PlankConfig } from './config.js';
