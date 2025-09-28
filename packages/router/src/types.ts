/**
 * @fileoverview Types for file-based routing system
 */

/**
 * Route configuration
 */
export interface RouteConfig {
  /** Route path (e.g., '/users/[id]') */
  path: string;
  /** File path relative to routes directory */
  filePath: string;
  /** Route parameters */
  params: string[];
  /** Whether this route has dynamic segments */
  isDynamic: boolean;
  /** Whether this route has catch-all segments */
  isCatchAll: boolean;
  /** Layout file path if exists */
  layoutPath: string | undefined;
  /** Page file path */
  pagePath: string;
  /** HTTP methods supported by this route */
  methods: string[];
  /** Route metadata */
  meta: RouteMeta;
}

/**
 * Route metadata
 */
export interface RouteMeta {
  /** Route title */
  title?: string;
  /** Route description */
  description?: string;
  /** Route keywords */
  keywords?: string[];
  /** Whether route should be indexed */
  indexable?: boolean;
  /** Custom headers for this route */
  headers?: Record<string, string>;
  /** Route priority for sitemap */
  priority?: number;
  /** Route change frequency */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Layout chain for nested layouts */
  layoutChain?: string[];
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Layout file path */
  filePath: string;
  /** Layout name */
  name: string;
  /** Whether this is the root layout */
  isRoot: boolean;
  /** Parent layout if nested */
  parent?: string;
  /** Layout metadata */
  meta: LayoutMeta;
}

/**
 * Layout metadata
 */
export interface LayoutMeta {
  /** Layout title */
  title?: string;
  /** Default meta tags */
  meta?: Record<string, string>;
  /** Default stylesheets */
  stylesheets?: string[];
  /** Default scripts */
  scripts?: string[];
}

/**
 * Route manifest entry
 */
export interface RouteManifestEntry {
  /** Route path */
  path: string;
  /** Route file path */
  file: string;
  /** Route parameters */
  params: string[];
  /** Whether route is dynamic */
  dynamic: boolean;
  /** Whether route is catch-all */
  catchAll: boolean;
  /** Layout file if exists */
  layout: string | undefined;
  /** HTTP methods */
  methods: string[];
  /** Route metadata */
  meta: RouteMeta;
}

/**
 * Route manifest
 */
export interface RouteManifest {
  /** All routes */
  routes: RouteManifestEntry[];
  /** Root layout */
  rootLayout: string | undefined;
  /** Layouts */
  layouts: Record<string, LayoutConfig>;
  /** Generated timestamp */
  generatedAt: string;
  /** Version */
  version: string;
}

/**
 * Route matching result
 */
export interface RouteMatch {
  /** Matched route */
  route: RouteConfig;
  /** Extracted parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Matched path */
  matchedPath: string;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Routes directory path */
  routesDir: string;
  /** Layouts directory path */
  layoutsDir: string;
  /** File extensions to consider */
  extensions: string[];
  /** Default layout name */
  defaultLayout: string | undefined;
  /** Whether to generate manifest */
  generateManifest: boolean;
  /** Manifest output path */
  manifestPath: string | undefined;
  /** Whether to watch for changes */
  watch: boolean;
}

/**
 * Route file types
 */
export type RouteFileType = 'page' | 'layout' | 'error' | 'loading' | 'not-found';

/**
 * Route file info
 */
export interface RouteFileInfo {
  /** File type */
  type: RouteFileType;
  /** File path */
  path: string;
  /** Route path */
  routePath: string;
  /** File name */
  name: string;
  /** Whether file is dynamic */
  isDynamic: boolean;
  /** Whether file is catch-all */
  isCatchAll: boolean;
  /** Parameters */
  params: string[];
}
