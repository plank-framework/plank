/**
 * @fileoverview Unit tests for Bun adapter (no Bun runtime required)
 *
 * Note: Integration tests with actual Bun runtime are in test-bun.test.js
 */

import { describe, expect, it } from 'vitest';
import { createBunAdapter } from '../adapter.js';

describe('BunAdapter', () => {
  describe('createBunAdapter', () => {
    it('should create adapter with default config', () => {
      const adapter = createBunAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.address).toBeDefined();
      expect(adapter.listen).toBeDefined();
      expect(adapter.close).toBeDefined();
    });

    it('should create adapter with custom port', () => {
      const adapter = createBunAdapter({ port: 8080 });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom hostname', () => {
      const adapter = createBunAdapter({ hostname: '127.0.0.1' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom static directory', () => {
      const adapter = createBunAdapter({ staticDir: 'public' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter in dev mode', () => {
      const adapter = createBunAdapter({ dev: true });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with compression disabled', () => {
      const adapter = createBunAdapter({ compression: false });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom shutdown timeout', () => {
      const adapter = createBunAdapter({ shutdownTimeout: 5000 });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom request handler', () => {
      const customHandler = async () => new Response('Custom');
      const adapter = createBunAdapter({ onRequest: customHandler });
      expect(adapter).toBeDefined();
    });
  });

  describe('address', () => {
    it('should return null when server is not started', () => {
      const adapter = createBunAdapter();
      expect(adapter.address()).toBeNull();
    });
  });

  describe('close', () => {
    it('should handle close when server is not started', async () => {
      const adapter = createBunAdapter();
      await expect(adapter.close()).resolves.not.toThrow();
    });
  });
});
