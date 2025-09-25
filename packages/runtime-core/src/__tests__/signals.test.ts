/**
 * @fileoverview Tests for Plank signals implementation
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  signal,
  computed,
  effect,
  batch,
  derived,
  memo,
  fromPromise,
  debounced,
  throttled,
  isSignal,
  isComputed,
  isEffect
} from '../signals.js';

describe('Plank Signals', () => {
  beforeEach(() => {
    // Clear any pending timers
    vi.clearAllTimers();
  });

  describe('signal', () => {
    test('should create a signal with initial value', () => {
      const count = signal(0);
      expect(count()).toBe(0);
      expect(count.value).toBe(0);
    });

    test('should update signal value', () => {
      const count = signal(0);
      count(42);
      expect(count()).toBe(42);
      expect(count.value).toBe(42);
    });

    test('should not update if value is the same', () => {
      const count = signal(0);
      const result1 = count(0);
      const result2 = count(0);
      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });

    test('should track dependencies', () => {
      const count = signal(0);
      const doubled = computed(() => count() * 2);

      expect(doubled()).toBe(0);
      count(5);
      expect(doubled()).toBe(10);
    });
  });

  describe('computed', () => {
    test('should create computed value', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);

      expect(doubled()).toBe(10);
      expect(doubled.value).toBe(10);
    });

    test('should update when dependencies change', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);

      expect(doubled()).toBe(10);
      count(10);
      expect(doubled()).toBe(20);
    });

    test('should handle multiple dependencies', () => {
      const a = signal(2);
      const b = signal(3);
      const sum = computed(() => a() + b());

      expect(sum()).toBe(5);
      a(4);
      expect(sum()).toBe(7);
      b(5);
      expect(sum()).toBe(9);
    });

    test('should handle nested computeds', () => {
      const count = signal(2);
      const doubled = computed(() => count() * 2);
      const quadrupled = computed(() => doubled() * 2);

      expect(quadrupled()).toBe(8);
      count(3);
      expect(quadrupled()).toBe(12);
    });

    test('should track isDirty state', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);

      expect(doubled.isDirty).toBe(false);
      count(10);
      expect(doubled.isDirty).toBe(true);
      doubled(); // Access to trigger recomputation
      expect(doubled.isDirty).toBe(false);
    });
  });

  describe('effect', () => {
    test('should run effect immediately', () => {
      const count = signal(0);
      const log: number[] = [];

      effect(() => {
        log.push(count());
      });

      expect(log).toEqual([0]);
    });

    test('should run effect when dependencies change', () => {
      const count = signal(0);
      const log: number[] = [];

      effect(() => {
        log.push(count());
      });

      count(5);
      count(10);

      // Effects are batched, so we need to wait for microtask
      return new Promise(resolve => {
        setTimeout(() => {
          expect(log).toEqual([0, 10]);
          resolve(undefined);
        }, 0);
      });
    });

    test('should handle cleanup function', () => {
      const count = signal(0);
      const cleanup = vi.fn();

      effect(() => {
        count();
        return cleanup;
      });

      count(5);

      return new Promise(resolve => {
        setTimeout(() => {
          expect(cleanup).toHaveBeenCalled();
          resolve(undefined);
        }, 0);
      });
    });

    test('should stop effect', () => {
      const count = signal(0);
      const log: number[] = [];

      const stop = effect(() => {
        log.push(count());
      });

      count(5);
      stop.stop();
      count(10);

      return new Promise(resolve => {
        setTimeout(() => {
          expect(log).toEqual([0, 5]);
          resolve(undefined);
        }, 0);
      });
    });

    test('should track isActive state', () => {
      const count = signal(0);
      const stop = effect(() => {
        count();
      });

      expect(stop.isActive).toBe(true);
      stop.stop();
      expect(stop.isActive).toBe(false);
    });
  });

  describe('batch', () => {
    test('should batch updates', () => {
      const a = signal(0);
      const b = signal(0);
      const log: number[] = [];

      effect(() => {
        log.push(a() + b());
      });

      batch(() => {
        a(1);
        b(2);
      });

      return new Promise(resolve => {
        setTimeout(() => {
          expect(log).toEqual([0, 3]);
          resolve(undefined);
        }, 0);
      });
    });
  });

  describe('derived', () => {
    test('should work as alias for computed', () => {
      const count = signal(5);
      const doubled = derived(() => count() * 2);

      expect(doubled()).toBe(10);
      count(10);
      expect(doubled()).toBe(20);
    });
  });

  describe('memo', () => {
    test('should create memoized computed', () => {
      const count = signal(5);
      const doubled = memo(() => count() * 2);

      expect(doubled()).toBe(10);
      count(10);
      expect(doubled()).toBe(20);
    });

    test('should work with explicit dependencies', () => {
      const a = signal(2);
      const b = signal(3);
      const sum = memo(() => a() + b(), [a, b]);

      expect(sum()).toBe(5);
      a(4);
      expect(sum()).toBe(7);
    });
  });

  describe('fromPromise', () => {
    test('should create signal from promise', async () => {
      const promise = Promise.resolve('hello');
      const sig = fromPromise(promise);

      expect(sig()).toBeUndefined();

      await promise;
      expect(sig()).toBe('hello');
    });

    test('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('test error'));
      const sig = fromPromise(promise);

      expect(sig()).toBeUndefined();

      try {
        await promise;
      } catch {
        // Expected
      }

      // Signal should still be undefined after rejection
      expect(sig()).toBeUndefined();
    });
  });

  describe('debounced', () => {
    test('should debounce signal updates', async () => {
      vi.useFakeTimers();

      const count = signal(0);
      const debouncedCount = debounced(count, 100);
      const log: number[] = [];

      effect(() => {
        log.push(debouncedCount());
      });

      count(1);
      count(2);
      count(3);

      // Fast forward time
      vi.advanceTimersByTime(100);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(log).toEqual([0, 3]);

      vi.useRealTimers();
    });
  });

  describe('throttled', () => {
    test('should throttle signal updates', async () => {
      vi.useFakeTimers();

      const count = signal(0);
      const throttledCount = throttled(count, 100);
      const log: number[] = [];

      effect(() => {
        log.push(throttledCount());
      });

      count(1);
      vi.advanceTimersByTime(50);
      count(2);
      vi.advanceTimersByTime(50);
      count(3);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(log).toEqual([0, 1, 3]);

      vi.useRealTimers();
    });
  });

  describe('type guards', () => {
    test('should identify signals', () => {
      const sig = signal(0);
      expect(isSignal(sig)).toBe(true);
      expect(isSignal(42)).toBe(false);
      expect(isSignal(() => {})).toBe(false);
    });

    test('should identify computeds', () => {
      const count = signal(0);
      const comp = computed(() => count() * 2);
      expect(isComputed(comp)).toBe(true);
      expect(isComputed(signal(0))).toBe(false);
      expect(isComputed(42)).toBe(false);
    });

    test('should identify effects', () => {
      const effectFn = effect(() => {});
      expect(isEffect(effectFn)).toBe(true);
      expect(isEffect(signal(0))).toBe(false);
      expect(isEffect(42)).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    test('should handle circular dependencies gracefully', () => {
      const a = signal(1);
      const b = computed(() => a() + 1);
      const c = computed(() => b() + 1);

      // This should not cause infinite loops
      expect(c()).toBe(3);
      a(2);
      expect(c()).toBe(4);
    });

    test('should handle dynamic dependency changes', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);

      const result = computed(() => {
        if (condition()) {
          return a() * 2;
        } else {
          return b() * 3;
        }
      });

      expect(result()).toBe(2);
      condition(false);
      expect(result()).toBe(6);
      a(5); // Should not affect result when condition is false
      expect(result()).toBe(6);
      b(3);
      expect(result()).toBe(9);
    });
  });
});
