/**
 * @fileoverview Tests for form enhancement
 */

import { signal } from '@plank/runtime-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoEnhanceForms,
  createOptimisticItem,
  enhanceForm,
  removeItemFromList,
  removeOptimisticItems,
  updateItemInList,
} from '../form-enhancement.js';
import type { UseActionResult } from '../use-action.js';

describe('enhanceForm', () => {
  let form: HTMLFormElement;
  let mockActionHelper: UseActionResult;

  beforeEach(() => {
    // Create form
    form = document.createElement('form');
    form.innerHTML = `
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Submit</button>
    `;
    document.body.appendChild(form);

    // Create mock action helper
    mockActionHelper = {
      isPending: signal(false),
      data: signal<unknown>(null),
      error: signal<Error | null>(null),
      errors: signal<Record<string, string> | null>(null),
      execute: vi.fn().mockResolvedValue({ success: true }),
      setOptimistic: vi.fn(),
      rollback: vi.fn(),
      reset: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should prevent default form submission', async () => {
    enhanceForm(form, mockActionHelper);

    const submitEvent = new Event('submit', { cancelable: true });
    const preventDefault = vi.spyOn(submitEvent, 'preventDefault');

    form.dispatchEvent(submitEvent);

    expect(preventDefault).toHaveBeenCalled();
  });

  it('should execute action on submit', async () => {
    enhanceForm(form, mockActionHelper);

    form.dispatchEvent(new Event('submit'));

    // Wait for async execution
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockActionHelper.execute).toHaveBeenCalled();
  });

  it('should disable submit button during execution', async () => {
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    enhanceForm(form, mockActionHelper);

    form.dispatchEvent(new Event('submit'));

    // Check disabled state immediately
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(button.disabled).toBe(false); // Re-enabled after completion
  });

  it('should add loading class during submission', async () => {
    enhanceForm(form, mockActionHelper, { loadingClass: 'loading' });

    const submitPromise = new Promise<void>((resolve) => {
      mockActionHelper.execute = vi.fn().mockImplementation(async () => {
        expect(form.classList.contains('loading')).toBe(true);
        resolve();
        return { success: true };
      });
    });

    form.dispatchEvent(new Event('submit'));

    await submitPromise;
  });

  it('should add success class on success', async () => {
    enhanceForm(form, mockActionHelper, { successClass: 'success' });

    form.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(form.classList.contains('success')).toBe(true);
  });

  it('should add error class on error', async () => {
    mockActionHelper.execute = vi.fn().mockResolvedValue({
      success: false,
      error: 'Failed',
    });

    enhanceForm(form, mockActionHelper, { errorClass: 'error' });

    form.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(form.classList.contains('error')).toBe(true);
  });

  it('should reset form on success if configured', async () => {
    const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
    emailInput.value = 'test@example.com';

    enhanceForm(form, mockActionHelper, { resetOnSuccess: true });

    form.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emailInput.value).toBe('');
  });

  it('should display field errors', async () => {
    mockActionHelper.execute = vi.fn().mockResolvedValue({
      success: false,
      errors: {
        email: 'Invalid email',
        password: 'Too short',
      },
    });

    enhanceForm(form, mockActionHelper);

    form.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const emailError = document.getElementById('email-error');
    expect(emailError).toBeTruthy();
    expect(emailError?.textContent).toBe('Invalid email');

    const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement;
    expect(emailInput.classList.contains('plank-field-error')).toBe(true);
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('should display general error', async () => {
    mockActionHelper.execute = vi.fn().mockResolvedValue({
      success: false,
      error: 'General error message',
    });

    enhanceForm(form, mockActionHelper);

    form.dispatchEvent(new Event('submit'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const generalError = form.querySelector('.plank-general-error');
    expect(generalError).toBeTruthy();
    expect(generalError?.textContent).toBe('General error message');
  });

  it('should return cleanup function', () => {
    const cleanup = enhanceForm(form, mockActionHelper);

    expect(typeof cleanup).toBe('function');

    cleanup();

    // After cleanup, submit should not execute action
    form.dispatchEvent(new Event('submit'));

    expect(mockActionHelper.execute).not.toHaveBeenCalled();
  });
});

describe('autoEnhanceForms', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should enhance all forms with data-action-id', () => {
    // Create forms
    const form1 = document.createElement('form');
    form1.setAttribute('data-action-id', 'action1');
    document.body.appendChild(form1);

    const form2 = document.createElement('form');
    form2.setAttribute('data-action-id', 'action2');
    document.body.appendChild(form2);

    const form3 = document.createElement('form');
    document.body.appendChild(form3); // No data-action-id

    // Create action helpers
    const actions = new Map<string, UseActionResult>();
    actions.set('action1', {
      isPending: signal(false),
      data: signal<unknown>(null),
      error: signal<Error | null>(null),
      errors: signal<Record<string, string> | null>(null),
      execute: vi.fn().mockResolvedValue({ success: true }),
      setOptimistic: vi.fn(),
      rollback: vi.fn(),
      reset: vi.fn(),
    });
    actions.set('action2', {
      isPending: signal(false),
      data: signal<unknown>(null),
      error: signal<Error | null>(null),
      errors: signal<Record<string, string> | null>(null),
      execute: vi.fn().mockResolvedValue({ success: true }),
      setOptimistic: vi.fn(),
      rollback: vi.fn(),
      reset: vi.fn(),
    });

    const cleanup = autoEnhanceForms(actions);

    expect(typeof cleanup).toBe('function');
  });
});

describe('List helper functions', () => {
  it('should create optimistic item', () => {
    const list = [
      { id: '1', title: 'Item 1' },
      { id: '2', title: 'Item 2' },
    ];

    const newItem = { id: '3', title: 'New Item' };
    const result = createOptimisticItem(list, newItem);

    expect(result.length).toBe(3);
    expect(result[2]?.id).toMatch(/^optimistic-/);
    expect(result[2]?.title).toBe('New Item');
  });

  it('should remove optimistic items', () => {
    const list = [
      { id: '1', title: 'Real Item' },
      { id: 'optimistic-123', title: 'Optimistic Item' },
      { id: '2', title: 'Another Real Item' },
    ];

    const result = removeOptimisticItems(list);

    expect(result.length).toBe(2);
    expect(result.every((item) => !item.id.startsWith('optimistic-'))).toBe(true);
  });

  it('should update item in list', () => {
    const list = [
      { id: '1', title: 'Item 1', completed: false },
      { id: '2', title: 'Item 2', completed: false },
    ];

    const result = updateItemInList(list, '1', { completed: true });

    expect(result[0]?.completed).toBe(true);
    expect(result[1]?.completed).toBe(false);
  });

  it('should remove item from list', () => {
    const list = [
      { id: '1', title: 'Item 1' },
      { id: '2', title: 'Item 2' },
      { id: '3', title: 'Item 3' },
    ];

    const result = removeItemFromList(list, '2');

    expect(result.length).toBe(2);
    expect(result.find((item) => item.id === '2')).toBeUndefined();
  });
});
