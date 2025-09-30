/**
 * @fileoverview Server-side resumability serializer
 * Captures reactive state, event listeners, and component boundaries
 */

import type { Computed, Signal } from '@plank/runtime-core';
import {
  RESUME_SCHEMA_VERSION,
  type ResumabilitySnapshot,
  type ResumeConfig,
  type SerializedComputed,
  type SerializedSignal,
} from './schema.js';

/**
 * Default resumability configuration
 */
const DEFAULT_CONFIG: Required<ResumeConfig> = {
  enabled: true,
  serializeFunctions: false,
  maxSnapshotSize: 1024 * 1024, // 1 MB
  compress: true,
  versionStrategy: 'compatible',
};

/**
 * Resumability serializer
 */
export class ResumabilitySerializer {
  private config: Required<ResumeConfig>;
  private signalMap = new Map<string, Signal<unknown>>();
  private computedMap = new Map<string, Computed<unknown>>();

  constructor(config?: Partial<ResumeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Warn if function serialization is enabled
    if (this.config.serializeFunctions) {
      console.warn(
        '⚠️  Function serialization enabled. This may pose security risks in production.'
      );
    }
  }

  /**
   * Register a signal for serialization
   */
  registerSignal<T>(signal: Signal<T>): void {
    if (signal.isSerializable) {
      this.signalMap.set(signal.id, signal as Signal<unknown>);
    }
  }

  /**
   * Register a computed for serialization
   */
  registerComputed<T>(computed: Computed<T>): void {
    if (computed.isSerializable) {
      this.computedMap.set(computed.id, computed as Computed<unknown>);
    }
  }

  /**
   * Capture all signals
   */
  captureSignals(): Record<string, SerializedSignal> {
    const serialized: Record<string, SerializedSignal> = {};

    for (const [id, signal] of this.signalMap) {
      try {
        const value = signal();

        // Only serialize JSON-safe values
        if (this.isSerializable(value)) {
          serialized[id] = {
            id,
            value,
            dependents: Array.from(signal.dependents)
              .filter((dep) => 'isDirty' in dep) // Only computeds
              .map((dep) => dep.id),
            isSerializable: true,
          };
        }
      } catch (error) {
        console.warn(`Failed to serialize signal ${id}:`, error);
      }
    }

    return serialized;
  }

  /**
   * Capture all computed values
   */
  captureComputeds(): Record<string, SerializedComputed> {
    const serialized: Record<string, SerializedComputed> = {};

    for (const [id, computed] of this.computedMap) {
      try {
        const value = computed();

        if (this.isSerializable(value)) {
          const serializedComputed: SerializedComputed = {
            id,
            value,
            dependencies: Array.from(computed.dependencies).map((dep) => dep.id),
            isDirty: computed.isDirty,
          };

          // Add function source only if enabled
          if (this.config.serializeFunctions) {
            serializedComputed.fnSource = computed.toString();
          }

          serialized[id] = serializedComputed;
        }
      } catch (error) {
        console.warn(`Failed to serialize computed ${id}:`, error);
      }
    }

    return serialized;
  }

  /**
   * Create complete snapshot
   */
  createSnapshot(options: {
    route: string;
    locale?: string;
    custom?: Record<string, unknown>;
  }): ResumabilitySnapshot {
    const snapshot: ResumabilitySnapshot = {
      version: RESUME_SCHEMA_VERSION,
      timestamp: Date.now(),
      signals: this.captureSignals(),
      computeds: this.captureComputeds(),
      nodes: {}, // Will be populated by runtime-dom
      components: {}, // Will be populated by framework
      islands: {}, // Will be populated by runtime-dom
      meta: {
        route: options.route,
      },
    };

    // Add optional properties if present
    if (options.locale !== undefined) {
      snapshot.meta.locale = options.locale;
    }
    if (options.custom !== undefined) {
      snapshot.meta.custom = options.custom;
    }

    return snapshot;
  }

  /**
   * Serialize snapshot to JSON string
   */
  serializeToJSON(snapshot: ResumabilitySnapshot): string {
    const json = JSON.stringify(snapshot);

    // Check size
    const sizeBytes = new TextEncoder().encode(json).length;
    if (sizeBytes > this.config.maxSnapshotSize) {
      console.warn(
        `Resumability snapshot size (${sizeBytes} bytes) exceeds maximum (${this.config.maxSnapshotSize} bytes)`
      );
    }

    return json;
  }

  /**
   * Embed snapshot in HTML script tag
   */
  embedInHTML(snapshot: ResumabilitySnapshot): string {
    const json = this.serializeToJSON(snapshot);

    // Escape for HTML
    const escaped = json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

    return `<script type="application/plank-resume" id="plank-resume-data">${escaped}</script>`;
  }

  /**
   * Check if value is JSON-serializable
   */
  private isSerializable(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    const type = typeof value;

    // Primitives are serializable
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }

    // Functions are not serializable (unless explicitly enabled)
    if (type === 'function') {
      return false;
    }

    // Symbols are not serializable
    if (type === 'symbol') {
      return false;
    }

    // Check for circular references and deep serializability
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all registered signals and computeds
   */
  clear(): void {
    this.signalMap.clear();
    this.computedMap.clear();
  }

  /**
   * Get statistics about current state
   */
  getStats(): {
    signals: number;
    computeds: number;
    totalSize: number;
  } {
    const snapshot = this.createSnapshot({ route: '/' });
    const json = this.serializeToJSON(snapshot);

    return {
      signals: Object.keys(snapshot.signals).length,
      computeds: Object.keys(snapshot.computeds).length,
      totalSize: new TextEncoder().encode(json).length,
    };
  }
}

/**
 * Create a new serializer instance
 */
export function createSerializer(config?: Partial<ResumeConfig>): ResumabilitySerializer {
  return new ResumabilitySerializer(config);
}
