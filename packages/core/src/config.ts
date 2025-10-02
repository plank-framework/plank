/**
 * @fileoverview Plank configuration types and utilities
 */

export interface PlankConfig {
  /** Routes directory */
  routesDir?: string;
  /** Layouts directory */
  layoutsDir?: string;
  /** Public assets directory */
  publicDir?: string;
  /** Output directory for builds */
  outputDir?: string;
  /** Base URL for the application */
  baseUrl?: string;
  /** Development server configuration */
  dev?: {
    port?: number;
    host?: string;
    https?: boolean;
  };
  /** Build configuration */
  build?: {
    minify?: boolean;
    sourcemap?: boolean;
  };
}

/**
 * Define a Plank configuration
 */
export function defineConfig(config: PlankConfig): PlankConfig {
  return config;
}
