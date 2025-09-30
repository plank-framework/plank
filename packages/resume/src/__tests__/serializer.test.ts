/**
 * @fileoverview Tests for resumability serializer
 */

import { computed, signal } from '@plank/runtime-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESUME_SCHEMA_VERSION } from '../schema.js';
import { createSerializer, type ResumabilitySerializer } from '../serializer.js';

describe('ResumabilitySerializer', () => {
  let serializer: ResumabilitySerializer;

  beforeEach(() => {
    serializer = createSerializer();
  });

  describe('signal serialization', () => {
    it('should register and capture signals', () => {
      const count = signal(42);
      const name = signal('test');

      serializer.registerSignal(count);
      serializer.registerSignal(name);

      const serialized = serializer.captureSignals();

      expect(Object.keys(serialized).length).toBe(2);
      expect(serialized[count.id]?.value).toBe(42);
      expect(serialized[name.id]?.value).toBe('test');
    });

    it('should handle primitive values', () => {
      const boolSig = signal(true);
      const numSig = signal(123);
      const strSig = signal('hello');
      const nullSig = signal(null);

      serializer.registerSignal(boolSig);
      serializer.registerSignal(numSig);
      serializer.registerSignal(strSig);
      serializer.registerSignal(nullSig);

      const serialized = serializer.captureSignals();

      expect(serialized[boolSig.id]?.value).toBe(true);
      expect(serialized[numSig.id]?.value).toBe(123);
      expect(serialized[strSig.id]?.value).toBe('hello');
      expect(serialized[nullSig.id]?.value).toBeNull();
    });

    it('should handle arrays and objects', () => {
      const arraySignal = signal([1, 2, 3]);
      const objectSignal = signal({ key: 'value' });

      serializer.registerSignal(arraySignal);
      serializer.registerSignal(objectSignal);

      const serialized = serializer.captureSignals();

      expect(serialized[arraySignal.id]?.value).toEqual([1, 2, 3]);
      expect(serialized[objectSignal.id]?.value).toEqual({ key: 'value' });
    });

    it('should skip non-serializable signals', () => {
      // Create signal with isSerializable = false
      const nonSerializable = signal(42);
      Object.defineProperty(nonSerializable, 'isSerializable', {
        value: false,
        writable: false,
      });

      serializer.registerSignal(nonSerializable);

      const serialized = serializer.captureSignals();

      expect(Object.keys(serialized).length).toBe(0);
    });

    it('should capture signal dependents', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);

      serializer.registerSignal(count);
      serializer.registerComputed(doubled);

      const serialized = serializer.captureSignals();

      expect(serialized[count.id]?.dependents).toContain(doubled.id);
    });
  });

  describe('computed serialization', () => {
    it('should register and capture computeds', () => {
      const count = signal(10);
      const doubled = computed(() => count() * 2);

      serializer.registerSignal(count);
      serializer.registerComputed(doubled);

      const serialized = serializer.captureComputeds();

      expect(Object.keys(serialized).length).toBe(1);
      expect(serialized[doubled.id]?.value).toBe(20);
      expect(serialized[doubled.id]?.dependencies).toContain(count.id);
    });

    it('should track computed dependencies', () => {
      const a = signal(5);
      const b = signal(10);
      const sum = computed(() => a() + b());

      serializer.registerSignal(a);
      serializer.registerSignal(b);
      serializer.registerComputed(sum);

      const serialized = serializer.captureComputeds();

      expect(serialized[sum.id]?.dependencies).toHaveLength(2);
      expect(serialized[sum.id]?.dependencies).toContain(a.id);
      expect(serialized[sum.id]?.dependencies).toContain(b.id);
    });

    it('should capture isDirty flag', () => {
      const count = signal(5);
      const doubled = computed(() => count() * 2);

      // Access computed to clear dirty flag
      doubled();

      serializer.registerComputed(doubled);

      const serialized = serializer.captureComputeds();

      expect(serialized[doubled.id]?.isDirty).toBe(false);
    });
  });

  describe('snapshot creation', () => {
    it('should create complete snapshot', () => {
      const count = signal(42);
      const doubled = computed(() => count() * 2);

      serializer.registerSignal(count);
      serializer.registerComputed(doubled);

      const snapshot = serializer.createSnapshot({
        route: '/test',
        locale: 'en',
        custom: { theme: 'dark' },
      });

      expect(snapshot.version).toBe(RESUME_SCHEMA_VERSION);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.signals[count.id]).toBeDefined();
      expect(snapshot.computeds[doubled.id]).toBeDefined();
      expect(snapshot.meta.route).toBe('/test');
      expect(snapshot.meta.locale).toBe('en');
      expect(snapshot.meta.custom?.theme).toBe('dark');
    });

    it('should include empty collections for nodes/components/islands', () => {
      const snapshot = serializer.createSnapshot({ route: '/' });

      expect(snapshot.nodes).toEqual({});
      expect(snapshot.components).toEqual({});
      expect(snapshot.islands).toEqual({});
    });
  });

  describe('JSON serialization', () => {
    it('should serialize snapshot to JSON', () => {
      const count = signal(42);
      serializer.registerSignal(count);

      const snapshot = serializer.createSnapshot({ route: '/' });
      const json = serializer.serializeToJSON(snapshot);

      expect(json).toBeTruthy();
      expect(typeof json).toBe('string');

      // Should be valid JSON
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(RESUME_SCHEMA_VERSION);
    });

    it('should warn when snapshot exceeds size limit', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create small serializer
      const smallSerializer = createSerializer({ maxSnapshotSize: 100 });

      // Create large data
      const largeData = signal({ data: 'x'.repeat(1000) });
      smallSerializer.registerSignal(largeData);

      const snapshot = smallSerializer.createSnapshot({ route: '/' });
      smallSerializer.serializeToJSON(snapshot);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum'));

      consoleSpy.mockRestore();
    });
  });

  describe('HTML embedding', () => {
    it('should embed snapshot in script tag', () => {
      const count = signal(42);
      serializer.registerSignal(count);

      const snapshot = serializer.createSnapshot({ route: '/' });
      const html = serializer.embedInHTML(snapshot);

      expect(html).toContain('<script type="application/plank-resume"');
      expect(html).toContain('id="plank-resume-data"');
      expect(html).toContain('</script>');
    });

    it('should escape HTML special characters', () => {
      const data = signal('<script>alert("xss")</script>');
      serializer.registerSignal(data);

      const snapshot = serializer.createSnapshot({ route: '/' });
      const html = serializer.embedInHTML(snapshot);

      // Should be escaped
      expect(html).toContain('\\u003c');
      expect(html).toContain('\\u003e');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('utility methods', () => {
    it('should clear registered signals and computeds', () => {
      const sig = signal(42);
      const comp = computed(() => sig() * 2);

      serializer.registerSignal(sig);
      serializer.registerComputed(comp);

      serializer.clear();

      const snapshot = serializer.createSnapshot({ route: '/' });

      expect(Object.keys(snapshot.signals).length).toBe(0);
      expect(Object.keys(snapshot.computeds).length).toBe(0);
    });

    it('should provide statistics', () => {
      const sig1 = signal(1);
      const sig2 = signal(2);
      const comp = computed(() => sig1() + sig2());

      serializer.registerSignal(sig1);
      serializer.registerSignal(sig2);
      serializer.registerComputed(comp);

      const stats = serializer.getStats();

      expect(stats.signals).toBe(2);
      expect(stats.computeds).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultSerializer = createSerializer();
      const snapshot = defaultSerializer.createSnapshot({ route: '/' });

      expect(snapshot.version).toBe(RESUME_SCHEMA_VERSION);
    });

    it('should allow custom configuration', () => {
      const customSerializer = createSerializer({
        maxSnapshotSize: 500 * 1024,
        compress: false,
        versionStrategy: 'strict',
      });

      expect(customSerializer).toBeDefined();
    });

    it('should warn about function serialization', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createSerializer({ serializeFunctions: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Function serialization enabled')
      );

      consoleSpy.mockRestore();
    });
  });
});
