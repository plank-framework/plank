/**
 * @fileoverview Tests for resumability bootstrap
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBootstrap, quickResume, ResumabilityBootstrap } from '../bootstrap.js';
import type { ResumabilitySnapshot } from '../schema.js';
import { RESUME_SCHEMA_VERSION } from '../schema.js';

describe('ResumabilityBootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('canResume', () => {
    it('should return false when no snapshot exists', () => {
      expect(ResumabilityBootstrap.canResume()).toBe(false);
    });

    it('should return true when snapshot exists', () => {
      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = '{}';
      document.body.appendChild(script);

      expect(ResumabilityBootstrap.canResume()).toBe(true);
    });
  });

  describe('loadSnapshot', () => {
    it('should load snapshot from script tag', () => {
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/test' },
      };

      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = JSON.stringify(snapshot);
      document.body.appendChild(script);

      const bootstrap = createBootstrap();
      const loaded = bootstrap.loadSnapshot();

      expect(loaded).toBeDefined();
      expect(loaded?.version).toBe(RESUME_SCHEMA_VERSION);
      expect(loaded?.meta.route).toBe('/test');
    });

    it('should return null when script tag not found', () => {
      const bootstrap = createBootstrap();
      const loaded = bootstrap.loadSnapshot();

      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = 'invalid json';
      document.body.appendChild(script);

      const bootstrap = createBootstrap();
      const loaded = bootstrap.loadSnapshot();

      expect(loaded).toBeNull();
    });

    it('should warn about version mismatch', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const snapshot: ResumabilitySnapshot = {
        version: '99.0.0', // Future version
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = JSON.stringify(snapshot);
      document.body.appendChild(script);

      const bootstrap = createBootstrap();
      bootstrap.loadSnapshot();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('version mismatch'));

      consoleSpy.mockRestore();
    });
  });

  describe('restoreSignals', () => {
    it('should restore signals from snapshot', () => {
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {
          'signal-1': {
            id: 'signal-1',
            value: 42,
            dependents: [],
            isSerializable: true,
          },
          'signal-2': {
            id: 'signal-2',
            value: 'hello',
            dependents: [],
            isSerializable: true,
          },
        },
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const bootstrap = createBootstrap();
      const restored = bootstrap.restoreSignals(snapshot);

      expect(restored).toBe(2);
      expect(bootstrap.getSignal('signal-1')).toBeDefined();
      expect(bootstrap.getSignal('signal-2')).toBeDefined();
      expect(bootstrap.getSignal('signal-1')?.()).toBe(42);
      expect(bootstrap.getSignal('signal-2')?.()).toBe('hello');
    });

    it('should handle restoration errors gracefully', () => {
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {
          'bad-signal': {
            id: 'bad-signal',
            value: undefined, // May cause issues
            dependents: [],
            isSerializable: true,
          },
        },
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const bootstrap = createBootstrap();
      const restored = bootstrap.restoreSignals(snapshot);

      // Should handle error and continue
      expect(restored).toBeGreaterThanOrEqual(0);
    });
  });

  describe('restoreComputeds', () => {
    it('should restore computed values', () => {
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {
          'signal-1': {
            id: 'signal-1',
            value: 10,
            dependents: ['computed-1'],
            isSerializable: true,
          },
        },
        computeds: {
          'computed-1': {
            id: 'computed-1',
            value: 20,
            dependencies: ['signal-1'],
            isDirty: false,
          },
        },
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const bootstrap = createBootstrap();
      bootstrap.restoreSignals(snapshot);
      const restored = bootstrap.restoreComputeds(snapshot);

      expect(restored).toBe(1);
      expect(bootstrap.getComputed('computed-1')).toBeDefined();
    });
  });

  describe('restoreListeners', () => {
    it('should restore event listeners to DOM nodes', () => {
      const handler = vi.fn();

      // Create DOM node with data-plank-id
      const button = document.createElement('button');
      button.setAttribute('data-plank-id', 'btn-1');
      document.body.appendChild(button);

      const bootstrap = createBootstrap();
      bootstrap.registerHandler('handler-1', handler);

      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {
          'btn-1': {
            nodeId: 'btn-1',
            tagName: 'BUTTON',
            dataAttrs: {},
            listeners: [
              {
                event: 'click',
                handlerId: 'handler-1',
              },
            ],
          },
        },
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const restored = bootstrap.restoreListeners(snapshot);

      expect(restored).toBe(1);

      // Trigger event
      button.click();
      expect(handler).toHaveBeenCalled();
    });

    it('should warn when node not found', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {
          'missing-node': {
            nodeId: 'missing-node',
            tagName: 'DIV',
            dataAttrs: {},
            listeners: [],
          },
        },
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const bootstrap = createBootstrap();
      bootstrap.restoreListeners(snapshot);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Node not found'));

      consoleSpy.mockRestore();
    });
  });

  describe('full resume', () => {
    it('should resume complete application', async () => {
      // Create snapshot in DOM
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {
          'count-signal': {
            id: 'count-signal',
            value: 5,
            dependents: [],
            isSerializable: true,
          },
        },
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/counter' },
      };

      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = JSON.stringify(snapshot);
      document.body.appendChild(script);

      const bootstrap = createBootstrap();
      const result = await bootstrap.resume();

      expect(result.success).toBe(true);
      expect(result.metrics.signalsRestored).toBe(1);
      expect(result.metrics.resumeTime).toBeGreaterThan(0);
    });

    it('should fallback to hydration on error', async () => {
      const bootstrap = createBootstrap({ fallbackToHydration: true });
      const result = await bootstrap.resume();

      expect(result.success).toBe(true);
      expect(result.fallback).toBe('partial-hydration');
      expect(result.error).toBeDefined();
    });

    it('should fail without fallback', async () => {
      const bootstrap = createBootstrap({ fallbackToHydration: false });
      const result = await bootstrap.resume();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();

      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = JSON.stringify(snapshot);
      document.body.appendChild(script);

      const bootstrap = createBootstrap({ onProgress });
      await bootstrap.resume();

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('quickResume helper', () => {
    it('should provide quick resume function', async () => {
      const snapshot: ResumabilitySnapshot = {
        version: RESUME_SCHEMA_VERSION,
        timestamp: Date.now(),
        signals: {},
        computeds: {},
        nodes: {},
        components: {},
        islands: {},
        meta: { route: '/' },
      };

      const script = document.createElement('script');
      script.id = 'plank-resume-data';
      script.type = 'application/plank-resume';
      script.textContent = JSON.stringify(snapshot);
      document.body.appendChild(script);

      const result = await quickResume();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});
