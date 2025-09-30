/**
 * @fileoverview Integration tests for server actions
 */

import { describe, expect, it } from 'vitest';
import { createActionRuntime } from '../action-runtime.js';
import type { ActionContext, ActionHandler } from '../types.js';

describe('Server Actions Integration', () => {
  it('should handle complete form submission flow', async () => {
    const runtime = createActionRuntime({ secret: 'test-secret' });

    // Define a todo creation action
    const createTodo: ActionHandler = async (formData, _context) => {
      const title = formData.get('title') as string;
      const completed = formData.get('completed') === 'on';

      if (!title || title.trim().length === 0) {
        return {
          success: false,
          errors: {
            title: 'Title is required',
          },
        };
      }

      // Simulate database save
      const todo = {
        id: Math.random().toString(36).slice(2),
        title: title.trim(),
        completed,
        createdAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: todo,
        redirect: `/todos/${todo.id}`,
      };
    };

    const action = runtime.defineAction(createTodo, {
      name: 'createTodo',
    });

    // Generate CSRF token
    const csrfToken = runtime.generateCSRFToken();

    // Create form data
    const formData = new FormData();
    formData.append('title', 'Buy groceries');
    formData.append('completed', 'on');

    // Create context
    const context: ActionContext = {
      headers: {
        'x-plank-csrf-token': csrfToken,
      },
      url: '/api/actions/create-todo',
      method: 'POST',
    };

    // Execute action
    const result = await runtime.executeAction(action.id, formData, context);

    // Verify result
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as { title: string })?.title).toBe('Buy groceries');
    expect((result.data as { completed: boolean })?.completed).toBe(true);
    expect(result.redirect).toMatch(/^\/todos\//);
  });

  it('should handle validation errors', async () => {
    const runtime = createActionRuntime({ secret: 'test-secret' });

    const signupAction: ActionHandler = async (formData) => {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      const errors: Record<string, string> = {};

      if (!email || !email.includes('@')) {
        errors.email = 'Valid email is required';
      }

      if (!password || password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }

      if (Object.keys(errors).length > 0) {
        return {
          success: false,
          errors,
        };
      }

      return {
        success: true,
        data: { userId: '123' },
      };
    };

    const action = runtime.defineAction(signupAction, { csrf: false });

    // Test with invalid data
    const formData = new FormData();
    formData.append('email', 'invalid');
    formData.append('password', '123');

    const context: ActionContext = {
      headers: {},
      url: '/api/signup',
      method: 'POST',
    };

    const result = await runtime.executeAction(action.id, formData, context);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      email: 'Valid email is required',
      password: 'Password must be at least 8 characters',
    });
  });

  it('should support progressive enhancement', async () => {
    const runtime = createActionRuntime({ secret: 'test-secret' });

    // Action that works with or without JavaScript
    const subscribeAction: ActionHandler = async (formData, context) => {
      const email = formData.get('email') as string;

      if (!email) {
        return {
          success: false,
          error: 'Email is required',
        };
      }

      // Check if this is an AJAX request
      const isAjax = context.headers['x-requested-with'] === 'XMLHttpRequest';

      if (isAjax) {
        // Return JSON for JavaScript clients
        return {
          success: true,
          data: { message: 'Successfully subscribed!' },
        };
      }

      // Redirect for non-JavaScript clients
      return {
        success: true,
        redirect: '/thank-you',
      };
    };

    const action = runtime.defineAction(subscribeAction, { csrf: false });

    const formData = new FormData();
    formData.append('email', 'user@example.com');

    // Test with JavaScript (AJAX)
    const ajaxContext: ActionContext = {
      headers: {
        'x-requested-with': 'XMLHttpRequest',
      },
      url: '/api/subscribe',
      method: 'POST',
    };

    const ajaxResult = await runtime.executeAction(action.id, formData, ajaxContext);

    expect(ajaxResult.success).toBe(true);
    expect((ajaxResult.data as { message: string })?.message).toBe('Successfully subscribed!');
    expect(ajaxResult.redirect).toBeUndefined();

    // Test without JavaScript (form submission)
    const formContext: ActionContext = {
      headers: {},
      url: '/api/subscribe',
      method: 'POST',
    };

    const formResult = await runtime.executeAction(action.id, formData, formContext);

    expect(formResult.success).toBe(true);
    expect(formResult.redirect).toBe('/thank-you');
  });

  it('should handle file uploads', async () => {
    const runtime = createActionRuntime({ secret: 'test-secret' });

    const uploadAction: ActionHandler = async (formData) => {
      const file = formData.get('file') as File;
      const description = formData.get('description') as string;

      if (!file) {
        return {
          success: false,
          error: 'File is required',
        };
      }

      // Simulate file processing
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        description: description || '',
      };

      return {
        success: true,
        data: fileInfo,
      };
    };

    const action = runtime.defineAction(uploadAction, { csrf: false });

    const formData = new FormData();
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);
    formData.append('description', 'Test file');

    const context: ActionContext = {
      headers: {},
      url: '/api/upload',
      method: 'POST',
    };

    const result = await runtime.executeAction(action.id, formData, context);

    expect(result.success).toBe(true);
    expect((result.data as { name: string })?.name).toBe('test.txt');
    expect((result.data as { type: string })?.type).toBe('text/plain');
    expect((result.data as { description: string })?.description).toBe('Test file');
  });
});
