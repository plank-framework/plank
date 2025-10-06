/**
 * @fileoverview Edge adapter for Plank framework (Cloudflare Workers)
 */

import type { EdgeAdapterConfig, Env, EdgeAdapter, StaticAsset } from './types.js';

export function createEdgeAdapter(config: EdgeAdapterConfig = {}): EdgeAdapter {
  return new EdgeAdapterImpl(config);
}

class EdgeAdapterImpl implements EdgeAdapter {
  private config: Required<EdgeAdapterConfig>;

  constructor(config: EdgeAdapterConfig = {}) {
    this.config = {
      onRequest: config.onRequest ?? (async () => null),
      staticAssets: {
        kvNamespace: config.staticAssets?.kvNamespace ?? undefined,
        r2Bucket: config.staticAssets?.r2Bucket ?? undefined,
        cacheTtl: config.staticAssets?.cacheTtl ?? 86400, // 24 hours
      },
      errorHandling: {
        errorTemplate: config.errorHandling?.errorTemplate ?? this.defaultErrorTemplate,
        devMode: config.errorHandling?.devMode ?? false,
      },
      security: {
        csp: config.security?.csp ?? "default-src 'self'",
        headers: config.security?.headers ?? {},
      },
    };
  }

  async handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Try to serve static assets first
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const staticResponse = await this.serveStatic(url.pathname, env);
        if (staticResponse) {
          return staticResponse;
        }
      }

      // Try custom request handler
      const customResponse = await this.config.onRequest(request, env, ctx);
      if (customResponse) {
        return this.addSecurityHeaders(customResponse);
      }

      // Return 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return this.createErrorResponse(error as Error, env);
    }
  }

  async serveStatic(path: string, env: Env): Promise<Response | null> {
    // Try KV first
    const kvAsset = await this.tryKVAsset(path, env);
    if (kvAsset) return kvAsset;

    // Try R2
    const r2Asset = await this.tryR2Asset(path, env);
    if (r2Asset) return r2Asset;

    return null;
  }

  private async tryKVAsset(path: string, env: Env): Promise<Response | null> {
    const kv = this.config.staticAssets.kvNamespace || env.STATIC_KV;
    if (!kv) return null;

    const asset = await this.getAssetFromKV(path, kv);
    if (!asset) return null;

    return this.createStaticResponse(asset, path);
  }

  private async tryR2Asset(path: string, env: Env): Promise<Response | null> {
    const r2 = this.config.staticAssets.r2Bucket || env.STATIC_R2;
    if (!r2) return null;

    const asset = await this.getAssetFromR2(path, r2);
    if (!asset) return null;

    return this.createStaticResponse(asset, path);
  }

  createErrorResponse(error: Error, _env: Env): Response {
    const errorHtml = this.config.errorHandling.errorTemplate?.(error) ?? this.defaultErrorTemplate(error);

    return new Response(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        ...this.config.security.headers,
      },
    });
  }

  private async getAssetFromKV(path: string, kv: KVNamespace): Promise<StaticAsset | null> {
    try {
      const key = path.startsWith('/') ? path.slice(1) : path;
      const value = await kv.get(key, 'arrayBuffer');

      if (!value) return null;

      return {
        content: value,
        mimeType: this.getMimeType(path),
        cacheControl: this.getCacheControl(path),
        etag: await this.generateETag(value),
      };
    } catch {
      return null;
    }
  }

  private async getAssetFromR2(path: string, r2: R2Bucket): Promise<StaticAsset | null> {
    try {
      const key = path.startsWith('/') ? path.slice(1) : path;
      const object = await r2.get(key);

      if (!object) return null;

      return {
        content: await object.arrayBuffer(),
        mimeType: this.getMimeType(path),
        cacheControl: this.getCacheControl(path),
        lastModified: object.uploaded,
        etag: object.httpEtag,
      };
    } catch {
      return null;
    }
  }

  private createStaticResponse(asset: StaticAsset, _path: string): Response {
    const headers = new Headers({
      'Content-Type': asset.mimeType,
      'Cache-Control': asset.cacheControl,
    });

    if (asset.etag) {
      headers.set('ETag', asset.etag);
    }

    if (asset.lastModified) {
      headers.set('Last-Modified', asset.lastModified.toUTCString());
    }

    // Add security headers
    if (this.config.security.headers) {
      for (const [key, value] of Object.entries(this.config.security.headers)) {
        headers.set(key, value);
      }
    }

    return new Response(asset.content, { headers });
  }

  private addSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    // Add CSP header
    if (this.config.security.csp) {
      headers.set('Content-Security-Policy', this.config.security.csp);
    }

    // Add custom security headers
    if (this.config.security.headers) {
      for (const [key, value] of Object.entries(this.config.security.headers)) {
        headers.set(key, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
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

  private getCacheControl(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const cacheableExts = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot'];

    if (cacheableExts.includes(ext || '')) {
      return `public, max-age=${this.config.staticAssets.cacheTtl}`;
    }

    return 'no-cache';
  }

  private async generateETag(content: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-1', content);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `"${hashHex}"`;
  }

  private defaultErrorTemplate(error: Error): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server Error</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 2rem; }
            .error { background: #fee; border: 1px solid #fcc; padding: 1rem; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Server Error</h1>
          <div class="error">
            <p>An unexpected error occurred.</p>
            ${this.config.errorHandling.devMode ? `<pre>${error.stack}</pre>` : ''}
          </div>
        </body>
      </html>
    `;
  }
}
