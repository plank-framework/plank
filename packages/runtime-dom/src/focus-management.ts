/**
 * @fileoverview Focus management for accessible navigation
 */

/**
 * Focus management utilities
 */
export class FocusManager {
  private focusedElement: Element | null = null;
  private skipLinks = new Map<string, HTMLAnchorElement>();

  /**
   * Save current focus
   */
  saveFocus(): void {
    this.focusedElement = document.activeElement;
  }

  /**
   * Restore focus
   */
  restoreFocus(): void {
    if (this.focusedElement && this.focusedElement instanceof HTMLElement) {
      this.focusedElement.focus();
    }
  }

  /**
   * Focus main content after navigation
   */
  focusMain(): void {
    // Try to find and focus the main content area
    const main =
      document.querySelector<HTMLElement>('main[tabindex="-1"]') ||
      document.querySelector<HTMLElement>('main') ||
      document.querySelector<HTMLElement>('[role="main"]');

    if (main) {
      if (!main.hasAttribute('tabindex')) {
        main.setAttribute('tabindex', '-1');
      }
      main.focus({ preventScroll: true });
    }
  }

  /**
   * Create skip link for accessibility
   */
  createSkipLink(text = 'Skip to main content', targetSelector = 'main'): HTMLAnchorElement {
    const existing = this.skipLinks.get(targetSelector);
    if (existing) {
      return existing;
    }

    const skipLink = document.createElement('a');
    skipLink.href = `#${targetSelector}`;
    skipLink.textContent = text;
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 0;
      background: #000;
      color: #fff;
      padding: 8px 16px;
      text-decoration: none;
      z-index: 100;
      transition: top 0.2s;
    `;

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '0';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (target) {
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus();
      }
    });

    this.skipLinks.set(targetSelector, skipLink);

    // Insert at beginning of body
    if (document.body.firstChild) {
      document.body.insertBefore(skipLink, document.body.firstChild);
    } else {
      document.body.appendChild(skipLink);
    }

    return skipLink;
  }

  /**
   * Remove skip link
   */
  removeSkipLink(targetSelector = 'main'): void {
    const skipLink = this.skipLinks.get(targetSelector);
    if (skipLink?.parentNode) {
      skipLink.parentNode.removeChild(skipLink);
      this.skipLinks.delete(targetSelector);
    }
  }

  /**
   * Announce page change to screen readers
   */
  announcePageChange(message: string): void {
    let announcer = document.getElementById('plank-announcer');

    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'plank-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(announcer);
    }

    announcer.textContent = message;
  }

  /**
   * Get focusable elements in container
   */
  getFocusableElements(container: Element = document.body): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(selector));
  }

  /**
   * Trap focus within container
   */
  trapFocus(container: Element): () => void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') {
        return;
      }

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown as EventListener);

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }
}

/**
 * Create a focus manager instance
 */
export function createFocusManager(): FocusManager {
  return new FocusManager();
}
