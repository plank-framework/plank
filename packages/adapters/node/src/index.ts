/**
 * @fileoverview Node.js 20+ production adapter for Plank framework
 * @module @plank/adapter-node
 */

export { createNodeAdapter, NodeAdapter } from './adapter.js';
export {
  getBaseURL,
  nodeRequestToWebRequest,
} from './request-converter.js';
export {
  sendError,
  sendFile,
  sendWebResponse,
} from './response-handler.js';
export {
  getCacheControl,
  getMimeType,
  isSafePath,
  resolveStaticFile,
} from './static-files.js';
export type {
  NodeAdapterConfig,
  NodeRequestContext,
  NodeServer,
  StaticFileOptions,
} from './types.js';
