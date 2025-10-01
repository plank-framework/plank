/**
 * @fileoverview Tag-based caching for Plank framework
 * @module @plank/cache
 */

// Client adapter
export {
  ClientCacheAdapter,
  createClientAdapter,
} from './adapters/client.js';
// Edge adapter
export {
  createEdgeAdapter,
  type EdgeAdapterConfig,
  EdgeCacheAdapter,
  type KVNamespace,
} from './adapters/edge.js';

// Server adapter
export {
  createServerAdapter,
  ServerCacheAdapter,
} from './adapters/server.js';
export {
  CacheManager,
  createCacheManager,
} from './cache-manager.js';
export type {
  CacheAdapter,
  CacheEntry,
  CacheOptions,
  CacheStats,
} from './types.js';
