/**
 * @fileoverview Development server for Plank applications
 */

// Main development server
export { createDevServer, defaultDevServerConfig, PlankDevServer } from './dev-server.js';
// Error overlay utilities
export {
  createErrorOverlay,
  createWarningOverlay,
  generateErrorOverlay,
  generateErrorOverlayScript,
} from './error-overlay.js';
// Types
export type {
  BuildResult,
  DevServer,
  DevServerConfig,
  DevServerEvents,
  ErrorOverlay,
  FileChangeEvent,
  HMRUpdate,
  ModuleResolution,
  PlankPluginOptions,
  WatchOptions,
} from './types.js';
// Vite plugin
export { plankPlugin } from './vite-plugin.js';
