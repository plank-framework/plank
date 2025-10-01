/**
 * @fileoverview Tests for client-side router
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ClientRouter, createClientRouter } from '../client-router.js';

describe('ClientRouter', () => {
  let router: ClientRouter | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    // Setup DOM
    container = document.createElement('div');
    document.body.appendChild(container);

    // Reset history
    history.replaceState({}, '', '/');

    router = createClientRouter();
  });

  afterEach(() => {
    if (router) {
      router.stop();
      router = null;
    }
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('link interception', () => {
    it('should intercept same-origin link clicks', async () => {
      const link = document.createElement('a');
      link.href = '/about';
      link.textContent = 'About';
      container.appendChild(link);

      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      link.click();

      // Wait for navigation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(beforeNavigate).toHaveBeenCalled();
      expect(window.location.pathname).toBe('/about');
    });

    it('should not intercept external links', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.textContent = 'External';
      container.appendChild(link);

      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      // Mock to prevent actual navigation
      const preventDefault = vi.fn();
      link.addEventListener('click', (_e) => preventDefault());

      link.click();

      expect(beforeNavigate).not.toHaveBeenCalled();
    });

    it('should not intercept links with target attribute', () => {
      const link = document.createElement('a');
      link.href = '/page';
      link.target = '_blank';
      container.appendChild(link);

      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      const preventDefault = vi.fn();
      link.addEventListener('click', (_e) => preventDefault());

      link.click();

      expect(beforeNavigate).not.toHaveBeenCalled();
    });

    it('should not intercept links with modifier keys', () => {
      const link = document.createElement('a');
      link.href = '/page';
      container.appendChild(link);

      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      // Simulate Ctrl+Click
      const event = new MouseEvent('click', { ctrlKey: true, bubbles: true });
      link.dispatchEvent(event);

      expect(beforeNavigate).not.toHaveBeenCalled();
    });

    it('should not intercept download links', () => {
      const link = document.createElement('a');
      link.href = '/file.pdf';
      link.download = 'file.pdf';
      container.appendChild(link);

      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      const preventDefault = vi.fn();
      link.addEventListener('click', (_e) => preventDefault());

      link.click();

      expect(beforeNavigate).not.toHaveBeenCalled();
    });
  });

  describe('programmatic navigation', () => {
    it('should navigate to a new URL', async () => {
      router?.start();

      await router?.navigate('/contact');

      expect(window.location.pathname).toBe('/contact');
    });

    it('should support replace option', async () => {
      router?.start();

      await router?.navigate('/page1');
      await router?.navigate('/page2', { replace: true });

      expect(window.location.pathname).toBe('/page2');
    });

    it('should call beforeNavigate hook', async () => {
      const beforeNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      await router.navigate('/test');

      expect(beforeNavigate).toHaveBeenCalled();
      expect(beforeNavigate.mock.calls[0]?.[0]?.url.pathname).toBe('/test');
    });

    it('should call afterNavigate hook', async () => {
      const afterNavigate = vi.fn();
      router?.stop();
      router = createClientRouter({ afterNavigate });
      router.start();

      await router.navigate('/test');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(afterNavigate).toHaveBeenCalled();
    });

    it('should prevent navigation if preventDefault is called', async () => {
      const beforeNavigate = vi.fn((event) => {
        event.preventDefault();
      });
      router?.stop();
      router = createClientRouter({ beforeNavigate });
      router.start();

      await router.navigate('/test');

      expect(window.location.pathname).toBe('/');
    });
  });

  describe('history navigation', () => {
    it('should support back navigation', async () => {
      router?.start();

      await router?.navigate('/page1');
      await router?.navigate('/page2');

      router?.back();

      // Wait for history change
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.location.pathname).toBe('/page1');
    });

    it('should support forward navigation', async () => {
      router?.start();

      await router?.navigate('/page1');
      await router?.navigate('/page2');

      router?.back();
      await new Promise((resolve) => setTimeout(resolve, 50));

      router?.forward();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.location.pathname).toBe('/page2');
    });
  });

  describe('scroll management', () => {
    it('should scroll to top by default', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      router?.start();

      await router?.navigate('/page');

      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it('should support custom scroll position', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      router?.start();

      await router?.navigate('/page', { scrollPosition: { x: 100, y: 200 } });

      expect(scrollToSpy).toHaveBeenCalledWith(100, 200);
    });

    it('should skip scroll when skipScroll is true', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      router?.start();

      await router?.navigate('/page', { skipScroll: true });

      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove listeners on stop', () => {
      router?.start();

      const link = document.createElement('a');
      link.href = '/page';
      container.appendChild(link);

      router?.stop();

      const beforeNavigate = vi.fn();
      router = createClientRouter({ beforeNavigate });

      link.click();

      expect(beforeNavigate).not.toHaveBeenCalled();
    });
  });
});
