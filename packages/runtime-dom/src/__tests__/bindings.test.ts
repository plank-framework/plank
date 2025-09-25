/**
 * @fileoverview Tests for DOM bindings
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { signal, computed, effect, flushSync } from '@plank/runtime-core';
import {
  bindText,
  bindAttribute,
  bindProperty,
  bindClass,
  bindStyle,
  bindInputValue,
  bindCheckbox,
  bindTwoWay,
  bindMultiple
} from '../bindings.js';

describe('DOM Bindings', () => {
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

  describe('bindText', () => {
    test('should bind signal to textContent', () => {
      const count = signal(42);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindText(div, count);

      expect(div.textContent).toBe('42');

      changeAndFlush(count, 100);
      expect(div.textContent).toBe('100');

      stop.stop();
    });

    test('should bind computed to textContent', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindText(div, doubled);

      expect(div.textContent).toBe('10');

      // Debug: check values before change
      console.log('Before change - count:', count(), 'doubled:', doubled(), 'textContent:', div.textContent);
      
      changeAndFlush(count, 10);
      
      // Debug: check values after change
      console.log('After change - count:', count(), 'doubled:', doubled(), 'textContent:', div.textContent);
      
      expect(div.textContent).toBe('20');

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(42);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindText(div, count, {
        formatter: (value) => `Count: ${value}`
      });

      expect(div.textContent).toBe('Count: 42');

      stop.stop();
    });

    test('should use innerHTML when text is false', () => {
      const html = signal('<strong>Hello</strong>');
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindText(div, html, { text: false });

      expect(div.innerHTML).toBe('<strong>Hello</strong>');

      stop.stop();
    });
  });

  describe('bindAttribute', () => {
    test('should bind signal to attribute', () => {
      const id = signal('test-id');
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindAttribute(div, 'id', id);

      expect(div.getAttribute('id')).toBe('test-id');

      changeAndFlush(id, 'new-id');
      expect(div.getAttribute('id')).toBe('new-id');

      stop.stop();
    });

    test('should remove attribute when value is empty', () => {
      const id = signal('test-id');
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindAttribute(div, 'id', id);

      expect(div.getAttribute('id')).toBe('test-id');

      changeAndFlush(id, '');
      expect(div.getAttribute('id')).toBeNull();

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(42);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindAttribute(div, 'data-count', count, {
        formatter: (value) => `count-${value}`
      });

      expect(div.getAttribute('data-count')).toBe('count-42');

      stop.stop();
    });
  });

  describe('bindProperty', () => {
    test('should bind signal to property', () => {
      const disabled = signal(false);
      const button = document.createElement('button');
      container.appendChild(button);

      const stop = bindProperty(button, 'disabled', disabled);

      expect(button.disabled).toBe(false);

      changeAndFlush(disabled, true);
      expect(button.disabled).toBe(true);

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(42);
      const input = document.createElement('input');
      container.appendChild(input);

      const stop = bindProperty(input, 'value', count, {
        formatter: (value) => `Count: ${value}`
      });

      expect(input.value).toBe('Count: 42');

      stop.stop();
    });
  });

  describe('bindClass', () => {
    test('should bind signal to class', () => {
      const active = signal(false);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindClass(div, 'active', active);

      expect(div.classList.contains('active')).toBe(false);

      changeAndFlush(active, true);
      expect(div.classList.contains('active')).toBe(true);

      changeAndFlush(active, false);
      expect(div.classList.contains('active')).toBe(false);

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(5);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindClass(div, 'count', count, {
        formatter: (value) => value > 3
      });

      expect(div.classList.contains('count')).toBe(true);

      changeAndFlush(count, 2);
      expect(div.classList.contains('count')).toBe(false);

      stop.stop();
    });
  });

  describe('bindStyle', () => {
    test('should bind signal to style property', () => {
      const color = signal('red');
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindStyle(div, 'color', color);

      expect(div.style.color).toBe('red');

      changeAndFlush(color, 'blue');
      expect(div.style.color).toBe('blue');

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(5);
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindStyle(div, 'width', count, {
        formatter: (value) => `${value * 10}px`
      });

      expect(div.style.width).toBe('50px');

      changeAndFlush(count, 10);
      expect(div.style.width).toBe('100px');

      stop.stop();
    });
  });

  describe('bindInputValue', () => {
    test('should bind signal to input value', () => {
      const value = signal('initial');
      const input = document.createElement('input');
      container.appendChild(input);

      const stop = bindInputValue(input, value);

      expect(input.value).toBe('initial');

      changeAndFlush(value, 'updated');
      expect(input.value).toBe('updated');

      // Simulate user input
      input.value = 'user input';
      input.dispatchEvent(new Event('input'));

      expect(value()).toBe('user input');

      stop.stop();
    });

    test('should handle textarea', () => {
      const value = signal('initial');
      const textarea = document.createElement('textarea');
      container.appendChild(textarea);

      const stop = bindInputValue(textarea, value);

      expect(textarea.value).toBe('initial');

      changeAndFlush(value, 'updated');
      expect(textarea.value).toBe('updated');

      stop.stop();
    });

    test('should handle select', () => {
      const value = signal('option1');
      const select = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'option1';
      option1.textContent = 'Option 1';
      const option2 = document.createElement('option');
      option2.value = 'option2';
      option2.textContent = 'Option 2';
      select.appendChild(option1);
      select.appendChild(option2);
      container.appendChild(select);

      const stop = bindInputValue(select, value);

      expect(select.value).toBe('option1');

      changeAndFlush(value, 'option2');
      expect(select.value).toBe('option2');

      stop.stop();
    });
  });

  describe('bindCheckbox', () => {
    test('should bind signal to checkbox checked state', () => {
      const checked = signal(false);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      container.appendChild(checkbox);

      const stop = bindCheckbox(checkbox, checked);

      expect(checkbox.checked).toBe(false);

      changeAndFlush(checked, true);
      expect(checkbox.checked).toBe(true);

      // Simulate user interaction
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(checked()).toBe(false);

      stop.stop();
    });

    test('should use formatter when provided', () => {
      const count = signal(5);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      container.appendChild(checkbox);

      const stop = bindCheckbox(checkbox, count, {
        formatter: (value) => value > 3
      });

      expect(checkbox.checked).toBe(true);

      changeAndFlush(count, 2);
      expect(checkbox.checked).toBe(false);

      stop.stop();
    });
  });

  describe('bindTwoWay', () => {
    test('should create two-way binding with input', () => {
      const value = signal('initial');
      const input = document.createElement('input');
      container.appendChild(input);

      const stop = bindTwoWay(input, value);

      expect(input.value).toBe('initial');

      changeAndFlush(value, 'updated');
      expect(input.value).toBe('updated');

      // Simulate user input
      input.value = 'user input';
      input.dispatchEvent(new Event('input'));

      expect(value()).toBe('user input');

      stop.stop();
    });

    test('should create two-way binding with attribute', () => {
      const value = signal('initial');
      const div = document.createElement('div');
      container.appendChild(div);

      const stop = bindTwoWay(div, value, { attribute: 'data-value' } as any);

      expect(div.getAttribute('data-value')).toBe('initial');

      changeAndFlush(value, 'updated');
      expect(div.getAttribute('data-value')).toBe('updated');

      // Simulate attribute change
      div.setAttribute('data-value', 'user input');
      div.dispatchEvent(new Event('input'));

      expect(value()).toBe('user input');

      stop.stop();
    });
  });

  describe('bindMultiple', () => {
    test('should bind multiple signals to element', () => {
      const count = signal(42);
      const active = signal(true);
      const color = signal('red');
      const div = document.createElement('div');
      container.appendChild(div);

      const effects = bindMultiple(div, [
        { signal: count, text: true },
        { signal: active, className: 'active' },
        { signal: color, style: 'color' }
      ]);

      expect(div.textContent).toBe('42');
      expect(div.classList.contains('active')).toBe(true);
      expect(div.style.color).toBe('red');

      changeAndFlush(count, 100);
      changeAndFlush(active, false);
      changeAndFlush(color, 'blue');

      expect(div.textContent).toBe('100');
      expect(div.classList.contains('active')).toBe(false);
      expect(div.style.color).toBe('blue');

      effects.forEach(effect => effect.stop());
    });
  });
});
