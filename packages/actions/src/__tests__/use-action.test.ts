/**
 * @fileoverview Tests for useAction client helper
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerAction } from '../types.js';
import { useAction, useActionError, useActionLoading } from '../use-action.js';

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test',
    reload: vi.fn(),
  },
  writable: true,
});

describe('useAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
    };

    const actionHelper = useAction(action);

    expect(actionHelper.isPending()).toBe(false);
    expect(actionHelper.data()).toBeNull();
    expect(actionHelper.error()).toBeNull();
    expect(actionHelper.errors()).toBeNull();
  });

  it('should execute action successfully', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const mockResponse = {
      success: true,
      data: { message: 'Success!' },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();
    formData.append('test', 'value');

    const result = await actionHelper.execute(formData);

    expect(result.success).toBe(true);
    expect(actionHelper.data()).toEqual({ message: 'Success!' });
    expect(actionHelper.isPending()).toBe(false);
  });

  it('should handle action errors', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const mockResponse = {
      success: false,
      error: 'Something went wrong',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();

    const result = await actionHelper.execute(formData);

    expect(result.success).toBe(false);
    expect(actionHelper.error()?.message).toBe('Something went wrong');
  });

  it('should handle validation errors', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const mockResponse = {
      success: false,
      errors: {
        email: 'Invalid email',
        password: 'Too short',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();

    await actionHelper.execute(formData);

    expect(actionHelper.errors()).toEqual({
      email: 'Invalid email',
      password: 'Too short',
    });
  });

  it('should support optimistic updates', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const actionHelper = useAction(action, { optimistic: true });

    // Set optimistic data
    actionHelper.setOptimistic({ id: '1', title: 'Optimistic Todo' });

    expect(actionHelper.data()).toEqual({ id: '1', title: 'Optimistic Todo' });

    // Simulate successful response
    const mockResponse = {
      success: true,
      data: { id: '1', title: 'Real Todo' },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const formData = new FormData();
    await actionHelper.execute(formData);

    expect(actionHelper.data()).toEqual({ id: '1', title: 'Real Todo' });
  });

  it('should rollback optimistic updates on error', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const actionHelper = useAction(action, { optimistic: true });

    // Set initial data
    actionHelper.data({ id: '1', title: 'Original' });

    // Set optimistic update
    actionHelper.setOptimistic({ id: '2', title: 'Optimistic' });
    expect(actionHelper.data()).toEqual({ id: '2', title: 'Optimistic' });

    // Simulate error response
    const mockResponse = {
      success: false,
      error: 'Failed',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const formData = new FormData();
    await actionHelper.execute(formData);

    // Should rollback to original
    expect(actionHelper.data()).toEqual({ id: '1', title: 'Original' });
  });

  it('should call lifecycle hooks', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const onBefore = vi.fn();
    const onSuccess = vi.fn();
    const onAfter = vi.fn();

    const actionHelper = useAction(action, {
      onBefore,
      onSuccess,
      onAfter,
    });

    const mockResponse = {
      success: true,
      data: { result: 'ok' },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const formData = new FormData();
    await actionHelper.execute(formData);

    expect(onBefore).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({ result: 'ok' });
    expect(onAfter).toHaveBeenCalled();
  });

  it('should handle network errors', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const onError = vi.fn();
    const actionHelper = useAction(action, { onError });

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const formData = new FormData();
    const result = await actionHelper.execute(formData);

    expect(result.success).toBe(false);
    expect(actionHelper.error()?.message).toBe('Network error');
    expect(onError).toHaveBeenCalled();
  });

  it('should reset state', () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
    };

    const actionHelper = useAction(action);

    // Set some state
    actionHelper.data({ test: 'data' });
    actionHelper.error(new Error('test'));
    actionHelper.errors({ field: 'error' });

    // Reset
    actionHelper.reset();

    expect(actionHelper.data()).toBeNull();
    expect(actionHelper.error()).toBeNull();
    expect(actionHelper.errors()).toBeNull();
  });

  it('should handle redirect response', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const mockResponse = {
      success: true,
      redirect: '/success',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();

    await actionHelper.execute(formData);

    expect(window.location.href).toBe('/success');
  });

  it('should handle reload response', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
      csrf: false,
    };

    const mockResponse = {
      success: true,
      reload: true,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => mockResponse,
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();

    await actionHelper.execute(formData);

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should include CSRF token when available', async () => {
    const action: ServerAction = {
      id: 'test-action',
      handler: vi.fn(),
    };

    // Add CSRF meta tag
    const metaTag = document.createElement('meta');
    metaTag.name = 'csrf-token';
    metaTag.content = 'test-csrf-token';
    document.head.appendChild(metaTag);

    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    const actionHelper = useAction(action);
    const formData = new FormData();

    await actionHelper.execute(formData);

    expect(fetch).toHaveBeenCalledWith(
      '/api/actions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-plank-csrf-token': 'test-csrf-token',
        }),
      })
    );
  });
});

describe('useActionLoading', () => {
  it('should track loading state of multiple actions', () => {
    const action1: ServerAction = { id: '1', handler: vi.fn() };
    const action2: ServerAction = { id: '2', handler: vi.fn() };

    const helper1 = useAction(action1);
    const helper2 = useAction(action2);

    const loading = useActionLoading(helper1, helper2);

    expect(loading()).toBe(false);

    helper1.isPending(true);
    expect(loading()).toBe(true);

    helper1.isPending(false);
    helper2.isPending(true);
    expect(loading()).toBe(true);

    helper2.isPending(false);
    expect(loading()).toBe(false);
  });
});

describe('useActionError', () => {
  it('should return first error from multiple actions', () => {
    const action1: ServerAction = { id: '1', handler: vi.fn() };
    const action2: ServerAction = { id: '2', handler: vi.fn() };

    const helper1 = useAction(action1);
    const helper2 = useAction(action2);

    const error = useActionError(helper1, helper2);

    expect(error()).toBeNull();

    const error1 = new Error('Error 1');
    helper1.error(error1);
    expect(error()).toBe(error1);

    const error2 = new Error('Error 2');
    helper2.error(error2);
    expect(error()).toBe(error1); // Should return first error
  });
});
