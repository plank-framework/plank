/**
 * @fileoverview View Transitions API wrapper for smooth page transitions
 */

/**
 * View transition configuration
 */
export interface ViewTransitionConfig {
  /** Enable view transitions (default: true if browser supports) */
  enabled?: boolean;
  /** Duration in milliseconds (default: 300) */
  duration?: number;
  /** Easing function (default: 'ease-in-out') */
  easing?: string;
  /** Elements to persist across transitions */
  persistElements?: string[];
  /** Before transition callback */
  onBeforeTransition?: () => void | Promise<void>;
  /** After transition callback */
  onAfterTransition?: () => void | Promise<void>;
}

/**
 * View transition options for single transition
 */
export interface TransitionOptions {
  /** Skip transition for this navigation */
  skipTransition?: boolean;
  /** Custom transition name */
  transitionName?: string;
  /** Custom duration for this transition */
  duration?: number;
}

/**
 * View Transitions manager
 */
export class ViewTransitions {
  private config: {
    enabled: boolean;
    duration: number;
    easing: string;
    persistElements?: string[] | undefined;
    onBeforeTransition?: (() => void | Promise<void>) | undefined;
    onAfterTransition?: (() => void | Promise<void>) | undefined;
  };
  private isSupported: boolean;

  constructor(config: ViewTransitionConfig = {}) {
    this.isSupported = this.checkSupport();
    this.config = {
      enabled: config.enabled ?? this.isSupported,
      duration: config.duration ?? 300,
      easing: config.easing ?? 'ease-in-out',
    };

    if (config.persistElements !== undefined) {
      this.config.persistElements = config.persistElements;
    }
    if (config.onBeforeTransition !== undefined) {
      this.config.onBeforeTransition = config.onBeforeTransition;
    }
    if (config.onAfterTransition !== undefined) {
      this.config.onAfterTransition = config.onAfterTransition;
    }

    if (this.config.enabled && this.isSupported) {
      this.injectStyles();
    }
  }

  /**
   * Check if View Transitions API is supported
   */
  private checkSupport(): boolean {
    return (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as { startViewTransition?: unknown }).startViewTransition === 'function'
    );
  }

  /**
   * Perform a view transition
   */
  async transition(
    updateCallback: () => void | Promise<void>,
    options: TransitionOptions = {}
  ): Promise<void> {
    // Skip if disabled or not supported
    if (!this.config.enabled || !this.isSupported || options.skipTransition) {
      await Promise.resolve(updateCallback());
      return;
    }

    // Call before hook
    if (this.config.onBeforeTransition) {
      await this.config.onBeforeTransition();
    }

    // Set custom transition name if provided
    if (options.transitionName) {
      document.documentElement.setAttribute('data-transition', options.transitionName);
    }

    // Start view transition
    const transition = (
      document as unknown as {
        startViewTransition: (cb: () => Promise<void>) => PlankViewTransition;
      }
    ).startViewTransition(async () => {
      await Promise.resolve(updateCallback());
    });

    // Wait for transition to complete
    await transition.finished.catch(() => {
      // Ignore transition errors (browser may skip if user navigates away)
    });

    // Clean up
    if (options.transitionName) {
      document.documentElement.removeAttribute('data-transition');
    }

    // Call after hook
    if (this.config.onAfterTransition) {
      await this.config.onAfterTransition();
    }
  }

  /**
   * Mark an element to persist across transitions
   */
  markPersistent(element: Element, name: string): void {
    element.setAttribute('data-view-transition-name', name);
  }

  /**
   * Remove persistence marker from element
   */
  unmarkPersistent(element: Element): void {
    element.removeAttribute('data-view-transition-name');
  }

  /**
   * Auto-mark persistent elements based on config
   */
  autoMarkPersistentElements(): void {
    if (!this.config.persistElements) {
      return;
    }

    for (const selector of this.config.persistElements) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const name = this.generatePersistentName(element);
        this.markPersistent(element, name);
      }
    }
  }

  /**
   * Generate unique name for persistent element
   */
  private generatePersistentName(element: Element): string {
    // Use ID if available
    if (element.id) {
      return element.id;
    }

    // Use data attribute if available
    const dataName = element.getAttribute('data-name');
    if (dataName) {
      return dataName;
    }

    // Generate from class names
    if (element.className) {
      const className = element.className.split(' ')[0];
      return className || 'element';
    }

    // Fallback to tag name
    return element.tagName.toLowerCase();
  }

  /**
   * Inject default transition styles
   */
  private injectStyles(): void {
    if (document.getElementById('plank-view-transitions')) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = 'plank-view-transitions';
    style.textContent = `
/* View Transitions base styles */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: ${this.config.duration}ms;
  animation-timing-function: ${this.config.easing};
}

/* Fade transition (default) */
::view-transition-old(root) {
  animation-name: fade-out;
}

::view-transition-new(root) {
  animation-name: fade-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide transition */
[data-transition="slide"] ::view-transition-old(root) {
  animation-name: slide-out-left;
}

[data-transition="slide"] ::view-transition-new(root) {
  animation-name: slide-in-right;
}

@keyframes slide-out-left {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* Slide back transition */
[data-transition="slide-back"] ::view-transition-old(root) {
  animation-name: slide-out-right;
}

[data-transition="slide-back"] ::view-transition-new(root) {
  animation-name: slide-in-left;
}

@keyframes slide-out-right {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@keyframes slide-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Scale transition */
[data-transition="scale"] ::view-transition-old(root) {
  animation-name: scale-out;
}

[data-transition="scale"] ::view-transition-new(root) {
  animation-name: scale-in;
}

@keyframes scale-out {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.95); opacity: 0; }
}

@keyframes scale-in {
  from { transform: scale(1.05); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
    `.trim();

    document.head.appendChild(style);
  }

  /**
   * Check if view transitions are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isSupported;
  }
}

/**
 * View Transition interface (simplified to avoid conflicts with browser types)
 */
interface PlankViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

/**
 * Create a view transitions instance
 */
export function createViewTransitions(config?: ViewTransitionConfig): ViewTransitions {
  return new ViewTransitions(config);
}

/**
 * Perform a single view transition
 */
export async function withViewTransition(
  updateCallback: () => void | Promise<void>,
  options: TransitionOptions = {}
): Promise<void> {
  const vt = createViewTransitions({ enabled: !options.skipTransition });
  await vt.transition(updateCallback, options);
}
