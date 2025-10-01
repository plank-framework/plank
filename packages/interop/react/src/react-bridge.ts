/**
 * @fileoverview Bridge between Plank signals and React state
 */

import { signal as createSignal, type Signal } from '@plank/runtime-core';
import { useEffect, useState } from 'react';

/**
 * React hook to subscribe to a Plank signal
 */
export function useSignal<T>(plankSignal: Signal<T>): T {
  const [value, setValue] = useState<T>(plankSignal());

  useEffect(() => {
    // Poll for changes (Plank signals don't have subscribe method)
    // In a production implementation, we'd use Plank's effect system
    const interval = setInterval(() => {
      const current = plankSignal();
      setValue((prev: T) => (prev !== current ? current : prev));
    }, 100);

    return () => clearInterval(interval);
  }, [plankSignal]);

  return value;
}

/**
 * Create a Plank signal from React component
 */
export function createPlankSignal<T>(initialValue: T): Signal<T> {
  return createSignal(initialValue);
}

/**
 * Sync React state to Plank signal
 */
export function useSyncToSignal<T>(plankSignal: Signal<T>, value: T): void {
  useEffect(() => {
    if (plankSignal() !== value) {
      plankSignal(value);
    }
  }, [plankSignal, value]);
}
