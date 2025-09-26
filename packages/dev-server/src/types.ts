/**
 * @fileoverview Types for development server
 */

// Note: These imports will be available at runtime
// import type { Plugin } from 'vite';
// import type { FileBasedRouter } from '@plank/router';

// Temporary type definitions until dependencies are installed
// biome-ignore lint/suspicious/noExplicitAny: Temporary types until dependencies are installed
type Plugin = any;
// biome-ignore lint/suspicious/noExplicitAny: Temporary types until dependencies are installed
type FileBasedRouter = any;

/**
 * Development server configuration
 */
export interface DevServerConfig {
  /** Root directory of the project */
  root: string;
  /** Port to run the dev server on */
  port: number;
  /** Host to bind the server to */
  host: string;
  /** Whether to open browser automatically */
  open: boolean;
  /** Routes directory */
  routesDir: string;
  /** Whether to enable HMR */
  hmr: boolean;
  /** Whether to enable file watching */
  watch: boolean;
  /** Custom Vite plugins */
  plugins: Plugin[];
  /** Environment variables */
  env: Record<string, string>;
  /** Whether to enable HTTPS */
  https: boolean;
  /** SSL certificate path */
  cert?: string;
  /** SSL key path */
  key?: string;
}

/**
 * HMR update payload
 */
export interface HMRUpdate {
  /** Type of update */
  type: 'js-update' | 'css-update' | 'full-reload' | 'prune';
  /** Path of the updated file */
  path: string;
  /** Timestamp of the update */
  timestamp: number;
  /** Additional data for the update */
  data?: unknown;
}

/**
 * Error overlay data
 */
export interface ErrorOverlay {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** File path where error occurred */
  file?: string;
  /** Line number where error occurred */
  line?: number;
  /** Column number where error occurred */
  column?: number;
  /** Error type */
  type: 'error' | 'warning';
  /** Error code */
  code?: string;
}

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Type of change */
  type: 'add' | 'change' | 'unlink';
  /** Path of the changed file */
  path: string;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Development server instance
 */
export interface DevServer {
  /** Start the development server */
  start(): Promise<void>;
  /** Stop the development server */
  stop(): Promise<void>;
  /** Restart the development server */
  restart(): Promise<void>;
  /** Get the server URL */
  getUrl(): string;
  /** Check if server is running */
  isRunning(): boolean;
  /** Get the router instance */
  getRouter(): FileBasedRouter;
}

/**
 * Vite plugin options
 */
export interface PlankPluginOptions {
  /** Routes directory */
  routesDir?: string;
  /** Whether to enable HMR for .plk files */
  hmr?: boolean;
  /** Custom file extensions to process */
  extensions?: string[];
  /** Whether to enable source maps */
  sourcemap?: boolean;
  /** Custom transform options */
  transform?: {
    /** Whether to minify output */
    minify?: boolean;
    /** Whether to preserve comments */
    comments?: boolean;
  };
}

/**
 * Module resolution result
 */
export interface ModuleResolution {
  /** Resolved file path */
  filePath: string;
  /** Module type */
  type: 'plk' | 'js' | 'ts' | 'css' | 'json' | 'other';
  /** Whether the module exists */
  exists: boolean;
  /** Module content */
  content?: string;
  /** Module metadata */
  metadata?: {
    /** File size in bytes */
    size: number;
    /** Last modified timestamp */
    mtime: number;
    /** File hash */
    hash: string;
  };
}

/**
 * Build result
 */
export interface BuildResult {
  /** Whether the build was successful */
  success: boolean;
  /** Build output directory */
  outputDir: string;
  /** Build errors */
  errors: string[];
  /** Build warnings */
  warnings: string[];
  /** Build duration in milliseconds */
  duration: number;
  /** Build statistics */
  stats: {
    /** Number of files processed */
    files: number;
    /** Total size of output */
    size: number;
    /** Number of chunks */
    chunks: number;
  };
}

/**
 * Watch options
 */
export interface WatchOptions {
  /** Directories to watch */
  dirs: string[];
  /** File patterns to ignore */
  ignore: string[];
  /** Whether to watch recursively */
  recursive: boolean;
  /** Debounce delay in milliseconds */
  debounce: number;
  /** Whether to watch for file additions */
  watchAdd: boolean;
  /** Whether to watch for file changes */
  watchChange: boolean;
  /** Whether to watch for file deletions */
  watchUnlink: boolean;
}

/**
 * Development server events
 */
export interface DevServerEvents {
  /** Server started */
  'server:start': () => void;
  /** Server stopped */
  'server:stop': () => void;
  /** File changed */
  'file:change': (event: FileChangeEvent) => void;
  /** HMR update */
  'hmr:update': (update: HMRUpdate) => void;
  /** Error occurred */
  error: (error: ErrorOverlay) => void;
  /** Build completed */
  'build:complete': (result: BuildResult) => void;
  /** Route updated */
  'route:update': (path: string) => void;
}
