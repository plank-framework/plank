/**
 * @fileoverview Tests for React interop index exports
 */

import { describe, expect, it } from 'vitest';

describe('@plank/react exports', () => {
  it('should export all expected functions and types', async () => {
    const module = await import('../index.js');

    // Test react-bridge exports
    expect(module.createPlankSignal).toBeDefined();
    expect(module.useSignal).toBeDefined();
    expect(module.useSyncToSignal).toBeDefined();

    // Test react-island exports
    expect(module.createReactIsland).toBeDefined();
    expect(module.wrapReactComponent).toBeDefined();

    // Test register exports
    expect(module.registerReactIsland).toBeDefined();
    expect(module.registerReactIslands).toBeDefined();
  });

  it('should export functions with correct types', async () => {
    const module = await import('../index.js');

    // Verify function types
    expect(typeof module.createPlankSignal).toBe('function');
    expect(typeof module.useSignal).toBe('function');
    expect(typeof module.useSyncToSignal).toBe('function');
    expect(typeof module.createReactIsland).toBe('function');
    expect(typeof module.wrapReactComponent).toBe('function');
    expect(typeof module.registerReactIsland).toBe('function');
    expect(typeof module.registerReactIslands).toBe('function');
  });

  it('should be importable as a module', async () => {
    // Test that the module can be imported without errors
    await expect(import('../index.js')).resolves.toBeDefined();
  });

  it('should have consistent exports', async () => {
    const module1 = await import('../index.js');
    const module2 = await import('../index.js');

    // Verify exports are consistent across imports
    expect(Object.keys(module1)).toEqual(Object.keys(module2));
  });
});
