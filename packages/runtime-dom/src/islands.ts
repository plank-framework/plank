/**
 * @fileoverview Islands system for lazy loading components
 */

import { Signal, Computed, Effect, effect } from '@plank/runtime-core';

export interface IslandOptions {
  src: string;
  strategy: 'load' | 'idle' | 'visible' | 'interaction';
  fallback?: Element;
  props?: Record<string, any>;
}

export interface IslandComponent {
  mount: (element: Element, props?: Record<string, any>) => Effect;
  unmount: () => void;
  update?: (props: Record<string, any>) => void;
}

export interface IslandRegistry {
  [src: string]: IslandComponent;
}

/**
 * Global registry of island components
 */
const islandRegistry: IslandRegistry = {};

/**
 * Register an island component
 */
export function registerIsland(src: string, component: IslandComponent): void {
  islandRegistry[src] = component;
}

/**
 * Get an island component
 */
export function getIsland(src: string): IslandComponent | undefined {
  return islandRegistry[src];
}

/**
 * Load an island component dynamically
 */
export async function loadIsland(src: string): Promise<IslandComponent> {
  if (islandRegistry[src]) {
    return islandRegistry[src]!;
  }

  try {
    // Dynamic import of the island component
    const module = await import(src);
    const component = module.default || module;

    if (typeof component.mount !== 'function') {
      throw new Error(`Island component ${src} must export a mount function`);
    }

    islandRegistry[src] = component;
    return component;
  } catch (error) {
    console.error(`Failed to load island component ${src}:`, error);
    throw error;
  }
}

/**
 * Create an island element
 */
export function createIsland(options: IslandOptions): Element {
  const { src, strategy, fallback, props = {} } = options;

  const islandElement = document.createElement('div');
  islandElement.setAttribute('data-island', src);
  islandElement.setAttribute('data-strategy', strategy);

  // Add fallback content if provided
  if (fallback) {
    islandElement.appendChild(fallback.cloneNode(true));
  } else {
    islandElement.textContent = 'Loading...';
  }

  // Store props as data attributes
  Object.entries(props).forEach(([key, value]) => {
    islandElement.setAttribute(`data-prop-${key}`, String(value));
  });

  return islandElement;
}

/**
 * Mount an island component
 */
export async function mountIsland(
  element: Element,
  options: IslandOptions
): Promise<Effect | null> {
  const { src, props = {} } = options;

  try {
    const component = await loadIsland(src);

    // Clear fallback content
    element.innerHTML = '';

    // Mount the component
    const effect = component.mount(element, props);

    return effect;
  } catch (error) {
    console.error(`Failed to mount island ${src}:`, error);

    // Show error state
    element.innerHTML = `<div class="island-error">Failed to load component: ${src}</div>`;

    return null;
  }
}

/**
 * Unmount an island component
 */
export function unmountIsland(element: Element): void {
  const src = element.getAttribute('data-island');
  if (!src) return;

  const component = getIsland(src);
  if (component && component.unmount) {
    component.unmount();
  }

  // Clear the element
  element.innerHTML = '';
  element.removeAttribute('data-island');
  element.removeAttribute('data-strategy');
}

/**
 * Update island props
 */
export function updateIslandProps(
  element: Element,
  props: Record<string, any>
): void {
  const src = element.getAttribute('data-island');
  if (!src) return;

  const component = getIsland(src);
  if (component && component.update) {
    component.update(props);
  }

  // Update data attributes
  Object.entries(props).forEach(([key, value]) => {
    element.setAttribute(`data-prop-${key}`, String(value));
  });
}

/**
 * Strategy: Load immediately
 */
export function loadStrategy(element: Element, options: IslandOptions): Promise<Effect | null> {
  return mountIsland(element, options);
}

/**
 * Strategy: Load when idle
 */
export function idleStrategy(element: Element, options: IslandOptions): Promise<Effect | null> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        mountIsland(element, options).then(resolve);
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        mountIsland(element, options).then(resolve);
      }, 1);
    }
  });
}

/**
 * Strategy: Load when visible
 */
export function visibleStrategy(element: Element, options: IslandOptions): Promise<Effect | null> {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          mountIsland(element, options).then(resolve);
        }
      });
    });

    observer.observe(element);
  });
}

/**
 * Strategy: Load on interaction
 */
export function interactionStrategy(element: Element, options: IslandOptions): Promise<Effect | null> {
  return new Promise((resolve) => {
    const events = ['click', 'touchstart', 'keydown'];
    let mounted = false;

    const handleInteraction = () => {
      if (mounted) return;
      mounted = true;

      events.forEach(event => {
        element.removeEventListener(event, handleInteraction);
      });

      mountIsland(element, options).then(resolve);
    };

    events.forEach(event => {
      element.addEventListener(event, handleInteraction, { once: true });
    });
  });
}

/**
 * Strategy handlers
 */
const strategyHandlers = {
  load: loadStrategy,
  idle: idleStrategy,
  visible: visibleStrategy,
  interaction: interactionStrategy
};

/**
 * Initialize an island with the specified strategy
 */
export function initializeIsland(
  element: Element,
  options: IslandOptions
): Promise<Effect | null> {
  const { strategy } = options;
  const handler = strategyHandlers[strategy];

  if (!handler) {
    console.warn(`Unknown island strategy: ${strategy}`);
    return Promise.resolve(null);
  }

  return handler(element, options);
}

/**
 * Initialize all islands on the page
 */
export function initializeAllIslands(): Promise<Effect[]> {
  const islandElements = document.querySelectorAll('[data-island]');
  const promises: Promise<Effect | null>[] = [];

  islandElements.forEach((element) => {
    const src = element.getAttribute('data-island');
    const strategy = element.getAttribute('data-strategy') as IslandOptions['strategy'];

    if (!src || !strategy) {
      console.warn('Island element missing src or strategy attribute');
      return;
    }

    // Extract props from data attributes
    const props: Record<string, any> = {};
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-prop-')) {
        const key = attr.name.replace('data-prop-', '');
        props[key] = attr.value;
      }
    });

    const options: IslandOptions = {
      src,
      strategy,
      props
    };

    promises.push(initializeIsland(element, options));
  });

  return Promise.all(promises).then(effects =>
    effects.filter((effect): effect is Effect => effect !== null)
  );
}

/**
 * Clean up all islands
 */
export function cleanupAllIslands(): void {
  const islandElements = document.querySelectorAll('[data-island]');
  islandElements.forEach(unmountIsland);
}

/**
 * Create a signal-based island that updates when props change
 */
export function createSignalIsland(
  src: string,
  propsSignal: Signal<Record<string, any>>
): Element {
  const element = createIsland({
    src,
    strategy: 'load',
    props: propsSignal()
  });

  // Update props when signal changes
  effect(() => {
    const props = propsSignal();
    updateIslandProps(element, props);
  });

  return element;
}

/**
 * Create a computed island that updates when dependencies change
 */
export function createComputedIsland(
  src: string,
  propsComputed: Computed<Record<string, any>>
): Element {
  const element = createIsland({
    src,
    strategy: 'load',
    props: propsComputed()
  });

  // Update props when computed changes
  effect(() => {
    const props = propsComputed();
    updateIslandProps(element, props);
  });

  return element;
}
