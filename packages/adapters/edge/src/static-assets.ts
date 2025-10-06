/**
 * @fileoverview Enhanced static assets strategy for Edge adapter
 */

import type { Env, StaticAsset } from './types.js';

/**
 * Asset optimization options
 */
export interface AssetOptimization {
  /** Enable image optimization */
  optimizeImages?: boolean;
  /** Enable CSS minification */
  minifyCSS?: boolean;
  /** Enable JS minification */
  minifyJS?: boolean;
  /** Enable HTML minification */
  minifyHTML?: boolean;
  /** Enable Brotli compression */
  enableBrotli?: boolean;
}

/**
 * Cache strategy configuration
 */
export interface CacheStrategy {
  /** Static assets cache TTL */
  staticAssetsTTL?: number;
  /** API responses cache TTL */
  apiTTL?: number;
  /** HTML pages cache TTL */
  htmlTTL?: number;
  /** Enable stale-while-revalidate */
  staleWhileRevalidate?: boolean;
}

/**
 * Enhanced static assets manager
 */
export class StaticAssetsManager {
  private optimization: Required<AssetOptimization>;
  private cacheStrategy: Required<CacheStrategy>;

  constructor(
    private env: Env,
    optimization: AssetOptimization = {},
    cacheStrategy: CacheStrategy = {}
  ) {
    this.optimization = {
      optimizeImages: optimization.optimizeImages ?? true,
      minifyCSS: optimization.minifyCSS ?? true,
      minifyJS: optimization.minifyJS ?? true,
      minifyHTML: optimization.minifyHTML ?? true,
      enableBrotli: optimization.enableBrotli ?? true,
    };

    this.cacheStrategy = {
      staticAssetsTTL: cacheStrategy.staticAssetsTTL ?? 31536000, // 1 year
      apiTTL: cacheStrategy.apiTTL ?? 300, // 5 minutes
      htmlTTL: cacheStrategy.htmlTTL ?? 3600, // 1 hour
      staleWhileRevalidate: cacheStrategy.staleWhileRevalidate ?? true,
    };
  }

  /**
   * Get optimized asset with caching
   */
  async getOptimizedAsset(path: string, request: Request): Promise<Response | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(path, request);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return this.createCachedResponse(cached);
    }

    // Get asset from storage
    const asset = await this.getAssetFromStorage(path);
    if (!asset) return null;

    // Optimize asset
    const optimizedAsset = await this.optimizeAsset(asset, path, request);

    // Cache optimized asset
    await this.setCache(cacheKey, optimizedAsset);

    return this.createAssetResponse(optimizedAsset, path);
  }

  /**
   * Get asset from KV storage
   */
  private async getAssetFromKV(path: string): Promise<StaticAsset | null> {
    const kv = this.env.STATIC_KV;
    if (!kv) return null;

    try {
      const key = this.normalizePath(path);
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

  /**
   * Get asset from R2 storage
   */
  private async getAssetFromR2(path: string): Promise<StaticAsset | null> {
    const r2 = this.env.STATIC_R2;
    if (!r2) return null;

    try {
      const key = this.normalizePath(path);
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

  /**
   * Get asset from storage (KV or R2)
   */
  private async getAssetFromStorage(path: string): Promise<StaticAsset | null> {
    // Try KV first (faster for small assets)
    const kvAsset = await this.getAssetFromKV(path);
    if (kvAsset) return kvAsset;

    // Try R2 (better for large assets)
    return this.getAssetFromR2(path);
  }

  /**
   * Optimize asset based on type and request
   */
  private async optimizeAsset(
    asset: StaticAsset,
    path: string,
    request: Request
  ): Promise<StaticAsset> {
    const ext = path.split('.').pop()?.toLowerCase();

    // Image optimization
    if (this.optimization.optimizeImages && this.isImage(ext)) {
      return this.optimizeImage(asset, request);
    }

    // CSS minification
    if (this.optimization.minifyCSS && ext === 'css') {
      return this.minifyCSS(asset);
    }

    // JS minification
    if (this.optimization.minifyJS && ext === 'js') {
      return this.minifyJS(asset);
    }

    // HTML minification
    if (this.optimization.minifyHTML && ext === 'html') {
      return this.minifyHTML(asset);
    }

    return asset;
  }

  /**
   * Optimize image based on request headers
   */
  private async optimizeImage(asset: StaticAsset, _request: Request): Promise<StaticAsset> {
    // For now, return original asset
    // In production, you'd integrate with image optimization service
    // and use request headers to determine optimal format
    return asset;
  }

  /**
   * Minify CSS
   */
  private async minifyCSS(asset: StaticAsset): Promise<StaticAsset> {
    // Basic CSS minification (remove comments and extra whitespace)
    const text = new TextDecoder().decode(asset.content);
    const minified = text
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .trim();

    return {
      ...asset,
      content: new TextEncoder().encode(minified).buffer,
    };
  }

  /**
   * Minify JavaScript
   */
  private async minifyJS(asset: StaticAsset): Promise<StaticAsset> {
    // Basic JS minification (remove comments and extra whitespace)
    const text = new TextDecoder().decode(asset.content);
    const minified = text
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();

    return {
      ...asset,
      content: new TextEncoder().encode(minified).buffer,
    };
  }

  /**
   * Minify HTML
   */
  private async minifyHTML(asset: StaticAsset): Promise<StaticAsset> {
    // Basic HTML minification
    const text = new TextDecoder().decode(asset.content);
    const minified = text
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();

    return {
      ...asset,
      content: new TextEncoder().encode(minified).buffer,
    };
  }

  /**
   * Get cache key for asset
   */
  private getCacheKey(path: string, request: Request): string {
    const acceptHeader = request.headers.get('accept') || '';
    const userAgent = request.headers.get('user-agent') || '';

    // Include optimization parameters in cache key
    const optimizationKey = this.getOptimizationKey(acceptHeader, userAgent);
    return `asset:${path}:${optimizationKey}`;
  }

  /**
   * Get optimization key based on request headers
   */
  private getOptimizationKey(_accept: string, _userAgent: string): string {
    // For now, return a simple key
    // In production, you'd use accept and userAgent to determine optimization
    return 'default';
  }

  /**
   * Get from cache
   */
  private async getFromCache(_key: string): Promise<StaticAsset | null> {
    // In a real implementation, you'd use a cache service
    // For now, return null to always fetch from storage
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(_key: string, _asset: StaticAsset): Promise<void> {
    // In a real implementation, you'd store in cache service
    // For now, do nothing
  }

  /**
   * Create cached response
   */
  private createCachedResponse(asset: StaticAsset): Response {
    return new Response(asset.content, {
      headers: {
        'Content-Type': asset.mimeType,
        'Cache-Control': asset.cacheControl,
        ETag: asset.etag || '',
        'X-Cache': 'HIT',
      },
    });
  }

  /**
   * Create asset response
   */
  private createAssetResponse(asset: StaticAsset, _path: string): Response {
    const headers = new Headers({
      'Content-Type': asset.mimeType,
      'Cache-Control': asset.cacheControl,
      'X-Cache': 'MISS',
    });

    if (asset.etag) {
      headers.set('ETag', asset.etag);
    }

    if (asset.lastModified) {
      headers.set('Last-Modified', asset.lastModified.toUTCString());
    }

    return new Response(asset.content, { headers });
  }

  /**
   * Normalize path for storage
   */
  private normalizePath(path: string): string {
    return path.startsWith('/') ? path.slice(1) : path;
  }

  /**
   * Check if file is an image
   */
  private isImage(ext?: string): boolean {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];
    return ext ? imageExts.includes(ext) : false;
  }

  /**
   * Get MIME type for file
   */
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
      webp: 'image/webp',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Get cache control header
   */
  private getCacheControl(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const cacheableExts = [
      'css',
      'js',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'webp',
      'ico',
      'woff',
      'woff2',
      'ttf',
      'eot',
    ];

    if (cacheableExts.includes(ext || '')) {
      const ttl = this.cacheStrategy.staticAssetsTTL;
      const swr = this.cacheStrategy.staleWhileRevalidate ? `, stale-while-revalidate=${ttl}` : '';
      return `public, max-age=${ttl}${swr}`;
    }

    return 'no-cache';
  }

  /**
   * Generate ETag for content
   */
  private async generateETag(content: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-1', content);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `"${hashHex}"`;
  }
}
