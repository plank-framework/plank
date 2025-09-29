/**
 * @fileoverview Main router class for file-based routing
 */

import { watch } from 'node:fs';
import { generateRouteManifest, validateManifest } from './manifest-generator.js';
import {
  buildLayoutConfig,
  buildRouteConfig,
  findRouteByPath,
  sortRoutesBySpecificity,
} from './route-config.js';
import { discoverRouteFiles } from './route-discovery.js';
import type {
  LayoutConfig,
  RouteConfig,
  RouteFileInfo,
  RouteManifest,
  RouteMatch,
  RouterConfig,
} from './types.js';

/**
 * File-based router
 */
export class FileBasedRouter {
  private config: RouterConfig;
  private routes: RouteConfig[] = [];
  private layouts: LayoutConfig[] = [];
  private manifest: RouteManifest | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private layoutWatcher: ReturnType<typeof watch> | null = null;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  /**
   * Initialize the router
   */
  async initialize(): Promise<void> {
    await this.discoverRoutes();
    await this.generateManifest();

    if (this.config.watch) {
      this.startWatching();
    }
  }

  /**
   * Discover routes from file system
   */
  async discoverRoutes(): Promise<void> {
    // Discover route files from routes directory
    const routeFiles = await discoverRouteFiles(this.config.routesDir, this.config.extensions);

    // Discover layout files from layouts directory (if configured)
    let layoutFiles: RouteFileInfo[] = [];
    if (this.config.layoutsDir) {
      layoutFiles = await discoverRouteFiles(this.config.layoutsDir, this.config.extensions);
    }

    // Filter files by type
    const pageFiles = routeFiles.filter((file) => file.type === 'page');
    const allLayoutFiles = [
      ...layoutFiles.filter((file) => file.type === 'layout'),
      ...routeFiles.filter((file) => file.type === 'layout')
    ];

    // Build configurations
    this.layouts = buildLayoutConfig(allLayoutFiles);
    this.routes = buildRouteConfig(pageFiles, this.layouts);

    // Sort routes by specificity
    this.routes = sortRoutesBySpecificity(this.routes);
  }

  /**
   * Generate route manifest
   */
  async generateManifest(): Promise<void> {
    if (!this.config.generateManifest) {
      return;
    }

    const manifestPath =
      this.config.manifestPath || `${this.config.routesDir}/../.plank/routes.json`;

    this.manifest = await generateRouteManifest(this.routes, this.layouts, manifestPath);

    // Validate manifest
    const errors = validateManifest(this.manifest);
    if (errors.length > 0) {
      throw new Error(`Manifest validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Match a route against the current path
   */
  match(path: string, method: string = 'GET'): RouteMatch | null {
    const route = findRouteByPath(this.routes, path);

    if (!route) {
      return null;
    }

    // Check if route supports the HTTP method
    if (!route.methods.includes(method)) {
      return null;
    }

    // Extract parameters
    const params = this.extractParams(route, path);

    // Extract query parameters (simplified)
    const query = this.extractQuery(path);

    return {
      route,
      params,
      query,
      matchedPath: path,
    };
  }

  /**
   * Get all routes
   */
  getRoutes(): RouteConfig[] {
    return [...this.routes];
  }

  /**
   * Get all layouts
   */
  getLayouts(): LayoutConfig[] {
    return [...this.layouts];
  }

  /**
   * Get route manifest
   */
  getManifest(): RouteManifest | null {
    return this.manifest;
  }

  /**
   * Get route by path
   */
  getRoute(path: string): RouteConfig | null {
    return findRouteByPath(this.routes, path);
  }

  /**
   * Check if a route exists
   */
  hasRoute(path: string): boolean {
    return this.getRoute(path) !== null;
  }

  /**
   * Get routes by pattern
   */
  getRoutesByPattern(pattern: string): RouteConfig[] {
    return this.routes.filter(
      (route) => route.path.includes(pattern) || route.filePath.includes(pattern)
    );
  }

  /**
   * Get dynamic routes
   */
  getDynamicRoutes(): RouteConfig[] {
    return this.routes.filter((route) => route.isDynamic);
  }

  /**
   * Get static routes
   */
  getStaticRoutes(): RouteConfig[] {
    return this.routes.filter((route) => !route.isDynamic);
  }

  /**
   * Start watching for file changes
   */
  private startWatching(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    // Watch routes directory
    this.watcher = watch(
      this.config.routesDir,
      { recursive: true },
      async (_eventType, filename) => {
        if (filename && !filename.startsWith('.')) {
          console.log(`Route file changed: ${filename}`);
          await this.discoverRoutes();
          await this.generateManifest();
        }
      }
    );

    // Also watch layouts directory if configured
    if (this.config.layoutsDir) {
      this.layoutWatcher = watch(
        this.config.layoutsDir,
        { recursive: true },
        async (_eventType, filename) => {
          if (filename && !filename.startsWith('.')) {
            console.log(`Layout file changed: ${filename}`);
            await this.discoverRoutes();
            await this.generateManifest();
          }
        }
      );
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.layoutWatcher) {
      this.layoutWatcher.close();
      this.layoutWatcher = null;
    }
  }

  /**
   * Extract parameters from path with enhanced dynamic route support
   */
  private extractParams(route: RouteConfig, path: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!route.isDynamic) {
      return params;
    }

    const routeSegments = route.path.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    // Handle catch-all routes
    if (route.isCatchAll) {
      return this.extractCatchAllParams(routeSegments, pathSegments, path);
    }

    // Handle optional routes - need to align segments properly
    if (routeSegments.length !== pathSegments.length) {
      return this.extractOptionalParams(routeSegments, pathSegments);
    }

    // Handle regular dynamic routes
    return this.extractRegularParams(routeSegments, pathSegments);
  }

  /**
   * Extract parameters from catch-all routes
   */
  private extractCatchAllParams(routeSegments: string[], pathSegments: string[], originalPath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const catchAllIndex = routeSegments.findIndex(seg => seg.startsWith('[...'));

    if (catchAllIndex === -1) {
      return params;
    }

    // Extract parameters before catch-all
    for (let i = 0; i < catchAllIndex; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];
      if (routeSegment && pathSegment && routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
        const extracted = this.extractParameterFromSegment(
          routeSegment,
          pathSegment,
          pathSegments,
          i
        );
        if (extracted) {
          Object.assign(params, extracted);
        }
      }
    }

    // Extract catch-all parameter
    const catchAllSegment = routeSegments[catchAllIndex];
    if (catchAllSegment) {
      const catchAllParam = catchAllSegment.slice(4, -1); // Remove [... and ]
      // For catch-all, we need to get the path after the catch-all position
      // Use the original path to preserve slashes when there are multiple consecutive slashes
      const routePath = routeSegments.slice(0, catchAllIndex).join('/');
      let catchAllValue = originalPath.replace(`/${routePath}`, '');

      // Only preserve leading slash if the original path had multiple consecutive slashes
      if (!originalPath.includes('//')) {
        catchAllValue = catchAllValue.replace(/^\/+/, '');
      } else {
        // For paths with multiple slashes, ensure we have exactly one leading slash
        catchAllValue = catchAllValue.replace(/^\/+/, '/');
      }

      params[catchAllParam] = catchAllValue;
    }

    return params;
  }

  /**
   * Extract parameters from optional routes
   */
  private extractOptionalParams(routeSegments: string[], pathSegments: string[]): Record<string, string> {
    const params: Record<string, string> = {};

    // Find the optional segment in the route
    let optionalIndex = -1;
    for (let i = 0; i < routeSegments.length; i++) {
      const segment = routeSegments[i];
      if (segment?.startsWith('[[') && segment.endsWith(']]')) {
        optionalIndex = i;
        break;
      }
    }

    if (optionalIndex === -1) {
      return params;
    }

    // Extract parameters by aligning segments, skipping the optional one
    let pathIndex = 0;
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];

      if (i === optionalIndex) {
        // Skip optional segment - it wasn't provided in the path
        continue;
      }

      const pathSegment = pathSegments[pathIndex];

      if (routeSegment?.startsWith('[') && routeSegment.endsWith(']')) {
        const extracted = this.extractParameterFromSegment(
          routeSegment,
          pathSegment,
          pathSegments,
          pathIndex
        );
        if (extracted) {
          Object.assign(params, extracted);
        }
      }

      pathIndex++;
    }

    return params;
  }

  /**
   * Extract parameters from regular dynamic routes
   */
  private extractRegularParams(routeSegments: string[], pathSegments: string[]): Record<string, string> {
    const params: Record<string, string> = {};

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (!routeSegment) {
        continue;
      }

      if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
        const extracted = this.extractParameterFromSegment(
          routeSegment,
          pathSegment,
          pathSegments,
          i
        );
        if (extracted) {
          Object.assign(params, extracted);
        }
      }
    }

    return params;
  }

  /**
   * Extract parameter from a single segment
   */
  private extractParameterFromSegment(
    routeSegment: string,
    pathSegment: string | undefined,
    pathSegments: string[],
    index: number
  ): { [key: string]: string | boolean; isCatchAll?: boolean } | null {
    const paramName = routeSegment.slice(1, -1);

    // Handle catch-all parameters
    if (paramName.startsWith('...')) {
      const catchAllName = paramName.slice(3);
      return {
        [catchAllName]: pathSegments.slice(index).join('/'),
        isCatchAll: true,
      };
    }

    // Handle optional parameters
    if (paramName.startsWith('[') && paramName.endsWith(']')) {
      const optionalName = paramName.slice(1, -1);
      if (pathSegment) {
        return { [optionalName]: pathSegment };
      }
      return null;
    }

    // Regular parameter
    if (pathSegment) {
      return { [paramName]: pathSegment };
    }

    return null;
  }

  /**
   * Extract query parameters from path
   */
  private extractQuery(path: string): Record<string, string> {
    const query: Record<string, string> = {};

    const queryIndex = path.indexOf('?');
    if (queryIndex === -1) {
      return query;
    }

    const queryString = path.slice(queryIndex + 1);
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }

    return query;
  }

  /**
   * Get layout hierarchy for a route
   */
  getLayoutHierarchy(routePath: string): LayoutConfig[] {
    const route = this.getRoute(routePath);
    if (!route || !route.layoutPath) {
      return [];
    }

    const hierarchy: LayoutConfig[] = [];
    const layoutMap = new Map(this.layouts.map(l => [l.filePath, l]));

    let currentLayout = layoutMap.get(route.layoutPath);
    while (currentLayout) {
      hierarchy.unshift(currentLayout);
      if (currentLayout.parent) {
        currentLayout = layoutMap.get(currentLayout.parent);
      } else {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Get all routes that use a specific layout
   */
  getRoutesByLayout(layoutPath: string): RouteConfig[] {
    return this.routes.filter(route => route.layoutPath === layoutPath);
  }

  /**
   * Get route statistics
   */
  getRouteStats(): {
    total: number;
    static: number;
    dynamic: number;
    catchAll: number;
    withLayouts: number;
  } {
    return {
      total: this.routes.length,
      static: this.routes.filter(r => !r.isDynamic).length,
      dynamic: this.routes.filter(r => r.isDynamic && !r.isCatchAll).length,
      catchAll: this.routes.filter(r => r.isCatchAll).length,
      withLayouts: this.routes.filter(r => r.layoutPath).length,
    };
  }

  /**
   * Destroy the router and cleanup resources
   */
  destroy(): void {
    this.stopWatching();
    this.routes = [];
    this.layouts = [];
    this.manifest = null;
  }
}

/**
 * Create a new file-based router
 */
export function createRouter(config: RouterConfig): FileBasedRouter {
  return new FileBasedRouter(config);
}

/**
 * Default router configuration
 */
export const defaultRouterConfig: RouterConfig = {
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  extensions: ['.plk', '.ts', '.js'],
  defaultLayout: undefined,
  generateManifest: true,
  manifestPath: undefined,
  watch: false,
};
