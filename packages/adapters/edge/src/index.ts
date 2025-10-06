/**
 * @fileoverview Edge adapter public API
 */

export { createEdgeAdapter } from './adapter.js';
export type { AssetOptimization, CacheStrategy } from './static-assets.js';

// Static assets management
export { StaticAssetsManager } from './static-assets.js';
export type { EdgeAdapter, EdgeAdapterConfig, Env, StaticAsset } from './types.js';
