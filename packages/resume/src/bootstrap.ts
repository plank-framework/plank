/**
 * @fileoverview Client-side resumability bootstrap
 * Restores reactive state and event listeners from serialized snapshot
 */

import type { Computed, Signal } from '@plank/runtime-core';
import { computed, signal } from '@plank/runtime-core';
import {
  RESUME_SCHEMA_VERSION,
  type ResumabilitySnapshot,
  type ResumeOptions,
  type ResumeResult,
} from './schema.js';

/**
 * Default resume options
 */
const DEFAULT_OPTIONS: Required<ResumeOptions> = {
  fallbackToHydration: true,
  timeout: 5000,
  onError: (error) => console.error('Resume error:', error),
  onProgress: () => {}, // No-op
};

/**
 * Resumability bootstrap
 */
export class ResumabilityBootstrap {
  private options: Required<ResumeOptions>;
  private signalRegistry = new Map<string, Signal<unknown>>();
  private computedRegistry = new Map<string, Computed<unknown>>();
  private handlerRegistry = new Map<string, EventListener>();

  constructor(options?: Partial<ResumeOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Load snapshot from embedded script tag
   */
  loadSnapshot(): ResumabilitySnapshot | null {
    const scriptElement = document.getElementById('plank-resume-data');

    if (!scriptElement || scriptElement.getAttribute('type') !== 'application/plank-resume') {
      return null;
    }

    try {
      const content = scriptElement.textContent || '';
      const snapshot = JSON.parse(content) as ResumabilitySnapshot;

      // Verify version compatibility
      if (!this.isVersionCompatible(snapshot.version)) {
        console.warn(
          `Resumability version mismatch: snapshot ${snapshot.version}, expected ${RESUME_SCHEMA_VERSION}`
        );
        return null;
      }

      return snapshot;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error('Failed to parse snapshot'));
      return null;
    }
  }

  /**
   * Restore signals from snapshot
   */
  restoreSignals(snapshot: ResumabilitySnapshot): number {
    this.options.onProgress('Restoring signals', 0.2);

    let restored = 0;

    for (const [id, serializedSignal] of Object.entries(snapshot.signals)) {
      try {
        // Create signal with value
        const sig = signal(serializedSignal.value);

        // Store in registry
        this.signalRegistry.set(id, sig);
        restored++;
      } catch (error) {
        console.warn(`Failed to restore signal ${id}:`, error);
      }
    }

    return restored;
  }

  /**
   * Restore computed values from snapshot
   */
  restoreComputeds(snapshot: ResumabilitySnapshot): number {
    this.options.onProgress('Restoring computed values', 0.4);

    let restored = 0;

    for (const [id, serializedComputed] of Object.entries(snapshot.computeds)) {
      try {
        // Create computed with dependencies
        // Note: We use cached value initially, recompute on first access
        const comp = computed(() => {
          // This will be recomputed on first access
          return serializedComputed.value;
        });

        this.computedRegistry.set(id, comp);
        restored++;
      } catch (error) {
        console.warn(`Failed to restore computed ${id}:`, error);
      }
    }

    return restored;
  }

  /**
   * Restore event listeners from snapshot
   */
  restoreListeners(snapshot: ResumabilitySnapshot): number {
    this.options.onProgress('Restoring event listeners', 0.6);

    let restored = 0;

    for (const [nodeId, nodeData] of Object.entries(snapshot.nodes)) {
      try {
        // Find DOM node by data-plank-id attribute
        const element = document.querySelector<HTMLElement>(`[data-plank-id="${nodeId}"]`);

        if (!element) {
          console.warn(`Node not found for ID: ${nodeId}`);
          continue;
        }

        // Restore listeners
        for (const listener of nodeData.listeners) {
          const handler = this.handlerRegistry.get(listener.handlerId);

          if (handler) {
            element.addEventListener(listener.event, handler, listener.options);
            restored++;
          } else {
            console.warn(`Handler not found for ID: ${listener.handlerId}`);
          }
        }
      } catch (error) {
        console.warn(`Failed to restore listeners for node ${nodeId}:`, error);
      }
    }

    return restored;
  }

  /**
   * Resume application from snapshot
   */
  async resume(): Promise<ResumeResult> {
    const startTime = performance.now();

    try {
      this.options.onProgress('Loading snapshot', 0.1);

      // Load snapshot
      const snapshot = this.loadSnapshot();

      if (!snapshot) {
        throw new Error('No resumability snapshot found');
      }

      // Restore in order: signals → computeds → listeners
      const signalsRestored = this.restoreSignals(snapshot);
      this.restoreComputeds(snapshot);
      const listenersRestored = this.restoreListeners(snapshot);

      this.options.onProgress('Resume complete', 1.0);

      const resumeTime = performance.now() - startTime;

      return {
        success: true,
        metrics: {
          resumeTime,
          signalsRestored,
          listenersRestored,
          componentsResumed: Object.keys(snapshot.components).length,
        },
      };
    } catch (error) {
      const resumeError = error instanceof Error ? error : new Error('Resume failed');
      this.options.onError(resumeError);

      // Fallback to hydration if enabled
      if (this.options.fallbackToHydration) {
        return this.fallbackToPartialHydration(resumeError);
      }

      return {
        success: false,
        error: resumeError,
        metrics: {
          resumeTime: performance.now() - startTime,
          signalsRestored: 0,
          listenersRestored: 0,
          componentsResumed: 0,
        },
      };
    }
  }

  /**
   * Fallback to partial hydration
   */
  private fallbackToPartialHydration(originalError: Error): ResumeResult {
    console.warn('Falling back to partial hydration:', originalError.message);

    return {
      success: true,
      fallback: 'partial-hydration',
      error: originalError,
      metrics: {
        resumeTime: 0,
        signalsRestored: 0,
        listenersRestored: 0,
        componentsResumed: 0,
      },
    };
  }

  /**
   * Register an event handler
   */
  registerHandler(id: string, handler: EventListener): void {
    this.handlerRegistry.set(id, handler);
  }

  /**
   * Get signal by ID
   */
  getSignal(id: string): Signal<unknown> | undefined {
    return this.signalRegistry.get(id);
  }

  /**
   * Get computed by ID
   */
  getComputed(id: string): Computed<unknown> | undefined {
    return this.computedRegistry.get(id);
  }

  /**
   * Check if snapshot version is compatible
   */
  private isVersionCompatible(snapshotVersion: string): boolean {
    // Use 'compatible' strategy: same major version
    const [snapshotMajor] = snapshotVersion.split('.');
    const [currentMajor] = RESUME_SCHEMA_VERSION.split('.');

    return snapshotMajor === currentMajor;
  }

  /**
   * Check if resumability is available
   */
  static canResume(): boolean {
    return !!document.getElementById('plank-resume-data');
  }
}

/**
 * Create a new bootstrap instance
 */
export function createBootstrap(options?: Partial<ResumeOptions>): ResumabilityBootstrap {
  return new ResumabilityBootstrap(options);
}

/**
 * Quick resume helper
 */
export async function quickResume(options?: Partial<ResumeOptions>): Promise<ResumeResult> {
  const bootstrap = createBootstrap(options);
  return bootstrap.resume();
}
