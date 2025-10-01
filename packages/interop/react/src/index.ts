/**
 * @fileoverview React interop for Plank framework
 * @module @plank/react
 */

export {
  createPlankSignal,
  useSignal,
  useSyncToSignal,
} from './react-bridge.js';
export {
  createReactIsland,
  type ReactIslandOptions,
  wrapReactComponent,
} from './react-island.js';

export {
  registerReactIsland,
  registerReactIslands,
} from './register.js';
