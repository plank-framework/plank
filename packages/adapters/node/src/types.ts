/**
 * @fileoverview Types for Node.js adapter
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Node adapter configuration
 */
export interface NodeAdapterConfig {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Enable compression (gzip/brotli) */
  compression?: boolean;
  /** Static assets directory */
  staticDir?: string;
  /** Enable detailed error messages */
  dev?: boolean;
  /** Graceful shutdown timeout (ms) */
  shutdownTimeout?: number;
  /** Custom request handler */
  onRequest?: (req: Request) => Promise<Response | null>;
}

/**
 * Node server instance
 */
export interface NodeServer {
  /** Start the server */
  listen(): Promise<void>;
  /** Stop the server gracefully */
  close(): Promise<void>;
  /** Get server address */
  address(): { port: number; host: string } | null;
}

/**
 * Static file options
 */
export interface StaticFileOptions {
  /** MIME type */
  contentType: string;
  /** Enable caching */
  cache?: boolean;
  /** Cache-Control header value */
  cacheControl?: string;
}

/**
 * Request context for Node adapter
 */
export interface NodeRequestContext {
  /** Original Node.js request */
  req: IncomingMessage;
  /** Original Node.js response */
  res: ServerResponse;
  /** Web standard Request */
  request: Request;
  /** Request start time */
  startTime: number;
}
