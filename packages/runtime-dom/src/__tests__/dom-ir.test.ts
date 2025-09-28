/**
 * @fileoverview Tests for DOM IR execution
 */

import { type Effect, type Signal, signal } from '@plank/runtime-core';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  cleanupDOMExecutionContext,
  createDOMExecutionContext,
  createElementFromOperation,
  type DOMOperation,
  executeDOMIR,
  executeReactiveDOMIR,
  removeElement,
} from '../dom-ir.js';

describe('DOM IR Execution', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  test('should create element from operation', () => {
    const operation: DOMOperation = {
      type: 'createElement',
      tag: 'div',
      attributes: { id: 'test', class: 'container' },
    };

    const element = createElementFromOperation(operation);
    expect(element).toBeInstanceOf(HTMLDivElement);
    expect((element as HTMLDivElement)?.getAttribute('id')).toBe('test');
    expect((element as HTMLDivElement)?.getAttribute('class')).toBe('container');
  });

  test('should create text node from operation', () => {
    const operation: DOMOperation = {
      type: 'createTextNode',
      text: 'Hello World',
    };

    const textNode = createElementFromOperation(operation);
    expect(textNode).toBeInstanceOf(Text);
    expect(textNode?.textContent).toBe('Hello World');
  });

  test('should execute DOM operations', () => {
    const operations: DOMOperation[] = [
      {
        type: 'createElement',
        tag: 'div',
        attributes: { id: 'test' },
      },
      {
        type: 'createTextNode',
        text: 'Hello',
      },
    ];

    const context = createDOMExecutionContext(container);

    // Mock the operations to store created elements
    const divOp = operations[0] as DOMOperation & { element: Element };
    const textOp = operations[1] as DOMOperation & { textNode: Text };

    executeDOMIR(operations, context);

    // Verify elements were created
    expect(divOp.element).toBeInstanceOf(HTMLDivElement);
    expect(textOp.textNode).toBeInstanceOf(Text);
  });

  test('should execute reactive DOM IR', async () => {
    const count = signal(0);
    const operations: DOMOperation[] = [
      {
        type: 'createElement',
        tag: 'span',
        attributes: { id: 'counter' },
      },
    ];

    const context = createDOMExecutionContext(container);
    context.signals.set('count', count as Signal<unknown>);

    const bindings = [
      {
        element: container,
        signal: count as Signal<unknown>,
        type: 'text' as const,
        target: 'textContent',
      },
    ];

    executeReactiveDOMIR(operations, context, bindings);

    // Initial value should be set
    expect(container.textContent).toBe('0');

    // Update signal and verify reactive update
    count(42);

    // Force a microtask to ensure the effect runs
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).toBe('42');
  });

  test('should clean up DOM execution context', () => {
    const count = signal(0);
    const context = createDOMExecutionContext(container);

    context.signals.set('count', count as Signal<unknown>);
    context.effects.add({
      stop: () => {},
      isActive: true,
    } as Effect);

    expect(context.signals.size).toBe(1);
    expect(context.effects.size).toBe(1);

    cleanupDOMExecutionContext(context);

    expect(context.signals.size).toBe(0);
    expect(context.effects.size).toBe(0);
  });

  test('should remove element and clean up bindings', () => {
    const element = document.createElement('div');
    element.id = 'test-element';
    container.appendChild(element);

    expect(container.contains(element)).toBe(true);

    removeElement(element);

    expect(container.contains(element)).toBe(false);
  });

  test('should handle setAttribute operation', () => {
    const element = document.createElement('div');
    container.appendChild(element);

    const operations: DOMOperation[] = [
      {
        type: 'setAttribute',
        parent: element,
        property: 'data-test',
        value: 'test-value',
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    expect(element.getAttribute('data-test')).toBe('test-value');
  });

  test('should handle removeAttribute operation', () => {
    const element = document.createElement('div');
    element.setAttribute('data-test', 'test-value');
    container.appendChild(element);

    const operations: DOMOperation[] = [
      {
        type: 'removeAttribute',
        parent: element,
        property: 'data-test',
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    expect(element.getAttribute('data-test')).toBeNull();
  });

  test('should handle setProperty operation', () => {
    const element = document.createElement('input');
    container.appendChild(element);

    const operations: DOMOperation[] = [
      {
        type: 'setProperty',
        parent: element,
        property: 'value',
        value: 'test-input',
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    expect(element.value).toBe('test-input');
  });

  test('should handle addEventListener operation', () => {
    const element = document.createElement('button');
    container.appendChild(element);

    let clicked = false;
    const handler = () => {
      clicked = true;
    };

    const operations: DOMOperation[] = [
      {
        type: 'addEventListener',
        parent: element,
        event: 'click',
        handler,
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    element.click();
    expect(clicked).toBe(true);
  });

  test('should handle appendChild operation', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    container.appendChild(parent);

    const operations: DOMOperation[] = [
      {
        type: 'appendChild',
        parent,
        child,
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    expect(parent.contains(child)).toBe(true);
  });

  test('should handle removeChild operation', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    container.appendChild(parent);

    expect(parent.contains(child)).toBe(true);

    const operations: DOMOperation[] = [
      {
        type: 'removeChild',
        parent,
        child,
      },
    ];

    const context = createDOMExecutionContext(container);
    executeDOMIR(operations, context);

    expect(parent.contains(child)).toBe(false);
  });

  test('should handle errors gracefully', () => {
    const operations: DOMOperation[] = [
      {
        type: 'createElement',
        // Missing tag - should cause error
      } as DOMOperation,
    ];

    const context = createDOMExecutionContext(container);

    // Should not throw, but log error
    expect(() => executeDOMIR(operations, context)).not.toThrow();
  });
});
