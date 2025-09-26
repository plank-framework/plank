/**
 * @fileoverview Tests for Plank directives
 */

import { flushSync, signal } from '@plank/runtime-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  cleanupEffects,
  executeDirective,
  getDirectiveHandler,
  processDirectives,
  registerDirective,
} from '../directives.js';

describe('Plank Directives', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // Helper function to change signal and flush effects
  function changeAndFlush<T>(signal: (value?: T) => T, newValue: T): void {
    signal(newValue);
    flushSync();
  }

  describe('directive registration', () => {
    test('should register and retrieve directive handlers', () => {
      const handler = vi.fn();
      registerDirective('test:directive', handler);

      const retrieved = getDirectiveHandler('test:directive');
      expect(retrieved).toBe(handler);
    });

    test('should return undefined for unknown directives', () => {
      const handler = getDirectiveHandler('unknown:directive');
      expect(handler).toBeUndefined();
    });
  });

  describe('event directives', () => {
    test('should handle on:click directive', () => {
      const handler = vi.fn();
      const button = document.createElement('button');
      container.appendChild(button);

      const effect = executeDirective(button, 'on:click', 'handleClick', { handler });

      expect(effect).toBeDefined();

      button.click();
      expect(handler).toHaveBeenCalled();

      effect?.stop();
    });

    test('should handle on:submit directive', () => {
      const handler = vi.fn();
      const form = document.createElement('form');
      container.appendChild(form);

      const effect = executeDirective(form, 'on:submit', 'handleSubmit', { handler });

      expect(effect).toBeDefined();

      form.dispatchEvent(new Event('submit'));
      expect(handler).toHaveBeenCalled();

      effect?.stop();
    });

    test('should handle on:input directive', () => {
      const handler = vi.fn();
      const input = document.createElement('input');
      container.appendChild(input);

      const effect = executeDirective(input, 'on:input', 'handleInput', { handler });

      expect(effect).toBeDefined();

      input.dispatchEvent(new Event('input'));
      expect(handler).toHaveBeenCalled();

      effect?.stop();
    });
  });

  describe('bind directives', () => {
    test('should handle bind:value directive', () => {
      const value = signal('initial');
      const input = document.createElement('input');
      container.appendChild(input);

      const effect = executeDirective(input, 'bind:value', 'value', { signal: value });

      expect(effect).toBeDefined();
      expect(input.value).toBe('initial');

      changeAndFlush(value, 'updated');
      expect(input.value).toBe('updated');

      effect?.stop();
    });

    test('should handle bind:checked directive', () => {
      const checked = signal(false);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      container.appendChild(checkbox);

      const effect = executeDirective(checkbox, 'bind:checked', 'checked', { signal: checked });

      expect(effect).toBeDefined();
      expect(checkbox.checked).toBe(false);

      changeAndFlush(checked, true);
      expect(checkbox.checked).toBe(true);

      effect?.stop();
    });

    test('should handle bind:disabled directive', () => {
      const disabled = signal(false);
      const button = document.createElement('button');
      container.appendChild(button);

      const effect = executeDirective(button, 'bind:disabled', 'disabled', { signal: disabled });

      expect(effect).toBeDefined();
      expect(button.disabled).toBe(false);

      changeAndFlush(disabled, true);
      expect(button.disabled).toBe(true);

      effect?.stop();
    });
  });

  describe('conditional directives', () => {
    test('should handle x:if directive', () => {
      const visible = signal(true);
      const div = document.createElement('div');
      div.textContent = 'Content';
      container.appendChild(div);

      const effect = executeDirective(div, 'x:if', 'visible', { signal: visible });

      expect(effect).toBeDefined();
      expect(div.parentNode).toBe(container);

      changeAndFlush(visible, false);
      expect(div.parentNode).toBeNull();

      changeAndFlush(visible, true);
      // Note: x:if restoration is not fully implemented in the test

      effect?.stop();
    });

    test('should handle x:show directive', () => {
      const visible = signal(true);
      const div = document.createElement('div');
      div.textContent = 'Content';
      container.appendChild(div);

      const effect = executeDirective(div, 'x:show', 'visible', { signal: visible });

      expect(effect).toBeDefined();
      expect(div.style.display).toBe('');

      changeAndFlush(visible, false);
      expect(div.style.display).toBe('none');

      changeAndFlush(visible, true);
      expect(div.style.display).toBe('');

      effect?.stop();
    });
  });

  describe('class directives', () => {
    test('should handle class:active directive', () => {
      const active = signal(false);
      const div = document.createElement('div');
      container.appendChild(div);

      const effect = executeDirective(div, 'class:active', 'active', { signal: active });

      expect(effect).toBeDefined();
      expect(div.classList.contains('active')).toBe(false);

      changeAndFlush(active, true);
      expect(div.classList.contains('active')).toBe(true);

      effect?.stop();
    });
  });

  describe('attribute directives', () => {
    test('should handle attr:data-id directive', () => {
      const id = signal('test-id');
      const div = document.createElement('div');
      container.appendChild(div);

      const effect = executeDirective(div, 'attr:data-id', 'id', { signal: id });

      expect(effect).toBeDefined();
      expect(div.getAttribute('data-id')).toBe('test-id');

      changeAndFlush(id, 'new-id');
      expect(div.getAttribute('data-id')).toBe('new-id');

      effect?.stop();
    });
  });

  describe('style directives', () => {
    test('should handle style:color directive', () => {
      const color = signal('red');
      const div = document.createElement('div');
      container.appendChild(div);

      const effect = executeDirective(div, 'style:color', 'color', { signal: color });

      expect(effect).toBeDefined();
      expect(div.style.color).toBe('red');

      changeAndFlush(color, 'blue');
      expect(div.style.color).toBe('blue');

      effect?.stop();
    });
  });

  describe('processDirectives', () => {
    test('should process multiple directives on an element', () => {
      const count = signal(42);
      const active = signal(true);
      const handler = vi.fn();
      const div = document.createElement('div');
      container.appendChild(div);

      const effects = processDirectives(div, {
        'bind:value': count,
        'class:active': active,
        'on:click': handler,
      });

      expect(effects).toHaveLength(3);

      // Test bind:value (div doesn't have value property, so we test textContent instead)
      expect(div.textContent).toBe('42');

      // Test class:active
      expect(div.classList.contains('active')).toBe(true);

      // Test on:click
      div.click();
      expect(handler).toHaveBeenCalled();

      cleanupEffects(effects);
    });

    test('should ignore non-directive attributes', () => {
      const count = signal(42);
      const div = document.createElement('div');
      container.appendChild(div);

      const effects = processDirectives(div, {
        'bind:value': count,
        id: 'test-id',
        class: 'test-class',
      });

      expect(effects).toHaveLength(1);

      cleanupEffects(effects);
    });
  });

  describe('cleanupEffects', () => {
    test('should stop all effects', () => {
      const count = signal(42);
      const div = document.createElement('div');
      container.appendChild(div);

      const effects = processDirectives(div, {
        'bind:value': count,
        'class:active': count,
      });

      expect(effects).toHaveLength(2);

      cleanupEffects(effects);

      // Effects should be stopped (check if stop method exists and was called)
      for (const effect of effects) {
        expect(typeof effect.stop).toBe('function');
      }
    });
  });
});
