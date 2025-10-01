/**
 * @fileoverview Register React components as Plank islands
 */

import { registerIsland } from '@plank/runtime-dom';
import type { ComponentType } from 'react';
import type { ReactIslandOptions } from './react-island.js';
import { wrapReactComponent } from './react-island.js';

/**
 * Register a React component as a Plank island
 */
export function registerReactIsland<P = Record<string, unknown>>(
  src: string,
  Component: ComponentType<P>,
  options?: ReactIslandOptions
): void {
  const island = wrapReactComponent(Component, options);
  // biome-ignore lint/suspicious/noExplicitAny: IslandComponent types are compatible but TS can't infer generic properly
  registerIsland(src, island as any);
}

/**
 * Register multiple React components as islands
 */
export function registerReactIslands(islands: Record<string, ComponentType>): void {
  for (const [src, Component] of Object.entries(islands)) {
    registerReactIsland(src, Component);
  }
}
