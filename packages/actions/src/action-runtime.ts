/**
 * @fileoverview Server actions runtime
 */

import { type CSRFManager, createCSRFManager } from './csrf.js';
import type {
  ActionContext,
  ActionHandler,
  ActionRegistry,
  ActionResult,
  CSRFConfig,
  ServerAction,
} from './types.js';

/**
 * Action registry implementation
 */
class ActionRegistryImpl implements ActionRegistry {
  private actions = new Map<string, ServerAction>();

  get(id: string): ServerAction | undefined {
    return this.actions.get(id);
  }

  register(action: ServerAction): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with ID "${action.id}" is already registered`);
    }
    this.actions.set(action.id, action);
  }

  unregister(id: string): void {
    this.actions.delete(id);
  }

  has(id: string): boolean {
    return this.actions.has(id);
  }

  clear(): void {
    this.actions.clear();
  }
}

/**
 * Server actions runtime
 */
export class ActionRuntime {
  private registry: ActionRegistry;
  private csrfManager: CSRFManager;

  constructor(csrfConfig?: Partial<CSRFConfig>) {
    this.registry = new ActionRegistryImpl();
    this.csrfManager = createCSRFManager(csrfConfig);
  }

  /**
   * Define a new server action
   */
  defineAction<T = unknown>(
    handler: ActionHandler<T>,
    options: { name?: string; csrf?: boolean } = {}
  ): ServerAction<T> {
    const action: ServerAction<T> = {
      id: this.generateActionId(),
      handler,
      csrf: options.csrf ?? true,
      name: options.name,
    };

    this.registry.register(action);
    return action;
  }

  /**
   * Execute an action
   */
  async executeAction(
    actionId: string,
    formData: FormData,
    context: ActionContext
  ): Promise<ActionResult> {
    try {
      // Get action from registry
      const action = this.registry.get(actionId);

      if (!action) {
        return {
          success: false,
          error: `Action with ID "${actionId}" not found`,
        };
      }

      // Verify CSRF token if enabled
      if (action.csrf !== false) {
        const token = this.csrfManager.extractToken(context.headers, context.cookies);

        if (!token) {
          return {
            success: false,
            error: 'CSRF token missing',
          };
        }

        if (!this.csrfManager.verifyToken(token)) {
          return {
            success: false,
            error: 'Invalid or expired CSRF token',
          };
        }
      }

      // Execute action handler
      const result = await action.handler(formData, context);

      return result;
    } catch (error) {
      console.error('Action execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return this.csrfManager.generateToken();
  }

  /**
   * Get CSRF cookie name
   */
  getCSRFCookieName(): string {
    return this.csrfManager.getCookieName();
  }

  /**
   * Get CSRF header name
   */
  getCSRFHeaderName(): string {
    return this.csrfManager.getHeaderName();
  }

  /**
   * Get action by ID
   */
  getAction(id: string): ServerAction | undefined {
    return this.registry.get(id);
  }

  /**
   * Check if action exists
   */
  hasAction(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * Create a new action runtime instance
 */
export function createActionRuntime(csrfConfig?: Partial<CSRFConfig>): ActionRuntime {
  return new ActionRuntime(csrfConfig);
}

/**
 * Global action runtime instance
 */
let globalRuntime: ActionRuntime | null = null;

/**
 * Get or create global action runtime
 */
export function getActionRuntime(csrfConfig?: Partial<CSRFConfig>): ActionRuntime {
  if (!globalRuntime) {
    globalRuntime = createActionRuntime(csrfConfig);
  }
  return globalRuntime;
}

/**
 * Reset global runtime (for testing)
 */
export function resetActionRuntime(): void {
  globalRuntime = null;
}
