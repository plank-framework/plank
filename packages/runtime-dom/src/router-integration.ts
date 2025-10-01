/**
 * @fileoverview Integration helpers for view transitions with client router
 */

import { FocusManager } from './focus-management.js';
import type { TransitionOptions, ViewTransitionConfig } from './view-transitions.js';
import { ViewTransitions } from './view-transitions.js';

/**
 * Router transition configuration
 */
export interface RouterTransitionConfig extends ViewTransitionConfig {
  /** Auto-focus main content after navigation */
  autoFocusMain?: boolean;
  /** Announce page changes to screen readers */
  announcePageChanges?: boolean;
  /** Skip link text */
  skipLinkText?: string;
}

/**
 * Enhanced router with view transitions
 */
export class RouterWithTransitions {
  private viewTransitions: ViewTransitions;
  private focusManager: FocusManager;
  private config: RouterTransitionConfig;

  constructor(config: RouterTransitionConfig = {}) {
    this.config = {
      autoFocusMain: config.autoFocusMain ?? true,
      announcePageChanges: config.announcePageChanges ?? true,
      skipLinkText: config.skipLinkText ?? 'Skip to main content',
      ...config,
    };

    this.viewTransitions = new ViewTransitions(config);
    this.focusManager = new FocusManager();

    if (this.config.skipLinkText) {
      this.focusManager.createSkipLink(this.config.skipLinkText);
    }
  }

  /**
   * Navigate with view transition
   */
  async navigate(
    updateCallback: () => void | Promise<void>,
    options: TransitionOptions & { pageTitle?: string } = {}
  ): Promise<void> {
    // Save scroll and focus
    this.focusManager.saveFocus();

    // Perform view transition
    await this.viewTransitions.transition(async () => {
      await Promise.resolve(updateCallback());

      // Auto-mark persistent elements
      this.viewTransitions.autoMarkPersistentElements();
    }, options);

    // Focus management
    if (this.config.autoFocusMain) {
      this.focusManager.focusMain();
    }

    // Announce page change
    if (this.config.announcePageChanges && options.pageTitle) {
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
 * Create router with transitions
 */
export function createRouterWithTransitions(
  config?: RouterTransitionConfig
): RouterWithTransitions {
  return new RouterWithTransitions(config);
}
