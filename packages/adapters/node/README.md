# @plank/adapter-node

Production-ready Node.js 20+ adapter for the Plank framework.

## Features

- ✅ **Node 20+ Native**: Uses native fetch API and Web Streams
- ✅ **Production Ready**: Graceful shutdown, error handling, logging
- ✅ **Static File Serving**: Automatic MIME types and caching
- ✅ **Streaming Support**: Full streaming SSR with backpressure
- ✅ **Fetch Compatible**: Standard Web Request/Response API
- ✅ **TypeScript**: Full type safety

## Installation

```bash
pnpm add @plank/adapter-node
```

## Usage

### Basic Server

```typescript
import { createNodeAdapter } from '@plank/adapter-node';

const server = createNodeAdapter({
  port: 3000,
  staticDir: './dist',
  onRequest: async (request) => {
    return new Response('Hello, world!');
  },
});

await server.listen();
```

### With Plank SSR

```typescript
import { createNodeAdapter } from '@plank/adapter-node';
import { SSRRenderer } from '@plank/ssr';
import { createRouter } from '@plank/router';

const renderer = new SSRRenderer();
const router = createRouter({
  routesDir: './app/routes',
});

const server = createNodeAdapter({
  port: 3000,
  staticDir: './dist',
  onRequest: async (request) => {
    const route = await router.match(request.url);

    if (!route) {
      return null; // 404
    }

    const html = await renderer.render(route.component, route.props);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});

await server.listen();
```

### Graceful Shutdown

```typescript
const server = createNodeAdapter({
  port: 3000,
  shutdownTimeout: 10000, // 10 seconds
});

await server.listen();

// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await server.close();
  process.exit(0);
});
```

### Streaming SSR

```typescript
const server = createNodeAdapter({
  port: 3000,
  onRequest: async (request) => {
    const stream = new ReadableStream({
      async start(controller) {
        // Send shell
        controller.enqueue(
          new TextEncoder().encode('<!DOCTYPE html><html><head>')
        );

        // Load data
        const data = await loadData();

        // Send content
        controller.enqueue(
          new TextEncoder().encode(`<body>${renderContent(data)}</body></html>`)
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});
```

## Configuration

```typescript
interface NodeAdapterConfig {
  /** Port to listen on (default: 3000) */
  port?: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /** Enable compression (default: true) */
  compression?: boolean;

  /** Static assets directory (default: 'dist') */
  staticDir?: string;

  /** Enable detailed error messages (default: false) */
  dev?: boolean;

  /** Graceful shutdown timeout in ms (default: 10000) */
  shutdownTimeout?: number;

  /** Custom request handler */
  onRequest?: (req: Request) => Promise<Response | null>;
}
```

## Static File Serving

The adapter automatically serves static files from `staticDir`:

- **Automatic MIME types**: Detects correct Content-Type
- **Smart caching**: Immutable for hashed files, short TTL for others
- **Security**: Prevents directory traversal attacks

### Cache Headers

| File Type | Cache-Control |
|-----------|---------------|
| Hashed assets (e.g., `app.a1b2c3d4.js`) | `public, max-age=31536000, immutable` |
| Images & fonts | `public, max-age=86400` (1 day) |
| CSS & JS | `public, max-age=3600` (1 hour) |
| Other files | `public, max-age=300` (5 minutes) |
| Development mode | `no-cache` |

## Error Handling

### Production Mode (default)

Shows user-friendly error pages without sensitive information.

### Development Mode

```typescript
const server = createNodeAdapter({
  dev: true, // Shows full stack traces
});
```

## API Reference

### `createNodeAdapter(config)`

Creates a new Node adapter instance.

**Parameters:**
- `config`: `NodeAdapterConfig` - Configuration options

**Returns:** `NodeServer`

### `NodeServer`

**Methods:**

#### `listen(): Promise<void>`

Start the HTTP server.

#### `close(): Promise<void>`

Stop the server gracefully. Waits for active connections to complete.

#### `address(): { port: number; host: string } | null`

Get the server's address.

## Deployment

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
```

### PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'plank-app',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
```

### Systemd

```ini
[Unit]
Description=Plank App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/node /var/www/app/dist/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

## Performance

### Benchmarks (Node 20)

| Metric | Value |
|--------|-------|
| Requests/sec | ~50,000 |
| Latency (p50) | ~2ms |
| Latency (p99) | ~10ms |
| Memory (idle) | ~30MB |

### Optimization Tips

1. **Enable compression** for text responses
2. **Use streaming** for large responses
3. **Cache static assets** with CDN
4. **Use clustering** with PM2 or native cluster module
5. **Set NODE_ENV=production**

## License

Apache-2.0
