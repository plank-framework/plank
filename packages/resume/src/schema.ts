/**
 * @fileoverview Resumability serialization schema
 *
 * Defines the format for serializing reactive state, event listeners,
 * and component boundaries for client-side resumption without re-execution.
 */

/**
 * Schema version for compatibility checking
 */
export const RESUME_SCHEMA_VERSION = '1.0.0';

/**
 * Serialized signal state
 */
export interface SerializedSignal {
  /** Signal ID */
  id: string;
  /** Current value (must be JSON-serializable) */
  value: unknown;
  /** IDs of dependent computed signals */
  dependents: string[];
  /** Whether this signal is serializable */
  isSerializable: boolean;
}

/**
 * Serialized computed state
 */
export interface SerializedComputed {
  /** Computed ID */
  id: string;
  /** Current computed value */
  value: unknown;
  /** IDs of signals/computeds this depends on */
  dependencies: string[];
  /** Whether this computed is dirty */
  isDirty: boolean;
  /** Computation function source (for recreation) */
  fnSource?: string | undefined;
}

/**
 * Serialized event listener
 */
export interface SerializedListener {
  /** Event type (click, submit, input, etc.) */
  event: string;
  /** Handler function ID */
  handlerId: string;
  /** Handler function source (for recreation) */
  handlerSource?: string;
  /** Additional event listener options */
  options?: AddEventListenerOptions;
}

/**
 * Serialized DOM node reference
 */
export interface SerializedNode {
  /** Stable node ID for matching */
  nodeId: string;
  /** Node tag name */
  tagName: string;
  /** Data attributes for identification */
  dataAttrs: Record<string, string>;
  /** Event listeners attached to this node */
  listeners: SerializedListener[];
}

/**
 * Serialized component state
 */
export interface SerializedComponent {
  /** Component ID */
  id: string;
  /** Component type/name */
  type: string;
  /** Component props */
  props: Record<string, unknown>;
  /** Component internal state */
  state: Record<string, unknown>;
  /** Signal IDs owned by this component */
  signals: string[];
  /** Child component IDs */
  children: string[];
}

/**
 * Serialized island metadata
 */
export interface SerializedIsland {
  /** Island ID */
  id: string;
  /** Island source file path */
  src: string;
  /** Hydration strategy */
  strategy: 'load' | 'idle' | 'visible';
  /** Island props */
  props: Record<string, unknown>;
  /** Node ID where island is mounted */
  mountNodeId: string;
  /** Whether island has been hydrated */
  isHydrated: boolean;
}

/**
 * Complete resumability snapshot
 */
export interface ResumabilitySnapshot {
  /** Schema version for compatibility */
  version: string;
  /** Timestamp when snapshot was created */
  timestamp: number;

  /** All serialized signals */
  signals: Record<string, SerializedSignal>;
  /** All serialized computed values */
  computeds: Record<string, SerializedComputed>;
  /** All serialized DOM nodes with listeners */
  nodes: Record<string, SerializedNode>;
  /** All serialized components */
  components: Record<string, SerializedComponent>;
  /** All serialized islands */
  islands: Record<string, SerializedIsland>;

  /** Application-level metadata */
  meta: {
    /** Current route */
    route: string;
    /** Locale/language */
    locale?: string | undefined;
    /** Custom metadata */
    custom?: Record<string, unknown> | undefined;
  };
}

/**
 * Resumability configuration
 */
export interface ResumeConfig {
  /** Enable resumability (default: true) */
  enabled?: boolean;
  /** Serialize function sources (default: false, security risk) */
  serializeFunctions?: boolean;
  /** Maximum snapshot size in bytes (default: 1MB) */
  maxSnapshotSize?: number;
  /** Compression (default: true) */
  compress?: boolean;
  /** Version compatibility strategy */
  versionStrategy?: 'strict' | 'compatible' | 'ignore';
}

/**
 * Resume options for client bootstrap
 */
export interface ResumeOptions {
  /** Fallback to partial hydration if resume fails */
  fallbackToHydration?: boolean;
  /** Timeout for resume operation in ms */
  timeout?: number;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Progress callback */
  onProgress?: (step: string, progress: number) => void;
}

/**
 * Resume result
 */
export interface ResumeResult {
  /** Whether resume was successful */
  success: boolean;
  /** Error if resume failed */
  error?: Error;
  /** Fallback method used if any */
  fallback?: 'partial-hydration' | 'full-hydration';
  /** Metrics */
  metrics: {
    /** Time to resume in ms */
    resumeTime: number;
    /** Number of signals restored */
    signalsRestored: number;
    /** Number of listeners restored */
    listenersRestored: number;
    /** Number of components resumed */
    componentsResumed: number;
  };
}
