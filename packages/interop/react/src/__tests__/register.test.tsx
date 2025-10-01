/**
 * @fileoverview Tests for React island registration
 */

import { getIsland } from '@plank/runtime-dom';
import { describe, expect, it } from 'vitest';
import { registerReactIsland, registerReactIslands } from '../register.js';

function TestComponent() {
  return <div>Test Component</div>;
}

function AnotherComponent() {
  return <div>Another Component</div>;
}

describe('registerReactIsland', () => {
  it('should register React component as island', () => {
    registerReactIsland('./TestComponent.tsx', TestComponent);

    const island = getIsland('./TestComponent.tsx');

    expect(island).toBeDefined();
    expect(typeof island?.mount).toBe('function');
  });
});

describe('registerReactIslands', () => {
  it('should register multiple React components', () => {
    registerReactIslands({
      './Component1.tsx': TestComponent,
      './Component2.tsx': AnotherComponent,
    });

    expect(getIsland('./Component1.tsx')).toBeDefined();
    expect(getIsland('./Component2.tsx')).toBeDefined();
  });
});
