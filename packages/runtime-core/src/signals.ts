/**
 * @fileoverview Plank signals implementation
 * Fine-grained reactivity with dependency tracking and microtask scheduling
 */

export interface Signal<T> {
  (): T;
  (value: T): void;
  readonly value: T;
  readonly dependencies: Set<Computed<any>>;
  readonly dependents: Set<Computed<any> | Effect>;
}

export interface Computed<T> {
  (): T;
  readonly value: T;
  readonly dependencies: Set<Signal<any> | Computed<any>>;
  readonly dependents: Set<Computed<any> | Effect>;
  readonly isDirty: boolean;
}

export interface Effect {
  (): void | (() => void);
  stop(): void;
  readonly isActive: boolean;
  readonly dependencies: Set<Signal<any>>;
}

// Global scheduler for batched updates
class Scheduler {
  private scheduled = false;
  private effects: Set<Effect> = new Set();
  private computeds: Set<Computed<any>> = new Set();

  schedule(effect: Effect): void {
    this.effects.add(effect);
    this.flush();
  }

  scheduleComputed(computed: Computed<any>): void {
    this.computeds.add(computed);
    this.flush();
  }

  private flush(): void {
    if (this.scheduled) return;

    this.scheduled = true;

    // Use microtask for batching
    Promise.resolve().then(() => {
      this.scheduled = false;

      // Update computeds first
      for (const computed of this.computeds) {
        if (computed.isDirty) {
          this.updateComputed(computed);
        }
      }
      this.computeds.clear();

      // Then run effects
      for (const effect of this.effects) {
        if (effect.isActive) {
          effect();
        }
      }
      this.effects.clear();
    });
  }

  // Synchronous flush for testing
  flushSync(): void {
    this.scheduled = false;

    // Update computeds first
    for (const computed of this.computeds) {
      if (computed.isDirty) {
        this.updateComputed(computed);
      }
    }
    this.computeds.clear();

    // Then run effects
    for (const effect of this.effects) {
      if (effect.isActive) {
        effect();
      }
    }
    this.effects.clear();
  }

  private updateComputed(computed: Computed<any>): void {
    // Store dependents before clearing them
    const dependents = new Set((computed as any).dependents);

    // Mark as clean before recomputation
    (computed as any).isDirty = false;

    // Clear old dependencies
    for (const dep of computed.dependencies) {
      dep.dependents.delete(computed);
    }
    computed.dependencies.clear();

    // Recompute with new dependencies
    const prevActiveComputed = activeComputed;
    const prevActiveEffect = activeEffect;

    activeComputed = computed;
    activeEffect = null;

    try {
      (computed as any).value = computed();
    } finally {
      activeComputed = prevActiveComputed;
      activeEffect = prevActiveEffect;
    }

    // Notify dependents that this computed has been updated
    for (const dependent of dependents) {
      if ('isDirty' in (dependent as any)) {
        (dependent as any).isDirty = true;
        this.scheduleComputed(dependent as Computed<any>);
      } else {
        this.schedule(dependent as Effect);
      }
    }
  }
}

// Global scheduler instance
const scheduler = new Scheduler();

// Global tracking for active computations
let activeComputed: Computed<any> | null = null;
let activeEffect: Effect | null = null;

/**
 * Create a reactive signal
 */
export function signal<T>(initialValue: T): Signal<T> {
  const dependencies = new Set<Computed<any>>();
  const dependents = new Set<Computed<any> | Effect>();
  let value = initialValue;

  const signalFn = (newValue?: T) => {
    if (newValue !== undefined) {
      if (Object.is(value, newValue)) return value;

      value = newValue;

      // Notify all dependents
      for (const dependent of dependents) {
        if ('isDirty' in dependent) {
          // It's a computed - mark as dirty and schedule
          (dependent as any).isDirty = true;
          scheduler.scheduleComputed(dependent as Computed<any>);
        } else {
          // It's an effect
          scheduler.schedule(dependent as Effect);
        }
      }
    }

    // Track dependency if we're in a computation or effect
    if (activeComputed) {
      dependents.add(activeComputed);
      activeComputed.dependencies.add(signalFn as Signal<any>);
    }
    if (activeEffect) {
      dependents.add(activeEffect);
      // Add this signal to the effect's dependencies
      activeEffect.dependencies.add(signalFn as Signal<any>);
    }

    return value;
  };

  // Add properties to the function
  Object.defineProperties(signalFn, {
    value: {
      get: () => value,
      configurable: true
    },
    dependencies: {
      get: () => dependencies,
      configurable: true
    },
    dependents: {
      get: () => dependents,
      configurable: true
    }
  });

  return signalFn as Signal<T>;
}

/**
 * Create a computed value that depends on signals
 */
export function computed<T>(fn: () => T): Computed<T> {
  const dependencies = new Set<Signal<any> | Computed<any>>();
  const dependents = new Set<Computed<any> | Effect>();
  let value: T;
  let isDirty = true;

  const computedFn = () => {
    // Track dependency if we're in a computation or effect
    if (activeComputed) {
      dependents.add(activeComputed);
      activeComputed.dependencies.add(computedFn as Computed<any>);
    }
    if (activeEffect) {
      dependents.add(activeEffect);
    }

    if (isDirty) {
      // Store dependents before clearing dependencies
      const currentDependents = new Set(dependents);

      // Clear old dependencies
      for (const dep of dependencies) {
        dep.dependents.delete(computedFn as Computed<any>);
      }
      dependencies.clear();

      // Recompute with dependency tracking
      const prevActiveComputed = activeComputed;
      activeComputed = computedFn as Computed<any>;

      try {
        value = fn();
        isDirty = false;
      } finally {
        activeComputed = prevActiveComputed;
      }

      // Notify dependents that this computed has been updated
      for (const dependent of currentDependents) {
        if ('isDirty' in dependent) {
          (dependent as any).isDirty = true;
          scheduler.scheduleComputed(dependent as Computed<any>);
        } else {
          // It's an effect - schedule it for re-execution
          scheduler.schedule(dependent as Effect);
        }
      }
    } else if (value === undefined) {
      // First access - establish dependencies
      const prevActiveComputed = activeComputed;
      activeComputed = computedFn as Computed<any>;

      try {
        value = fn();
        isDirty = false;
      } finally {
        activeComputed = prevActiveComputed;
      }
    }

    return value;
  };

  // Add properties to the function
  Object.defineProperties(computedFn, {
    value: {
      get: () => {
        if (isDirty) {
          computedFn();
        }
        return value;
      },
      set: (val: T) => { value = val; },
      configurable: true
    },
    dependencies: {
      get: () => dependencies,
      configurable: true
    },
    dependents: {
      get: () => dependents,
      configurable: true
    },
    isDirty: {
      get: () => isDirty,
      set: (val: boolean) => { isDirty = val; },
      configurable: true
    }
  });

  // Initial computation
  computedFn();

  return computedFn as Computed<T>;
}

/**
 * Create a side effect that runs when dependencies change
 */
export function effect(fn: () => void | (() => void)): Effect {
  const dependencies = new Set<Signal<any>>();
  let cleanup: (() => void) | undefined;
  let isActive = true;

  const effectFn = () => {
    if (!isActive) return;

    // Cleanup previous effect
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Clear old dependencies
    for (const dep of dependencies) {
      dep.dependents.delete(effectFn as Effect);
    }
    dependencies.clear();

    // Run effect and track dependencies
    const prevActiveEffect = activeEffect;
    activeEffect = effectFn as Effect;

    try {
      cleanup = fn() || undefined;
    } finally {
      activeEffect = prevActiveEffect;
    }
  };

  // Add properties to the function
  Object.defineProperties(effectFn, {
    isActive: {
      get: () => isActive,
      configurable: true
    },
    dependencies: {
      get: () => dependencies,
      configurable: true
    }
  });

  // Initial run
  effectFn();

  // Add stop method
  (effectFn as any).stop = () => {
    if (!isActive) return;

    isActive = false;

    // Cleanup
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Remove from all dependencies
    for (const dep of dependencies) {
      dep.dependents.delete(effectFn as Effect);
    }
    dependencies.clear();
  };

  return effectFn as Effect;
}

/**
 * Batch multiple signal updates for better performance
 */
export function batch(fn: () => void): void {
  // For now, just run the function
  // In a more sophisticated implementation, we could defer all updates
  fn();
}

/**
 * Create a derived signal that automatically updates
 */
export function derived<T>(fn: () => T): Computed<T> {
  return computed(fn);
}

/**
 * Create a signal that only updates when the value actually changes
 */
export function memo<T>(fn: () => T, deps?: Signal<any>[]): Computed<T> {
  if (deps) {
    // Create a computed that depends on specific signals
    return computed(() => {
      // Access all dependencies to track them
      for (const dep of deps) {
        dep();
      }
      return fn();
    });
  }

  return computed(fn);
}

/**
 * Create a signal from a promise
 */
export function fromPromise<T>(promise: Promise<T>): Signal<T | undefined> {
  const sig = signal<T | undefined>(undefined);

  promise.then(value => {
    sig(value);
  }).catch(error => {
    // Could emit error signal here
    console.error('Promise signal error:', error);
  });

  return sig;
}

/**
 * Create a signal that debounces updates
 */
export function debounced<T>(signal: Signal<T>, delay: number): Signal<T> {
  let timeoutId: number | undefined;
  const debouncedSignal = signal(undefined as T);

  const originalSignal = signal;

  // Override the signal to debounce updates
  const debouncedFn = (value?: T) => {
    if (value !== undefined) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        originalSignal(value);
        timeoutId = undefined;
      }, delay);

      return originalSignal(value);
    }

    return debouncedSignal;
  };

  return debouncedFn as Signal<T>;
}

/**
 * Create a signal that throttles updates
 */
export function throttled<T>(signal: Signal<T>, delay: number): Signal<T> {
  let lastUpdate = 0;
  const throttledSignal = signal(undefined as T);

  const originalSignal = signal;

  // Override the signal to throttle updates
  const throttledFn = (value?: T) => {
    if (value !== undefined) {
      const now = Date.now();

      if (now - lastUpdate >= delay) {
        originalSignal(value);
        lastUpdate = now;
      }

      return originalSignal(value);
    }

    return throttledSignal;
  };

  return throttledFn as Signal<T>;
}

/**
 * Utility to check if a value is a signal
 */
export function isSignal(value: any): value is Signal<any> {
  return typeof value === 'function' && 'dependencies' in value && 'dependents' in value;
}

/**
 * Utility to check if a value is a computed
 */
export function isComputed(value: any): value is Computed<any> {
  return typeof value === 'function' && 'dependencies' in value && 'isDirty' in value;
}

/**
 * Utility to check if a value is an effect
 */
export function isEffect(value: any): value is Effect {
  return typeof value === 'function' && 'isActive' in value && 'stop' in value;
}

/**
 * Flush the scheduler synchronously (for testing)
 */
export function flushSync(): void {
  scheduler.flushSync();
}
