/**
 * @fileoverview Tests for error overlay
 */

import { describe, expect, test } from 'vitest';
import {
  createErrorOverlay,
  createWarningOverlay,
  generateErrorOverlay,
  generateErrorOverlayScript,
} from '../error-overlay.js';
import type { ErrorOverlay } from '../types.js';

describe('Error Overlay', () => {
  test('should generate error overlay HTML', () => {
    const error: ErrorOverlay = {
      message: 'Test error message',
      stack: 'Error stack trace',
      file: '/app/routes/test.plk',
      line: 10,
      column: 5,
      type: 'error',
      code: 'PLK001',
    };

    const html = generateErrorOverlay(error);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test error message');
    expect(html).toContain('/app/routes/test.plk');
    expect(html).toContain('Line 10, Column 5');
    expect(html).toContain('Error stack trace');
    expect(html).toContain('PLK001');
    expect(html).toContain('Compilation Error');
  });

  test('should generate warning overlay HTML', () => {
    const error: ErrorOverlay = {
      message: 'Test warning message',
      type: 'warning',
    };

    const html = generateErrorOverlay(error);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test warning message');
    expect(html).toContain('Warning');
  });

  test('should generate error overlay script', () => {
    const error: ErrorOverlay = {
      message: 'Test error message',
      type: 'error',
    };

    const script = generateErrorOverlayScript(error);

    expect(script).toContain('plank-error-overlay');
    expect(script).toContain('atob(');
    expect(script).toContain('document.body.appendChild');
  });

  test('should create error overlay from Error object', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';

    const overlay = createErrorOverlay(error, {
      file: '/app/routes/test.plk',
      line: 10,
      column: 5,
      type: 'error',
      code: 'PLK001',
    });

    expect(overlay.message).toBe('Test error');
    expect(overlay.stack).toBe('Error stack trace');
    expect(overlay.file).toBe('/app/routes/test.plk');
    expect(overlay.line).toBe(10);
    expect(overlay.column).toBe(5);
    expect(overlay.type).toBe('error');
    expect(overlay.code).toBe('PLK001');
  });

  test('should create warning overlay', () => {
    const overlay = createWarningOverlay('Test warning', {
      file: '/app/routes/test.plk',
      line: 10,
      column: 5,
      code: 'PLK002',
    });

    expect(overlay.message).toBe('Test warning');
    expect(overlay.file).toBe('/app/routes/test.plk');
    expect(overlay.line).toBe(10);
    expect(overlay.column).toBe(5);
    expect(overlay.type).toBe('warning');
    expect(overlay.code).toBe('PLK002');
  });

  test('should handle missing optional fields', () => {
    const error: ErrorOverlay = {
      message: 'Test error message',
      type: 'error',
    };

    const html = generateErrorOverlay(error);

    expect(html).toContain('Test error message');
    expect(html).not.toContain('Line');
    expect(html).not.toContain('Column');
  });

  test('should escape HTML special characters', () => {
    const error: ErrorOverlay = {
      message: 'Test error with <script>alert("xss")</script>',
      type: 'error',
    };

    const html = generateErrorOverlay(error);

    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('alert("xss")');
    expect(html).not.toContain('<script>');
  });
});
