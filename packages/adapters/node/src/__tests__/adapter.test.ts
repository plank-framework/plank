/**
 * @fileoverview Tests for Node adapter
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createNodeAdapter } from '../adapter.js';
import type { NodeServer } from '../types.js';

describe('NodeAdapter', () => {
  let server: NodeServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('should create adapter with default config', () => {
    const adapter = createNodeAdapter();
    expect(adapter).toBeDefined();
  });

  it('should start server on specified port', async () => {
    server = createNodeAdapter({ port: 0 }); // Random port
    await server.listen();

    const address = server.address();
    expect(address).not.toBeNull();
    expect(address?.port).toBeGreaterThan(0);
  });

  it('should handle custom request handler', async () => {
    server = createNodeAdapter({
      port: 0,
      onRequest: async (req) => {
        if (req.url.endsWith('/custom')) {
          return new Response('Custom response');
        }
        return null;
      },
    });

    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/custom`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Custom response');
  });

  it('should return 404 for unknown routes', async () => {
    server = createNodeAdapter({ port: 0 });
    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/unknown`);

    expect(response.status).toBe(404);
  });

  it('should close gracefully', async () => {
    server = createNodeAdapter({ port: 0, shutdownTimeout: 1000 });
    await server.listen();
    await server.close();

    expect(server.address()).toBeNull();
  });

  it('should handle POST requests', async () => {
    server = createNodeAdapter({
      port: 0,
      onRequest: async (req) => {
        if (req.method === 'POST') {
          const body = await req.text();
          return new Response(`Received: ${body}`);
        }
        return null;
      },
    });

    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/api`, {
      method: 'POST',
      body: 'test data',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Received: test data');
  });

  it('should handle JSON responses', async () => {
    server = createNodeAdapter({
      port: 0,
      onRequest: async () => {
        return Response.json({ message: 'Hello, world!' });
      },
    });

    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ message: 'Hello, world!' });
  });

  it('should handle errors gracefully', async () => {
    server = createNodeAdapter({
      port: 0,
      dev: false,
      onRequest: async () => {
        throw new Error('Test error');
      },
    });

    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/`);

    expect(response.status).toBe(500);
  });

  it('should handle streaming responses', async () => {
    server = createNodeAdapter({
      port: 0,
      onRequest: async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk1'));
            controller.enqueue(new TextEncoder().encode('chunk2'));
            controller.close();
          },
        });

        return new Response(stream);
      },
    });

    await server.listen();

    const address = server.address();
    const response = await fetch(`http://localhost:${address?.port}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('chunk1chunk2');
  });
});
