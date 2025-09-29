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

  // Build layout map using file path as key for better matching
  for (const layout of layouts) {
    layoutMap.set(layout.filePath, layout);
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
    const routeConfig = buildSingleRouteConfig(routePath, routeFiles, layoutMap, layouts);
    if (routeConfig) {
      routes.push(routeConfig);
    }
  }

  return routes;
}

/**
 * Find the most appropriate layout for a route path based on directory structure
 */
function findAppropriateLayout(routePath: string, layouts: LayoutConfig[]): string | undefined {
  // Create a map of layout paths to their directory structure
  const layoutMap = new Map<string, string[]>();

  for (const layout of layouts) {
    // Extract the directory path from the layout file path
    // e.g., "/path/to/layouts/admin/layout.plk" -> ["admin"]
    const pathParts = layout.filePath.split('/');
    const layoutsIndex = pathParts.indexOf('layouts');
    if (layoutsIndex !== -1 && layoutsIndex < pathParts.length - 2) {
      const layoutDir = pathParts.slice(layoutsIndex + 1, -1); // Get directory path after 'layouts'
      layoutMap.set(layout.filePath, layoutDir);
    } else if (layout.isRoot) {
      // Root layout has no directory path
      layoutMap.set(layout.filePath, []);
    }
  }

  // Walk up the route path to find the most specific matching layout
  const routeSegments = routePath.split('/').filter(Boolean);

  for (let i = routeSegments.length; i >= 0; i--) {
    const candidateSegments = routeSegments.slice(0, i);

    // Find layout that matches this directory structure
    for (const [layoutPath, layoutSegments] of layoutMap) {
      if (arraysEqual(candidateSegments, layoutSegments)) {
        return layoutPath;
      }
    }
  }

  // Fallback to root layout if no specific match found
  const rootLayout = layouts.find(layout => layout.isRoot);
  return rootLayout?.filePath;
}

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

/**
 * Build configuration for a single route
 */
function buildSingleRouteConfig(
  routePath: string,
  files: RouteFileInfo[],
  _layoutMap: Map<string, LayoutConfig>,
  layouts: LayoutConfig[]
): RouteConfig | null {
  // Find page file
  const pageFile = files.find((f) => f.type === 'page');
  if (!pageFile) {
    return null;
  }

  // Find layout file in the same directory first
  const layoutFile = files.find((f) => f.type === 'layout');
  let layoutPath = layoutFile?.path;

  // If no layout in same directory, find appropriate layout from layouts directory
  if (!layoutPath && layouts.length > 0) {
    layoutPath = findAppropriateLayout(routePath, layouts);
  }

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
 * Build layout configuration from files with nested layout support
 */
export function buildLayoutConfig(files: RouteFileInfo[]): LayoutConfig[] {
  const layouts: LayoutConfig[] = [];
  const layoutMap = new Map<string, LayoutConfig>();

  // First pass: create all layouts
  for (const file of files) {
    if (file.type === 'layout') {
      // Determine if this is the root layout based on directory structure
      // Root layout is the one at the root of the layouts directory
      const isRoot = file.routePath === '/' || file.routePath === '';

      const layoutConfig: LayoutConfig = {
        filePath: file.path,
        name: file.name,
        isRoot,
        meta: buildLayoutMeta(file),
      };

      layouts.push(layoutConfig);
      layoutMap.set(file.routePath, layoutConfig);
    }
  }

  // Second pass: establish parent-child relationships for nested layouts
  for (const layout of layouts) {
    if (!layout.isRoot) {
      const parentPath = findParentLayoutPath(layout.filePath, layoutMap);
      if (parentPath) {
        layout.parent = parentPath;
      }
    }
  }

  return layouts;
}

/**
 * Find parent layout path for nested layouts
 */
function findParentLayoutPath(
  layoutFilePath: string,
  layoutMap: Map<string, LayoutConfig>
): string | undefined {
  const pathSegments = layoutFilePath.split('/');

  // Walk up the directory tree to find the nearest parent layout
  for (let i = pathSegments.length - 2; i >= 0; i--) {
    const parentPath = pathSegments.slice(0, i + 1).join('/');
    const parentRoutePath = parentPath.replace(/^.*\/routes/, '') || '/';

    if (layoutMap.has(parentRoutePath)) {
      return parentRoutePath;
    }
  }

  return undefined;
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
 * Check if a route matches a given path with enhanced dynamic route support
 */
function matchesRoutePath(route: RouteConfig, path: string): boolean {
  const routeSegments = route.path.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  // Handle catch-all routes
  if (route.isCatchAll) {
    return matchesCatchAllRoute(routeSegments, pathSegments);
  }

  // Handle optional parameters
  if (routeSegments.length !== pathSegments.length) {
    return matchesOptionalRoute(routeSegments, pathSegments);
  }

  return matchesRouteSegments(routeSegments, pathSegments);
}

/**
 * Check if catch-all route matches
 */
function matchesCatchAllRoute(routeSegments: string[], pathSegments: string[]): boolean {
  const catchAllIndex = routeSegments.findIndex(seg => seg.startsWith('[...'));
  if (catchAllIndex === -1) {
    return false;
  }

  // Check if all segments before catch-all match
  for (let i = 0; i < catchAllIndex; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];
    if (!routeSegment || !pathSegment || !matchesRouteSegment(routeSegment, pathSegment)) {
      return false;
    }
  }

  // Catch-all allows zero or more segments after the catch-all position
  return pathSegments.length >= catchAllIndex;
}

/**
 * Check if optional route matches
 */
function matchesOptionalRoute(routeSegments: string[], pathSegments: string[]): boolean {
  // Check if the difference is due to optional parameters
  if (Math.abs(routeSegments.length - pathSegments.length) !== 1) {
    return false;
  }

  const longer = routeSegments.length > pathSegments.length ? routeSegments : pathSegments;
  const shorter = routeSegments.length > pathSegments.length ? pathSegments : routeSegments;

  // Find the optional segment in the longer array
  let optionalIndex = -1;
  for (let i = 0; i < longer.length; i++) {
    const segment = longer[i];
    if (segment?.startsWith('[[') && segment.endsWith(']]')) {
      optionalIndex = i;
      break;
    }
  }

  if (optionalIndex === -1) {
    return false;
  }

  // Remove the optional segment and check the rest
  const adjustedRoute = longer.filter((_, index) => index !== optionalIndex);
  return matchesRouteSegments(adjustedRoute, shorter);
}

/**
 * Check if route segments match path segments
 */
function matchesRouteSegments(routeSegments: string[], pathSegments: string[]): boolean {
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];
    if (!routeSegment || !pathSegment || !matchesRouteSegment(routeSegment, pathSegment)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a single route segment matches a path segment
 */
function matchesRouteSegment(routeSegment: string, pathSegment: string | undefined): boolean {
  if (!pathSegment) {
    // Handle optional parameters
    return routeSegment.startsWith('[[') && routeSegment.endsWith(']]');
  }

  // Exact match
  if (routeSegment === pathSegment) {
    return true;
  }

  // Dynamic segment patterns
  if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
    return true; // Any value matches dynamic segments
  }

  return false;
}
