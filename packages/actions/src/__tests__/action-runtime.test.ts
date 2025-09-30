/**
 * @fileoverview Tests for action runtime
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type ActionRuntime,
  createActionRuntime,
  getActionRuntime,
  resetActionRuntime,
} from '../action-runtime.js';
import type { ActionContext, ActionHandler } from '../types.js';

describe('ActionRuntime', () => {
  let runtime: ActionRuntime;

  beforeEach(() => {
    resetActionRuntime();
    runtime = createActionRuntime({
      secret: 'test-secret',
    });
  });

  describe('defineAction', () => {
    it('should define a new action', () => {
      const handler: ActionHandler = async () => ({
        success: true,
        data: { message: 'Hello' },
      });

      const action = runtime.defineAction(handler, { name: 'testAction' });

      expect(action).toBeDefined();
      expect(action.id).toBeTruthy();
      expect(action.handler).toBe(handler);
      expect(action.name).toBe('testAction');
      expect(action.csrf).toBe(true); // Default
    });

    it('should generate unique action IDs', () => {
      const handler: ActionHandler = async () => ({ success: true });

      const action1 = runtime.defineAction(handler);
      const action2 = runtime.defineAction(handler);

      expect(action1.id).not.toBe(action2.id);
    });

    it('should allow disabling CSRF', () => {
      const handler: ActionHandler = async () => ({ success: true });

      const action = runtime.defineAction(handler, { csrf: false });

      expect(action.csrf).toBe(false);
    });
  });

  describe('executeAction', () => {
    it('should execute an action successfully', async () => {
      const handler: ActionHandler = async (formData) => ({
        success: true,
        data: { title: formData.get('title') },
      });

      const action = runtime.defineAction(handler, { csrf: false });

      const formData = new FormData();
      formData.append('title', 'Test Todo');

      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ title: 'Test Todo' });
    });

    it('should return error for non-existent action', async () => {
      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction('invalid-id', formData, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should verify CSRF token when enabled', async () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler); // CSRF enabled by default

      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSRF token missing');
    });

    it('should accept valid CSRF token', async () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler);

      const csrfToken = runtime.generateCSRFToken();

      const formData = new FormData();
      const context: ActionContext = {
        headers: {
          'x-plank-csrf-token': csrfToken,
        },
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(true);
    });

    it('should reject invalid CSRF token', async () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler);

      const formData = new FormData();
      const context: ActionContext = {
        headers: {
          'x-plank-csrf-token': 'invalid-token',
        },
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired CSRF token');
    });

    it('should handle action handler errors', async () => {
      const handler: ActionHandler = async () => {
        throw new Error('Something went wrong');
      };

      const action = runtime.defineAction(handler, { csrf: false });

      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should handle validation errors', async () => {
      const handler: ActionHandler = async () => ({
        success: false,
        errors: {
          email: 'Invalid email format',
          password: 'Password too short',
        },
      });

      const action = runtime.defineAction(handler, { csrf: false });

      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual({
        email: 'Invalid email format',
        password: 'Password too short',
      });
    });

    it('should support redirect responses', async () => {
      const handler: ActionHandler = async () => ({
        success: true,
        redirect: '/success',
      });

      const action = runtime.defineAction(handler, { csrf: false });

      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(true);
      expect(result.redirect).toBe('/success');
    });
  });

  describe('CSRF token management', () => {
    it('should generate CSRF token', () => {
      const token = runtime.generateCSRFToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should get CSRF cookie name', () => {
      expect(runtime.getCSRFCookieName()).toBe('plank-csrf');
    });

    it('should get CSRF header name', () => {
      expect(runtime.getCSRFHeaderName()).toBe('x-plank-csrf-token');
    });
  });

  describe('action registry', () => {
    it('should get action by ID', () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler);

      const retrieved = runtime.getAction(action.id);

      expect(retrieved).toBe(action);
    });

    it('should return undefined for non-existent action', () => {
      const retrieved = runtime.getAction('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should check if action exists', () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler);

      expect(runtime.hasAction(action.id)).toBe(true);
      expect(runtime.hasAction('non-existent')).toBe(false);
    });
  });

  describe('global runtime', () => {
    it('should create singleton instance', () => {
      const runtime1 = getActionRuntime();
      const runtime2 = getActionRuntime();

      expect(runtime1).toBe(runtime2);
    });

    it('should reset global runtime', () => {
      const runtime1 = getActionRuntime();
      resetActionRuntime();
      const runtime2 = getActionRuntime();

      expect(runtime1).not.toBe(runtime2);
    });
  });

  describe('action context', () => {
    it('should pass context to handler', async () => {
      let capturedContext: ActionContext | null = null;

      const handler: ActionHandler = async (_formData, context) => {
        capturedContext = context;
        return { success: true };
      };

      const action = runtime.defineAction(handler, { csrf: false });

      const formData = new FormData();
      const context: ActionContext = {
        headers: { 'user-agent': 'test' },
        cookies: { session: 'abc123' },
        session: { userId: '123' },
        url: '/api/test',
        method: 'POST',
      };

      await runtime.executeAction(action.id, formData, context);

      expect(capturedContext).toEqual(context);
    });

    it('should support CSRF token from cookies', async () => {
      const handler: ActionHandler = async () => ({ success: true });
      const action = runtime.defineAction(handler);

      const csrfToken = runtime.generateCSRFToken();

      const formData = new FormData();
      const context: ActionContext = {
        headers: {},
        cookies: {
          'plank-csrf': csrfToken,
        },
        url: '/api/actions',
        method: 'POST',
      };

      const result = await runtime.executeAction(action.id, formData, context);

      expect(result.success).toBe(true);
    });
  });
});
