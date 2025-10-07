import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityManager } from '../security';

describe('SecurityManager', () => {
  let manager: SecurityManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create manager with minimal config', () => {
      manager = new SecurityManager();

      expect(manager).toBeDefined();
    });

    it('should create manager with full config', () => {
      const securityHeaders = {
        frameOptions: 'DENY',
        contentTypeOptions: 'nosniff',
        csp: {
          default: "default-src 'self'",
        },
      };

      const rateLimitConfig = {
        requests: 100,
        window: 60,
      };

      manager = new SecurityManager(securityHeaders, {}, rateLimitConfig);

      expect(manager).toBeDefined();
    });
  });

  describe('addSecurityHeaders', () => {
    it('should add standard security headers', () => {
      manager = new SecurityManager();

      const response = new Response('OK');
      const newResponse = manager.addSecurityHeaders(response);

      expect(newResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(newResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(newResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(newResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should add custom headers', () => {
      const securityHeaders = {
        frameOptions: 'SAMEORIGIN',
      };
      manager = new SecurityManager(securityHeaders);

      const response = new Response('OK');
      const newResponse = manager.addSecurityHeaders(response);

      expect(newResponse.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });

    it('should add CSP header', () => {
      const securityHeaders = {
        csp: {
          default: "default-src 'self'; script-src 'self' 'unsafe-inline'",
        },
      };
      manager = new SecurityManager(securityHeaders);

      const response = new Response('OK');
      const newResponse = manager.addSecurityHeaders(response);

      const csp = newResponse.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    });

    it('should add permissions policy header', () => {
      manager = new SecurityManager();

      const response = new Response('OK');
      const newResponse = manager.addSecurityHeaders(response);

      const permissionsPolicy = newResponse.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
    });
  });

  describe('createErrorResponse', () => {
    it('should create 404 error response', () => {
      manager = new SecurityManager();

      const error = new Error('Not Found');
      const response = manager.createErrorResponse(404, error);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('text/html');

      return response.text().then((body) => {
        expect(body).toContain('404');
        expect(body).toContain('Not Found');
      });
    });

    it('should create 500 error response', () => {
      manager = new SecurityManager();

      const error = new Error('Internal Server Error');
      const response = manager.createErrorResponse(500, error);

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toContain('text/html');

      return response.text().then((body) => {
        expect(body).toContain('500');
        expect(body).toContain('Internal Server Error');
      });
    });

    it('should add security headers to error responses', () => {
      manager = new SecurityManager();

      const error = new Error('Not Found');
      const response = manager.createErrorResponse(404, error);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const rateLimitConfig = {
        requests: 10,
        window: 60,
        enabled: true,
      };
      manager = new SecurityManager({}, {}, rateLimitConfig);

      const request = new Request('https://example.com/');
      const result = await manager.checkRateLimit(request, {});

      expect(result.allowed).toBe(true);
      expect(result.headers).toBeDefined();
    });

    it('should handle requests without rate limiting', async () => {
      manager = new SecurityManager();

      const request = new Request('https://example.com/');
      const result = await manager.checkRateLimit(request, {});

      expect(result.allowed).toBe(true);
      expect(result.headers).toBeDefined();
    });
  });
});
