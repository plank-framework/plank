/**
 * @fileoverview DOM bindings for reactive updates
 */

import { Signal, Computed, Effect, effect } from '@plank/runtime-core';

export interface BindingContext {
  element: Element;
  signal: Signal<any> | Computed<any>;
  attribute?: string;
  property?: string;
  event?: string;
  handler?: (value: any) => void;
}

export interface BindingOptions {
  /** Whether to use textContent instead of innerHTML */
  text?: boolean;
  /** Whether to use setAttribute instead of property assignment */
  attribute?: boolean;
  /** Custom formatter for the value */
  formatter?: (value: any) => string;
}

export interface BooleanBindingOptions {
  /** Custom formatter for the value */
  formatter?: (value: any) => boolean;
}

/**
 * Bind a signal to an element's text content
 */
export function bindText(
  element: Element,
  signal: Signal<any> | Computed<any>,
  options: BindingOptions = {}
): Effect {
  const { text = true, formatter } = options;

  return effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    if (text) {
      element.textContent = displayValue;
    } else {
      element.innerHTML = displayValue;
    }
  });
}

/**
 * Bind a signal to an element's attribute
 */
export function bindAttribute(
  element: Element,
  attribute: string,
  signal: Signal<any> | Computed<any>,
  options: BindingOptions = {}
): Effect {
  const { formatter } = options;

  return effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    if (displayValue === '' || displayValue === 'null' || displayValue === 'undefined') {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, displayValue);
    }
  });
}

/**
 * Bind a signal to an element's property
 */
export function bindProperty(
  element: Element,
  property: string,
  signal: Signal<any> | Computed<any>,
  options: BindingOptions = {}
): Effect {
  const { formatter } = options;

  return effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : value;

    (element as any)[property] = displayValue;
  });
}

/**
 * Bind a signal to an element's class list
 */
export function bindClass(
  element: Element,
  className: string,
  signal: Signal<any> | Computed<any>,
  options: BooleanBindingOptions = {}
): Effect {
  const { formatter } = options;

  return effect(() => {
    const value = signal();
    const shouldHaveClass = formatter ? formatter(value) : Boolean(value);

    if (shouldHaveClass) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  });
}

/**
 * Bind a signal to an element's style property
 */
export function bindStyle(
  element: HTMLElement,
  property: string,
  signal: Signal<any> | Computed<any>,
  options: BindingOptions = {}
): Effect {
  const { formatter } = options;

  return effect(() => {
    const value = signal();
    const displayValue = formatter ? formatter(value) : String(value ?? '');

    (element.style as any)[property] = displayValue;
  });
}

/**
 * Bind a signal to an input element's value
 */
export function bindInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  signal: Signal<any>,
  options: BindingOptions = {}
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
      signal(currentValue);
    }
  };

  input.addEventListener('input', updateSignal);
  input.addEventListener('change', updateSignal);

  return {
    stop: () => {
      updateInput.stop();
      input.removeEventListener('input', updateSignal);
      input.removeEventListener('change', updateSignal);
    },
    isActive: true
  } as Effect;
}

/**
 * Bind a signal to a checkbox's checked state
 */
export function bindCheckbox(
  checkbox: HTMLInputElement,
  signal: Signal<any>,
  options: BooleanBindingOptions = {}
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
      signal(currentChecked);
    }
  };

  checkbox.addEventListener('change', updateSignal);

  return {
    stop: () => {
      updateCheckbox.stop();
      checkbox.removeEventListener('change', updateSignal);
    },
    isActive: true
  } as Effect;
}

/**
 * Create a two-way binding between a signal and an element
 */
export function bindTwoWay(
  element: Element,
  signal: Signal<any>,
  options: BindingOptions & {
    attribute?: string;
    property?: string;
    event?: string;
  } = {}
): Effect {
  const { attribute, property, event = 'input' } = options;

  // One-way binding: signal to element
  const oneWay = effect(() => {
    const value = signal();

    if (attribute) {
      bindAttribute(element, attribute, signal, options);
    } else if (property) {
      bindProperty(element, property, signal, options);
    } else if (element instanceof HTMLInputElement) {
      element.value = String(value ?? '');
    } else {
      element.textContent = String(value ?? '');
    }
  });

  // Two-way binding: element to signal
  const updateSignal = () => {
    let value: any;

    if (attribute) {
      value = element.getAttribute(attribute);
    } else if (property) {
      value = (element as any)[property];
    } else if (element instanceof HTMLInputElement) {
      value = element.value;
    } else {
      value = element.textContent;
    }

    signal(value);
  };

  element.addEventListener(event, updateSignal);

  return {
    stop: () => {
      oneWay.stop();
      element.removeEventListener(event, updateSignal);
    },
    isActive: true
  } as Effect;
}

/**
 * Bind multiple signals to an element's properties
 */
export function bindMultiple(
  element: Element,
  bindings: Array<{
    signal: Signal<any> | Computed<any>;
    attribute?: string;
    property?: string;
    className?: string;
    style?: string;
    text?: boolean;
    options?: BindingOptions | BooleanBindingOptions;
  }>
): Effect[] {
  return bindings.map(binding => {
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

/**
 * Remove all bindings from an element
 */
export function unbindElement(element: Element): void {
  // This would need to be implemented with a registry of bindings
  // For now, this is a placeholder
  console.warn('unbindElement not fully implemented yet');
}
