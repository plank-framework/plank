/**
 * @fileoverview Type definitions for server actions
 */

/**
 * Context provided to server actions
 */
export interface ActionContext {
  /** Request headers */
  headers: Record<string, string>;
  /** Request cookies */
  cookies?: Record<string, string>;
  /** Session data */
  session?: unknown;
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
}

/**
 * Result of an action execution
 */
export interface ActionResult<T = unknown> {
  /** Whether the action succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Validation errors by field name */
  errors?: Record<string, string>;
  /** Whether to redirect after action */
  redirect?: string;
  /** Whether to reload the page */
  reload?: boolean;
}

/**
 * Server action handler function
 */
export type ActionHandler<T = unknown> = (
  formData: FormData,
  context: ActionContext
) => Promise<ActionResult<T>>;

/**
 * Server action definition
 */
export interface ServerAction<T = unknown> {
  /** Unique action ID */
  id: string;
  /** Action handler function */
  handler: ActionHandler<T>;
  /** CSRF protection enabled (default: true) */
  csrf?: boolean | undefined;
  /** Action name for debugging */
  name?: string | undefined;
}

/**
 * Action registry for storing registered actions
 */
export interface ActionRegistry {
  /** Get action by ID */
  get(id: string): ServerAction | undefined;
  /** Register an action */
  register(action: ServerAction): void;
  /** Unregister an action */
  unregister(id: string): void;
  /** Check if action exists */
  has(id: string): boolean;
}

/**
 * CSRF token configuration
 */
export interface CSRFConfig {
  /** Secret key for signing tokens */
  secret: string;
  /** Token expiration time in seconds (default: 3600) */
  expiresIn?: number;
  /** Cookie name for CSRF token (default: 'plank-csrf') */
  cookieName?: string;
  /** Header name for CSRF token (default: 'x-plank-csrf-token') */
  headerName?: string;
}

/**
 * CSRF token payload
 */
export interface CSRFTokenPayload {
  /** Token value */
  token: string;
  /** Expiration timestamp */
  expiresAt: number;
}
