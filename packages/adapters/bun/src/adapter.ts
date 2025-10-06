/**
 * @fileoverview Bun adapter for Plank framework
 */

export interface BunAdapterConfig {
  port?: number;
  hostname?: string;
  staticDir?: string;
  dev?: boolean;
  compression?: boolean;
  shutdownTimeout?: number;
  onRequest?: (req: Request) => Promise<Response | null>;
}

export interface BunServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): { port: number; host: string } | null;
}

export function createBunAdapter(config: BunAdapterConfig = {}): BunAdapter {
  return new BunAdapter(config);
}

export class BunAdapter implements BunServer {
  private config: Required<BunAdapterConfig>;
  private server: { stop: () => Promise<void>; port: number } | null = null;
  private shutdownSignal = false;

  constructor(config: BunAdapterConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      hostname: config.hostname ?? '0.0.0.0',
      staticDir: config.staticDir ?? 'dist',
      dev: config.dev ?? false,
      compression: config.compression ?? true,
      shutdownTimeout: config.shutdownTimeout ?? 10000,
      onRequest: config.onRequest ?? (async () => null),
    };
  }

  async listen(): Promise<void> {
    const handler = async (request: Request): Promise<Response> => {
      // Handle graceful shutdown
      if (this.shutdownSignal) {
        return new Response('Server shutting down', { status: 503 });
      }

      // Try to serve static files first
      const staticResponse = await this.tryServeStatic(request);
      if (staticResponse) return staticResponse;

      // Try user handler
      const userResponse = await this.tryUserHandler(request);
      if (userResponse) return userResponse;

      return new Response('Not Found', { status: 404 });
    };

    // Resolve Bun.serve at runtime without requiring Bun types at build time
    const maybeServe = (globalThis as unknown as { Bun?: { serve?: unknown } }).Bun?.serve as unknown;
    if (typeof maybeServe !== 'function') {
      throw new Error('Bun.serve is not available in this runtime');
    }
    const serve = maybeServe as (options: Record<string, unknown>) => { stop: () => Promise<void>; port: number };

    const server = serve({
      port: this.config.port,
      hostname: this.config.hostname,
      fetch: handler,
      development: this.config.dev,
    });

    this.server = server;
  }

  async close(): Promise<void> {
    if (!this.server) return;

    // Set shutdown signal
    this.shutdownSignal = true;

    // Wait for active requests to complete
    const timeout = setTimeout(() => {
      console.warn('⚠️  Forcing server shutdown after timeout');
    }, this.config.shutdownTimeout);

    try {
      await this.server.stop();
    } finally {
      clearTimeout(timeout);
      this.server = null;
      this.shutdownSignal = false;
    }
  }

  address(): { port: number; host: string } | null {
    if (!this.server) return null;
    return { port: this.server.port, host: this.config.hostname };
  }

  private async tryServeStatic(request: Request): Promise<Response | null> {
    if (request.method !== 'GET' || !this.config.staticDir) return null;

    const url = new URL(request.url);
    const path = url.pathname;
    const { resolveStaticFile, getCacheControl, getMimeType } = await import('./static-files.js');
    const filePath = await resolveStaticFile(this.config.staticDir, path);

    if (!filePath) return null;

    const body = await (await import('node:fs/promises')).readFile(filePath);
    const uint8 = new Uint8Array(body);
    const response = new Response(uint8, {
      headers: {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': getCacheControl(filePath, this.config.dev),
      },
    });

    // Apply compression if enabled
    if (this.config.compression && this.shouldCompress(request, uint8.length)) {
      return this.compressResponse(response);
    }

    return response;
  }

  private async tryUserHandler(request: Request): Promise<Response | null> {
    const handled = await this.config.onRequest(request);
    if (!handled) return null;

    // Apply compression to user responses
    if (this.config.compression && this.shouldCompress(request, 0)) {
      return this.compressResponse(handled);
    }

    return handled;
  }

  private shouldCompress(request: Request, contentLength: number): boolean {
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const hasGzip = acceptEncoding.includes('gzip');
    const hasBrotli = acceptEncoding.includes('br');

    // Only compress if client supports it and content is large enough
    return (hasGzip || hasBrotli) && contentLength > 1024;
  }

  private async compressResponse(response: Response): Promise<Response> {
    const body = await response.arrayBuffer();
    const uint8 = new Uint8Array(body);

    // Use Bun's built-in compression
    const maybeCompress = (globalThis as unknown as { Bun?: { gzipSync?: (data: Uint8Array) => Uint8Array } }).Bun?.gzipSync;

    if (maybeCompress) {
      const compressed = maybeCompress(uint8);
      return new Response(compressed as BodyInit, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Content-Encoding': 'gzip',
          'Content-Length': compressed.length.toString(),
        },
      });
    }

    // Fallback to uncompressed
    return response;
  }
}


