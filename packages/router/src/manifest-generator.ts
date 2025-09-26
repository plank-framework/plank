/**
 * @fileoverview Route manifest generation
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { LayoutConfig, RouteConfig, RouteManifest, RouteManifestEntry } from './types.js';

/**
 * Generate route manifest
 */
export async function generateRouteManifest(
  routes: RouteConfig[],
  layouts: LayoutConfig[],
  outputPath: string,
  version: string = '1.0.0'
): Promise<RouteManifest> {
  const manifest: RouteManifest = {
    routes: routes.map((route) => buildManifestEntry(route)),
    layouts: buildLayoutsMap(layouts),
    rootLayout: undefined,
    generatedAt: new Date().toISOString(),
    version,
  };

  // Find root layout
  const rootLayout = layouts.find((layout) => layout.isRoot);
  if (rootLayout) {
    manifest.rootLayout = rootLayout.filePath;
  }

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Write manifest file
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return manifest;
}

/**
 * Build manifest entry from route config
 */
function buildManifestEntry(route: RouteConfig): RouteManifestEntry {
  return {
    path: route.path,
    file: route.filePath,
    params: route.params,
    dynamic: route.isDynamic,
    catchAll: route.isCatchAll,
    layout: route.layoutPath,
    methods: route.methods,
    meta: route.meta,
  };
}

/**
 * Build layouts map
 */
function buildLayoutsMap(layouts: LayoutConfig[]): Record<string, LayoutConfig> {
  const layoutsMap: Record<string, LayoutConfig> = {};

  for (const layout of layouts) {
    layoutsMap[layout.name] = layout;
  }

  return layoutsMap;
}

/**
 * Generate sitemap from route manifest
 */
export function generateSitemap(manifest: RouteManifest, baseUrl: string): string {
  const routes = manifest.routes.filter(
    (route) => route.meta.indexable !== false && !route.dynamic && route.methods.includes('GET')
  );

  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const route of routes) {
    const url = `${baseUrl}${route.path}`;
    const priority = route.meta.priority ?? 0.5;
    const changefreq = route.meta.changefreq ?? 'monthly';

    sitemap += '  <url>\n';
    sitemap += `    <loc>${escapeXml(url)}</loc>\n`;
    sitemap += `    <priority>${priority}</priority>\n`;
    sitemap += `    <changefreq>${changefreq}</changefreq>\n`;
    sitemap += '  </url>\n';
  }

  sitemap += '</urlset>';

  return sitemap;
}

/**
 * Generate robots.txt from route manifest
 */
export function generateRobotsTxt(manifest: RouteManifest, baseUrl: string): string {
  let robots = 'User-agent: *\n';

  // Add disallow rules for dynamic routes
  const dynamicRoutes = manifest.routes.filter((route) => route.dynamic);
  for (const route of dynamicRoutes) {
    robots += `Disallow: ${route.path}\n`;
  }

  // Add sitemap
  robots += `Sitemap: ${baseUrl}/sitemap.xml\n`;

  return robots;
}

/**
 * Generate route types for TypeScript
 */
export function generateRouteTypes(manifest: RouteManifest): string {
  let types = '// Auto-generated route types\n';
  types += generateRoutePathTypes(manifest.routes);
  types += generateRouteParamTypes(manifest.routes);
  return types;
}

/**
 * Generate RoutePath type
 */
function generateRoutePathTypes(routes: RouteManifestEntry[]): string {
  let types = 'export type RoutePath = \n';
  const staticRoutes = routes.filter((route) => !route.dynamic);

  for (const route of staticRoutes) {
    types += `  | '${route.path}'\n`;
  }

  types += ';\n\n';
  return types;
}

/**
 * Generate RouteParams type
 */
function generateRouteParamTypes(routes: RouteManifestEntry[]): string {
  const dynamicRoutes = routes.filter((route) => route.dynamic);
  if (dynamicRoutes.length === 0) {
    return '';
  }

  let types = 'export type RouteParams = {\n';
  for (const route of dynamicRoutes) {
    types += `  '${route.path}': {\n`;
    types += generateParamTypes(route.params);
    types += '  };\n';
  }
  types += '};\n';
  return types;
}

/**
 * Generate parameter types for a route
 */
function generateParamTypes(params: string[]): string {
  let types = '';
  for (const param of params) {
    const paramName = param.replace(/^\.\.\./, '').replace(/^\?/, '');
    const isOptional = param.startsWith('?');
    const isCatchAll = param.startsWith('...');

    if (isCatchAll) {
      types += `    '${paramName}': string[];\n`;
    } else {
      types += `    '${paramName}'${isOptional ? '?' : ''}: string;\n`;
    }
  }
  return types;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate manifest
 */
export function validateManifest(manifest: RouteManifest): string[] {
  const errors: string[] = [];

  errors.push(...validateManifestFields(manifest));
  errors.push(...validateManifestRoutes(manifest.routes));

  return errors;
}

/**
 * Validate manifest required fields
 */
function validateManifestFields(manifest: RouteManifest): string[] {
  const errors: string[] = [];

  if (!manifest.routes) {
    errors.push('Manifest must have routes');
  }

  if (!manifest.generatedAt) {
    errors.push('Manifest must have generatedAt timestamp');
  }

  if (!manifest.version) {
    errors.push('Manifest must have version');
  }

  return errors;
}

/**
 * Validate manifest routes
 */
function validateManifestRoutes(routes: RouteManifestEntry[]): string[] {
  const errors: string[] = [];

  if (!routes) {
    return errors;
  }

  for (const route of routes) {
    errors.push(...validateRoute(route));
  }

  return errors;
}

/**
 * Validate a single route
 */
function validateRoute(route: RouteManifestEntry): string[] {
  const errors: string[] = [];

  if (!route.path) {
    errors.push('Route must have path');
  }

  if (!route.file) {
    errors.push('Route must have file');
  }

  if (route.dynamic && route.params.length === 0) {
    errors.push('Dynamic route must have parameters');
  }

  return errors;
}

/**
 * Load manifest from file
 */
export async function loadManifest(filePath: string): Promise<RouteManifest> {
  try {
    const content = await import(filePath);
    return content.default || content;
  } catch (error) {
    throw new Error(`Failed to load manifest from ${filePath}: ${error}`);
  }
}
