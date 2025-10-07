/**
 * Example Cloudflare Worker using the Edge adapter
 *
 * This example demonstrates how to use the Edge adapter in a Cloudflare Worker
 * with static asset serving, security headers, and custom request handling.
 */

import { createEdgeAdapter } from './dist/index.js';

// Example request handler
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  // Handle API routes
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(request, env, ctx);
  }

  // Handle page routes
  if (url.pathname === '/') {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Plank Edge Adapter Example</title>
          <link rel="stylesheet" href="/static/styles.css">
        </head>
        <body>
          <h1>Welcome to Plank Edge Adapter</h1>
          <p>This page is served by Cloudflare Workers with the Edge adapter.</p>
          <button onclick="fetch('/api/hello').then(r => r.text()).then(alert)">Test API</button>
          <script src="/static/script.js"></script>
        </body>
      </html>
    `,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }

  // Let the adapter handle static assets and other requests
  return null;
}

// Example API handler
async function handleApiRequest(request, _env, _ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/api/hello') {
    return new Response(
      JSON.stringify({
        message: 'Hello from Plank Edge Adapter!',
        timestamp: new Date().toISOString(),
        worker: 'cloudflare-workers',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  if (url.pathname === '/api/status') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        adapter: 'edge',
        runtime: 'cloudflare-workers',
        version: '1.0.0',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return new Response('Not Found', { status: 404 });
}

// Create the Edge adapter
const adapter = createEdgeAdapter({
  handler: handleRequest,

  // Static assets configuration
  staticAssets: {
    // Use KV namespace for static assets
    kvNamespace: env.STATIC_ASSETS_KV,
    // Use R2 bucket for larger assets
    r2Bucket: env.STATIC_ASSETS_R2,
    // Cache TTL in seconds
    cacheTtl: 3600,
  },

  // Security configuration
  security: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },

    // Content Security Policy
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:'],
    },

    // Rate limiting
    rateLimit: {
      requests: 100,
      window: 60, // 1 minute
    },
  },

  // Custom error template
  errorTemplate: `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error {{status}}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">Error {{status}}</h1>
        <p>{{message}}</p>
        <a href="/">Go Home</a>
      </body>
    </html>
  `,
});

// Export the fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return adapter.handleRequest(request, env, ctx);
  },
};
