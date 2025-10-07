import type { ExecutionContext, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeAdapter } from '../adapter';
import type { EdgeAdapterConfig } from '../types';

// Mock Cloudflare Workers types
const mockKVNamespace = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockR2Bucket = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

const mockEnv = {
  STATIC_KV: mockKVNamespace as unknown as KVNamespace<string>,
  STATIC_R2: mockR2Bucket as unknown as R2Bucket,
};

describe('Edge Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEdgeAdapter', () => {
    it('should create adapter with minimal config', () => {
      const config: EdgeAdapterConfig = {};

      const adapter = createEdgeAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter.handleRequest).toBeDefined();
    });

    it('should create adapter with full config', () => {
      const config: EdgeAdapterConfig = {
        onRequest: vi.fn(),
        staticAssets: {
          kvNamespace: mockKVNamespace as unknown as KVNamespace<string>,
          r2Bucket: mockR2Bucket as unknown as R2Bucket,
          cacheTtl: 3600,
        },
        security: {
          headers: {
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
          },
          csp: "default-src 'self'; script-src 'self' 'unsafe-inline'",
        },
        errorHandling: {
          errorTemplate: (error: Error) => `<html><body>Error: ${error.message}</body></html>`,
        },
      };

      const adapter = createEdgeAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter.handleRequest).toBeDefined();
    });

    it('should handle request with custom handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response('Hello World'));
      const config: EdgeAdapterConfig = {
        onRequest: mockHandler,
      };

      const adapter = createEdgeAdapter(config);
      const request = new Request('https://example.com/api/test');
      const env = mockEnv;
      const ctx = mockExecutionContext as unknown as ExecutionContext;

      const response = await adapter.handleRequest(request, env, ctx);

      expect(mockHandler).toHaveBeenCalledWith(request, env, ctx);
      expect(response).toBeInstanceOf(Response);
      expect(await response.text()).toBe('Hello World');
    });

    it('should serve static assets from KV', async () => {
      const mockAsset = new Uint8Array([1, 2, 3, 4]);
      mockKVNamespace.get.mockResolvedValue(mockAsset);

      const config: EdgeAdapterConfig = {
        staticAssets: {
          kvNamespace: mockKVNamespace as unknown as KVNamespace<string>,
          cacheTtl: 3600,
        },
      };

      const adapter = createEdgeAdapter(config);
      const request = new Request('https://example.com/static/image.png');
      const env = mockEnv;
      const ctx = mockExecutionContext as unknown as ExecutionContext;

      const response = await adapter.handleRequest(request, env, ctx);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('should return 404 for missing static assets', async () => {
      mockKVNamespace.get.mockResolvedValue(null);
      mockR2Bucket.get.mockResolvedValue(null);

      const config: EdgeAdapterConfig = {
        staticAssets: {
          kvNamespace: mockKVNamespace as unknown as KVNamespace<string>,
          r2Bucket: mockR2Bucket as unknown as R2Bucket,
        },
      };

      const adapter = createEdgeAdapter(config);
      const request = new Request('https://example.com/static/missing.png');
      const env = mockEnv;
      const ctx = mockExecutionContext as unknown as ExecutionContext;

      const response = await adapter.handleRequest(request, env, ctx);

      expect(response.status).toBe(404);
    });

    it('should add security headers', async () => {
      const config: EdgeAdapterConfig = {
        onRequest: vi.fn().mockResolvedValue(new Response('OK')),
        security: {
          headers: {
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
          },
          csp: "default-src 'self'",
        },
      };

      const adapter = createEdgeAdapter(config);
      const request = new Request('https://example.com/');
      const env = mockEnv;
      const ctx = mockExecutionContext as unknown as ExecutionContext;

      const response = await adapter.handleRequest(request, env, ctx);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should handle errors gracefully', async () => {
      const config: EdgeAdapterConfig = {
        onRequest: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      const adapter = createEdgeAdapter(config);
      const request = new Request('https://example.com/');
      const env = mockEnv;
      const ctx = mockExecutionContext as unknown as ExecutionContext;

      const response = await adapter.handleRequest(request, env, ctx);

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toContain('text/html');
    });
  });
});
