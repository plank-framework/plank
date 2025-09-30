/**
 * @fileoverview Tests for Plank signals implementation
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  batch,
  clearReactiveGraph,
  computed,
  derived,
  deserializeReactiveGraph,
  effect,
  flushSync,
  fromPromise,
  getSerializableValues,
  isComputed,
  isEffect,
  isSignal,
  memo,
  serializeReactiveGraph,
  signal,
} from '../signals.js';

describe('Plank Signals', () => {
  beforeEach(() => {
    // Clear any pending timers
    vi.clearAllTimers();
    // Clear reactive graph for clean test state
    clearReactiveGraph();
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

    test('should have unique ID and serialization support', () => {
      const count = signal(42);
      const count2 = signal(24);

      expect(count.id).toBeDefined();
      expect(count2.id).toBeDefined();
      expect(count.id).not.toBe(count2.id);
      expect(count.isSerializable).toBe(true);
    });

    test('should support non-serializable signals', () => {
      const count = signal(42, { serializable: false });
      expect(count.isSerializable).toBe(false);
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
      flushSync();
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

    test('should have unique ID and serialization support', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);
      const tripled = computed(() => count() * 3);

      expect(doubled.id).toBeDefined();
      expect(tripled.id).toBeDefined();
      expect(doubled.id).not.toBe(tripled.id);
      expect(doubled.isSerializable).toBe(true);
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
      return new Promise((resolve) => {
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

      return new Promise((resolve) => {
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
      flushSync();
      stop.stop();
      count(10);
      flushSync();

      return new Promise((resolve) => {
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

    test('should have unique ID', () => {
      const count = signal(0);
      const effect1 = effect(() => {
        count();
      });
      const effect2 = effect(() => {
        count();
      });

      expect(effect1.id).toBeDefined();
      expect(effect2.id).toBeDefined();
      expect(effect1.id).not.toBe(effect2.id);
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

      return new Promise((resolve) => {
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

  describe('serialization', () => {
    test('should serialize reactive graph', () => {
      const count = signal(42);
      computed(() => count() * 2);
      computed(() => count() * 3);

      const serialized = serializeReactiveGraph();
      const data = JSON.parse(serialized);

      expect(data.version).toBe('1.0');
      expect(data.timestamp).toBeDefined();
      expect(data.values).toHaveLength(3); // count, doubled, tripled

      const signalData = data.values.find(
        (v: { type: string; value: unknown }) => v.type === 'signal'
      );
      const computedData = data.values.filter((v: { type: string }) => v.type === 'computed');

      expect(signalData.value).toBe(42);
      expect(computedData).toHaveLength(2);
    });

    test('should deserialize reactive graph', () => {
      const count = signal(42);
      const serialized = serializeReactiveGraph();

      clearReactiveGraph();
      const restored = deserializeReactiveGraph(serialized);

      expect(restored.size).toBe(1);
      const restoredSignal = restored.get(count.id);
      expect(restoredSignal).toBeDefined();
    });

    test('should get serializable values', () => {
      const count = signal(42);
      computed(() => count() * 2);
      const nonSerializable = signal(24, { serializable: false });

      const serializable = getSerializableValues();
      expect(serializable.size).toBe(2); // count and doubled, not nonSerializable
      expect(serializable.has(count.id)).toBe(true);
      expect(serializable.has(nonSerializable.id)).toBe(false);
    });

    test('should clear reactive graph', () => {
      signal(42);
      computed(() => 42 * 2);

      expect(getSerializableValues().size).toBe(2);

      clearReactiveGraph();

      expect(getSerializableValues().size).toBe(0);
    });
  });
});
