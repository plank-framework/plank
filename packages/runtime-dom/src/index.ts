/**
 * @fileoverview Plank DOM binding runtime
 * Connects signals to DOM elements for reactive updates
 */

export { batch, computed, effect, signal } from '@plank/runtime-core';
export * from './actions.js';
export * from './bindings.js';
export * from './directives.js';
export * from './dom-ir.js';
export * from './focus-management.js';
export * from './islands.js';
export * from './router-integration.js';
export * from './view-transitions.js';
