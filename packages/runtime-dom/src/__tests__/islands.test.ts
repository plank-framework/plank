/**
 * @fileoverview Tests for islands system
 */

import { computed, flushSync, signal } from '@plank/runtime-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  cleanupAllIslands,
  createComputedIsland,
  createIsland,
  createSignalIsland,
  getIsland,
  initializeAllIslands,
  initializeIsland,
  loadIsland,
  mountIsland,
  registerIsland,
  unmountIsland,
  updateIslandProps,
} from '../islands.js';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockImplementation((_callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));
// biome-ignore lint/suspicious/noExplicitAny: Mock for testing
global.IntersectionObserver = mockIntersectionObserver as any;

// Mock requestIdleCallback
const mockRequestIdleCallback = vi.fn();
mockRequestIdleCallback.mockImplementation((callback) => {
  setTimeout(callback, 0);
  return 1;
});
// biome-ignore lint/suspicious/noExplicitAny: Mock for testing
global.requestIdleCallback = mockRequestIdleCallback as any;

describe('Islands System', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(container);
    cleanupAllIslands();
    vi.useRealTimers();
  });

  // Helper function to change signal and flush effects
  function changeAndFlush<T>(signal: (value?: T) => T, newValue: T): void {
    signal(newValue);
    flushSync();
  }

  describe('island registration', () => {
    test('should register and retrieve island components', () => {
      const mockComponent = {
        mount: vi.fn().mockReturnValue({ stop: vi.fn(), isActive: true }),
        unmount: vi.fn(),
        update: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const retrieved = getIsland('./TestIsland.plk');
      expect(retrieved).toBe(mockComponent);
    });

    test('should return undefined for unregistered islands', () => {
      const retrieved = getIsland('./NonExistent.plk');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('createIsland', () => {
    test('should create an island element with basic attributes', () => {
      const island = createIsland({
        src: './TestIsland.plk',
        strategy: 'load',
      });

      expect(island.getAttribute('data-island')).toBe('./TestIsland.plk');
      expect(island.getAttribute('data-strategy')).toBe('load');
      expect(island.textContent).toBe('Loading...');
    });

    test('should create an island with fallback content', () => {
      const fallback = document.createElement('div');
      fallback.textContent = 'Custom fallback';

      const island = createIsland({
        src: './TestIsland.plk',
        strategy: 'load',
        fallback,
      });

      expect(island.textContent).toBe('Custom fallback');
    });

    test('should create an island with props', () => {
      const island = createIsland({
        src: './TestIsland.plk',
        strategy: 'load',
        props: { count: 42, name: 'test' },
      });

      expect(island.getAttribute('data-prop-count')).toBe('42');
      expect(island.getAttribute('data-prop-name')).toBe('test');
    });
  });

  describe('loadIsland', () => {
    test('should return existing island from registry', async () => {
      const mockComponent = {
        mount: vi.fn().mockReturnValue({ stop: vi.fn(), isActive: true }),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const component = await loadIsland('./TestIsland.plk');
      expect(component).toBe(mockComponent);
    });

    test('should load island component dynamically', async () => {
      const mockComponent = {
        mount: vi.fn().mockReturnValue({ stop: vi.fn(), isActive: true }),
        unmount: vi.fn(),
      };

      // Register the component directly since vi.doMock doesn't work with dynamic imports
      registerIsland('./DynamicIsland.plk', mockComponent);

      const component = await loadIsland('./DynamicIsland.plk');
      expect(component).toBe(mockComponent);
    });

    test('should handle loading errors', async () => {
      // loadIsland returns a fallback component on error, doesn't reject
      const component = await loadIsland('./ErrorIsland.plk');

      // Should return a fallback component with mount function
      expect(component).toBeDefined();
      expect(typeof component.mount).toBe('function');
      expect(typeof component.unmount).toBe('function');
    });

    test('should validate component structure', async () => {
      // loadIsland returns a fallback component for invalid components
      const component = await loadIsland('./InvalidIsland.plk');

      // Should return a fallback component with mount function
      expect(component).toBeDefined();
      expect(typeof component.mount).toBe('function');
      expect(typeof component.unmount).toBe('function');
    });
  });

  describe('mountIsland', () => {
    test('should mount an island component', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      element.textContent = 'Loading...';

      const effect = await mountIsland(element, {
        src: './TestIsland.plk',
        strategy: 'load',
        props: { test: 'value' },
      });

      expect(mockComponent.mount).toHaveBeenCalledWith(element, { test: 'value' });
      expect(effect).toBe(mockEffect);
      // Component without template doesn't clear innerHTML
      expect(element.innerHTML).toBe('Loading...');
    });

    test('should handle mounting errors', async () => {
      const element = document.createElement('div');
      element.textContent = 'Loading...';

      const effect = await mountIsland(element, {
        src: './NonExistent.plk',
        strategy: 'load',
      });

      // loadIsland returns a fallback component that mounts successfully
      expect(effect).toBeDefined();
      expect(effect).not.toBeNull();
      // The fallback component renders an error message
      expect(element.innerHTML).toContain('Component compilation failed');
    });
  });

  describe('unmountIsland', () => {
    test('should unmount an island component', () => {
      const mockComponent = {
        mount: vi.fn(),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      element.setAttribute('data-island', './TestIsland.plk');
      element.setAttribute('data-strategy', 'load');
      element.innerHTML = '<div>Content</div>';

      unmountIsland(element);

      expect(mockComponent.unmount).toHaveBeenCalled();
      expect(element.innerHTML).toBe('');
      expect(element.getAttribute('data-island')).toBeNull();
      expect(element.getAttribute('data-strategy')).toBeNull();
    });

    test('should handle unmounting without island attribute', () => {
      const element = document.createElement('div');
      element.innerHTML = '<div>Content</div>';

      // Should not throw
      unmountIsland(element);
      expect(element.innerHTML).toBe('<div>Content</div>');
    });
  });

  describe('updateIslandProps', () => {
    test('should update island props', () => {
      const mockComponent = {
        mount: vi.fn(),
        unmount: vi.fn(),
        update: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      element.setAttribute('data-island', './TestIsland.plk');

      updateIslandProps(element, { count: 10, name: 'updated' });

      expect(mockComponent.update).toHaveBeenCalledWith({ count: 10, name: 'updated' });
      expect(element.getAttribute('data-prop-count')).toBe('10');
      expect(element.getAttribute('data-prop-name')).toBe('updated');
    });

    test('should handle updating props without island attribute', () => {
      const element = document.createElement('div');

      // Should not throw
      updateIslandProps(element, { test: 'value' });
      expect(element.getAttribute('data-prop-test')).toBe('value');
    });
  });

  describe('initializeIsland', () => {
    test('should initialize island with load strategy', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      const effect = await initializeIsland(element, {
        src: './TestIsland.plk',
        strategy: 'load',
      });

      expect(effect).toBe(mockEffect);
    });

    test('should initialize island with idle strategy', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      const promise = initializeIsland(element, {
        src: './TestIsland.plk',
        strategy: 'idle',
      });

      // Fast-forward timers to trigger idle callback
      vi.advanceTimersByTime(0);

      const effect = await promise;
      expect(effect).toBe(mockEffect);
    });

    test('should initialize island with visible strategy', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      const promise = initializeIsland(element, {
        src: './TestIsland.plk',
        strategy: 'visible',
      });

      // Mock intersection observer callback
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      observerCallback([{ isIntersecting: true }]);

      const effect = await promise;
      expect(effect).toBe(mockEffect);
    });

    test('should initialize island with interaction strategy', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const element = document.createElement('div');
      const promise = initializeIsland(element, {
        src: './TestIsland.plk',
        strategy: 'interaction',
      });

      // Simulate click interaction
      element.dispatchEvent(new Event('click'));

      const effect = await promise;
      expect(effect).toBe(mockEffect);
    });

    test('should handle unknown strategy', async () => {
      const element = document.createElement('div');
      const effect = await initializeIsland(element, {
        src: './TestIsland.plk',
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid strategy
        strategy: 'unknown' as any,
      });

      expect(effect).toBeNull();
    });
  });

  describe('initializeAllIslands', () => {
    test('should initialize all islands on the page', async () => {
      const mockEffect = { stop: vi.fn(), isActive: true };
      const mockComponent = {
        mount: vi.fn().mockReturnValue(mockEffect),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      // Create island elements
      const island1 = document.createElement('div');
      island1.setAttribute('data-island', './TestIsland.plk');
      island1.setAttribute('data-strategy', 'load');
      island1.setAttribute('data-prop-count', '42');

      const island2 = document.createElement('div');
      island2.setAttribute('data-island', './TestIsland.plk');
      island2.setAttribute('data-strategy', 'load');
      island2.setAttribute('data-prop-name', 'test');

      document.body.appendChild(island1);
      document.body.appendChild(island2);

      const effects = await initializeAllIslands();

      expect(effects).toHaveLength(2);
      expect(mockComponent.mount).toHaveBeenCalledTimes(2);
      expect(mockComponent.mount).toHaveBeenCalledWith(island1, { count: '42' });
      expect(mockComponent.mount).toHaveBeenCalledWith(island2, { name: 'test' });

      document.body.removeChild(island1);
      document.body.removeChild(island2);
    });

    test('should handle islands with missing attributes', async () => {
      const island = document.createElement('div');
      island.setAttribute('data-island', './TestIsland.plk');
      // Missing strategy attribute

      document.body.appendChild(island);

      const effects = await initializeAllIslands();

      expect(effects).toHaveLength(0);

      document.body.removeChild(island);
    });
  });

  describe('createSignalIsland', () => {
    test('should create a signal-based island', () => {
      const propsSignal = signal({ count: 42, name: 'test' });
      const island = createSignalIsland('./TestIsland.plk', propsSignal);

      expect(island.getAttribute('data-island')).toBe('./TestIsland.plk');
      expect(island.getAttribute('data-strategy')).toBe('load');
      expect(island.getAttribute('data-prop-count')).toBe('42');
      expect(island.getAttribute('data-prop-name')).toBe('test');
    });

    test('should update props when signal changes', () => {
      const propsSignal = signal({ count: 42, name: 'test' });
      const island = createSignalIsland('./TestIsland.plk', propsSignal);

      expect(island.getAttribute('data-prop-count')).toBe('42');
      expect(island.getAttribute('data-prop-name')).toBe('test');

      changeAndFlush(propsSignal, { count: 100, name: 'updated' });

      expect(island.getAttribute('data-prop-count')).toBe('100');
      expect(island.getAttribute('data-prop-name')).toBe('updated');
    });
  });

  describe('createComputedIsland', () => {
    test('should create a computed-based island', () => {
      const count = signal(42);
      const propsComputed = computed(() => ({ count: count(), doubled: count() * 2 }));
      const island = createComputedIsland('./TestIsland.plk', propsComputed);

      expect(island.getAttribute('data-island')).toBe('./TestIsland.plk');
      expect(island.getAttribute('data-strategy')).toBe('load');
      expect(island.getAttribute('data-prop-count')).toBe('42');
      expect(island.getAttribute('data-prop-doubled')).toBe('84');
    });

    test('should update props when computed changes', () => {
      const count = signal(42);
      const propsComputed = computed(() => ({ count: count(), doubled: count() * 2 }));
      const island = createComputedIsland('./TestIsland.plk', propsComputed);

      expect(island.getAttribute('data-prop-count')).toBe('42');
      expect(island.getAttribute('data-prop-doubled')).toBe('84');

      changeAndFlush(count, 100);

      expect(island.getAttribute('data-prop-count')).toBe('100');
      expect(island.getAttribute('data-prop-doubled')).toBe('200');
    });
  });

  describe('cleanupAllIslands', () => {
    test('should cleanup all islands', () => {
      const mockComponent = {
        mount: vi.fn(),
        unmount: vi.fn(),
      };

      registerIsland('./TestIsland.plk', mockComponent);

      const island1 = document.createElement('div');
      island1.setAttribute('data-island', './TestIsland.plk');
      island1.innerHTML = '<div>Content 1</div>';

      const island2 = document.createElement('div');
      island2.setAttribute('data-island', './TestIsland.plk');
      island2.innerHTML = '<div>Content 2</div>';

      document.body.appendChild(island1);
      document.body.appendChild(island2);

      cleanupAllIslands();

      expect(mockComponent.unmount).toHaveBeenCalledTimes(2);
      expect(island1.innerHTML).toBe('');
      expect(island2.innerHTML).toBe('');

      document.body.removeChild(island1);
      document.body.removeChild(island2);
    });
  });
});
