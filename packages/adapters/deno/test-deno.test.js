/**
 * Deno-specific integration tests
 * Run with: deno test --allow-net --allow-read test-deno.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createDenoAdapter } from './dist/index.js';

Deno.test('Deno Adapter - Basic Functionality', async () => {
  const adapter = createDenoAdapter({
    port: 0, // Use random port
    staticDir: undefined, // No static files for this test
  });

  assertExists(adapter);
  assertExists(adapter.listen);
  assertExists(adapter.close);
  assertExists(adapter.address);
});

Deno.test('Deno Adapter - Configuration', () => {
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
});

Deno.test('Deno Adapter - Custom Request Handler', () => {
  const adapter = createDenoAdapter({
    onRequest: async (request) => {
      if (request.url.includes('/test')) {
        return new Response('Test Response', { status: 200 });
      }
      return null;
    },
  });

  assertExists(adapter);
});

Deno.test('Deno Adapter - Permissions Configuration', () => {
  const adapter = createDenoAdapter({
    permissions: {
      read: ['./public', './dist'],
      net: ['localhost:3000', '0.0.0.0:8080'],
    },
  });

  assertExists(adapter);
});

Deno.test('Deno Adapter - Address Before Start', () => {
  const adapter = createDenoAdapter();
  const address = adapter.address();

  // Should be null before starting
  assertEquals(address, null);
});

// Note: We don't test actual server startup in unit tests
// as it would require network permissions and could interfere
// with other tests. Integration tests should be run separately.
