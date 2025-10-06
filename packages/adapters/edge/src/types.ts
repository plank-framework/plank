/**
 * @fileoverview Edge adapter types for Cloudflare Workers
 */

/**
 * Edge adapter configuration
 */
export interface EdgeAdapterConfig {
  /** Custom request handler */
  onRequest?: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response | null>;
  /** Static assets configuration */
  staticAssets?: {
    /** KV namespace for static assets */
    kvNamespace?: KVNamespace | undefined;
    /** R2 bucket for static assets */
    r2Bucket?: R2Bucket | undefined;
    /** Cache TTL for static assets */
    cacheTtl?: number | undefined;
  };
  /** Error handling configuration */
  errorHandling?: {
    /** Custom error page template */
    errorTemplate?: (error: Error) => string;
    /** Enable detailed error responses in development */
    devMode?: boolean;
  };
  /** Security headers configuration */
  security?: {
    /** Content Security Policy */
    csp?: string;
    /** Additional security headers */
    headers?: Record<string, string>;
  };
}

/**
 * Environment variables interface
 */
export interface Env {
  /** KV namespace for static assets */
  STATIC_KV?: KVNamespace;
  /** R2 bucket for static assets */
  STATIC_R2?: R2Bucket;
  /** Environment name */
  ENVIRONMENT?: string;
  /** Custom environment variables */
  [key: string]: unknown;
}

/**
 * Edge adapter interface
 */
export interface EdgeAdapter {
  /** Handle incoming requests */
  handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  /** Serve static assets */
  serveStatic(path: string, env: Env, request: Request): Promise<Response | null>;
  /** Create error response */
  createErrorResponse(error: Error, env: Env): Response;
}

/**
 * Static asset metadata
 */
export interface StaticAsset {
  /** Asset content */
  content: ArrayBuffer;
  /** MIME type */
  mimeType: string;
  /** Cache control header */
  cacheControl: string;
  /** Last modified timestamp */
  lastModified?: Date;
  /** ETag */
  etag?: string;
}
