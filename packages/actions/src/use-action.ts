/**
 * @fileoverview Client-side action helper with optimistic updates
 */

import { type Computed, computed, type Signal, signal } from '@plank/runtime-core';
import type { ActionContext, ActionResult, ServerAction } from './types.js';

/**
 * Action state for client
 */
export interface ActionState<T = unknown> {
  /** Whether action is currently executing */
  isPending: Signal<boolean>;
  /** Action result data */
  data: Signal<T | null>;
  /** Action error */
  error: Signal<Error | null>;
  /** Validation errors by field */
  errors: Signal<Record<string, string> | null>;
}

/**
 * Options for useAction hook
 */
export interface UseActionOptions<T = unknown> {
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Enable optimistic updates */
  optimistic?: boolean;
  /** Callback before action executes */
  onBefore?: () => void;
  /** Callback after action completes (success or error) */
  onAfter?: () => void;
}

/**
 * Action methods
 */
export interface ActionMethods<T = unknown> {
  /** Execute the action */
  execute: (formData: FormData, context?: Partial<ActionContext>) => Promise<ActionResult<T>>;
  /** Set optimistic data */
  setOptimistic: (data: T) => void;
  /** Rollback optimistic data */
  rollback: () => void;
  /** Reset action state */
  reset: () => void;
}

/**
 * Combined action hook result
 */
export type UseActionResult<T = unknown> = ActionState<T> & ActionMethods<T>;

/**
 * Client-side action helper
 */
export function useAction<T = unknown>(
  action: ServerAction<T>,
  options: UseActionOptions<T> = {}
): UseActionResult<T> {
  // State signals
  const isPending = signal(false);
  const data = signal<T | null>(null);
  const error = signal<Error | null>(null);
  const errors = signal<Record<string, string> | null>(null);

  // Store for optimistic rollback
  let previousData: T | null = null;

  /**
   * Set optimistic data
   */
  const setOptimistic = (optimisticData: T): void => {
    if (options.optimistic !== false) {
      previousData = data();
      data(optimisticData);
    }
  };

  /**
   * Rollback to previous data
   */
  const rollback = (): void => {
    if (previousData !== null) {
      data(previousData);
      previousData = null;
    }
  };

  /**
   * Reset all state
   */
  const reset = (): void => {
    isPending(false);
    data(null);
    error(null);
    errors(null);
    previousData = null;
  };

  /**
   * Execute the action
   */
  const execute = async (
    formData: FormData,
    context?: Partial<ActionContext>
  ): Promise<ActionResult<T>> => {
    // Reset error state
    error(null);
    errors(null);

    // Call before hook
    options.onBefore?.();

    // Set pending state
    isPending(true);

    try {
      const result = await executeActionRequest(formData, context, action);
      handleActionResult(result);
      return result;
    } catch (err) {
      return handleActionError(err);
    } finally {
      isPending(false);
      options.onAfter?.();
    }
  };

  /**
   * Execute action request
   */
  const executeActionRequest = async (
    formData: FormData,
    context: Partial<ActionContext> | undefined,
    actionDef: ServerAction<T>
  ): Promise<ActionResult<T>> => {
    // Build full context
    const fullContext = buildActionContext(context);

    // Get CSRF token
    const csrfToken = getCSRFToken();
    if (csrfToken && actionDef.csrf !== false) {
      fullContext.headers['x-plank-csrf-token'] = csrfToken;
    }

    // Execute via fetch
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...fullContext.headers,
      },
      body: JSON.stringify({
        actionId: actionDef.id,
        formData: formDataToObject(formData),
        context: fullContext,
      }),
    });

    return (await response.json()) as ActionResult<T>;
  };

  /**
   * Handle successful or failed action result
   */
  const handleActionResult = (result: ActionResult<T>): void => {
    if (result.success) {
      handleSuccess(result);
    } else {
      handleFailure(result);
    }
  };

  /**
   * Handle successful action result
   */
  const handleSuccess = (result: ActionResult<T>): void => {
    // Update data
    if (result.data !== undefined) {
      data(result.data);
      previousData = null;
    }

    // Call success callback
    options.onSuccess?.(result.data as T);

    // Handle redirect
    if (result.redirect) {
      window.location.href = result.redirect;
    }

    // Handle reload
    if (result.reload) {
      window.location.reload();
    }
  };

  /**
   * Handle failed action result
   */
  const handleFailure = (result: ActionResult<T>): void => {
    // Handle general error
    if (result.error) {
      const err = new Error(result.error);
      error(err);
      options.onError?.(err);
      rollback();
    }

    // Handle validation errors
    if (result.errors) {
      errors(result.errors);
      rollback();
    }
  };

  /**
   * Handle action execution error
   */
  const handleActionError = (err: unknown): ActionResult<T> => {
    const actionError = err instanceof Error ? err : new Error('Action execution failed');
    error(actionError);
    options.onError?.(actionError);
    rollback();

    return {
      success: false,
      error: actionError.message,
    };
  };

  return {
    // State
    isPending,
    data,
    error,
    errors,
    // Methods
    execute,
    setOptimistic,
    rollback,
    reset,
  };
}

/**
 * Build action context from partial context
 */
function buildActionContext(context?: Partial<ActionContext>): ActionContext {
  const fullContext: ActionContext = {
    headers: context?.headers || {},
    url: context?.url || window.location.href,
    method: context?.method || 'POST',
  };

  // Add optional properties if present
  if (context?.cookies) {
    fullContext.cookies = context.cookies;
  }
  if (context?.session !== undefined) {
    fullContext.session = context.session;
  }

  return fullContext;
}

/**
 * Get CSRF token from meta tag or cookie
 */
function getCSRFToken(): string | null {
  // Try meta tag first
  const metaTag = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (metaTag?.content) {
    return metaTag.content;
  }

  // Try cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'plank-csrf') {
      return value || null;
    }
  }

  return null;
}

/**
 * Convert FormData to plain object
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Handle multiple values for same key
    if (key in obj) {
      const existing = obj[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        obj[key] = [existing, value];
      }
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

/**
 * Create a derived computed signal for loading state
 */
export function useActionLoading(...actions: UseActionResult[]): Computed<boolean> {
  return computed(() => actions.some((action) => action.isPending()));
}

/**
 * Create a derived computed signal for any errors
 */
export function useActionError(...actions: UseActionResult[]): Computed<Error | null> {
  return computed(() => {
    for (const action of actions) {
      if (action.error()) {
        return action.error();
      }
    }
    return null;
  });
}
