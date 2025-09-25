/**
 * @fileoverview Plank server-side rendering
 * Streaming HTML output with progressive enhancement
 */

// Core types
export type {
  SSRContext,
  SSRResult,
  TemplateRenderer,
  IslandComponent,
  ServerAction,
  SSRConfig,
  StreamingOptions
} from './types.js';

// Core renderer
export { SSRRenderer, StreamingWriter } from './renderer.js';

// Streaming utilities
export {
  StreamingResponse,
  ProgressiveEnhancement,
  StreamingTemplates
} from './streaming.js';

// Re-export compiler types for convenience
export type { TemplateNode, ParseResult } from '@plank/compiler';
