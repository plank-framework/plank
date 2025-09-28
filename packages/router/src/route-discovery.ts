/**
 * @fileoverview File-based route discovery and parsing
 */

import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import type { RouteFileInfo, RouteFileType } from './types.js';

/**
 * Route file patterns
 */
const ROUTE_PATTERNS = {
  page: /^(page|index)\.(plk|ts|js)$/,
  layout: /^layout\.(plk|ts|js)$/,
  error: /^error\.(plk|ts|js)$/,
  loading: /^loading\.(plk|ts|js)$/,
  notFound: /^not-found\.(plk|ts|js)$/,
} as const;

/**
 * Dynamic segment patterns
 */
const DYNAMIC_PATTERNS = {
  param: /^\[([^[\]]+)\]$/, // [id]
  catchAll: /^\[\.\.\.([^[\]]+)\]$/, // [...slug]
  optional: /^\[\[([^[\]]+)\]\]$/, // [[id]]
} as const;

/**
 * Discover route files in a directory
 */
export async function discoverRouteFiles(
  routesDir: string,
  extensions: string[] = ['.plk', '.ts', '.js']
): Promise<RouteFileInfo[]> {
  const files: RouteFileInfo[] = [];

  try {
    await scanDirectory(routesDir, routesDir, files, extensions);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // Routes directory doesn't exist yet
  }

  return files;
}

/**
 * Scan directory recursively for route files
 */
async function scanDirectory(
  currentDir: string,
  baseDir: string,
  files: RouteFileInfo[],
  extensions: string[]
): Promise<void> {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip special directories
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
          continue;
        }

        await scanDirectory(fullPath, baseDir, files, extensions);
      } else if (entry.isFile()) {
        const fileInfo = parseRouteFile(fullPath, baseDir, extensions);
        if (fileInfo) {
          files.push(fileInfo);
        }
      }
    }
  } catch (_error) {
    // Directory doesn't exist or can't be read
    return;
  }
}

/**
 * Parse a route file and extract information
 */
function parseRouteFile(
  filePath: string,
  baseDir: string,
  extensions: string[]
): RouteFileInfo | null {
  const ext = extname(filePath);

  // Check if file has supported extension
  if (!extensions.includes(ext)) {
    return null;
  }

  const fileName = basename(filePath, ext);
  const relativePath = relative(baseDir, filePath);
  const dirPath = dirname(relativePath);

  // Determine file type
  const fileType = determineFileType(fileName, filePath);
  if (!fileType) {
    return null;
  }

  // Parse route path from directory structure
  const routePath = parseRoutePath(dirPath, fileName, fileType);

  // Extract parameters from the full path (including directory segments)
  const fullPath = dirPath === '.' ? fileName : `${dirPath}/${fileName}`;
  const params = extractParameters(fullPath);
  const isDynamic = params.length > 0;
  const isCatchAll = params.some((param) => param.startsWith('...'));

  return {
    type: fileType,
    path: filePath,
    routePath,
    name: fileName,
    isDynamic,
    isCatchAll,
    params,
  };
}

/**
 * Determine the type of route file
 */
function determineFileType(fileName: string, filePath: string): RouteFileType | null {
  // Check specific patterns first
  for (const [type, pattern] of Object.entries(ROUTE_PATTERNS)) {
    if (pattern.test(fileName)) {
      return type as RouteFileType;
    }
  }

  // If no specific pattern matches, check if it's a .plk file
  // Any .plk file that doesn't match specific patterns is treated as a page route
  if (filePath.endsWith('.plk')) {
    return 'page';
  }

  return null;
}

/**
 * Parse route path from directory structure
 */
function parseRoutePath(dirPath: string, fileName: string, fileType: RouteFileType): string {
  const segments = dirPath.split('/').filter(Boolean);

  // Add directory segments
  const pathSegments = [...segments];

  // Add file segment for non-page files or non-index pages
  if (fileType !== 'page' || fileName !== 'index') {
    pathSegments.push(fileName);
  }

  // Convert to route path
  let routePath = `/${pathSegments.join('/')}`;

  // Clean up the path
  routePath = routePath.replace(/\/+/g, '/');
  if (routePath !== '/' && routePath.endsWith('/')) {
    routePath = routePath.slice(0, -1);
  }

  return routePath;
}

/**
 * Extract parameters from route path
 */
function extractParameters(routePath: string): string[] {
  const params: string[] = [];
  const segments = routePath.split('/').filter(Boolean);

  for (const segment of segments) {
    const param = extractParameterFromSegment(segment);
    if (param) {
      params.push(param);
    }
  }

  return params;
}

/**
 * Extract parameter from a single segment
 */
function extractParameterFromSegment(segment: string): string | null {
  if (DYNAMIC_PATTERNS.param.test(segment)) {
    const match = segment.match(DYNAMIC_PATTERNS.param);
    return match?.[1] ? match[1] : null;
  }

  if (DYNAMIC_PATTERNS.catchAll.test(segment)) {
    const match = segment.match(DYNAMIC_PATTERNS.catchAll);
    return match?.[1] ? `...${match[1]}` : null;
  }

  if (DYNAMIC_PATTERNS.optional.test(segment)) {
    const match = segment.match(DYNAMIC_PATTERNS.optional);
    return match?.[1] ? `?${match[1]}` : null;
  }

  return null;
}

/**
 * Validate route path
 */
export function validateRoutePath(routePath: string): boolean {
  // Check for invalid characters
  if (!/^\/[a-zA-Z0-9\-_[\]./]*$/.test(routePath)) {
    return false;
  }

  // Check for consecutive slashes
  if (routePath.includes('//')) {
    return false;
  }

  // Check for invalid dynamic segments
  const segments = routePath.split('/').filter(Boolean);
  for (const segment of segments) {
    // Check for empty brackets
    if (segment.includes('[]') || segment.includes('[[]]')) {
      return false;
    }

    // Check for nested brackets (but allow [[optional]] pattern)
    if (segment.includes('[[') && !segment.match(/^\[\[[^[\]]+\]\]$/)) {
      return false;
    }

    // Check for unmatched brackets
    const openBrackets = segment.match(/\[/g)?.length ?? 0;
    const closeBrackets = segment.match(/\]/g)?.length ?? 0;
    if (openBrackets !== closeBrackets) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize route path
 */
export function normalizeRoutePath(routePath: string): string {
  // Remove leading/trailing slashes and collapse multiple slashes
  let normalized = routePath.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

  // Add leading slash
  if (normalized && !normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // Handle root path
  if (!normalized) {
    normalized = '/';
  }

  return normalized;
}

/**
 * Check if route path matches a pattern
 */
export function matchesRoutePattern(routePath: string, pattern: string): boolean {
  const routeSegments = routePath.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);

  // Handle catch-all patterns
  const catchAllIndex = patternSegments.findIndex((seg) => DYNAMIC_PATTERNS.catchAll.test(seg));
  if (catchAllIndex !== -1) {
    return matchesCatchAllPattern(routeSegments, patternSegments, catchAllIndex);
  }

  // Handle optional parameters
  if (routeSegments.length !== patternSegments.length) {
    return matchesOptionalPattern(routeSegments, patternSegments);
  }

  return matchesRouteSegments(routeSegments, patternSegments);
}

/**
 * Check if catch-all pattern matches
 */
function matchesCatchAllPattern(routeSegments: string[], patternSegments: string[], catchAllIndex: number): boolean {
  // For catch-all, check if all segments before it match
  for (let i = 0; i < catchAllIndex; i++) {
    const patternSegment = patternSegments[i];
    if (!patternSegment || !matchesSegment(routeSegments[i], patternSegment)) {
      return false;
    }
  }
  // Catch-all requires at least one segment after the catch-all position
  return routeSegments.length > catchAllIndex;
}

/**
 * Check if optional pattern matches
 */
function matchesOptionalPattern(routeSegments: string[], patternSegments: string[]): boolean {
  // Check if the difference is due to optional parameters
  if (Math.abs(routeSegments.length - patternSegments.length) !== 1) {
    return false;
  }

  const longer = routeSegments.length > patternSegments.length ? routeSegments : patternSegments;
  const shorter = routeSegments.length > patternSegments.length ? patternSegments : routeSegments;

  // Check if the extra segment is optional
  const extraSegment = longer[longer.length - 1];
  if (!extraSegment || !DYNAMIC_PATTERNS.optional.test(extraSegment)) {
    return false;
  }

  // Remove the optional segment and check the rest
  const adjustedPattern = longer.slice(0, -1);
  return matchesRouteSegments(adjustedPattern, shorter);
}

/**
 * Check if route segments match pattern segments
 */
function matchesRouteSegments(routeSegments: string[], patternSegments: string[]): boolean {
  for (let i = 0; i < routeSegments.length; i++) {
    const patternSegment = patternSegments[i];
    if (!patternSegment || !matchesSegment(routeSegments[i], patternSegment)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a route segment matches a pattern segment
 */
function matchesSegment(routeSegment: string | undefined, patternSegment: string): boolean {
  if (!routeSegment) {
    // Handle optional parameters
    return DYNAMIC_PATTERNS.optional.test(patternSegment);
  }

  // Check for exact match
  if (routeSegment === patternSegment) {
    return true;
  }

  // Check for dynamic segments
  if (DYNAMIC_PATTERNS.param.test(patternSegment)) {
    return true;
  }

  if (DYNAMIC_PATTERNS.catchAll.test(patternSegment)) {
    return true;
  }

  if (DYNAMIC_PATTERNS.optional.test(patternSegment)) {
    return true;
  }

  return false;
}
