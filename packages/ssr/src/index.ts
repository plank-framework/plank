/**
 * @fileoverview Plank server-side rendering
 * Streaming HTML output with progressive enhancement
 */

// Re-export compiler types for convenience
export type { ParseResult, TemplateNode } from '@plank/compiler';

// Core renderer
export { SSRRenderer, StreamingWriter } from './renderer.js';

// Streaming utilities
export {
  generateDocument,
  generateEnhancementScript,
  generatePreconnectHints,
  generateSkeleton,
  generateViewportMeta,
  StreamingResponse,
} from './streaming.js';
// Core types
export type {
  IslandComponent,
  ServerAction,
  SSRConfig,
  SSRContext,
  SSRResult,
  StreamingOptions,
  TemplateRenderer,
} from './types.js';
