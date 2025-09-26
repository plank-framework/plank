/**
 * @fileoverview Tests for server actions system
 */

import { flushSync } from '@plank/runtime-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  bindActionToButton,
  bindActionToForm,
  createAction,
  createDebouncedAction,
  createFormAction,
  createMutationAction,
  createOptimisticAction,
  createQueryAction,
  createThrottledAction,
} from '../actions.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Server Actions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper function to change signal and flush effects
  function changeAndFlush<T>(signal: (value?: T) => T, newValue: T): void {
    signal(newValue);
    flushSync();
  }

  describe('createAction', () => {
    test('should create an action with default options', () => {
      const action = createAction('/api/test');

      expect(action.execute).toBeDefined();
      expect(action.state).toBeDefined();
      expect(action.loading).toBeDefined();
      expect(action.error).toBeDefined();
      expect(action.data).toBeDefined();

      expect(action.loading()).toBe(false);
      expect(action.error()).toBeNull();
      expect(action.data()).toBeNull();
    });

    test('should execute a successful action', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'Test' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = createAction('/api/test');
      const result = await action.execute({ name: 'Test' });

      expect(result).toEqual(mockResponse);
      expect(action.loading()).toBe(false);
      expect(action.error()).toBeNull();
      expect(action.data()).toEqual(mockResponse.data);
    });

    test('should handle action errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const action = createAction('/api/test');
      const result = await action.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(action.loading()).toBe(false);
      expect(action.error()).toBeInstanceOf(Error);
    });

    test('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const action = createAction('/api/test');
      const result = await action.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    test('should call success callback', async () => {
      const onSuccess = vi.fn();
      const mockResponse = { success: true, data: { id: 1 } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = createAction('/api/test', { onSuccess });
      await action.execute();

      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
    });

    test('should call error callback', async () => {
      const onError = vi.fn();
      const error = new Error('Test error');

      mockFetch.mockRejectedValueOnce(error);

      const action = createAction('/api/test', { onError });
      await action.execute();

      expect(onError).toHaveBeenCalledWith(error);
    });

    test('should handle redirects', async () => {
      const mockResponse = {
        success: true,
        redirect: '/dashboard',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Mock window.location.href
      // biome-ignore lint/suspicious/noExplicitAny: <window object>
      delete (window as any).location;
      // biome-ignore lint/suspicious/noExplicitAny: <window object>
      window.location = { href: '' } as any;

      const action = createAction('/api/test');
      await action.execute();

      expect(window.location.href).toBe('/dashboard');
    });

    test('should add CSRF token to headers', async () => {
      // Mock CSRF token
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'test-token';
      document.head.appendChild(meta);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const action = createAction('/api/test');
      await action.execute();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-token',
          }),
        })
      );

      document.head.removeChild(meta);
    });
  });

  describe('createFormAction', () => {
    test('should create a form action', () => {
      const formAction = createFormAction('/api/submit');

      expect(formAction.handleSubmit).toBeDefined();
      expect(formAction.state).toBeDefined();
      expect(formAction.loading).toBeDefined();
      expect(formAction.error).toBeDefined();
      expect(formAction.data).toBeDefined();
    });

    test('should handle form submission', async () => {
      const mockResponse = { success: true, data: { submitted: true } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const formAction = createFormAction('/api/submit');
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.name = 'test';
      input.value = 'value';
      form.appendChild(input);

      const event = {
        target: form,
        preventDefault: vi.fn(),
      } as unknown as Event;

      await formAction.handleSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/submit',
        expect.objectContaining({
          body: JSON.stringify({ test: 'value' }),
        })
      );
    });
  });

  describe('createOptimisticAction', () => {
    test('should create an optimistic action', () => {
      const optimisticUpdate = vi.fn();
      const rollbackUpdate = vi.fn();

      const action = createOptimisticAction('/api/update', {
        optimisticUpdate,
        rollbackUpdate,
      });

      expect(action.execute).toBeDefined();
      expect(action.state).toBeDefined();
    });

    test('should apply optimistic update and rollback on failure', async () => {
      const optimisticUpdate = vi.fn();
      const rollbackUpdate = vi.fn();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const action = createOptimisticAction('/api/update', {
        optimisticUpdate,
        rollbackUpdate,
      });

      try {
        await action.execute({ test: 'data' });
      } catch (_error) {
        // Expected to throw
      }

      expect(optimisticUpdate).toHaveBeenCalledWith({ test: 'data' });
      expect(rollbackUpdate).toHaveBeenCalled();
    });

    test('should not rollback on success', async () => {
      const optimisticUpdate = vi.fn();
      const rollbackUpdate = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { updated: true } }),
      });

      const action = createOptimisticAction('/api/update', {
        optimisticUpdate,
        rollbackUpdate,
      });

      await action.execute({ test: 'data' });

      expect(optimisticUpdate).toHaveBeenCalledWith({ test: 'data' });
      expect(rollbackUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createMutationAction', () => {
    test('should create a mutation action', () => {
      const mutation = createMutationAction('/api/mutate');

      expect(mutation.mutate).toBeDefined();
      expect(mutation.state).toBeDefined();
      expect(mutation.loading).toBeDefined();
      expect(mutation.error).toBeDefined();
      expect(mutation.data).toBeDefined();
    });

    test('should execute mutation', async () => {
      const mockResponse = { success: true, data: { mutated: true } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const mutation = createMutationAction('/api/mutate');
      const result = await mutation.mutate({ id: 1 });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('createQueryAction', () => {
    test('should create a query action with GET method', () => {
      const query = createQueryAction('/api/data');

      expect(query.refetch).toBeDefined();
      expect(query.state).toBeDefined();
    });

    test('should execute query with GET method', async () => {
      const mockResponse = { success: true, data: { items: [] } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const query = createQueryAction('/api/data');
      const result = await query.refetch();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/data',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('bindActionToForm', () => {
    test('should bind action to form', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = 'Submit';
      form.appendChild(button);

      const formAction = createFormAction('/api/submit');
      const effect = bindActionToForm(form, formAction);

      expect(effect).toBeDefined();
      expect(typeof effect.stop).toBe('function');

      effect.stop();
    });

    test('should update button state based on loading', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = 'Submit';
      form.appendChild(button);

      const formAction = createFormAction('/api/submit');
      const effect = bindActionToForm(form, formAction);

      // Simulate loading state
      formAction.state({
        loading: true,
        error: null,
        data: null,
        progress: 0,
      });

      changeAndFlush(formAction.state, formAction.state());

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Loading...');

      effect.stop();
    });
  });

  describe('bindActionToButton', () => {
    test('should bind action to button', () => {
      const button = document.createElement('button');
      const action = createAction('/api/click');

      const effect = bindActionToButton(button, action);

      expect(effect).toBeDefined();
      expect(typeof effect.stop).toBe('function');

      effect.stop();
    });

    test('should update button state based on loading', () => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      const action = createAction('/api/click');

      const effect = bindActionToButton(button, action);

      // Simulate loading state
      action.state({
        loading: true,
        error: null,
        data: null,
        progress: 0,
      });

      changeAndFlush(action.state, action.state());

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Loading...');

      effect.stop();
    });
  });

  describe('createDebouncedAction', () => {
    test('should create a debounced action', () => {
      const debounced = createDebouncedAction('/api/search', 300);

      expect(debounced.execute).toBeDefined();
      expect(debounced.state).toBeDefined();
    });

    test('should debounce execution', async () => {
      const mockResponse = { success: true, data: { results: [] } };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const debounced = createDebouncedAction('/api/search', 300);

      // Execute multiple times quickly
      debounced.execute({ query: 'test1' });
      debounced.execute({ query: 'test2' });
      const promise3 = debounced.execute({ query: 'test3' });

      // Fast-forward time
      vi.advanceTimersByTime(300);

      const result3 = await promise3;

      // Only the last execution should have actually run
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result3).toEqual(mockResponse);
    });
  });

  describe('createThrottledAction', () => {
    test('should create a throttled action', () => {
      const throttled = createThrottledAction('/api/update', 1000);

      expect(throttled.execute).toBeDefined();
      expect(throttled.state).toBeDefined();
    });

    test('should throttle execution', async () => {
      const mockResponse = { success: true, data: { updated: true } };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const throttled = createThrottledAction('/api/update', 1000);

      // First execution should run
      const result1 = await throttled.execute({ data: 'test1' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockResponse);

      // Second execution within throttle period should return cached result
      const result2 = await throttled.execute({ data: 'test2' });
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2.success).toBe(true);
      expect(result2.data).toEqual(mockResponse.data);

      // Advance time beyond throttle period
      vi.advanceTimersByTime(1000);

      // Third execution should run again
      const result3 = await throttled.execute({ data: 'test3' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result3).toEqual(mockResponse);
    });
  });
});
