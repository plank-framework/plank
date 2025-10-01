/**
 * @fileoverview React component wrapper for Plank islands
 */

import { effect } from '@plank/runtime-core';
import type { IslandComponent } from '@plank/runtime-dom';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

/**
 * React island options
 */
export interface ReactIslandOptions {
  /** Render function (for advanced use cases) */
  render?: (Component: ComponentType, props: Record<string, unknown>) => ReactElement;
  /** Error boundary component */
  errorBoundary?: ComponentType<{ children: ReactNode }>;
}

/**
 * Wrap a React component as a Plank island
 */
export function wrapReactComponent<P = Record<string, unknown>>(
  Component: ComponentType<P>,
  options: ReactIslandOptions = {}
): IslandComponent<P> {
  let root: Root | null = null;

  return {
    mount: (element: Element, props?: P) => {
      // Create React root
      root = createRoot(element);

      // Render component
      const reactElement = options.render
        ? options.render(Component as ComponentType, props as Record<string, unknown>)
        : createElement(
            Component as ComponentType<Record<string, unknown>>,
            (props as Record<string, unknown>) ?? {}
          );

      // Wrap in error boundary if provided
      const finalElement = options.errorBoundary
        ? createElement(options.errorBoundary, null, reactElement)
        : reactElement;

      root.render(finalElement);

      // Return effect (React manages its own reactivity)
      return effect(() => {
        // React handles reactivity internally
        // This effect is just for Plank's lifecycle tracking
      });
    },

    unmount: () => {
      if (root) {
        root.unmount();
        root = null;
      }
    },

    update: (newProps: P) => {
      if (root) {
        const reactElement = options.render
          ? options.render(Component as ComponentType, newProps as Record<string, unknown>)
          : createElement(
              Component as ComponentType<Record<string, unknown>>,
              newProps as Record<string, unknown>
            );

        const finalElement = options.errorBoundary
          ? createElement(options.errorBoundary, null, reactElement)
          : reactElement;

        root.render(finalElement);
      }
    },
  };
}

/**
 * Create a React island from a component
 */
export function createReactIsland<P = Record<string, unknown>>(
  Component: ComponentType<P>,
  options?: ReactIslandOptions
): IslandComponent<P> {
  return wrapReactComponent(Component, options);
}
