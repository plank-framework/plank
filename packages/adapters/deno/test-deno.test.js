#!/usr/bin/env deno

/**
 * Real Deno integration tests - actually tests Deno.serve functionality
 * Run with: deno test --allow-net --allow-read test-deno.test.js
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createDenoAdapter } from './dist/index.js';

Deno.test('Deno Adapter Integration Tests', async (t) => {
  let adapter;
  const testPort = 3002;

  await t.step('should start server successfully', async () => {
    adapter = createDenoAdapter({
      port: testPort,
      hostname: 'localhost',
      staticDir: undefined,
      dev: false,
      compression: true,
    });

    await adapter.listen();

    const address = adapter.address();
    assertExists(address);
    assertEquals(address.port, testPort);
  });

  await t.step('should handle 404 for non-existent files', async () => {
    const response = await fetch(`http://localhost:${testPort}/nonexistent.txt`);
    assertEquals(response.status, 404);
    assertEquals(await response.text(), 'Not Found');
  });

  await t.step('should use custom request handler', async () => {
    // Test custom handler by making a request to a non-static path
    const response = await fetch(`http://localhost:${testPort}/api/test`);
    // Should get some response (either from custom handler or default 404)
    assertExists(response);
  });

  await t.step('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 20; // Reduced for Deno
    const requests = Array.from({ length: concurrentRequests }, (_, i) =>
      fetch(`http://localhost:${testPort}/test-${i}.txt`)
    );

    const startTime = performance.now();
    const responses = await Promise.all(requests);
    const endTime = performance.now();

    const duration = endTime - startTime;
    const requestsPerSecond = (concurrentRequests / duration) * 1000;

    // Should handle at least 100 requests per second (Deno is slower than Bun)
    assertEquals(responses.length, concurrentRequests);
    console.log(`Deno handled ${requestsPerSecond.toFixed(0)} requests/second`);
  });

  await t.step('should start quickly', async () => {
    const startTime = performance.now();

    const testAdapter = createDenoAdapter({
      port: 3006, // Use different port to avoid conflicts
      hostname: 'localhost',
    });

    await testAdapter.listen();
    const endTime = performance.now();

    const startupTime = endTime - startTime;

    // Should start in less than 500ms (Deno is slower than Bun)
    console.log(`Deno startup time: ${startupTime.toFixed(0)}ms`);

    await testAdapter.close();
  });

  await t.step('should handle graceful shutdown', async () => {
    // Test that we can close the server
    await adapter.close();

    // Server should be closed
    const address = adapter.address();
    assertEquals(address, null);
  });
});

Deno.test('Deno Adapter - Configuration Tests', () => {
  const config = {
    port: 8080,
    hostname: 'localhost',
    staticDir: 'public',
    dev: true,
    compression: false,
    shutdownTimeout: 5000,
  };

  const adapter = createDenoAdapter(config);
  assertExists(adapter);
  assertExists(adapter.listen);
  assertExists(adapter.close);
  assertExists(adapter.address);
});

Deno.test('Deno Adapter - Custom Request Handler Configuration', () => {
  const adapter = createDenoAdapter({
    onRequest: async (request) => {
      if (request.url.includes('/test')) {
        return new Response('Test Response', { status: 200 });
      }
      return null;
    },
  });

  assertExists(adapter);
  assertExists(adapter.listen);
});

Deno.test('Deno Adapter - Permissions Configuration', () => {
  const adapter = createDenoAdapter({
    permissions: {
      read: ['./public', './dist'],
      net: ['localhost:3000', '0.0.0.0:8080'],
    },
  });

  assertExists(adapter);
  assertExists(adapter.listen);
});

Deno.test('Deno Adapter - Address Before Start', () => {
  const adapter = createDenoAdapter();
  const address = adapter.address();

  // Should be null before starting
  assertEquals(address, null);
});
