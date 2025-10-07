# @plank/adapter-edge

Edge runtime adapter for Plank framework (Cloudflare Workers).

## Features

- **Cloudflare Workers Runtime**: Optimized for Cloudflare's edge computing platform
- **Static Asset Serving**: Efficient serving from KV storage and R2 buckets
- **Security Headers**: Comprehensive security headers including CSP, HSTS, and more
- **Rate Limiting**: Built-in rate limiting with configurable thresholds
- **Error Handling**: Custom error pages with development/production modes
- **Asset Optimization**: Automatic minification of CSS, JS, and HTML
- **Caching**: Intelligent caching strategies for static assets
- **TypeScript**: Full TypeScript support with strict type checking

## Installation

```bash
pnpm add @plank/adapter-edge
```

## Quick Start

```typescript
import { createEdgeAdapter } from '@plank/adapter-edge';

// Create the adapter
const adapter = createEdgeAdapter({
  onRequest: async (request, env, ctx) => {
    // Your request handler
    return new Response('Hello from Edge!');
  },

  staticAssets: {
    kvNamespace: env.STATIC_KV,
    r2Bucket: env.STATIC_R2,
    cacheTtl: 3600,
  },

  security: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'",
  },
});

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return adapter.handleRequest(request, env, ctx);
  },
};
```

## Configuration

### EdgeAdapterConfig

```typescript
interface EdgeAdapterConfig {
  /** Custom request handler */
  onRequest?: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response | null>;

  /** Static assets configuration */
  staticAssets?: {
    /** KV namespace for static assets */
    kvNamespace?: KVNamespace;
    /** R2 bucket for larger static assets */
    r2Bucket?: R2Bucket;
    /** Cache TTL in seconds */
    cacheTtl?: number;
  };

  /** Security configuration */
  security?: {
    /** Custom security headers */
    headers?: Record<string, string>;
    /** Content Security Policy */
    csp?: string;
  };

  /** Error handling configuration */
  errorHandling?: {
    /** Custom error template */
    errorTemplate?: string;
    /** Development mode */
    devMode?: boolean;
  };
}
```

## Static Assets

The Edge adapter supports serving static assets from both KV storage and R2 buckets:

### KV Storage
- Best for small assets (< 25MB)
- Faster access times
- Automatic caching

### R2 Storage
- Best for larger assets
- Cost-effective for high bandwidth
- Supports range requests

### Asset Optimization

The adapter automatically optimizes assets:

- **CSS**: Minification, whitespace removal
- **JavaScript**: Minification, comment removal
- **HTML**: Minification, whitespace optimization
- **Images**: Format optimization (when configured)

## Security Features

### Security Headers

The adapter automatically adds security headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), ...`

### Content Security Policy

Configure CSP to prevent XSS attacks:

```typescript
const adapter = createEdgeAdapter({
  security: {
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  },
});
```

### Rate Limiting

Built-in rate limiting to prevent abuse:

```typescript
const adapter = createEdgeAdapter({
  security: {
    rateLimit: {
      requests: 100,    // Max requests
      window: 60,       // Per 60 seconds
    },
  },
});
```

## Error Handling

### Custom Error Pages

Create custom error templates:

```typescript
const adapter = createEdgeAdapter({
  errorHandling: {
    errorTemplate: `
      <!DOCTYPE html>
      <html>
        <head><title>Error {{status}}</title></head>
        <body>
          <h1>Error {{status}}</h1>
          <p>{{message}}</p>
        </body>
      </html>
    `,
  },
});
```

### Development Mode

Enable development mode for detailed error information:

```typescript
const adapter = createEdgeAdapter({
  errorHandling: {
    devMode: true,
  },
});
```

## Cloudflare Workers Setup

### wrangler.toml

```toml
name = "my-plank-app"
main = "src/worker.js"
compatibility_date = "2023-10-30"

# KV namespaces
[[kv_namespaces]]
binding = "STATIC_KV"
id = "your-kv-namespace-id"

# R2 buckets
[[r2_buckets]]
binding = "STATIC_R2"
bucket_name = "your-r2-bucket-name"
```

### Environment Variables

```typescript
interface Env {
  STATIC_KV: KVNamespace;
  STATIC_R2: R2Bucket;
  // Your custom environment variables
}
```

## Performance

The Edge adapter is optimized for Cloudflare's global network:

- **Edge Computing**: Runs close to users worldwide
- **Automatic Scaling**: Scales to zero when not in use
- **Global CDN**: Leverages Cloudflare's CDN
- **Smart Caching**: Intelligent caching strategies

## Testing

Run the test suite:

```bash
# Unit tests
pnpm test

# Test with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Example Applications

See the `example-worker.js` file for a complete example of using the Edge adapter in a Cloudflare Worker.

## API Reference

### createEdgeAdapter(config?)

Creates a new Edge adapter instance.

**Parameters:**
- `config` (optional): Configuration object

**Returns:** `EdgeAdapter` instance

### EdgeAdapter.handleRequest(request, env, ctx)

Handles incoming requests.

**Parameters:**
- `request`: The incoming Request object
- `env`: Cloudflare Workers environment
- `ctx`: Execution context

**Returns:** `Promise<Response>`

## License

Apache-2.0
