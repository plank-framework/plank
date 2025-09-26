/**
 * @fileoverview Tests for SSR package exports
 */

import { describe, expect, test } from 'vitest';

describe('SSR Package Exports', () => {
  test('should export all renderer components', async () => {
    const { SSRRenderer, StreamingWriter } = await import('../index.js');

    expect(SSRRenderer).toBeDefined();
    expect(StreamingWriter).toBeDefined();
    expect(typeof SSRRenderer).toBe('function');
    expect(typeof StreamingWriter).toBe('function');
  });

  test('should export all streaming utilities', async () => {
    const {
      generateDocument,
      generateEnhancementScript,
      generatePreconnectHints,
      generateSkeleton,
      generateViewportMeta,
      StreamingResponse,
    } = await import('../index.js');

    expect(generateDocument).toBeDefined();
    expect(generateEnhancementScript).toBeDefined();
    expect(generatePreconnectHints).toBeDefined();
    expect(generateSkeleton).toBeDefined();
    expect(generateViewportMeta).toBeDefined();
    expect(StreamingResponse).toBeDefined();

    expect(typeof generateDocument).toBe('function');
    expect(typeof generateEnhancementScript).toBe('function');
    expect(typeof generatePreconnectHints).toBe('function');
    expect(typeof generateSkeleton).toBe('function');
    expect(typeof generateViewportMeta).toBe('function');
    expect(typeof StreamingResponse).toBe('function');
  });

  test('should export all types', async () => {
    // Test that types are properly exported by checking if they can be imported
    // This is a compile-time test, so we just need to ensure the import doesn't fail
    const types = await import('../index.js');

    // The types are exported as type-only exports, so they won't be available at runtime
    // But we can verify the module loads without errors
    expect(types).toBeDefined();
  });
});
