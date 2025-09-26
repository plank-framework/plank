/**
 * @fileoverview Server actions system for form handling
 */

import {
  type Computed,
  computed,
  type Effect,
  effect,
  type Signal,
  signal,
} from '@plank/runtime-core';

export interface ActionOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export interface ActionState {
  loading: boolean;
  error: Error | null;
  data: unknown;
  progress: number;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  redirect?: string;
  status?: number;
}

/**
 * Create a server action
 */
export function createAction<T = unknown>(
  url: string,
  options: ActionOptions = {}
): {
  execute: (data?: unknown) => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const { method = 'POST', headers = {}, timeout = 30000, onSuccess, onError } = options;

  const state = signal<ActionState>({
    loading: false,
    error: null,
    data: null,
    progress: 0,
  });

  const loading = computed(() => state().loading);
  const error = computed(() => state().error);
  const data = computed(() => state().data as T | null);

  const buildRequestHeaders = (): Record<string, string> => {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
      requestHeaders['X-CSRF-Token'] = csrfToken;
    }

    return requestHeaders;
  };

  const handleSuccess = (result: ActionResult<T>): void => {
    // Update state
    state({
      loading: false,
      error: null,
      data: result.data,
      progress: 100,
    });

    // Call success callback
    if (onSuccess && result.success) {
      onSuccess(result.data);
    }

    // Handle redirect
    if (result.redirect) {
      window.location.href = result.redirect;
    }
  };

  const handleError = (err: unknown): ActionResult<T> => {
    const error = err instanceof Error ? err : new Error(String(err));

    // Update state
    state({
      loading: false,
      error,
      data: state().data,
      progress: 0,
    });

    // Call error callback
    if (onError) {
      onError(error);
    }

    return {
      success: false,
      error: error.message,
    };
  };

  const execute = async (formData?: unknown): Promise<ActionResult<T>> => {
    // Set loading state
    state({
      loading: true,
      error: null,
      data: state().data,
      progress: 0,
    });

    try {
      const requestHeaders = buildRequestHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: formData ? JSON.stringify(formData) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ActionResult<T> = await response.json();
      handleSuccess(result);
      return result;
    } catch (err) {
      return handleError(err);
    }
  };

  return {
    execute,
    state,
    loading,
    error,
    data,
  };
}

/**
 * Create a form action that handles form submission
 */
export function createFormAction<T = unknown>(
  url: string,
  options: ActionOptions = {}
): {
  handleSubmit: (event: Event) => Promise<void>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const action = createAction<T>(url, options);

  const handleSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    // Convert FormData to object
    const data: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    await action.execute(data);
  };

  return {
    handleSubmit,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}

/**
 * Create an optimistic action that updates UI immediately
 */
export function createOptimisticAction<T = unknown>(
  url: string,
  options: ActionOptions & {
    optimisticUpdate: (data: unknown) => void;
    rollbackUpdate: () => void;
  } = {} as ActionOptions & {
    optimisticUpdate: (data: unknown) => void;
    rollbackUpdate: () => void;
  }
): {
  execute: (data?: unknown) => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const { optimisticUpdate, rollbackUpdate, ...actionOptions } = options;

  const action = createAction<T>(url, actionOptions);

  const execute = async (data?: unknown): Promise<ActionResult<T>> => {
    // Apply optimistic update
    if (optimisticUpdate) {
      optimisticUpdate(data);
    }

    try {
      const result = await action.execute(data);

      if (!result.success && rollbackUpdate) {
        // Rollback on failure
        rollbackUpdate();
      }

      return result;
    } catch (error) {
      // Rollback on error
      if (rollbackUpdate) {
        rollbackUpdate();
      }
      throw error;
    }
  };

  return {
    execute,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}

/**
 * Create a mutation action for data updates
 */
export function createMutationAction<T = unknown>(
  url: string,
  options: ActionOptions = {}
): {
  mutate: (data: unknown) => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const action = createAction<T>(url, options);

  return {
    mutate: action.execute,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}

/**
 * Create a query action for data fetching
 */
export function createQueryAction<T = unknown>(
  url: string,
  options: ActionOptions = {}
): {
  refetch: () => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const action = createAction<T>(url, { ...options, method: 'GET' });

  return {
    refetch: action.execute,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}

/**
 * Bind an action to a form element
 */
export function bindActionToForm(
  form: HTMLFormElement,
  action: {
    handleSubmit: (event: Event) => Promise<void>;
    loading: Computed<boolean>;
    error: Computed<Error | null>;
  }
): Effect {
  // Bind submit handler
  form.addEventListener('submit', action.handleSubmit);

  // Bind loading state to submit button
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitButton) {
    return effect(() => {
      const isLoading = action.loading();
      submitButton.disabled = isLoading;
      submitButton.textContent = isLoading ? 'Loading...' : 'Submit';
    });
  }

  return {
    stop: () => {
      form.removeEventListener('submit', action.handleSubmit);
    },
    isActive: true,
  } as Effect;
}

/**
 * Bind an action to a button element
 */
export function bindActionToButton(
  button: HTMLButtonElement,
  action: {
    execute: (data?: unknown) => Promise<unknown>;
    loading: Computed<boolean>;
    error: Computed<Error | null>;
  },
  data?: unknown
): Effect {
  const handleClick = async () => {
    await action.execute(data);
  };

  button.addEventListener('click', handleClick);

  return effect(() => {
    const isLoading = action.loading();
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Loading...' : button.textContent;
  });
}

/**
 * Create a debounced action that delays execution
 */
export function createDebouncedAction<T = unknown>(
  url: string,
  delay: number = 300,
  options: ActionOptions = {}
): {
  execute: (data?: unknown) => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const action = createAction<T>(url, options);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const execute = async (data?: unknown): Promise<ActionResult<T>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await action.execute(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };

  return {
    execute,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}

/**
 * Create a throttled action that limits execution frequency
 */
export function createThrottledAction<T = unknown>(
  url: string,
  limit: number = 1000,
  options: ActionOptions = {}
): {
  execute: (data?: unknown) => Promise<ActionResult<T>>;
  state: Signal<ActionState>;
  loading: Computed<boolean>;
  error: Computed<Error | null>;
  data: Computed<T | null>;
} {
  const action = createAction<T>(url, options);
  let lastExecution = 0;

  const execute = async (data?: unknown): Promise<ActionResult<T>> => {
    const now = Date.now();

    if (now - lastExecution < limit) {
      // Throttled - return last result
      return {
        success: true,
        data: action.data() as T,
      };
    }

    lastExecution = now;
    return action.execute(data);
  };

  return {
    execute,
    state: action.state,
    loading: action.loading,
    error: action.error,
    data: action.data,
  };
}
