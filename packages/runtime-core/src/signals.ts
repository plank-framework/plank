/**
 * @fileoverview Plank signals implementation
 * Fine-grained reactivity with dependency tracking and microtask scheduling
 * Includes SSR serialization markers for resumability
 */

// Base types for reactive values
type ReactiveValue = Signal<unknown> | Computed<unknown> | Effect;

export interface Signal<T> {
  (): T;
  (value: T): void;
  readonly value: T;
  readonly dependencies: Set<Computed<unknown>>;
  readonly dependents: Set<ReactiveValue>;
  readonly id: string;
  readonly isSerializable: boolean;
}

export interface Computed<T> {
  (): T;
  readonly value: T;
  readonly dependencies: Set<ReactiveValue>;
  readonly dependents: Set<ReactiveValue>;
  readonly isDirty: boolean;
  readonly id: string;
  readonly isSerializable: boolean;
}

export interface Effect {
  (): void | (() => void);
  stop(): void;
  readonly isActive: boolean;
  readonly dependencies: Set<Signal<unknown>>;
  readonly id: string;
}

// Global scheduler for batched updates
class Scheduler {
  private scheduled = false;
  private effects: Set<Effect> = new Set();
  private computeds: Set<Computed<unknown>> = new Set();

  schedule(effect: Effect): void {
    this.effects.add(effect);
    this.flush();
  }

  scheduleComputed(computed: Computed<unknown>): void {
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

  private updateComputed(computed: Computed<unknown>): void {
    // Store dependents before clearing them
    const dependents = new Set(computed.dependents);

    // Clear old dependencies
    for (const dep of computed.dependencies) {
      if ('dependents' in dep) {
        dep.dependents.delete(computed);
      }
    }
    computed.dependencies.clear();

    // Recompute with new dependencies
    const prevActiveComputed = activeComputed;
    const prevActiveEffect = activeEffect;

    activeComputed = computed;
    activeEffect = null;

    try {
      // Access the value setter through the computed function
      const computedWithSetter = computed as Computed<unknown> & { value: unknown };
      computedWithSetter.value = computed();
      // Mark as clean after successful recomputation
      const computedWithDirty = computed as Computed<unknown> & { isDirty: boolean };
      computedWithDirty.isDirty = false;
    } finally {
      activeComputed = prevActiveComputed;
      activeEffect = prevActiveEffect;
    }

    // Notify dependents that this computed has been updated
    for (const dependent of dependents) {
      if ('isDirty' in dependent) {
        const dependentWithDirty = dependent as Computed<unknown> & { isDirty: boolean };
        dependentWithDirty.isDirty = true;
        this.scheduleComputed(dependent as Computed<unknown>);
      } else {
        this.schedule(dependent as Effect);
      }
    }
  }
}

// Global scheduler instance
const scheduler = new Scheduler();

// Global tracking for active computations
let activeComputed: Computed<unknown> | null = null;
let activeEffect: Effect | null = null;

// ID generation for serialization
let nextId = 1;
function generateId(): string {
  return `reactive_${nextId++}`;
}

// Global registry for serializable reactive values
const serializableRegistry = new Map<string, ReactiveValue>();

/**
 * Mark a computed as dirty and notify its dependents
 */
function markComputedDirty(computed: Computed<unknown>): void {
  // If already dirty, don't process again (avoid infinite loops)
  if (computed.isDirty) return;

  // Mark as dirty and schedule
  const computedWithDirty = computed as Computed<unknown> & { isDirty: boolean };
  computedWithDirty.isDirty = true;
  scheduler.scheduleComputed(computed);

  // Notify all dependents of this computed
  const computedDependents = computed.dependents;
  for (const dependent of computedDependents) {
    if ('isDirty' in dependent) {
      // It's a computed - recursively mark as dirty
      markComputedDirty(dependent as Computed<unknown>);
    } else {
      // It's an effect - schedule it
      scheduler.schedule(dependent as Effect);
    }
  }
}

/**
 * Create a reactive signal
 */
export function signal<T>(initialValue: T, options?: { serializable?: boolean }): Signal<T> {
  const dependencies = new Set<Computed<unknown>>();
  const dependents = new Set<ReactiveValue>();
  let value = initialValue;
  const id = generateId();
  const isSerializable = options?.serializable ?? true;

  const signalFn = (newValue?: T) => {
    if (newValue !== undefined) {
      if (Object.is(value, newValue)) return value;

      value = newValue;

      // Notify all dependents
      for (const dependent of dependents) {
        if ('isDirty' in dependent) {
          // It's a computed - mark as dirty and schedule
          markComputedDirty(dependent as Computed<unknown>);
        } else {
          // It's an effect
          scheduler.schedule(dependent as Effect);
        }
      }
    }

    // Track dependency if we're in a computation or effect
    if (activeComputed) {
      dependents.add(activeComputed);
      activeComputed.dependencies.add(signalFn as Signal<unknown>);
    }
    if (activeEffect) {
      dependents.add(activeEffect);
      // Add this signal to the effect's dependencies
      activeEffect.dependencies.add(signalFn as Signal<unknown>);
    }

    return value;
  };

  // Add properties to the function
  Object.defineProperties(signalFn, {
    value: {
      get: () => value,
      configurable: true,
    },
    dependencies: {
      get: () => dependencies,
      configurable: true,
    },
    dependents: {
      get: () => dependents,
      configurable: true,
    },
    id: {
      get: () => id,
      configurable: true,
    },
    isSerializable: {
      get: () => isSerializable,
      configurable: true,
    },
  });

  // Register for serialization if serializable
  if (isSerializable) {
    serializableRegistry.set(id, signalFn as Signal<unknown>);
  }

  return signalFn as Signal<T>;
}

/**
 * Create a computed value that depends on signals
 */
export function computed<T>(fn: () => T, options?: { serializable?: boolean }): Computed<T> {
  const dependencies = new Set<ReactiveValue>();
  const dependents = new Set<ReactiveValue>();
  let value: T;
  let isDirty = true;
  const id = generateId();
  const isSerializable = options?.serializable ?? true;

  const trackDependencies = () => {
    if (activeComputed) {
      dependents.add(activeComputed);
      activeComputed.dependencies.add(computedFn as Computed<unknown>);
    }
    if (activeEffect) {
      dependents.add(activeEffect);
    }
  };

  const clearOldDependencies = () => {
    for (const dep of dependencies) {
      if ('dependents' in dep) {
        dep.dependents.delete(computedFn as Computed<unknown>);
      }
    }
    dependencies.clear();
  };

  const notifyDependents = (currentDependents: Set<ReactiveValue>) => {
    for (const dependent of currentDependents) {
      if ('isDirty' in dependent) {
        const dependentWithDirty = dependent as Computed<unknown> & { isDirty: boolean };
        dependentWithDirty.isDirty = true;
        scheduler.scheduleComputed(dependent as Computed<unknown>);
      } else {
        scheduler.schedule(dependent as Effect);
      }
    }
  };

  const computedFn = () => {
    trackDependencies();

    if (isDirty || value === undefined) {
      const currentDependents = new Set(dependents);
      clearOldDependencies();

      const prevActiveComputed = activeComputed;
      activeComputed = computedFn as Computed<unknown>;

      try {
        value = fn();
        isDirty = false;
      } finally {
        activeComputed = prevActiveComputed;
      }

      notifyDependents(currentDependents);
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
      set: (val: T) => {
        value = val;
      },
      configurable: true,
    },
    dependencies: {
      get: () => dependencies,
      configurable: true,
    },
    dependents: {
      get: () => dependents,
      configurable: true,
    },
    isDirty: {
      get: () => isDirty,
      set: (val: boolean) => {
        isDirty = val;
      },
      configurable: true,
    },
    id: {
      get: () => id,
      configurable: true,
    },
    isSerializable: {
      get: () => isSerializable,
      configurable: true,
    },
  });

  // Register for serialization if serializable
  if (isSerializable) {
    serializableRegistry.set(id, computedFn as Computed<unknown>);
  }

  // Initial computation
  computedFn();

  return computedFn as Computed<T>;
}

/**
 * Create a side effect that runs when dependencies change
 */
export function effect(fn: () => void | (() => void)): Effect {
  const dependencies = new Set<Signal<unknown>>();
  let cleanup: (() => void) | undefined;
  let isActive = true;
  const id = generateId();

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
      configurable: true,
    },
    dependencies: {
      get: () => dependencies,
      configurable: true,
    },
    id: {
      get: () => id,
      configurable: true,
    },
  });

  // Initial run
  effectFn();

  // Add stop method
  const effectWithStop = effectFn as Effect & { stop: () => void };
  effectWithStop.stop = () => {
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
export function memo<T, TDep = unknown>(fn: () => T, deps?: Signal<TDep>[]): Computed<T> {
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

  promise
    .then((value) => {
      sig(value);
    })
    .catch((error) => {
      // Could emit error signal here
      console.error('Promise signal error:', error);
    });

  return sig;
}

/**
 * Utility to check if a value is a signal
 */
export function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === 'function' && 'dependencies' in value && 'dependents' in value;
}

/**
 * Utility to check if a value is a computed
 */
export function isComputed(value: unknown): value is Computed<unknown> {
  return typeof value === 'function' && 'dependencies' in value && 'isDirty' in value;
}

/**
 * Utility to check if a value is an effect
 */
export function isEffect(value: unknown): value is Effect {
  return typeof value === 'function' && 'isActive' in value && 'stop' in value;
}

/**
 * Flush the scheduler synchronously (for testing)
 */
export function flushSync(): void {
  scheduler.flushSync();
}

/**
 * Extract dependencies from a reactive value
 */
function extractDependencies(reactive: ReactiveValue): string[] {
  const dependencies: string[] = [];

  if ('dependencies' in reactive) {
    for (const dep of reactive.dependencies) {
      if ('id' in dep) {
        dependencies.push(dep.id);
      }
    }
  }

  return dependencies;
}

/**
 * Serialize a single reactive value
 */
function serializeReactiveValue(
  id: string,
  reactive: ReactiveValue
): {
  id: string;
  type: 'signal' | 'computed';
  value: unknown;
  dependencies: string[];
} {
  return {
    id,
    type: 'isDirty' in reactive ? 'computed' : 'signal',
    value: 'value' in reactive ? reactive.value : undefined,
    dependencies: extractDependencies(reactive),
  };
}

/**
 * Serialize the reactive graph for SSR resumability
 */
export function serializeReactiveGraph(): string {
  const serializableValues: Array<{
    id: string;
    type: 'signal' | 'computed';
    value: unknown;
    dependencies: string[];
  }> = [];

  for (const [id, reactive] of serializableRegistry) {
    if ('isSerializable' in reactive && reactive.isSerializable) {
      serializableValues.push(serializeReactiveValue(id, reactive));
    }
  }

  return JSON.stringify({
    version: '1.0',
    timestamp: Date.now(),
    values: serializableValues,
  });
}

/**
 * Deserialize the reactive graph from SSR
 */
export function deserializeReactiveGraph(serialized: string): Map<string, ReactiveValue> {
  const data = JSON.parse(serialized);
  const restored = new Map<string, ReactiveValue>();

  // Create signals and computeds from serialized data
  for (const item of data.values) {
    if (item.type === 'signal') {
      const sig = signal(item.value, { serializable: true });
      restored.set(item.id, sig);
    }
    // Note: Computeds would need their computation function to be restored
    // This is a simplified version - in practice, you'd need to store the computation
  }

  return restored;
}

/**
 * Clear all reactive values (for cleanup and memory leak prevention)
 */
export function clearReactiveGraph(): void {
  // Clear the registry
  serializableRegistry.clear();

  // Reset ID counter
  nextId = 1;

  // Clear active tracking
  activeComputed = null;
  activeEffect = null;
}

/**
 * Get all serializable reactive values
 */
export function getSerializableValues(): Map<string, ReactiveValue> {
  return new Map(serializableRegistry);
}
