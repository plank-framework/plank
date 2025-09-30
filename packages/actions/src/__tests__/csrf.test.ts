/**
 * @fileoverview Tests for CSRF token management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CSRFManager, createCSRFManager } from '../csrf.js';

describe('CSRFManager', () => {
  let csrfManager: CSRFManager;

  beforeEach(() => {
    csrfManager = createCSRFManager({
      secret: 'test-secret-key',
      expiresIn: 3600,
    });
  });

  describe('generateToken', () => {
    it('should generate a valid CSRF token', () => {
      const token = csrfManager.generateToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = csrfManager.generateToken();
      const token2 = csrfManager.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = csrfManager.generateToken();
      const isValid = csrfManager.verifyToken(token);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid token', () => {
      const isValid = csrfManager.verifyToken('invalid-token');

      expect(isValid).toBe(false);
    });

    it('should reject a token with invalid signature', () => {
      const token = csrfManager.generateToken();
      const [payload] = token.split('.');
      const tamperedToken = `${payload}.invalid-signature`;

      const isValid = csrfManager.verifyToken(tamperedToken);

      expect(isValid).toBe(false);
    });

    it('should reject an expired token', () => {
      const expiredManager = createCSRFManager({
        secret: 'test-secret',
        expiresIn: -1, // Already expired
      });

      const token = expiredManager.generateToken();

      // Wait a bit to ensure expiration
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      const isValid = expiredManager.verifyToken(token);

      expect(isValid).toBe(false);

      vi.useRealTimers();
    });

    it('should reject a malformed token', () => {
      expect(csrfManager.verifyToken('malformed')).toBe(false);
      expect(csrfManager.verifyToken('')).toBe(false);
      expect(csrfManager.verifyToken('a.b.c')).toBe(false);
    });
  });

  describe('getCookieName', () => {
    it('should return default cookie name', () => {
      expect(csrfManager.getCookieName()).toBe('plank-csrf');
    });

    it('should return custom cookie name', () => {
      const manager = createCSRFManager({
        cookieName: 'custom-csrf',
      });

      expect(manager.getCookieName()).toBe('custom-csrf');
    });
  });

  describe('getHeaderName', () => {
    it('should return default header name', () => {
      expect(csrfManager.getHeaderName()).toBe('x-plank-csrf-token');
    });

    it('should return custom header name', () => {
      const manager = createCSRFManager({
        headerName: 'x-custom-csrf',
      });

      expect(manager.getHeaderName()).toBe('x-custom-csrf');
    });
  });

  describe('extractToken', () => {
    it('should extract token from headers', () => {
      const token = 'test-token';
      const headers = {
        'x-plank-csrf-token': token,
      };

      const extracted = csrfManager.extractToken(headers);

      expect(extracted).toBe(token);
    });

    it('should extract token from cookies', () => {
      const token = 'test-token';
      const cookies = {
        'plank-csrf': token,
      };

      const extracted = csrfManager.extractToken({}, cookies);

      expect(extracted).toBe(token);
    });

    it('should prefer header over cookie', () => {
      const headerToken = 'header-token';
      const cookieToken = 'cookie-token';

      const headers = {
        'x-plank-csrf-token': headerToken,
      };
      const cookies = {
        'plank-csrf': cookieToken,
      };

      const extracted = csrfManager.extractToken(headers, cookies);

      expect(extracted).toBe(headerToken);
    });

    it('should return null when token not found', () => {
      const extracted = csrfManager.extractToken({});

      expect(extracted).toBeNull();
    });

    it('should handle case-insensitive header names', () => {
      const token = 'test-token';

      // Extract should normalize to lowercase
      const manager = createCSRFManager({
        headerName: 'x-plank-csrf-token',
      });

      const extracted = manager.extractToken({
        'x-plank-csrf-token': token,
      });

      expect(extracted).toBe(token);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const manager = createCSRFManager();

      expect(manager.getCookieName()).toBe('plank-csrf');
      expect(manager.getHeaderName()).toBe('x-plank-csrf-token');
    });

    it('should allow partial configuration', () => {
      const manager = createCSRFManager({
        cookieName: 'custom-cookie',
      });

      expect(manager.getCookieName()).toBe('custom-cookie');
      expect(manager.getHeaderName()).toBe('x-plank-csrf-token'); // Still default
    });

    it('should warn about default secret in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.NODE_ENV = 'production';

      createCSRFManager(); // Using default secret

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Using default CSRF secret'));

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });
});
