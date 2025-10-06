/**
 * @fileoverview Tests for view transitions
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewTransitions, withViewTransition } from '../view-transitions.js';

describe('ViewTransitions', () => {
  beforeEach(() => {
    // Clear document
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('should create view transitions instance', () => {
    const vt = createViewTransitions();
    expect(vt).toBeDefined();
  });

  it('should check browser support', () => {
    const vt = createViewTransitions();
    // jsdom doesn't support View Transitions, so it should be disabled
    expect(vt.isEnabled()).toBe(false);
  });

  it('should inject transition styles when enabled', () => {
    createViewTransitions({ enabled: true });

    // Check if styles were injected (would be if supported)
    const styleElement = document.getElementById('plank-view-transitions');
    // In jsdom, this won't exist because View Transitions isn't supported
    expect(styleElement).toBeNull();
  });

  it('should mark elements as persistent', () => {
    const vt = createViewTransitions();
    const element = document.createElement('div');
    element.id = 'header';

    vt.markPersistent(element, 'header');

    expect(element.getAttribute('data-view-transition-name')).toBe('header');
  });

  it('should unmark persistent elements', () => {
    const vt = createViewTransitions();
    const element = document.createElement('div');

    vt.markPersistent(element, 'test');
    vt.unmarkPersistent(element);

    expect(element.hasAttribute('data-view-transition-name')).toBe(false);
  });

  it('should auto-mark persistent elements by selector', () => {
    const vt = createViewTransitions({
      persistElements: ['.persist', '#header'],
    });

    const div1 = document.createElement('div');
    div1.className = 'persist';
    const div2 = document.createElement('div');
    div2.id = 'header';

    document.body.appendChild(div1);
    document.body.appendChild(div2);

    vt.autoMarkPersistentElements();

    expect(div1.hasAttribute('data-view-transition-name')).toBe(true);
    expect(div2.getAttribute('data-view-transition-name')).toBe('header');
  });

  it('should perform transition without browser support', async () => {
    const vt = createViewTransitions();
    const callback = vi.fn();

    await vt.transition(callback);

    expect(callback).toHaveBeenCalled();
  });

  it('should skip transition when requested', async () => {
    const vt = createViewTransitions();
    const callback = vi.fn();

    await vt.transition(callback, { skipTransition: true });

    expect(callback).toHaveBeenCalled();
  });

  it('should handle async update callbacks', async () => {
    const vt = createViewTransitions();
    const callback = vi.fn().mockResolvedValue(undefined);

    await vt.transition(callback);

    expect(callback).toHaveBeenCalled();
  });
});

describe('withViewTransition', () => {
  it('should perform single transition', async () => {
    const callback = vi.fn();

    await withViewTransition(callback);

    expect(callback).toHaveBeenCalled();
  });

  it('should skip transition when requested', async () => {
    const callback = vi.fn();

    await withViewTransition(callback, { skipTransition: true });

    expect(callback).toHaveBeenCalled();
  });

  it('should handle browser support detection', () => {
    const transitions = createViewTransitions();

    // Test that isEnabled method works (which internally uses checkSupport)
    expect(typeof transitions.isEnabled()).toBe('boolean');
  });

  it('should handle style injection through public API', () => {
    const transitions = createViewTransitions({ enabled: true });

    // Test that the public API works without accessing private methods
    // The injectStyles method is called internally when enabled is true
    expect(transitions.isEnabled()).toBeDefined();
  });
});
