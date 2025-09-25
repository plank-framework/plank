/**
 * @fileoverview Plank template directives implementation
 */

import { Signal, Computed, Effect, effect } from '@plank/runtime-core';
import { bindText, bindAttribute, bindProperty, bindClass, bindStyle, bindInputValue, bindCheckbox } from './bindings.js';

export interface DirectiveContext {
  element: Element;
  directive: string;
  expression: string;
  signal?: Signal<any> | Computed<any>;
  handler?: (...args: any[]) => void;
}

export interface DirectiveHandler {
  (context: DirectiveContext): Effect | void;
}

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
export function executeDirective(
  element: Element,
  directive: string,
  expression: string,
  context: any = {}
): Effect | void {
  const handler = getDirectiveHandler(directive);
  if (!handler) {
    console.warn(`Unknown directive: ${directive}`);
    return;
  }

  const directiveContext: DirectiveContext = {
    element,
    directive,
    expression,
    ...context
  };

  return handler(directiveContext);
}

/**
 * Event handler directive (on:click, on:submit, etc.)
 */
function handleEventDirective(context: DirectiveContext): Effect | void {
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
    isActive: true
  } as Effect;

  return effectObj;
}

/**
 * Binding directive (bind:value, bind:checked, etc.)
 */
function handleBindDirective(context: DirectiveContext): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for bind directive: ${directive}`);
    return;
  }

  const property = directive.replace('bind:', '');

  if (element instanceof HTMLInputElement) {
    if (property === 'value') {
      return bindInputValue(element, signal as Signal<any>);
    } else if (property === 'checked') {
      return bindCheckbox(element, signal as Signal<any>);
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

/**
 * Conditional directive (x:if, x:show)
 */
function handleConditionalDirective(context: DirectiveContext): Effect | void {
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
      // x:if - remove/add element from DOM
      if (shouldShow) {
        if (!element.parentNode) {
          // Element was removed, need to restore it
          // This is complex and would need a reference to the original position
          console.warn('x:if element restoration not fully implemented');
        }
      } else {
        if (element.parentNode) {
          element.remove();
        }
      }
    } else if (type === 'show') {
      // x:show - toggle visibility
      (element as HTMLElement).style.display = shouldShow ? '' : 'none';
    }
  });
}

/**
 * Loop directive (x:for)
 */
function handleForDirective(context: DirectiveContext): Effect | void {
  const { element, directive, signal } = context;

  if (!signal) {
    console.warn(`No signal provided for for directive: ${directive}`);
    return;
  }

  // This is a simplified implementation
  // A full implementation would need to parse the expression and handle key tracking
  return effect(() => {
    const items = signal();

    if (!Array.isArray(items)) {
      console.warn('x:for expects an array');
      return;
    }

    // Clear existing children
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    // Create new children
    items.forEach((item, index) => {
      const child = element.cloneNode(true) as Element;
      child.textContent = String(item);
      element.appendChild(child);
    });
  });
}

/**
 * Class directive (class:active, class:btn-primary)
 */
function handleClassDirective(context: DirectiveContext): Effect | void {
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
function handleAttrDirective(context: DirectiveContext): Effect | void {
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
function handleStyleDirective(context: DirectiveContext): Effect | void {
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
function handleTextDirective(context: DirectiveContext): Effect | void {
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
  directives: Record<string, any>,
  context: any = {}
): Effect[] {
  const effects: Effect[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (directive.startsWith('on:') ||
        directive.startsWith('bind:') ||
        directive.startsWith('x:') ||
        directive.startsWith('class:') ||
        directive.startsWith('attr:') ||
        directive.startsWith('style:')) {

      const effect = executeDirective(element, directive, String(value), {
        ...context,
        signal: directive.startsWith('on:') ? undefined : value,
        handler: directive.startsWith('on:') ? value : undefined
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
  effects.forEach(effect => {
    if (effect && typeof effect.stop === 'function') {
      effect.stop();
    }
  });
}
