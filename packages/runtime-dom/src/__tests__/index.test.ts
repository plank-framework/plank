/**
 * @fileoverview Tests for runtime-dom index exports
 */

import { describe, expect, test } from 'vitest';

describe('@plank/runtime-dom exports', () => {
  test('should export core runtime functions', async () => {
    const module = await import('../index.js');

    // Test core runtime exports
    expect(module.signal).toBeDefined();
    expect(module.computed).toBeDefined();
    expect(module.effect).toBeDefined();
    expect(module.batch).toBeDefined();

    // Test that they are functions
    expect(typeof module.signal).toBe('function');
    expect(typeof module.computed).toBe('function');
    expect(typeof module.effect).toBe('function');
    expect(typeof module.batch).toBe('function');
  });

  test('should export DOM-specific modules', async () => {
    const module = await import('../index.js');

    // Test that DOM-specific exports exist
    expect(module.executeDOMIR).toBeDefined();
    expect(module.removeElement).toBeDefined();
    expect(module.createViewTransitions).toBeDefined();
    expect(module.FocusManager).toBeDefined();
    expect(module.createFocusManager).toBeDefined();
  });
});
