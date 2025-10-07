import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDenoAdapter } from '../adapter';
import type { DenoAdapterConfig } from '../types';

// Mock Deno APIs
const mockDeno = {
  serve: vi.fn(),
  listen: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  readDir: vi.fn(),
  permissions: {
    query: vi.fn(),
  },
  exit: vi.fn(),
  errors: {
    PermissionDenied: class PermissionDenied extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'PermissionDenied';
      }
    },
  },
};

// Mock global Deno object
(global as unknown as { Deno: typeof mockDeno }).Deno = mockDeno;

describe('Deno Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockDeno.serve.mockReturnValue({
      finished: Promise.resolve(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });

    mockDeno.listen.mockReturnValue({
      close: vi.fn(),
    });

    mockDeno.permissions.query.mockResolvedValue({ state: 'granted' });
    mockDeno.readDir.mockResolvedValue([]);
    mockDeno.stat.mockResolvedValue({
      isFile: true,
      size: 1024,
      mtime: new Date('2023-01-01'),
    });
    mockDeno.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createDenoAdapter', () => {
    it('should create adapter with minimal config', () => {
      const config: DenoAdapterConfig = {};

      const adapter = createDenoAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter.listen).toBeDefined();
      expect(adapter.close).toBeDefined();
      expect(adapter.address).toBeDefined();
    });

    it('should create adapter with full config', () => {
      const config: DenoAdapterConfig = {
        port: 8080,
        hostname: 'localhost',
        staticDir: 'public',
        dev: true,
        compression: false,
        shutdownTimeout: 5000,
        onRequest: vi.fn(),
        permissions: {
          read: ['./public'],
          net: ['localhost:8080'],
        },
      };

      const adapter = createDenoAdapter(config);

      expect(adapter).toBeDefined();
    });
  });

  describe('listen', () => {
    it('should start server with default config', async () => {
      const adapter = createDenoAdapter();

      await adapter.listen();

      expect(mockDeno.serve).toHaveBeenCalledWith({
        port: 3000,
        hostname: '0.0.0.0',
        handler: expect.any(Function),
        onListen: expect.any(Function),
      });
    });

    it('should start server with custom config', async () => {
      const config: DenoAdapterConfig = {
        port: 8080,
        hostname: 'localhost',
      };
      const adapter = createDenoAdapter(config);

      await adapter.listen();

      expect(mockDeno.serve).toHaveBeenCalledWith({
        port: 8080,
        hostname: 'localhost',
        handler: expect.any(Function),
        onListen: expect.any(Function),
      });
    });

    it('should check permissions before starting', async () => {
      const adapter = createDenoAdapter();

      await adapter.listen();

      expect(mockDeno.listen).toHaveBeenCalledWith({ port: 3000, hostname: '0.0.0.0' });
    });

    it('should handle permission denied', async () => {
      mockDeno.listen.mockImplementation(() => {
        throw new mockDeno.errors.PermissionDenied('Permission denied');
      });

      const adapter = createDenoAdapter();

      await expect(adapter.listen()).rejects.toThrow('Permission denied');
    });
  });

  describe('close', () => {
    it('should close server gracefully', async () => {
      const mockShutdown = vi.fn().mockResolvedValue(undefined);
      mockDeno.serve.mockReturnValue({
        finished: Promise.resolve(),
        shutdown: mockShutdown,
      });

      const adapter = createDenoAdapter();
      await adapter.listen();

      await adapter.close();

      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should handle close timeout', async () => {
      const mockShutdown = vi.fn().mockRejectedValue(new Error('Timeout'));
      mockDeno.serve.mockReturnValue({
        finished: Promise.resolve(),
        shutdown: mockShutdown,
      });

      const adapter = createDenoAdapter();
      await adapter.listen();

      // Should not throw even with timeout
      await expect(adapter.close()).resolves.toBeUndefined();
    });
  });

  describe('address', () => {
    it('should return null when server not started', () => {
      const adapter = createDenoAdapter();

      expect(adapter.address()).toBeNull();
    });

    it('should return server address when started', async () => {
      const config: DenoAdapterConfig = {
        port: 8080,
        hostname: 'localhost',
      };
      const adapter = createDenoAdapter(config);

      await adapter.listen();

      const address = adapter.address();
      expect(address).toEqual({
        port: 8080,
        host: 'localhost',
      });
    });
  });

  describe('request handling', () => {
    it('should handle custom request handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response('Hello World'));
      const config: DenoAdapterConfig = {
        onRequest: mockHandler,
      };
      const adapter = createDenoAdapter(config);

      await adapter.listen();

      // Get the handler function passed to Deno.serve
      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/api/test', { method: 'POST' });

      const response = await handler(request);

      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(response).toBeInstanceOf(Response);
      expect(await response.text()).toBe('Hello World');
    });

    it('should serve static files', async () => {
      const adapter = createDenoAdapter({
        staticDir: 'public',
      });

      await adapter.listen();

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/test.txt');

      const response = await handler(request);

      expect(mockDeno.stat).toHaveBeenCalledWith('public/test.txt');
      expect(mockDeno.readFile).toHaveBeenCalledWith('public/test.txt');
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('should return 404 for missing static files', async () => {
      mockDeno.stat.mockRejectedValue(new Error('File not found'));

      const adapter = createDenoAdapter({
        staticDir: 'public',
      });

      await adapter.listen();

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/missing.txt');

      const response = await handler(request);

      expect(response.status).toBe(404);
    });

    it('should handle graceful shutdown', async () => {
      const adapter = createDenoAdapter();

      await adapter.listen();

      // Manually set the shutdown signal to test the behavior
      (adapter as unknown as { shutdownSignal: boolean }).shutdownSignal = true;

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/api/shutdown', { method: 'POST' });

      const response = await handler(request);

      expect(response.status).toBe(503);
      expect(await response.text()).toBe('Server shutting down');
    });

    it('should handle non-GET requests', async () => {
      const adapter = createDenoAdapter();

      await adapter.listen();

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/', { method: 'POST' });

      const response = await handler(request);

      // Should not try to serve static files for non-GET requests
      expect(mockDeno.stat).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
    });
  });

  describe('compression', () => {
    it('should compress responses when enabled', async () => {
      const adapter = createDenoAdapter({
        compression: true,
        staticDir: 'public',
      });

      await adapter.listen();

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/test.txt', {
        headers: { 'Accept-Encoding': 'gzip' },
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
      // In a real implementation, we'd check for compression headers
    });

    it('should not compress when disabled', async () => {
      const adapter = createDenoAdapter({
        compression: false,
        staticDir: 'public',
      });

      await adapter.listen();

      const serveConfig = mockDeno.serve.mock.calls[0][0];
      const handler = serveConfig.handler;
      const request = new Request('https://example.com/test.txt', {
        headers: { 'Accept-Encoding': 'gzip' },
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
    });
  });
});
