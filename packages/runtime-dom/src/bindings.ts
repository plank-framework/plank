/**
 * @fileoverview DOM bindings for reactive updates
 */

import { type Computed, type Effect, effect, type Signal } from '@plank/runtime-core';

export interface BindingContext {
  element: Element;
  signal: Signal<unknown> | Computed<unknown>;
  attribute?: string;
  property?: string;
  event?: string;
  handler?: (value: unknown) => void;
}

export interface BindingOptions<T = unknown> {
  /** Whether to use textContent instead of innerHTML */
  text?: boolean;
  /** Whether to use setAttribute instead of property assignment */
  attribute?: boolean;
  /** Custom formatter for the value */
  formatter?: (value: T) => string;
}

export interface BooleanBindingOptions<T = unknown> {
  /** Custom formatter for the value */
  formatter?: (value: T) => boolean;
}

/**
 * Bind a signal to an element's text content
 */
export function bindText<T = unknown>(
  element: Element,
  signal: Signal<T> | Computed<T>,
  options: BindingOptions<T> = {}
): Effect {
  const { text = true, formatter } = options;

  const effectObj = effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    if (text) {
      element.textContent = displayValue;
    } else {
      element.innerHTML = displayValue;
    }
  });

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind a signal to an element's attribute
 */
export function bindAttribute<T = unknown>(
  element: Element,
  attribute: string,
  signal: Signal<T> | Computed<T>,
  options: BindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  const effectObj = effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    if (displayValue === '' || displayValue === 'null' || displayValue === 'undefined') {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, displayValue);
    }
  });

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind a signal to an element's property
 */
export function bindProperty<T = unknown>(
  element: Element,
  property: string,
  signal: Signal<T> | Computed<T>,
  options: BindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  const effectObj = effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : value;

    // Safely set property on element using Reflect
    try {
      Reflect.set(element, property, displayValue);
    } catch (error) {
      console.warn(`Failed to set property "${property}" on element:`, error);
    }
  });

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind a signal to an element's class list
 */
export function bindClass<T = unknown>(
  element: Element,
  className: string,
  signal: Signal<T> | Computed<T>,
  options: BooleanBindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  const effectObj = effect(() => {
    const value = signal();
    const shouldHaveClass = formatter ? formatter(value) : Boolean(value);

    if (shouldHaveClass) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  });

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind a signal to an element's style property
 */
export function bindStyle<T = unknown>(
  element: HTMLElement,
  property: string,
  signal: Signal<T> | Computed<T>,
  options: BindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  const effectObj = effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    // Safely set CSS property using Reflect
    try {
      Reflect.set(element.style, property, displayValue);
    } catch (error) {
      console.warn(`Failed to set CSS property "${property}" on element style:`, error);
    }
  });

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind a signal to an input element's value
 */
export function bindInputValue<T = unknown>(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  signal: Signal<T>,
  options: BindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  // Update input when signal changes
  const updateInput = effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    if (input.value !== displayValue) {
      input.value = displayValue;
    }
  });

  // Update signal when input changes
  const updateSignal = () => {
    const currentValue = input.value;
    const signalValue = signal();

    if (String(signalValue) !== currentValue) {
      signal(currentValue as T);
    }
  };

  input.addEventListener('input', updateSignal);
  input.addEventListener('change', updateSignal);

  const effectObj = {
    stop: () => {
      updateInput.stop();
      input.removeEventListener('input', updateSignal);
      input.removeEventListener('change', updateSignal);
    },
    isActive: true,
  } as Effect;

  registerBinding(input, effectObj);
  return effectObj;
}

/**
 * Bind a signal to a checkbox's checked state
 */
export function bindCheckbox<T = unknown>(
  checkbox: HTMLInputElement,
  signal: Signal<T>,
  options: BooleanBindingOptions<T> = {}
): Effect {
  const { formatter } = options;

  // Update checkbox when signal changes
  const updateCheckbox = effect(() => {
    const value = signal();
    const checked = formatter ? formatter(value) : Boolean(value);

    if (checkbox.checked !== checked) {
      checkbox.checked = checked;
    }
  });

  // Update signal when checkbox changes
  const updateSignal = () => {
    const currentChecked = checkbox.checked;
    const signalValue = signal();

    if (Boolean(signalValue) !== currentChecked) {
      signal(currentChecked as T);
    }
  };

  checkbox.addEventListener('change', updateSignal);

  const effectObj = {
    stop: () => {
      updateCheckbox.stop();
      checkbox.removeEventListener('change', updateSignal);
    },
    isActive: true,
  } as Effect;

  registerBinding(checkbox, effectObj);
  return effectObj;
}

/**
 * Create a two-way binding between a signal and an element
 */
export function bindTwoWay<T = unknown>(
  element: Element,
  signal: Signal<T>,
  options: {
    attribute?: string;
    property?: string;
    event?: string;
    formatter?: (value: T) => string;
  } = {}
): Effect {
  const { attribute, property, event = 'input' } = options;

  // One-way binding: signal to element
  const oneWay = effect(() => {
    const value = signal();

    if (attribute) {
      const bindingOptions = options.formatter ? { formatter: options.formatter } : {};
      bindAttribute(element, attribute, signal, bindingOptions);
    } else if (property) {
      const bindingOptions = options.formatter ? { formatter: options.formatter } : {};
      bindProperty(element, property, signal, bindingOptions);
    } else if (element instanceof HTMLInputElement) {
      element.value = String(value ?? '');
    } else {
      element.textContent = String(value ?? '');
    }
  });

  // Two-way binding: element to signal
  const updateSignal = () => {
    let value: unknown;

    if (attribute) {
      value = element.getAttribute(attribute);
    } else if (property) {
      // Safely get property from element using Reflect
      try {
        value = Reflect.get(element, property);
      } catch (error) {
        console.warn(`Failed to get property "${property}" from element:`, error);
        value = null;
      }
    } else if (element instanceof HTMLInputElement) {
      value = element.value;
    } else {
      value = element.textContent;
    }

    signal(value as T);
  };

  element.addEventListener(event, updateSignal);

  const effectObj = {
    stop: () => {
      oneWay.stop();
      element.removeEventListener(event, updateSignal);
    },
    isActive: true,
  } as Effect;

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Bind multiple signals to an element's properties
 */
export function bindMultiple(
  element: Element,
  bindings: Array<{
    // biome-ignore lint/suspicious/noExplicitAny: <any type necessary for multiple bindings>
    signal: Signal<any> | Computed<any>;
    attribute?: string;
    property?: string;
    className?: string;
    style?: string;
    text?: boolean;
    options?: BindingOptions | BooleanBindingOptions;
  }>
): Effect[] {
  return bindings.map((binding) => {
    const { signal, attribute, property, className, style, text, options = {} } = binding;

    if (text) {
      return bindText(element, signal, options as BindingOptions);
    } else if (attribute) {
      return bindAttribute(element, attribute, signal, options as BindingOptions);
    } else if (property) {
      return bindProperty(element, property, signal, options as BindingOptions);
    } else if (className) {
      return bindClass(element, className, signal, options as BooleanBindingOptions);
    } else if (style) {
      return bindStyle(element as HTMLElement, style, signal, options as BindingOptions);
    } else {
      throw new Error('No binding type specified');
    }
  });
}

// Global registry for tracking bindings per element
const elementBindings = new WeakMap<Element, Set<Effect>>();

/**
 * Register a binding effect for an element
 */
export function registerBinding(element: Element, effect: Effect): void {
  if (!elementBindings.has(element)) {
    elementBindings.set(element, new Set());
  }
  const bindings = elementBindings.get(element);
  if (bindings) {
    bindings.add(effect);
  }
}

/**
 * Bind an event handler to an element
 */
export function bindEvent(
  element: Element,
  event: string,
  handler: (event: Event) => void
): Effect {
  element.addEventListener(event, handler);

  const effectObj = {
    stop: () => {
      element.removeEventListener(event, handler);
    },
    isActive: true,
  } as Effect;

  registerBinding(element, effectObj);
  return effectObj;
}

/**
 * Remove all bindings from an element
 */
export function unbindElement(element: Element): void {
  const bindings = elementBindings.get(element);
  if (bindings) {
    for (const effect of bindings) {
      if (effect && typeof effect.stop === 'function') {
        effect.stop();
      }
    }
    bindings.clear();
    elementBindings.delete(element);
  }
}
