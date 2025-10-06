/**
 * @fileoverview Deno adapter for Plank framework
 */

import type { DenoAdapterConfig, DenoServer } from './types.js';

export function createDenoAdapter(config: DenoAdapterConfig = {}): DenoAdapter {
  return new DenoAdapter(config);
}

export class DenoAdapter implements DenoServer {
  private config: Required<DenoAdapterConfig>;
  private server: Deno.HttpServer | null = null;
  private shutdownSignal = false;

  constructor(config: DenoAdapterConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      hostname: config.hostname ?? '0.0.0.0',
      staticDir: config.staticDir ?? 'dist',
      dev: config.dev ?? false,
      compression: config.compression ?? true,
      shutdownTimeout: config.shutdownTimeout ?? 10000,
      onRequest: config.onRequest ?? (async () => null),
      permissions: {
        read: config.permissions?.read ?? ['.'],
        net: config.permissions?.net ?? ['0.0.0.0:3000'],
      },
    };
  }

  async listen(): Promise<void> {
    // Check permissions
    await this.checkPermissions();

    const handler = async (request: Request): Promise<Response> => {
      // Handle graceful shutdown
      if (this.shutdownSignal) {
        return new Response('Server shutting down', { status: 503 });
      }

      // Try to serve static files first (GET only)
      if (request.method === 'GET' && this.config.staticDir) {
        const url = new URL(request.url);
        const path = url.pathname;
        const staticResponse = await this.serveStaticFile(path);
        if (staticResponse) {
          return staticResponse;
        }
      }

      // Try user handler
      const handled = await this.config.onRequest(request);
      if (handled) {
        // Apply compression to user responses
        if (this.config.compression && this.shouldCompress(request, 0)) {
          return this.compressResponse(handled);
        }
        return handled;
      }

      return new Response('Not Found', { status: 404 });
    };

    // Start Deno HTTP server
    this.server = Deno.serve({
      port: this.config.port,
      hostname: this.config.hostname,
      handler,
      onListen: ({ port, hostname }) => {
        console.log(`✅ Deno server listening on http://${hostname}:${port}`);
      },
    });
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
      this.server.shutdown();
    } finally {
      clearTimeout(timeout);
      this.server = null;
      this.shutdownSignal = false;
    }
  }

  address(): { port: number; host: string } | null {
    if (!this.server) return null;
    return { port: this.config.port, host: this.config.hostname };
  }

  private async checkPermissions(): Promise<void> {
    // Check read permissions for static directory
    try {
      await Deno.readDir(this.config.staticDir);
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        throw new Error(
          `Permission denied: Cannot read static directory '${this.config.staticDir}'. Run with --allow-read flag.`
        );
      }
      // Directory might not exist, that's okay
    }

    // Check network permissions
    try {
      const listener = Deno.listen({ port: this.config.port, hostname: this.config.hostname });
      listener.close();
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        throw new Error(
          `Permission denied: Cannot bind to ${this.config.hostname}:${this.config.port}. Run with --allow-net flag.`
        );
      }
      throw error;
    }
  }

  private async serveStaticFile(path: string): Promise<Response | null> {
    try {
      // Resolve file path
      const filePath = await this.resolveStaticFile(path);
      if (!filePath) return null;

      const stat = await Deno.stat(filePath);

      // For large files, use streaming
      if (stat.size > 1024 * 1024) {
        // 1MB threshold
        return this.serveStaticFileStream(filePath, stat);
      }

      // For smaller files, read into memory
      const content = await Deno.readFile(filePath);

      // Create response
      const response = new Response(content, {
        headers: {
          'Content-Type': this.getMimeType(filePath),
          'Cache-Control': this.getCacheControl(filePath),
          'Last-Modified': stat.mtime?.toUTCString() || new Date().toUTCString(),
          'Content-Length': stat.size.toString(),
        },
      });

      // Apply compression if enabled
      if (
        this.config.compression &&
        this.shouldCompress(new Request('http://localhost'), content.length)
      ) {
        return this.compressResponse(response);
      }

      return response;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return null;
      }
      throw error;
    }
  }

  private async serveStaticFileStream(filePath: string, stat: Deno.FileInfo): Promise<Response> {
    const file = await Deno.open(filePath, { read: true });

    const { createFileStreamResponse } = await import('./streaming.js');
    const response = createFileStreamResponse(file, {
      backpressure: true,
      chunkSize: 8192,
    });

    // Add headers
    const headers = new Headers(response.headers);
    headers.set('Content-Type', this.getMimeType(filePath));
    headers.set('Cache-Control', this.getCacheControl(filePath));
    headers.set('Last-Modified', stat.mtime?.toUTCString() || new Date().toUTCString());
    headers.set('Content-Length', stat.size.toString());

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  private async resolveStaticFile(path: string): Promise<string | null> {
    // Remove leading slash and resolve relative to static directory
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const fullPath = `${this.config.staticDir}/${cleanPath}`;

    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        return fullPath;
      }
      if (stat.isDirectory) {
        // Try index.html
        const indexPath = `${fullPath}/index.html`;
        const indexStat = await Deno.stat(indexPath);
        if (indexStat.isFile) {
          return indexPath;
        }
      }
    } catch {
      // File not found
    }

    return null;
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

    // Use Deno's built-in compression
    const compressed = await this.compressData(uint8);

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

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    // Use Deno's built-in compression
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write data
    await writer.write(data as BufferSource);
    await writer.close();

    // Read compressed data
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private getCacheControl(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const cacheableExts = [
      'css',
      'js',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'ico',
      'woff',
      'woff2',
      'ttf',
      'eot',
    ];

    if (cacheableExts.includes(ext || '')) {
      return this.config.dev ? 'no-cache' : 'public, max-age=31536000'; // 1 year
    }

    return 'no-cache';
  }
}
