# @plank/cache

Tag-based cache invalidation for the Plank framework. Provides adapters for server, edge, and client-side caching with automatic invalidation by tags.

## Features

- ✅ **Tag-Based Invalidation**: Invalidate multiple cache entries by tag
- ✅ **Multiple Adapters**: Server (in-memory), Edge (KV), Client (IndexedDB)
- ✅ **TTL Support**: Automatic expiration
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Statistics**: Hit/miss tracking
- ✅ **Graceful Fallbacks**: Works even when storage unavailable

## Installation

```bash
pnpm add @plank/cache
```

## Usage

### Basic Caching

```typescript
import { createCacheManager, createServerAdapter } from '@plank/cache';

const adapter = createServerAdapter();
const cache = createCacheManager(adapter);

// Cache with tags
const result = await cache.cache('user:123', ['users', 'user:123'], async () => {
  return await db.users.findById('123');
});

// Invalidate by tag
await cache.invalidate('users'); // Clears all user caches
await cache.invalidate('user:123'); // Clears specific user
```

### With Server Actions

```typescript
import { createCacheManager, createServerAdapter } from '@plank/cache';

const cache = createCacheManager(createServerAdapter());

// Server action with cache invalidation
const createTodo = runtime.defineAction(async (formData) => {
  const todo = await db.todos.create({
    title: formData.get('title'),
  });

  // Invalidate todos cache
  await cache.invalidate('todos');

  return { success: true, data: todo };
});
```

### Server Adapter (Node.js/Bun)

```typescript
import { createServerAdapter } from '@plank/cache/server';

const adapter = createServerAdapter();

// Set with TTL
await adapter.set('session:abc', sessionData, {
  ttl: 3600, // 1 hour
  tags: ['sessions', 'user:123'],
});

// Get
const session = await adapter.get('session:abc');

// Invalidate all user sessions
await adapter.invalidateTag('user:123');
```

### Edge Adapter (Cloudflare Workers)

```typescript
import { createEdgeAdapter } from '@plank/cache/edge';

// In Cloudflare Worker
export default {
  async fetch(request, env) {
    const adapter = createEdgeAdapter({ kv: env.CACHE_KV });

    const result = await adapter.cache('key', ['tag'], async () => {
      return await fetchData();
    });

    return new Response(JSON.stringify(result));
  }
};
```

### Client Adapter (Browser)

```typescript
import { createClientAdapter } from '@plank/cache/client';

const adapter = createClientAdapter();

// Cache API responses
async function fetchUser(id: string) {
  const cached = await adapter.get(`user:${id}`);

  if (cached) {
    return cached;
  }

  const user = await fetch(`/api/users/${id}`).then((r) => r.json());

  await adapter.set(`user:${id}`, user, {
    ttl: 300, // 5 minutes
    tags: ['users', `user:${id}`],
  });

  return user;
}

// Invalidate when user updates
await adapter.invalidateTag('user:123');
```

## API

### `createCacheManager(adapter)`

Creates a cache manager with tag-based invalidation.

```typescript
const cache = createCacheManager(adapter);
```

### `cache.cache(key, tags, fn, ttl?)`

Get cached value or compute and cache it.

**Parameters**:
- `key`: Cache key
- `tags`: Array of tags for invalidation
- `fn`: Function to compute value if not cached
- `ttl`: Time to live in seconds (optional)

### `cache.invalidate(tag)`

Invalidate all cache entries with a specific tag.

### `cache.invalidateTags(tags[])`

Invalidate multiple tags at once.

### `cache.get/set/delete/has/clear`

Standard cache operations.

### `cache.getStats()`

Get cache statistics (hits, misses, hit rate).

## Adapters

### Server Adapter (In-Memory)

**Best for**: Node.js, Bun, Deno servers

```typescript
import { createServerAdapter } from '@plank/cache/server';

const adapter = createServerAdapter();
```

**Features**:
- In-memory Map storage
- Tag indexing
- TTL expiration
- Fast performance

### Edge Adapter (KV Storage)

**Best for**: Cloudflare Workers, Vercel Edge Functions

```typescript
import { createEdgeAdapter } from '@plank/cache/edge';

const adapter = createEdgeAdapter({
  kv: env.CACHE_KV,
  prefix: 'myapp:',
});
```

**Features**:
- Cloudflare KV storage
- Global distribution
- Automatic fallback to in-memory
- TTL support

### Client Adapter (IndexedDB)

**Best for**: Browser caching

```typescript
import { createClientAdapter } from '@plank/cache/client';

const adapter = createClientAdapter();
```

**Features**:
- IndexedDB for structured storage
- localStorage fallback
- TTL expiration
- Tag queries

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage

# Current: 75%+ coverage, 57/58 tests passing
```

## Performance

### Cache Hit Performance
- Server (Map): < 1ms
- Edge (KV): ~5-10ms (global)
- Client (IndexedDB): ~2-5ms

### Tag Invalidation
- Server: O(n) where n = entries with tag
- Edge: O(n) with KV operations
- Client: O(n) with index lookup

## Best Practices

### Tag Naming
```typescript
// Entity-based
'users'              // All users
'user:123'           // Specific user
'posts'              // All posts
'post:456'           // Specific post

// Feature-based
'dashboard'          // Dashboard data
'analytics'          // Analytics data

// Time-based
'daily:2024-10-01'   // Daily cache
```

### TTL Guidelines
```typescript
// Short-lived (real-time data)
ttl: 60              // 1 minute

// Medium-lived (user data)
ttl: 300             // 5 minutes

// Long-lived (static content)
ttl: 3600            // 1 hour

// Very long (rarely changes)
ttl: 86400           // 24 hours
```

### Invalidation Strategy
```typescript
// On mutation, invalidate related tags
await cache.invalidateTags([
  'users',           // All users list
  `user:${userId}`,  // Specific user
  'dashboard',       // Dashboard that shows users
]);
```

## License

Apache-2.0
