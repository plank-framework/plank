# @plank/router

File-based routing system with both server-side and client-side navigation for Plank framework.

## Features

- ✅ **File-Based Routing**: Automatic route generation from `/app/routes`
- ✅ **Dynamic Routes**: `[id]`, `[...slug]`, `[[optional]]` parameters
- ✅ **Nested Layouts**: Hierarchical layout system
- ✅ **Client-Side Navigation**: SPA-like navigation without full page reloads
- ✅ **Type-Safe**: Auto-generated TypeScript route types
- ✅ **SEO Friendly**: Sitemap and robots.txt generation
- ✅ **Hot Reload**: File watching in development

## Installation

```bash
pnpm add @plank/router
```

## Server-Side Routing

### Basic Setup

```typescript
import { createRouter } from '@plank/router';

const router = createRouter({
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  extensions: ['.plk'],
  generateManifest: true,
  watch: process.env.NODE_ENV === 'development',
});

await router.initialize();

// Match a route
const match = router.match('/users/123');
if (match) {
  console.log(match.route.path);     // '/users/[id]'
  console.log(match.params.id);       // '123'
}
```

### File Structure

```
app/
├── routes/
│   ├── index.plk              → /
│   ├── about.plk              → /about
│   ├── users/
│   │   ├── [id].plk           → /users/:id
│   │   └── [id]/
│   │       └── posts.plk       → /users/:id/posts
│   ├── posts/
│   │   └── [...slug].plk      → /posts/* (catch-all)
│   └── api/
│       └── [[version]]/
│           └── users.plk       → /api/users or /api/:version/users
└── layouts/
    ├── layout.plk             → Root layout
    └── admin/
        └── layout.plk         → Admin layout
```

### Dynamic Routes

```typescript
// [id].plk - Single parameter
router.match('/users/123');
// → { params: { id: '123' } }

// [...slug].plk - Catch-all
router.match('/posts/2024/10/my-post');
// → { params: { slug: '2024/10/my-post' } }

// [[id]].plk - Optional parameter
router.match('/api/users');        // → { params: {} }
router.match('/api/v2/users');     // → { params: { version: 'v2' } }
```

### Query Parameters

```typescript
const match = router.match('/search?q=plank&page=2');
// → { query: { q: 'plank', page: '2' } }
```

### Route Methods

```typescript
// Get all routes
const routes = router.getRoutes();

// Get dynamic routes only
const dynamicRoutes = router.getDynamicRoutes();

// Get static routes only
const staticRoutes = router.getStaticRoutes();

// Check if route exists
const exists = router.hasRoute('/users');

// Get route statistics
const stats = router.getRouteStats();
// → { total: 10, static: 6, dynamic: 3, catchAll: 1 }
```

### Layouts

```typescript
// Get layout hierarchy for a route
const hierarchy = router.getLayoutHierarchy('/admin/users');
// → [rootLayout, adminLayout]

// Get all routes using a layout
const adminRoutes = router.getRoutesByLayout('./app/layouts/admin/layout.plk');
```

## Client-Side Navigation

### Basic Setup

```typescript
import { createClientRouter } from '@plank/router';

const clientRouter = createClientRouter();
clientRouter.start();
```

### Link Interception

The client router automatically intercepts same-origin link clicks:

```html
<!-- These links will be intercepted -->
<a href="/about">About</a>
<a href="/users/123">User Profile</a>

<!-- These will NOT be intercepted -->
<a href="https://external.com">External</a>
<a href="/file.pdf" download>Download</a>
<a href="/page" target="_blank">New Tab</a>
<a href="/page" rel="external">External</a>
```

### Programmatic Navigation

```typescript
// Navigate to URL
await clientRouter.navigate('/about');

// Replace history
await clientRouter.navigate('/dashboard', { replace: true });

// Custom scroll position
await clientRouter.navigate('/contact', {
  scrollPosition: { x: 0, y: 500 }
});

// History navigation
clientRouter.back();
clientRouter.forward();
clientRouter.reload();
```

### Lifecycle Hooks

```typescript
const clientRouter = createClientRouter({
  beforeNavigate: async (event) => {
    // Check if user has unsaved changes
    if (hasUnsavedChanges()) {
      if (!confirm('Leave without saving?')) {
        event.preventDefault();
        return;
      }
    }

    // Show loading indicator
    showLoadingBar();
  },

  afterNavigate: async (url) => {
    // Fetch new page content
    const response = await fetch(url.href);
    const html = await response.text();

    // Update page content
    document.querySelector('main').innerHTML = html;

    // Hide loading indicator
    hideLoadingBar();
  },
});

clientRouter.start();
```

## Manifest Generation

```typescript
const router = createRouter({
  routesDir: './app/routes',
  generateManifest: true,
  manifestPath: './dist/routes.json',
});

await router.initialize();

// Generates:
// - routes.json (route manifest)
// - sitemap.xml
// - robots.txt
// - route-types.ts (TypeScript types)
```

### Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <priority>0.8</priority>
    <changefreq>daily</changefreq>
  </url>
  <!-- Dynamic routes excluded -->
</urlset>
```

### Route Types

```typescript
// Auto-generated from routes
export type RoutePath =
  | '/'
  | '/about'
  | '/contact';

export type RouteParams = {
  '/users/[id]': { id: string };
  '/posts/[...slug]': { slug: string };
};
```

## API Reference

### Server Router

#### `createRouter(config: RouterConfig): FileBasedRouter`

Creates a file-based router instance.

#### `FileBasedRouter.initialize(): Promise<void>`

Discovers routes and initializes the router.

#### `FileBasedRouter.match(path: string, method?: string): RouteMatch | null`

Matches a URL path to a route.

#### `FileBasedRouter.getRoutes(): RouteConfig[]`

Returns all discovered routes.

#### `FileBasedRouter.getLayouts(): LayoutConfig[]`

Returns all discovered layouts.

### Client Router

#### `createClientRouter(config?: ClientRouterConfig): ClientRouter`

Creates a client-side router instance.

#### `ClientRouter.start(): void`

Starts link interception and history management.

#### `ClientRouter.navigate(url: string | URL, options?: NavigationOptions): Promise<void>`

Navigates to a URL programmatically.

#### `ClientRouter.stop(): void`

Stops link interception and cleans up listeners.

## Configuration

```typescript
interface RouterConfig {
  /** Routes directory (default: './app/routes') */
  routesDir: string;

  /** Layouts directory (default: './app/layouts') */
  layoutsDir: string;

  /** File extensions (default: ['.plk', '.ts', '.js']) */
  extensions: string[];

  /** Default layout name */
  defaultLayout?: string;

  /** Generate manifest (default: true) */
  generateManifest: boolean;

  /** Manifest path (default: auto) */
  manifestPath?: string;

  /** Watch for file changes (default: false) */
  watch: boolean;
}
```

## Examples

### Full SSR Integration

```typescript
import { createRouter } from '@plank/router';
import { SSRRenderer } from '@plank/ssr';
import { createNodeAdapter } from '@plank/adapter-node';

const router = createRouter({
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
});

const renderer = new SSRRenderer();

await router.initialize();

const server = createNodeAdapter({
  port: 3000,
  onRequest: async (request) => {
    const match = router.match(new URL(request.url).pathname);

    if (!match) {
      return new Response('Not Found', { status: 404 });
    }

    const html = await renderer.render(match.route.pagePath, {
      params: match.params,
      query: match.query,
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});

await server.listen();
```

### Client-Side SPA

```typescript
import { createClientRouter } from '@plank/router';
import { SSRRenderer } from '@plank/ssr';

const renderer = new SSRRenderer();
const clientRouter = createClientRouter({
  afterNavigate: async (url) => {
    // Fetch new page
    const response = await fetch(url.href);
    const html = await response.text();

    // Parse and extract main content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main');
    const currentMain = document.querySelector('main');

    if (newMain && currentMain) {
      currentMain.innerHTML = newMain.innerHTML;

      // Re-hydrate islands
      await renderer.hydrateIslands();
    }
  },
});

clientRouter.start();
```

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage

# Current: 90 tests passing, 7 test files
```

## Performance

- **Server router**: O(n) route matching with early exit
- **Client router**: ~2KB gzipped
- **File watching**: Incremental updates only
- **Manifest**: Cached in memory

## License

Apache-2.0
