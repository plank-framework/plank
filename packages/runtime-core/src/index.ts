/**
 * @fileoverview Plank runtime core
 * Signals, scheduler, and reactive primitives
 */

export interface Signal<T> {
  (): T;
  (value: T): void;
  readonly value: T;
}

export interface Computed<T> {
  (): T;
  readonly value: T;
}

export interface Effect {
  stop(): void;
}

/**
 * Create a reactive signal
 */
export function signal<T>(initialValue: T): Signal<T> {
  // TODO: Implement signal primitive
  // This is a placeholder for Phase A implementation

  let value = initialValue;

  const signalFn = (newValue?: T) => {
    if (newValue !== undefined) {
      value = newValue;
    }
    return value;
  };

  Object.defineProperty(signalFn, 'value', {
    get: () => value,
    configurable: true
  });

  return signalFn as Signal<T>;
}

/**
 * Create a computed value that depends on signals
 */
export function computed<T>(fn: () => T): Computed<T> {
  // TODO: Implement computed primitive
  // This is a placeholder for Phase A implementation

  const computedFn = () => fn();

  Object.defineProperty(computedFn, 'value', {
    get: () => fn(),
    configurable: true
  });

  return computedFn as Computed<T>;
}

/**
 * Create a side effect that runs when dependencies change
 */
export function effect(fn: () => void | (() => void)): Effect {
  // TODO: Implement effect primitive
  // This is a placeholder for Phase A implementation

  const cleanup = fn();

  return {
    stop: () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    }
  };
}

/**
 * Batch multiple signal updates for better performance
 */
export function batch(fn: () => void): void {
  // TODO: Implement batching
  // This is a placeholder for Phase A implementation

  fn();
}
