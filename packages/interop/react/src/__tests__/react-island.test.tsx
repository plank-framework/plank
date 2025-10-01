/**
 * @fileoverview Tests for React island wrapper
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReactIsland, wrapReactComponent } from '../react-island.js';

// Simple React component for testing
function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = React.useState(initial);

  return (
    <div>
      <p data-testid="count">Count: {count}</p>
      <button type="button" onClick={() => setCount(count + 1)} data-testid="increment">
        Increment
      </button>
    </div>
  );
}

// Import React after defining the component
import React from 'react';

describe('wrapReactComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should wrap React component as island', () => {
    const island = wrapReactComponent(Counter);

    expect(island).toBeDefined();
    expect(typeof island.mount).toBe('function');
    expect(typeof island.unmount).toBe('function');
    expect(typeof island.update).toBe('function');
  });

  it('should mount React component', async () => {
    const island = wrapReactComponent(Counter);

    const effect = island.mount(container, { initial: 5 });

    // Wait for React to render
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="count"]')?.textContent).toContain('5');
    expect(effect).toBeDefined();
    expect(typeof effect.stop).toBe('function');
  });

  it('should unmount React component', async () => {
    const island = wrapReactComponent(Counter);

    island.mount(container, { initial: 0 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="count"]')).toBeDefined();

    island.unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.innerHTML).toBe('');
  });

  it('should update React component props', async () => {
    // Component that responds to prop updates
    function DynamicCounter({ value }: { value: number }) {
      return <div data-testid="value">Value: {value}</div>;
    }

    const island = wrapReactComponent(DynamicCounter);

    island.mount(container, { value: 5 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="value"]')?.textContent).toContain('5');

    island.update?.({ value: 10 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="value"]')?.textContent).toContain('10');
  });

  it('should handle component without props', async () => {
    function SimpleComponent() {
      return <div data-testid="simple">Hello</div>;
    }

    const island = wrapReactComponent(SimpleComponent);

    island.mount(container);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="simple"]')?.textContent).toBe('Hello');
  });
});

describe('createReactIsland', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should create React island', () => {
    const island = createReactIsland(Counter);

    expect(island).toBeDefined();
    expect(typeof island.mount).toBe('function');
  });

  it('should mount and render component', async () => {
    const island = createReactIsland(Counter);

    island.mount(container, { initial: 42 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('[data-testid="count"]')?.textContent).toContain('42');
  });
});
