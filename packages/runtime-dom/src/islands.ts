/**
 * @fileoverview Islands system for lazy loading components
 */

import { type Computed, type Effect, effect, type Signal } from '@plank/runtime-core';

export interface IslandOptions<T = Record<string, unknown>> {
  src: string;
  strategy: 'load' | 'idle' | 'visible' | 'interaction';
  fallback?: Element;
  props?: T;
}

export interface IslandComponent<T = Record<string, unknown>> {
  mount: (element: Element, props?: T) => Effect;
  unmount: () => void;
  update?: (props: T) => void;
  template?: string;
}

export interface IslandRegistry {
  [src: string]: IslandComponent<Record<string, unknown>>;
}

/**
 * Global registry of island components
 */
const islandRegistry: IslandRegistry = {};

/**
 * Register an island component
 */
export function registerIsland<T = Record<string, unknown>>(
  src: string,
  component: IslandComponent<T>
): void {
  islandRegistry[src] = component as IslandComponent<Record<string, unknown>>;
}

/**
 * Get an island component
 */
export function getIsland<T = Record<string, unknown>>(
  src: string
): IslandComponent<T> | undefined {
  return islandRegistry[src] as IslandComponent<T> | undefined;
}

/**
 * Load an island component dynamically
 */
export async function loadIsland<T = Record<string, unknown>>(
  src: string
): Promise<IslandComponent<T>> {
  const existing = islandRegistry[src];
  if (existing) {
    return existing as IslandComponent<T>;
  }

  try {
    // Dynamic import of the island component
    const module = await import(src);
    const component = module.default || module;

    if (typeof component.mount !== 'function') {
      throw new Error(`Island component ${src} must export a mount function`);
    }

    islandRegistry[src] = component;
    return component as IslandComponent<T>;
  } catch (error) {
    console.error(`Failed to load island component ${src}:`, error);
    throw error;
  }
}

/**
 * Create an island element
 */
export function createIsland<T = Record<string, unknown>>(options: IslandOptions<T>): Element {
  const { src, strategy, fallback, props = {} as T } = options;

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
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    islandElement.setAttribute(`data-prop-${key}`, String(value));
  }

  return islandElement;
}

/**
 * Mount an island component
 */
export async function mountIsland<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
): Promise<Effect | null> {
  const { src, props = {} as T } = options;

  try {
    const component = await loadIsland<T>(src);

    // If the component has a template, replace the placeholder content BEFORE mounting
    if (component.template && typeof component.template === 'string') {
      element.innerHTML = component.template;
    }

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
  if (component?.unmount) {
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
export function updateIslandProps<T = Record<string, unknown>>(element: Element, props: T): void {
  const src = element.getAttribute('data-island');

  if (src) {
    const component = getIsland<T>(src);
    if (component?.update) {
      component.update(props);
    }
  }

  // Update data attributes
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    element.setAttribute(`data-prop-${key}`, String(value));
  }
}

/**
 * Strategy: Load immediately
 */
export function loadStrategy<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
): Promise<Effect | null> {
  return mountIsland(element, options);
}

/**
 * Strategy: Load when idle
 */
export function idleStrategy<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
): Promise<Effect | null> {
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
export function visibleStrategy<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
): Promise<Effect | null> {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          mountIsland(element, options).then(resolve);
          break;
        }
      }
    });

    observer.observe(element);
  });
}

/**
 * Strategy: Load on interaction
 */
export function interactionStrategy<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
): Promise<Effect | null> {
  return new Promise((resolve) => {
    const events = ['click', 'touchstart', 'keydown'];
    let mounted = false;

    const handleInteraction = () => {
      if (mounted) return;
      mounted = true;

      for (const event of events) {
        element.removeEventListener(event, handleInteraction);
      }

      mountIsland(element, options).then(resolve);
    };

    for (const event of events) {
      element.addEventListener(event, handleInteraction, { once: true });
    }
  });
}

/**
 * Strategy handlers
 */
const strategyHandlers = {
  load: loadStrategy as <T = Record<string, unknown>>(
    element: Element,
    options: IslandOptions<T>
  ) => Promise<Effect | null>,
  idle: idleStrategy as <T = Record<string, unknown>>(
    element: Element,
    options: IslandOptions<T>
  ) => Promise<Effect | null>,
  visible: visibleStrategy as <T = Record<string, unknown>>(
    element: Element,
    options: IslandOptions<T>
  ) => Promise<Effect | null>,
  interaction: interactionStrategy as <T = Record<string, unknown>>(
    element: Element,
    options: IslandOptions<T>
  ) => Promise<Effect | null>,
};

/**
 * Initialize an island with the specified strategy
 */
export function initializeIsland<T = Record<string, unknown>>(
  element: Element,
  options: IslandOptions<T>
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

  for (const element of islandElements) {
    const src = element.getAttribute('data-island');
    const strategy = element.getAttribute('data-strategy') as IslandOptions['strategy'];

    if (!src || !strategy) {
      console.warn('Island element missing src or strategy attribute');
      continue;
    }

    // Extract props from data attributes
    const props: Record<string, unknown> = {};
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-prop-')) {
        const key = attr.name.replace('data-prop-', '');
        props[key] = attr.value;
      }
    }

    const options: IslandOptions = {
      src,
      strategy,
      props,
    };

    promises.push(initializeIsland(element, options));
  }

  return Promise.all(promises).then((effects) =>
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
export function createSignalIsland<T = Record<string, unknown>>(
  src: string,
  propsSignal: Signal<T>
): Element {
  const element = createIsland<T>({
    src,
    strategy: 'load',
    props: propsSignal(),
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
export function createComputedIsland<T = Record<string, unknown>>(
  src: string,
  propsComputed: Computed<T>
): Element {
  const element = createIsland<T>({
    src,
    strategy: 'load',
    props: propsComputed(),
  });

  // Update props when computed changes
  effect(() => {
    const props = propsComputed();
    updateIslandProps(element, props);
  });

  return element;
}

/**
 * Hydrate all islands on the page
 * This is the main entry point for island hydration
 */
export async function hydrateIslands(): Promise<void> {
  try {
    const effects = await initializeAllIslands();
    console.log(`Hydrated ${effects.length} islands`);
  } catch (error) {
    console.error('Failed to hydrate islands:', error);
  }
}
