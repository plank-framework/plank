/**
 * @fileoverview Server actions for Plank framework
 * @module @plank/actions
 */

// Server-side exports
export {
  ActionRuntime,
  createActionRuntime,
  getActionRuntime,
  resetActionRuntime,
} from './action-runtime.js';

export {
  CSRFManager,
  createCSRFManager,
} from './csrf.js';
export type { FormEnhancementOptions } from './form-enhancement.js';

export {
  autoEnhanceForms,
  createOptimisticItem,
  enhanceForm,
  removeItemFromList,
  removeOptimisticItems,
  updateItemInList,
} from './form-enhancement.js';

// Type exports
export type {
  ActionContext,
  ActionHandler,
  ActionRegistry,
  ActionResult,
  CSRFConfig,
  CSRFTokenPayload,
  ServerAction,
} from './types.js';

export type {
  ActionMethods,
  ActionState,
  UseActionOptions,
  UseActionResult,
} from './use-action.js';
// Client-side exports
export {
  useAction,
  useActionError,
  useActionLoading,
} from './use-action.js';
