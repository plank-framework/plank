/**
 * @fileoverview Resumability for Plank framework
 * @module @plank/resume
 *
 * Enables instant interactivity by serializing reactive state on the server
 * and resuming on the client without re-executing constructors.
 */

// Client-side bootstrap
export {
  createBootstrap,
  quickResume,
  ResumabilityBootstrap,
} from './bootstrap.js';

export type {
  ResumabilitySnapshot,
  ResumeConfig,
  ResumeOptions,
  ResumeResult,
  SerializedComponent,
  SerializedComputed,
  SerializedIsland,
  SerializedListener,
  SerializedNode,
  SerializedSignal,
} from './schema.js';
// Schema exports
export { RESUME_SCHEMA_VERSION } from './schema.js';
// Server-side serialization
export {
  createSerializer,
  ResumabilitySerializer,
} from './serializer.js';
