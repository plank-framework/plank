/**
 * @fileoverview Deno adapter types
 */

/**
 * Deno adapter configuration
 */
export interface DenoAdapterConfig {
  /** Server port */
  port?: number;
  /** Server hostname */
  hostname?: string;
  /** Static files directory */
  staticDir?: string;
  /** Development mode */
  dev?: boolean;
  /** Enable compression */
  compression?: boolean;
  /** Shutdown timeout in milliseconds */
  shutdownTimeout?: number;
  /** Custom request handler */
  onRequest?: (request: Request) => Promise<Response | null>;
  /** Permissions configuration */
  permissions?: {
    /** Read permissions for static files */
    read?: string[];
    /** Network permissions */
    net?: string[];
  };
}

/**
 * Deno server interface
 */
export interface DenoServer {
  /** Start the server */
  listen(): Promise<void>;
  /** Stop the server */
  close(): Promise<void>;
  /** Get server address */
  address(): { port: number; host: string } | null;
}

/**
 * Static file metadata
 */
export interface StaticFile {
  /** File path */
  path: string;
  /** MIME type */
  mimeType: string;
  /** Cache control header */
  cacheControl: string;
  /** File size */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
}
