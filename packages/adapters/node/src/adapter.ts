/**
 * @fileoverview Node.js 20+ production adapter
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { getBaseURL, nodeRequestToWebRequest } from './request-converter.js';
import { sendError, sendFile, sendWebResponse } from './response-handler.js';
import { getCacheControl, getMimeType, resolveStaticFile } from './static-files.js';
import type { NodeAdapterConfig, NodeServer } from './types.js';

/**
 * Create Node.js adapter
 */
export function createNodeAdapter(config: NodeAdapterConfig = {}): NodeAdapter {
  return new NodeAdapter(config);
}

/**
 * Node.js adapter for Plank framework
 */
export class NodeAdapter implements NodeServer {
  private config: Required<NodeAdapterConfig>;
  private server: Server | null = null;
  private connections = new Set<{ destroy: () => void }>();

  constructor(config: NodeAdapterConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? '0.0.0.0',
      compression: config.compression ?? true,
      staticDir: config.staticDir ?? 'dist',
      dev: config.dev ?? false,
      shutdownTimeout: config.shutdownTimeout ?? 10000,
      onRequest: config.onRequest ?? this.defaultRequestHandler.bind(this),
    };
  }

  /**
   * Start the server
   */
  async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          console.error('Request handler error:', error);
          if (!res.headersSent) {
            sendError(error, res, this.config.dev);
          }
        });
      });

      // Track connections for graceful shutdown
      this.server.on('connection', (socket) => {
        this.connections.add(socket);
        socket.on('close', () => {
          this.connections.delete(socket);
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`✅ Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️  Forcing server shutdown after timeout');
        for (const socket of this.connections) {
          socket.destroy();
        }
      }, this.config.shutdownTimeout);

      if (!this.server) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      this.server.close((err) => {
        clearTimeout(timeout);
        this.server = null;

        if (err) {
          reject(err);
        } else {
          console.log('✅ Server closed gracefully');
          resolve();
        }
      });
    });
  }

  /**
   * Get server address
   */
  address(): { port: number; host: string } | null {
    if (!this.server) {
      return null;
    }

    const addr = this.server.address();

    if (typeof addr === 'string') {
      return { port: 0, host: addr };
    }

    if (addr) {
      return { port: addr.port, host: addr.address };
    }

    return null;
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();

    try {
      // Try static files first
      if (await this.tryServeStatic(req, res)) {
        this.logRequest(req, res, startTime);
        return;
      }

      // Convert to Web Request
      const baseURL = getBaseURL(req);
      const webRequest = nodeRequestToWebRequest(req, baseURL);

      // Handle with custom handler
      const webResponse = await this.config.onRequest(webRequest);

      if (webResponse) {
        await sendWebResponse(webResponse, res);
        this.logRequest(req, res, startTime);
      } else {
        // 404
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(this.create404Page());
        this.logRequest(req, res, startTime);
      }
    } catch (error) {
      console.error('Request error:', error);
      if (!res.headersSent) {
        sendError(error as Error, res, this.config.dev);
      }
      this.logRequest(req, res, startTime);
    }
  }

  /**
   * Try to serve static file
   */
  private async tryServeStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!this.config.staticDir || req.method !== 'GET') {
      return false;
    }

    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const filePath = await resolveStaticFile(this.config.staticDir, pathname);

    if (!filePath) {
      return false;
    }

    try {
      const contentType = getMimeType(filePath);
      const cacheControl = getCacheControl(filePath, this.config.dev);

      await sendFile(filePath, res, { contentType, cacheControl });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Default request handler (returns 404)
   */
  private async defaultRequestHandler(_request: Request): Promise<Response | null> {
    return null;
  }

  /**
   * Log request
   */
  private logRequest(req: IncomingMessage, res: ServerResponse, startTime: number): void {
    const duration = Date.now() - startTime;
    const method = req.method || 'GET';
    const url = req.url || '/';
    const status = res.statusCode;

    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    console.log(`${method} ${url} ${statusColor}${status}${reset} ${duration}ms`);
  }

  /**
   * Create 404 page
   */
  private create404Page(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>404 - Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
    h1 { color: #718096; }
  </style>
</head>
<body>
  <h1>404 - Not Found</h1>
  <p>The requested resource could not be found.</p>
</body>
</html>
    `.trim();
  }
}
