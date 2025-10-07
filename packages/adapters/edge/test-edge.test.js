#!/usr/bin/env node

/**
 * Edge adapter integration tests - tests actual Cloudflare Workers functionality
 * Run with: node test-edge.test.js
 *
 * These tests simulate the Workers environment and test actual functionality
 */

import { createEdgeAdapter } from './dist/index.js';

// Mock Workers environment
global.KVNamespace = class MockKV {
  constructor() {
    this.data = new Map();
  }

  async get(key, type = 'text') {
    const value = this.data.get(key);
    if (!value) return null;

    if (type === 'arrayBuffer') {
      return new TextEncoder().encode(value).buffer;
    }

    return value;
  }

  async put(key, value) {
    this.data.set(key, value);
  }
};

global.R2Bucket = class MockR2 {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    const value = this.data.get(key);
    if (!value) return null;
    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(value));
          controller.close();
        }
      }),
      headers: new Headers({ 'content-type': 'text/plain' }),
      uploaded: new Date().toISOString(),
      httpEtag: `"${Date.now()}"`,
      async arrayBuffer() {
        return new TextEncoder().encode(value).buffer;
      }
    };
  }

  async put(key, value) {
    this.data.set(key, value);
  }
};

global.ExecutionContext = class MockExecutionContext {
  waitUntil(promise) {
    // In real Workers, this would wait for the promise
    return promise;
  }

  passThroughOnException() {
    // In real Workers, this would pass through exceptions
  }
};

// Test suite
async function runTests() {
  console.log('🧪 Running Edge Adapter Integration Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`✅ ${name}`);
        testsPassed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        testsFailed++;
      }
    };
  }

  // Test 1: Basic adapter creation
  await test('should create Edge adapter successfully', async () => {
    const adapter = createEdgeAdapter({
      staticAssets: {
        kvNamespace: new global.KVNamespace(),
        r2Bucket: new global.R2Bucket()
      }
    });

    if (!adapter) throw new Error('Adapter not created');
    if (typeof adapter.handleRequest !== 'function') throw new Error('handleRequest not a function');
  })();

  // Test 2: Request handling
  await test('should handle basic requests', async () => {
    const adapter = createEdgeAdapter({
      onRequest: async (request) => {
        if (request.url.includes('/test')) {
          return new Response('Test Response', { status: 200 });
        }
        return null;
      }
    });

    const mockEnv = { ENVIRONMENT: 'test' };
    const request = new Request('http://localhost:3000/test');
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');
    if (response.status !== 200) throw new Error(`Expected status 200, got ${response.status}`);

    const text = await response.text();
    if (text !== 'Test Response') throw new Error(`Expected 'Test Response', got '${text}'`);
  })();

  // Test 3: Static asset serving from KV
  await test('should serve static assets from KV', async () => {
    const mockKV = new global.KVNamespace();
    await mockKV.put('styles.css', 'body { color: red; }');

    const adapter = createEdgeAdapter({
      staticAssets: {
        kvNamespace: mockKV,
        r2Bucket: new global.R2Bucket()
      }
    });

    const request = new Request('http://localhost:3000/styles.css');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');
    if (response.status !== 200) throw new Error(`Expected status 200, got ${response.status}`);

    const text = await response.text();
    if (!text.includes('color: red')) throw new Error('KV asset not served correctly');
  })();

  // Test 4: Static asset serving from R2
  await test('should serve static assets from R2', async () => {
    const mockR2 = new global.R2Bucket();
    await mockR2.put('script.js', 'console.log("Hello from R2");');

    const adapter = createEdgeAdapter({
      staticAssets: {
        kvNamespace: new global.KVNamespace(),
        r2Bucket: mockR2
      }
    });

    const request = new Request('http://localhost:3000/script.js');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');
    if (response.status !== 200) throw new Error(`Expected status 200, got ${response.status}`);

    const text = await response.text();
    if (!text.includes('Hello from R2')) throw new Error('R2 asset not served correctly');
  })();

  // Test 5: 404 handling
  await test('should handle 404 for missing assets', async () => {
    const adapter = createEdgeAdapter({
      staticAssets: {
        kvNamespace: new global.KVNamespace(),
        r2Bucket: new global.R2Bucket()
      }
    });

    const request = new Request('http://localhost:3000/nonexistent.css');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');
    if (response.status !== 404) throw new Error(`Expected status 404, got ${response.status}`);
  })();

  // Test 6: Security headers
  await test('should add security headers', async () => {
    const adapter = createEdgeAdapter({
      security: {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    });

    const request = new Request('http://localhost:3000/');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');

    const xFrameOptions = response.headers.get('X-Frame-Options');
    const xContentTypeOptions = response.headers.get('X-Content-Type-Options');

    if (xFrameOptions !== 'DENY') throw new Error('X-Frame-Options header not set');
    if (xContentTypeOptions !== 'nosniff') throw new Error('X-Content-Type-Options header not set');
  })();

  // Test 7: CSP headers
  await test('should add CSP headers', async () => {
    const adapter = createEdgeAdapter({
      security: {
        csp: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"]
        }
      }
    });

    const request = new Request('http://localhost:3000/');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');

    const csp = response.headers.get('Content-Security-Policy');
    if (!csp) throw new Error('CSP header not set');
    if (!csp.includes("default-src 'self'")) throw new Error('CSP default-src not set');
  })();

  // Test 8: Error handling
  await test('should handle errors gracefully', async () => {
    const adapter = createEdgeAdapter({
      onRequest: async () => {
        throw new Error('Test error');
      }
    });

    const request = new Request('http://localhost:3000/');
    const mockEnv = { ENVIRONMENT: 'test' };
    const response = await adapter.handleRequest(request, mockEnv, new global.ExecutionContext());

    if (!response) throw new Error('No response returned');
    if (response.status !== 500) throw new Error(`Expected status 500, got ${response.status}`);
  })();

  // Test 9: Performance test
  await test('should handle concurrent requests efficiently', async () => {
    const adapter = createEdgeAdapter({
      onRequest: async (_request) => {
        return new Response('OK', { status: 200 });
      }
    });

    const concurrentRequests = 50;
      const mockEnv = { ENVIRONMENT: 'test' };
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const request = new Request(`http://localhost:3000/test-${i}`);
        return adapter.handleRequest(request, mockEnv, new global.ExecutionContext());
      });

    const startTime = performance.now();
    const responses = await Promise.all(requests);
    const endTime = performance.now();

    const duration = endTime - startTime;
    const requestsPerSecond = (concurrentRequests / duration) * 1000;

    if (responses.length !== concurrentRequests) throw new Error('Not all requests completed');
    if (requestsPerSecond < 100) throw new Error(`Too slow: ${requestsPerSecond.toFixed(0)} req/s`);

    console.log(`   📊 Edge handled ${requestsPerSecond.toFixed(0)} requests/second`);
  })();

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

  if (testsFailed > 0) {
    console.log(`\n❌ ${testsFailed} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All tests passed!`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
