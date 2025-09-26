/**
 * @fileoverview Types for server-side rendering
 */

/**
 * Server-side rendering context
 */
export interface SSRContext {
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Route parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Server-side data */
  data: Record<string, unknown>;
  /** Streaming options */
  streaming?: StreamingOptions;
}

/**
 * Streaming configuration
 */
export interface StreamingOptions {
  /** Enable streaming HTML output */
  enabled: boolean;
  /** Chunk size for streaming */
  chunkSize?: number;
  /** Timeout for streaming operations */
  timeout?: number;
  /** Placeholder for loading states */
  placeholder?: string;
}

/**
 * Server-side rendering result
 */
export interface SSRResult {
  /** Rendered HTML */
  html: string;
  /** Streaming response if enabled */
  stream?: ReadableStream<Uint8Array>;
  /** Metadata about the render */
  metadata: {
    /** Time taken to render */
    renderTime: number;
    /** Number of islands detected */
    islandCount: number;
    /** Number of server actions detected */
    actionCount: number;
    /** Size of rendered HTML */
    htmlSize: number;
  };
}

/**
 * Template renderer function
 */
export type TemplateRenderer = (context: SSRContext) => Promise<SSRResult>;

/**
 * Island component definition
 */
export interface IslandComponent {
  /** Component source path */
  src: string;
  /** Component props */
  props: Record<string, unknown>;
  /** Loading strategy */
  strategy: 'load' | 'idle' | 'visible' | 'interaction';
  /** Unique identifier */
  id: string;
}

/**
 * Server action definition
 */
export interface ServerAction {
  /** Action name */
  name: string;
  /** Action handler function */
  handler: (data: unknown, context: SSRContext) => Promise<unknown>;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Validation schema */
  schema?: unknown;
}

/**
 * SSR configuration
 */
export interface SSRConfig {
  /** Template directory */
  templateDir: string;
  /** Static assets directory */
  assetsDir: string;
  /** Base URL for assets */
  baseUrl: string;
  /** Enable streaming by default */
  streaming: boolean;
  /** Default streaming options */
  streamingOptions: StreamingOptions;
  /** Custom template renderers */
  renderers: Record<string, TemplateRenderer>;
  /** Island components */
  islands: Record<string, IslandComponent>;
  /** Server actions */
  actions: Record<string, ServerAction>;
}
