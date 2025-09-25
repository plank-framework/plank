/**
 * @fileoverview Plank DOM binding runtime
 * Connects signals to DOM elements for reactive updates
 */

export { signal, computed, effect, batch } from '@plank/runtime-core';
export * from './bindings.js';
export * from './directives.js';
export * from './islands.js';
export * from './actions.js';
