/**
 * @fileoverview Client-side router with link interception and Navigation API
 */

/**
 * Navigation options
 */
export interface NavigationOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** State to associate with navigation */
  state?: Record<string, unknown>;
  /** Skip scroll restoration */
  skipScroll?: boolean;
  /** Custom scroll position */
  scrollPosition?: { x: number; y: number };
}

/**
 * Navigation event
 */
export interface NavigationEvent {
  /** Target URL */
  url: URL;
  /** Navigation type */
  type: 'push' | 'replace' | 'back' | 'forward' | 'reload';
  /** Can be prevented */
  preventDefault(): void;
  /** Check if prevented */
  defaultPrevented: boolean;
}

/**
 * Client router configuration
 */
export interface ClientRouterConfig {
  /** Base URL for the application */
  baseURL?: string;
  /** Selector for links to intercept */
  linkSelector?: string;
  /** Before navigation hook */
  beforeNavigate?: (event: NavigationEvent) => void | Promise<void>;
  /** After navigation hook */
  afterNavigate?: (url: URL) => void | Promise<void>;
  /** Scroll restoration strategy */
  scrollRestoration?: 'auto' | 'manual';
}

/**
 * Client-side router with Navigation API support
 */
export class ClientRouter {
  private config: Required<ClientRouterConfig>;
  private scrollPositions = new Map<string, { x: number; y: number }>();
  private clickListener: ((e: MouseEvent) => void) | null = null;
  private popstateListener: ((e: PopStateEvent) => void) | null = null;

  constructor(config: ClientRouterConfig = {}) {
    this.config = {
      baseURL: config.baseURL ?? window.location.origin,
      linkSelector: config.linkSelector ?? 'a[href]',
      beforeNavigate: config.beforeNavigate ?? (() => {}),
      afterNavigate: config.afterNavigate ?? (() => {}),
      scrollRestoration: config.scrollRestoration ?? 'auto',
    };
  }

  /**
   * Initialize the client router
   */
  start(): void {
    this.interceptLinks();
    this.setupPopstate();

    if (this.config.scrollRestoration === 'manual') {
      if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
      }
    }
  }

  /**
   * Stop the client router
   */
  stop(): void {
    this.removeListeners();
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string | URL, options: NavigationOptions = {}): Promise<void> {
    const targetURL = typeof url === 'string' ? new URL(url, this.config.baseURL) : url;

    // Check if same origin
    if (targetURL.origin !== window.location.origin) {
      window.location.href = targetURL.href;
      return;
    }

    this.saveScrollPosition(options);

    const navEvent = this.createNavigationEvent(targetURL, options);

    // Call before hook
    await this.config.beforeNavigate(navEvent);

    if (navEvent.defaultPrevented) {
      return;
    }

    this.updateHistory(targetURL, options);
    this.handleScrollPosition(targetURL, options);

    // Call after hook
    await this.config.afterNavigate(targetURL);
  }

  /**
   * Save current scroll position
   */
  private saveScrollPosition(options: NavigationOptions): void {
    if (this.config.scrollRestoration === 'manual' && !options.skipScroll) {
      this.scrollPositions.set(window.location.pathname, {
        x: window.scrollX,
        y: window.scrollY,
      });
    }
  }

  /**
   * Create navigation event
   */
  private createNavigationEvent(targetURL: URL, options: NavigationOptions): NavigationEvent {
    return {
      url: targetURL,
      type: options.replace ? 'replace' : 'push',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
  }

  /**
   * Update browser history
   */
  private updateHistory(targetURL: URL, options: NavigationOptions): void {
    if (options.replace) {
      history.replaceState(options.state ?? {}, '', targetURL.href);
    } else {
      history.pushState(options.state ?? {}, '', targetURL.href);
    }

    // Trigger popstate manually for consistency
    window.dispatchEvent(new PopStateEvent('popstate', { state: options.state ?? {} }));
  }

  /**
   * Handle scroll position after navigation
   */
  private handleScrollPosition(targetURL: URL, options: NavigationOptions): void {
    if (options.skipScroll) {
      return;
    }

    if (options.scrollPosition) {
      window.scrollTo(options.scrollPosition.x, options.scrollPosition.y);
    } else if (targetURL.hash) {
      this.scrollToHash(targetURL.hash);
    } else {
      window.scrollTo(0, 0);
    }
  }

  /**
   * Navigate back
   */
  back(): void {
    history.back();
  }

  /**
   * Navigate forward
   */
  forward(): void {
    history.forward();
  }

  /**
   * Reload current page
   */
  reload(): void {
    window.location.reload();
  }

  /**
   * Intercept link clicks
   */
  private interceptLinks(): void {
    this.clickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>(this.config.linkSelector);

      if (!link) return;

      // Check if we should intercept this link
      if (!this.shouldInterceptLink(link, e)) {
        return;
      }

      e.preventDefault();

      const href = link.getAttribute('href');
      if (!href) return;

      this.navigate(href).catch((error) => {
        console.error('Navigation failed:', error);
      });
    };

    document.addEventListener('click', this.clickListener, { capture: true });
  }

  /**
   * Setup popstate listener
   */
  private setupPopstate(): void {
    this.popstateListener = (e: PopStateEvent) => {
      const url = new URL(window.location.href);

      // Restore scroll position
      if (this.config.scrollRestoration === 'manual') {
        const savedPosition = this.scrollPositions.get(url.pathname);
        if (savedPosition) {
          window.scrollTo(savedPosition.x, savedPosition.y);
        }
      }

      // Create navigation event
      const navEvent: NavigationEvent = {
        url,
        type: e.state ? 'back' : 'forward',
        defaultPrevented: false,
        preventDefault() {
          // Cannot prevent browser back/forward
        },
      };

      Promise.resolve(this.config.beforeNavigate(navEvent)).catch((error: Error) => {
        console.error('Before navigate hook failed:', error);
      });

      Promise.resolve(this.config.afterNavigate(url)).catch((error: Error) => {
        console.error('After navigate hook failed:', error);
      });
    };

    window.addEventListener('popstate', this.popstateListener);
  }

  /**
   * Remove event listeners
   */
  private removeListeners(): void {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener, { capture: true });
      this.clickListener = null;
    }

    if (this.popstateListener) {
      window.removeEventListener('popstate', this.popstateListener);
      this.popstateListener = null;
    }
  }

  /**
   * Check if link should be intercepted
   */
  private shouldInterceptLink(link: HTMLAnchorElement, e: MouseEvent): boolean {
    // Don't intercept if:
    // - Modifier key is pressed (Ctrl/Cmd/Shift/Alt)
    // - Not left click
    // - Has download attribute
    // - Has target attribute
    // - Has rel="external"
    // - Different origin

    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return false;
    }

    if (e.button !== 0) {
      return false;
    }

    if (link.hasAttribute('download')) {
      return false;
    }

    if (link.target && link.target !== '_self') {
      return false;
    }

    if (link.rel?.includes('external')) {
      return false;
    }

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false;
    }

    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Scroll to element by hash
   */
  private scrollToHash(hash: string): void {
    const id = hash.slice(1);
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

/**
 * Create a client router instance
 */
export function createClientRouter(config?: ClientRouterConfig): ClientRouter {
  return new ClientRouter(config);
}
