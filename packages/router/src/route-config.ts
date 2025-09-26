/**
 * @fileoverview Route configuration builder
 */

import { normalizeRoutePath } from './route-discovery.js';
import type { LayoutConfig, LayoutMeta, RouteConfig, RouteFileInfo, RouteMeta } from './types.js';

/**
 * Build route configuration from discovered files
 */
export function buildRouteConfig(
  files: RouteFileInfo[],
  layouts: LayoutConfig[] = []
): RouteConfig[] {
  const routes: RouteConfig[] = [];
  const layoutMap = new Map<string, LayoutConfig>();

  // Build layout map
  for (const layout of layouts) {
    layoutMap.set(layout.name, layout);
  }

  // Group files by route path
  const routeGroups = new Map<string, RouteFileInfo[]>();

  for (const file of files) {
    const routePath = normalizeRoutePath(file.routePath);

    if (!routeGroups.has(routePath)) {
      routeGroups.set(routePath, []);
    }

    routeGroups.get(routePath)?.push(file);
  }

  // Build route configurations
  for (const [routePath, routeFiles] of routeGroups) {
    const routeConfig = buildSingleRouteConfig(routePath, routeFiles, layoutMap);
    if (routeConfig) {
      routes.push(routeConfig);
    }
  }

  return routes;
}

/**
 * Build configuration for a single route
 */
function buildSingleRouteConfig(
  routePath: string,
  files: RouteFileInfo[],
  _layoutMap: Map<string, LayoutConfig>
): RouteConfig | null {
  // Find page file
  const pageFile = files.find((f) => f.type === 'page');
  if (!pageFile) {
    return null;
  }

  // Find layout file
  const layoutFile = files.find((f) => f.type === 'layout');
  const layoutPath = layoutFile?.path;

  // Extract parameters from the most dynamic file
  const dynamicFile = files.find((f) => f.isDynamic) || pageFile;
  const params = dynamicFile.params;
  const isDynamic = dynamicFile.isDynamic;
  const isCatchAll = dynamicFile.isCatchAll;

  // Build route metadata
  const meta = buildRouteMeta(files);

  // Determine supported HTTP methods
  const methods = determineHttpMethods(files);

  return {
    path: routePath,
    filePath: pageFile.path,
    params,
    isDynamic,
    isCatchAll,
    layoutPath,
    pagePath: pageFile.path,
    methods,
    meta,
  };
}

/**
 * Build route metadata from files
 */
function buildRouteMeta(files: RouteFileInfo[]): RouteMeta {
  const meta: RouteMeta = {
    indexable: true,
    priority: 0.5,
    changefreq: 'monthly',
  };

  // Extract metadata from file names and types
  for (const file of files) {
    // Set title from file name if not already set
    if (!meta.title && file.name !== 'index' && file.name !== 'page') {
      meta.title = formatTitle(file.name);
    }

    // Set description from file name
    if (!meta.description) {
      meta.description = `Page for ${file.name}`;
    }
  }

  return meta;
}

/**
 * Determine HTTP methods supported by route files
 */
function determineHttpMethods(files: RouteFileInfo[]): string[] {
  const methods = new Set<string>(['GET']);

  // Check for specific method files
  for (const file of files) {
    const method = extractHttpMethod(file.name);
    if (method) {
      methods.add(method);
    }
  }

  return Array.from(methods);
}

/**
 * Extract HTTP method from file name
 */
function extractHttpMethod(fileName: string): string | null {
  const methodPattern = /^(get|post|put|patch|delete|head|options)\./i;
  const match = fileName.match(methodPattern);
  return match?.[1]?.toUpperCase() ?? null;
}

/**
 * Format title from file name
 */
function formatTitle(fileName: string): string {
  return fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Build layout configuration from files
 */
export function buildLayoutConfig(files: RouteFileInfo[]): LayoutConfig[] {
  const layouts: LayoutConfig[] = [];

  for (const file of files) {
    if (file.type === 'layout') {
      const layoutConfig: LayoutConfig = {
        filePath: file.path,
        name: file.name,
        isRoot: file.routePath === '/',
        meta: buildLayoutMeta(file),
      };

      layouts.push(layoutConfig);
    }
  }

  return layouts;
}

/**
 * Build layout metadata
 */
function buildLayoutMeta(file: RouteFileInfo): LayoutMeta {
  return {
    title: formatTitle(file.name),
    meta: {},
    stylesheets: [],
    scripts: [],
  };
}

/**
 * Validate route configuration
 */
export function validateRouteConfig(route: RouteConfig): string[] {
  const errors: string[] = [];

  // Validate path
  if (!route.path || !route.path.startsWith('/')) {
    errors.push('Route path must start with /');
  }

  // Validate file path
  if (!route.filePath) {
    errors.push('Route must have a file path');
  }

  // Validate parameters
  if (route.isDynamic && route.params.length === 0) {
    errors.push('Dynamic route must have parameters');
  }

  // Validate methods
  if (route.methods.length === 0) {
    errors.push('Route must support at least one HTTP method');
  }

  return errors;
}

/**
 * Sort routes by specificity (static routes first, then dynamic)
 */
export function sortRoutesBySpecificity(routes: RouteConfig[]): RouteConfig[] {
  return [...routes].sort((a, b) => {
    // Static routes first
    if (!a.isDynamic && b.isDynamic) return -1;
    if (a.isDynamic && !b.isDynamic) return 1;

    // Then by path length (more specific first)
    const aLength = a.path.split('/').length;
    const bLength = b.path.split('/').length;
    if (aLength !== bLength) return bLength - aLength;

    // Finally by path alphabetically
    return a.path.localeCompare(b.path);
  });
}

/**
 * Find route by path
 */
export function findRouteByPath(routes: RouteConfig[], path: string): RouteConfig | null {
  const normalizedPath = normalizeRoutePath(path);

  // First try exact match
  const exactMatch = routes.find((route) => route.path === normalizedPath);
  if (exactMatch) {
    return exactMatch;
  }

  // Then try dynamic matches
  for (const route of routes) {
    if (route.isDynamic && matchesRoutePath(route, normalizedPath)) {
      return route;
    }
  }

  return null;
}

/**
 * Check if a route matches a given path
 */
function matchesRoutePath(route: RouteConfig, path: string): boolean {
  const routeSegments = route.path.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    return false;
  }

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (!routeSegment || !pathSegment) {
      return false;
    }

    // Exact match
    if (routeSegment === pathSegment) {
      continue;
    }

    // Dynamic segment
    if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
      continue;
    }

    // No match
    return false;
  }

  return true;
}
