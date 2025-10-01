/**
 * @fileoverview Tests for focus management
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createFocusManager } from '../focus-management.js';

describe('FocusManager', () => {
  let focusManager: ReturnType<typeof createFocusManager>;

  beforeEach(() => {
    document.body.innerHTML = '';
    focusManager = createFocusManager();
  });

  it('should create focus manager', () => {
    expect(focusManager).toBeDefined();
  });

  it('should save and restore focus', () => {
    const button = document.createElement('button');
    button.textContent = 'Test';
    document.body.appendChild(button);

    button.focus();
    focusManager.saveFocus();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    focusManager.restoreFocus();

    expect(document.activeElement).toBe(button);
  });

  it('should focus main content', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);

    focusManager.focusMain();

    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('should focus main with existing tabindex', () => {
    const main = document.createElement('main');
    main.setAttribute('tabindex', '-1');
    document.body.appendChild(main);

    focusManager.focusMain();

    expect(document.activeElement).toBe(main);
  });

  it('should focus role=main', () => {
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    document.body.appendChild(main);

    focusManager.focusMain();

    expect(document.activeElement).toBe(main);
  });

  it('should create skip link', () => {
    const skipLink = focusManager.createSkipLink();

    expect(skipLink.textContent).toBe('Skip to main content');
    expect(skipLink.href).toContain('#main');
    expect(document.body.contains(skipLink)).toBe(true);
  });

  it('should create skip link with custom text', () => {
    const skipLink = focusManager.createSkipLink('Jump to content', '#content');

    expect(skipLink.textContent).toBe('Jump to content');
    expect(skipLink.href).toContain('#content');
  });

  it('should remove skip link', () => {
    const skipLink = focusManager.createSkipLink();
    expect(document.body.contains(skipLink)).toBe(true);

    focusManager.removeSkipLink('main');
    expect(document.body.contains(skipLink)).toBe(false);
  });

  it('should announce page changes', () => {
    focusManager.announcePageChange('Welcome to About page');

    const announcer = document.getElementById('plank-announcer');
    expect(announcer).toBeDefined();
    expect(announcer?.textContent).toBe('Welcome to About page');
    expect(announcer?.getAttribute('role')).toBe('status');
    expect(announcer?.getAttribute('aria-live')).toBe('polite');
  });

  it('should get focusable elements', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <a href="/test">Link</a>
      <button>Button</button>
      <input type="text" />
      <button disabled>Disabled</button>
      <div tabindex="0">Focusable</div>
      <div tabindex="-1">Not focusable</div>
    `;
    document.body.appendChild(container);

    const focusable = focusManager.getFocusableElements(container);

    expect(focusable).toHaveLength(4); // link, button, input, div with tabindex=0
  });

  it('should trap focus within container', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="first">First</button>
      <button id="middle">Middle</button>
      <button id="last">Last</button>
    `;
    document.body.appendChild(container);

    const cleanup = focusManager.trapFocus(container);

    expect(cleanup).toBeInstanceOf(Function);

    // Clean up
    cleanup();
  });
});
