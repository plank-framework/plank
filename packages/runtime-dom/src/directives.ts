/**
 * @fileoverview Plank template directives implementation
 */

import { type Computed, type Effect, effect, type Signal } from '@plank/runtime-core';
import {
  bindAttribute,
  bindCheckbox,
  bindClass,
  bindInputValue,
  bindProperty,
  bindStyle,
  bindText,
} from './bindings.js';

export interface DirectiveContext<T = unknown> {
  element: Element;
  directive: string;
  expression: string;
  signal?: Signal<T> | Computed<T>;
  handler?: (...args: unknown[]) => void;
}

export type DirectiveHandler<T = unknown> = (context: DirectiveContext<T>) => Effect | void;

/**
 * Registry of directive handlers
 */
const directiveHandlers = new Map<string, DirectiveHandler>();

/**
 * Register a directive handler
 */
export function registerDirective(name: string, handler: DirectiveHandler): void {
  directiveHandlers.set(name, handler);
}

/**
 * Get a directive handler
 */
export function getDirectiveHandler(name: string): DirectiveHandler | undefined {
  return directiveHandlers.get(name);
}

/**
 * Execute a directive on an element
 */
export function executeDirective<T = unknown>(
  element: Element,
  directive: string,
  expression: string,
  context: Partial<DirectiveContext<T>> = {}
): Effect | void {
  const handler = getDirectiveHandler(directive) as DirectiveHandler<T> | undefined;
  if (!handler) {
    console.warn(`Unknown directive: ${directive}`);
    return;
  }

  const directiveContext: DirectiveContext<T> = {
    element,
    directive,
    expression,
    ...context,
  } as DirectiveContext<T>;

  return handler(directiveContext);
}

/**
 * Event handler directive (on:click, on:submit, etc.)
 */
function handleEventDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, handler } = context;

  if (!handler) {
    console.warn(`No handler provided for event directive: ${directive}`);
    return;
  }

  const eventName = directive.replace('on:', '');

  const eventListener = (event: Event) => {
    handler(event);
  };

  element.addEventListener(eventName, eventListener);

  const effectObj = {
    stop: () => {
      element.removeEventListener(eventName, eventListener);
    },
    isActive: true,
  } as Effect;

  return effectObj;
}

/**
 * Binding directive (bind:value, bind:checked, etc.)
 */
function handleBindDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for bind directive: ${directive}`);
    return;
  }

  const property = directive.replace('bind:', '');

  if (element instanceof HTMLInputElement) {
    if (property === 'value') {
      // Two-way value binding requires a Signal (not Computed)
      return bindInputValue(element, signal as Signal<T>);
    } else if (property === 'checked') {
      return bindCheckbox(element, signal as Signal<T>);
    } else {
      return bindProperty(element, property, signal);
    }
  } else {
    if (property === 'value') {
      return bindText(element, signal);
    } else {
      return bindProperty(element, property, signal);
    }
  }
}

// Registry for tracking removed elements and their restoration info
const removedElements = new WeakMap<
  Element,
  {
    parent: Element;
    nextSibling: Node | null;
    effects: Set<Effect>;
  }
>();

/**
 * Restore element to DOM from removal registry
 */
function restoreElement(element: Element): void {
  const restorationInfo = removedElements.get(element);
  if (restorationInfo) {
    const { parent, nextSibling, effects } = restorationInfo;

    // Restore element to DOM
    if (nextSibling) {
      parent.insertBefore(element, nextSibling);
    } else {
      parent.appendChild(element);
    }

    // Re-register effects
    for (const effectObj of effects) {
      if (effectObj && typeof effectObj.stop === 'function') {
        // Effects will be re-created by the directive system
        effectObj.stop();
      }
    }

    removedElements.delete(element);
  }
}

/**
 * Remove element and store restoration info
 */
function removeElementWithRestoration(element: Element): void {
  const parent = element.parentNode as Element;
  const nextSibling = element.nextSibling;

  // Get current effects for this element
  const effects = new Set<Effect>();
  // Note: In a full implementation, we'd track effects per element

  removedElements.set(element, {
    parent,
    nextSibling,
    effects,
  });

  element.remove();
}

/**
 * Conditional directive (x:if, x:show)
 */
function applyIf(element: Element, shouldShow: boolean): void {
  if (shouldShow) {
    if (!element.parentNode) {
      // Element was removed, restore it
      restoreElement(element);
    }
  } else {
    if (element.parentNode) {
      // Store restoration info before removing
      removeElementWithRestoration(element);
    }
  }
}

function applyShow(element: Element, shouldShow: boolean): void {
  (element as HTMLElement).style.display = shouldShow ? '' : 'none';
}

function handleConditionalDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for conditional directive: ${directive}`);
    return;
  }

  const type = directive.replace('x:', '');

  return effect(() => {
    const value = signal();
    const shouldShow = Boolean(value);

    if (type === 'if') {
      applyIf(element, shouldShow);
    } else if (type === 'show') {
      applyShow(element, shouldShow);
    }
  });
}

/**
 * Loop directive (x:for)
 */
function handleForDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for for directive: ${directive}`);
    return;
  }

  // This is a simplified implementation
  // A full implementation would need to parse the expression and handle key tracking
  return effect(() => {
    const items = signal() as unknown;

    if (!Array.isArray(items)) {
      console.warn('x:for expects an array');
      return;
    }

    // Clear existing children
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    // Create new children
    for (const item of items) {
      const child = element.cloneNode(true) as Element;
      child.textContent = String(item);
      element.appendChild(child);
    }
  });
}

/**
 * Class directive (class:active, class:btn-primary)
 */
function handleClassDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for class directive: ${directive}`);
    return;
  }

  const className = directive.replace('class:', '');

  return bindClass(element, className, signal);
}

/**
 * Attribute directive (attr:data-id, attr:aria-label)
 */
function handleAttrDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for attr directive: ${directive}`);
    return;
  }

  const attribute = directive.replace('attr:', '');

  return bindAttribute(element, attribute, signal);
}

/**
 * Style directive (style:color, style:background-color)
 */
function handleStyleDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for style directive: ${directive}`);
    return;
  }

  const styleProperty = directive.replace('style:', '');

  return bindStyle(element as HTMLElement, styleProperty, signal);
}

/**
 * Text interpolation directive
 */
function _handleTextDirective<T = unknown>(context: DirectiveContext<T>): Effect | void {
  const { element, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for text directive`);
    return;
  }

  return bindText(element, signal);
}

// Register built-in directive handlers
registerDirective('on:click', handleEventDirective);
registerDirective('on:submit', handleEventDirective);
registerDirective('on:change', handleEventDirective);
registerDirective('on:input', handleEventDirective);
registerDirective('on:focus', handleEventDirective);
registerDirective('on:blur', handleEventDirective);
registerDirective('on:keydown', handleEventDirective);
registerDirective('on:keyup', handleEventDirective);
registerDirective('on:keypress', handleEventDirective);
registerDirective('on:mousedown', handleEventDirective);
registerDirective('on:mouseup', handleEventDirective);
registerDirective('on:mouseover', handleEventDirective);
registerDirective('on:mouseout', handleEventDirective);
registerDirective('on:load', handleEventDirective);
registerDirective('on:unload', handleEventDirective);
registerDirective('on:resize', handleEventDirective);
registerDirective('on:scroll', handleEventDirective);

registerDirective('bind:value', handleBindDirective);
registerDirective('bind:checked', handleBindDirective);
registerDirective('bind:disabled', handleBindDirective);
registerDirective('bind:readonly', handleBindDirective);

registerDirective('x:if', handleConditionalDirective);
registerDirective('x:show', handleConditionalDirective);
registerDirective('x:for', handleForDirective);

// Register common class directives
registerDirective('class:active', handleClassDirective);
registerDirective('class:disabled', handleClassDirective);
registerDirective('class:selected', handleClassDirective);
registerDirective('class:visible', handleClassDirective);
registerDirective('class:hidden', handleClassDirective);

// Register common attribute directives
registerDirective('attr:data-id', handleAttrDirective);
registerDirective('attr:data-value', handleAttrDirective);
registerDirective('attr:aria-label', handleAttrDirective);
registerDirective('attr:aria-hidden', handleAttrDirective);
registerDirective('attr:title', handleAttrDirective);

// Register common style directives
registerDirective('style:color', handleStyleDirective);
registerDirective('style:background-color', handleStyleDirective);
registerDirective('style:display', handleStyleDirective);
registerDirective('style:visibility', handleStyleDirective);
registerDirective('style:opacity', handleStyleDirective);

/**
 * Process all directives on an element
 */
export function processDirectives(
  element: Element,
  directives: Record<string, unknown>,
  context: Partial<DirectiveContext<unknown>> = {}
): Effect[] {
  const effects: Effect[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (
      directive.startsWith('on:') ||
      directive.startsWith('bind:') ||
      directive.startsWith('x:') ||
      directive.startsWith('class:') ||
      directive.startsWith('attr:') ||
      directive.startsWith('style:')
    ) {
      const extra: Partial<DirectiveContext<unknown>> = {};
      if (directive.startsWith('on:')) {
        extra.handler = value as (...args: unknown[]) => void;
      } else {
        extra.signal = value as Signal<unknown> | Computed<unknown>;
      }

      const effect = executeDirective(element, directive, String(value), {
        ...context,
        ...extra,
      });

      if (effect) {
        effects.push(effect);
      }
    }
  }

  return effects;
}

/**
 * Clean up all effects
 */
export function cleanupEffects(effects: Effect[]): void {
  for (const effectObj of effects) {
    if (effectObj && typeof effectObj.stop === 'function') {
      effectObj.stop();
    }
  }
}
