# @plank/ssr

Server-side rendering (SSR) for Plank applications with streaming HTML output, progressive enhancement, and island hydration.

## Features

- **Streaming SSR**: Progressive HTML streaming for faster perceived performance
- **Island Hydration**: Client-side hydration of interactive components
- **Progressive Enhancement**: Works without JavaScript, enhanced with it
- **Error Boundaries**: Graceful error handling and recovery
- **Performance Optimization**: Optimized rendering with minimal overhead
- **Type Safety**: Full TypeScript support for SSR contexts and results

## API

### `SSRRenderer`

The main SSR renderer class for rendering Plank templates.

```typescript
import { SSRRenderer } from '@plank/ssr';

const renderer = new SSRRenderer({
  templateDir: './app/routes',
  assetsDir: './dist',
  baseUrl: '/',
  streaming: true
});

const result = await renderer.render('/about', {
  url: '/about',
  method: 'GET',
  headers: {},
  params: {},
  query: {},
  data: { title: 'About Us' }
});
```

### `StreamingWriter`

Utility for writing streaming HTML responses.

```typescript
import { StreamingWriter } from '@plank/ssr';

const writer = new StreamingWriter();

writer.write('<html>');
writer.write('<head>');
writer.write('<title>My App</title>');
writer.write('</head>');
writer.write('<body>');
writer.write('<div id="app">Loading...</div>');
writer.write('</body>');
writer.write('</html>');

const stream = writer.getStream();
```

### Streaming Utilities

#### `generateDocument(options)`

Generates a complete HTML document with proper structure.

```typescript
import { generateDocument } from '@plank/ssr';

const html = generateDocument({
  title: 'My App',
  head: '<meta name="description" content="My awesome app">',
  body: '<div id="app">Content</div>',
  scripts: ['<script src="/app.js"></script>']
});
```

#### `generateEnhancementScript()`

Generates the client-side enhancement script for island hydration.

```typescript
import { generateEnhancementScript } from '@plank/ssr';

const script = generateEnhancementScript();
// Returns script tag for island hydration
```

#### `generateErrorBoundary(error, options)`

Generates error boundary HTML for graceful error handling.

```typescript
import { generateErrorBoundary } from '@plank/ssr';

const errorHtml = generateErrorBoundary(error, {
  fallback: '<div>Something went wrong</div>',
  showStack: process.env.NODE_ENV === 'development'
});
```

## Types

### `SSRContext`

Context object passed to the renderer containing request information.

```typescript
interface SSRContext {
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Route parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Server-side data */
  data: Record<string, unknown>;
  /** Streaming options */
  streaming?: StreamingOptions;
}
```

### `SSRResult`

Result object returned by the renderer.

```typescript
interface SSRResult {
  /** Rendered HTML */
  html: string;
  /** Streaming response if enabled */
  stream?: ReadableStream<Uint8Array>;
  /** Metadata about the render */
  metadata: {
    /** Time taken to render */
    renderTime: number;
    /** Number of islands rendered */
    islands: number;
    /** Size of rendered HTML */
    size: number;
  };
}
```

### `StreamingOptions`

Configuration for streaming behavior.

```typescript
interface StreamingOptions {
  /** Enable streaming HTML output */
  enabled: boolean;
  /** Chunk size for streaming */
  chunkSize?: number;
  /** Timeout for streaming operations */
  timeout?: number;
  /** Placeholder for loading states */
  placeholder?: string;
}
```

## SSR Configuration

### Basic Setup

```typescript
import { SSRRenderer } from '@plank/ssr';

const renderer = new SSRRenderer({
  templateDir: './app/routes',
  assetsDir: './dist',
  baseUrl: '/',
  streaming: true
});
```

### With Custom Context

```typescript
const context: SSRContext = {
  url: '/products/123',
  method: 'GET',
  headers: {
    'user-agent': 'Mozilla/5.0...',
    'accept': 'text/html'
  },
  params: { id: '123' },
  query: { color: 'blue' },
  data: {
    product: { id: 123, name: 'Widget', price: 29.99 }
  },
  streaming: {
    enabled: true,
    chunkSize: 1024,
    timeout: 5000
  }
};

const result = await renderer.render('/products/[id]', context);
```

## Streaming Features

### Progressive HTML Streaming

The SSR renderer supports streaming HTML for faster perceived performance:

```typescript
const result = await renderer.render('/page', context);

if (result.stream) {
  // Stream the response
  return new Response(result.stream, {
    headers: {
      'Content-Type': 'text/html',
      'Transfer-Encoding': 'chunked'
    }
  });
} else {
  // Return complete HTML
  return new Response(result.html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Streaming Boundaries

Use streaming boundaries to control when content is flushed:

```typescript
import { generateStreamingBoundary } from '@plank/ssr';

// In your template
const boundary = generateStreamingBoundary('critical-css');
// Flushes content up to this point immediately
```

## Island Hydration

The SSR renderer automatically handles island hydration:

```html
<!-- Server-rendered HTML -->
<div id="app">
  <h1>Welcome to My App</h1>
  <island src="./Counter.plk" client:load>
    <div>Loading counter...</div>
  </island>
</div>

<!-- Enhancement script -->
<script type="module">
  import { hydrateIslands } from '/islands/runtime.js';
  hydrateIslands();
</script>
```

## Error Handling

### Error Boundaries

```typescript
import { generateErrorBoundary } from '@plank/ssr';

try {
  const result = await renderer.render('/page', context);
  return result;
} catch (error) {
  const errorHtml = generateErrorBoundary(error, {
    fallback: '<div>Something went wrong. Please try again.</div>',
    showStack: process.env.NODE_ENV === 'development'
  });

  return new Response(errorHtml, {
    status: 500,
    headers: { 'Content-Type': 'text/html' }
  });
}
```

## Performance Optimization

### Render Time Tracking

```typescript
const result = await renderer.render('/page', context);

console.log(`Render time: ${result.metadata.renderTime}ms`);
console.log(`Islands rendered: ${result.metadata.islands}`);
console.log(`HTML size: ${result.metadata.size} bytes`);
```

### Streaming Optimization

```typescript
const context: SSRContext = {
  // ... other context
  streaming: {
    enabled: true,
    chunkSize: 2048, // Larger chunks for better performance
    timeout: 10000,  // Longer timeout for complex pages
    placeholder: '<div class="loading">Loading...</div>'
  }
};
```

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the SSR package
pnpm build --filter=@plank/ssr

# Run tests
pnpm test --filter=@plank/ssr

# Run tests with coverage
pnpm test:coverage --filter=@plank/ssr
```

## License

Apache 2.0
