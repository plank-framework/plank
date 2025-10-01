/**
 * @fileoverview Client router with View Transitions integration
 */

import type { TransitionOptions, ViewTransitionConfig } from '@plank/runtime-dom';
import { FocusManager, ViewTransitions } from '@plank/runtime-dom';
import type { ClientRouterConfig, NavigationOptions } from './client-router.js';
import { ClientRouter } from './client-router.js';

/**
 * Enhanced router configuration with view transitions
 */
export interface EnhancedRouterConfig extends ClientRouterConfig {
  /** View transitions configuration */
  viewTransitions?: ViewTransitionConfig;
  /** Auto-focus main content after navigation */
  autoFocusMain?: boolean;
  /** Announce page changes to screen readers */
  announcePageChanges?: boolean;
}

/**
 * Enhanced navigation options with transitions
 */
export interface EnhancedNavigationOptions extends NavigationOptions {
  /** Transition options */
  transition?: TransitionOptions;
  /** Page title for announcements */
  pageTitle?: string;
}

/**
 * Client router with View Transitions and focus management
 */
export class EnhancedClientRouter extends ClientRouter {
  private viewTransitions: ViewTransitions;
  private focusManager: FocusManager;
  private enhancedConfig: EnhancedRouterConfig;

  constructor(config: EnhancedRouterConfig = {}) {
    super(config);

    this.enhancedConfig = {
      autoFocusMain: config.autoFocusMain ?? true,
      announcePageChanges: config.announcePageChanges ?? true,
      ...config,
    };

    this.viewTransitions = new ViewTransitions(config.viewTransitions);
    this.focusManager = new FocusManager();
  }

  /**
   * Navigate with view transition
   */
  async navigate(url: string | URL, options: EnhancedNavigationOptions = {}): Promise<void> {
    // Perform navigation with view transition
    await this.viewTransitions.transition(async () => {
      // Call parent navigate
      await super.navigate(url, options);
    }, options.transition);

    // Focus management
    if (this.enhancedConfig.autoFocusMain) {
      this.focusManager.focusMain();
    }

    // Announce page change
    if (this.enhancedConfig.announcePageChanges && options.pageTitle) {
      this.focusManager.announcePageChange(`Navigated to ${options.pageTitle}`);
    }
  }

  /**
   * Get view transitions instance
   */
  getViewTransitions(): ViewTransitions {
    return this.viewTransitions;
  }

  /**
   * Get focus manager instance
   */
  getFocusManager(): FocusManager {
    return this.focusManager;
  }
}

/**
 * Create enhanced client router with transitions
 */
export function createEnhancedRouter(config?: EnhancedRouterConfig): EnhancedClientRouter {
  return new EnhancedClientRouter(config);
}
