/**
 * @fileoverview File-based routing system for Plank applications
 */

// Client-side router
export {
  ClientRouter,
  type ClientRouterConfig,
  createClientRouter,
  type NavigationEvent,
  type NavigationOptions,
} from './client-router.js';
// Manifest generation
export {
  generateRobotsTxt,
  generateRouteManifest,
  generateRouteTypes,
  generateSitemap,
  loadManifest,
  validateManifest,
} from './manifest-generator.js';
// Route configuration
export {
  buildLayoutConfig,
  buildRouteConfig,
  findRouteByPath,
  sortRoutesBySpecificity,
  validateRouteConfig,
} from './route-config.js';
// Route discovery and parsing
export {
  discoverRouteFiles,
  matchesRoutePattern,
  normalizeRoutePath,
  validateRoutePath,
} from './route-discovery.js';
// Main router class
export { createRouter, defaultRouterConfig, FileBasedRouter } from './router.js';

// Types
export type {
  LayoutConfig,
  LayoutMeta,
  RouteConfig,
  RouteFileInfo,
  RouteFileType,
  RouteManifest,
  RouteManifestEntry,
  RouteMatch,
  RouteMeta,
  RouterConfig,
} from './types.js';
