/**
 * @fileoverview Plank Core - Essential functionality for app development
 *
 * This package provides the core APIs needed for building Plank applications:
 * - Reactive primitives (signals, computed, effects)
 * - DOM bindings for templates
 * - Configuration utilities
 */

// Configuration
export { defineConfig, type PlankConfig } from './config.js';

// Reactive primitives - essential for app development
export { signal, computed, effect, type Signal, type Computed } from './runtime-core/index.js';

// DOM bindings - essential for template directives
export {
  bindText,
  bindEvent,
  bindInputValue,
  bindCheckbox,
  bindClass,
  hydrateIslands,
  type BindingOptions,
} from './runtime-dom/index.js';
