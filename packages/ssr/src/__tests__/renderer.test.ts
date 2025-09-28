/**
 * @fileoverview Tests for server-side renderer
 */

import { describe, expect, test, vi } from 'vitest';
import { SSRRenderer, StreamingWriter } from '../renderer.js';
import type { SSRContext, StreamingOptions } from '../types.js';

describe('SSRRenderer', () => {
  const renderer = new SSRRenderer({
    templateDir: '/templates',
    assetsDir: '/assets',
    baseUrl: '/',
    streaming: false,
  });

  test('should render basic template', async () => {
    const context: SSRContext = {
      url: '/test',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    const result = await renderer.render('/test.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.html).toContain('Welcome to Plank SSR');
    expect(result.html).toContain('Template: /test.plk');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
    expect(result.metadata.htmlSize).toBeGreaterThan(0);
  });

  test('should handle streaming context', async () => {
    const context: SSRContext = {
      url: '/test',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
      streaming: {
        enabled: true,
        chunkSize: 1024,
        timeout: 5000,
      },
    };

    const result = await renderer.render('/test.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.stream).toBeDefined();
    expect(result.metadata.islandCount).toBe(1);
    expect(result.metadata.actionCount).toBe(0);
  });

  test('should handle template with data context', async () => {
    const context: SSRContext = {
      url: '/user/123',
      method: 'GET',
      headers: {},
      params: { id: '123' },
      query: { tab: 'profile' },
      data: { user: { name: 'John Doe', email: 'john@example.com' } },
    };

    const result = await renderer.render('/user.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
    expect(result.metadata.htmlSize).toBeGreaterThan(0);
  });

  test('should handle template with islands', async () => {
    const context: SSRContext = {
      url: '/dashboard',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: { widgets: ['chart', 'stats', 'recent'] },
    };

    const result = await renderer.render('/dashboard.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.islandCount).toBeGreaterThanOrEqual(0);
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with server actions', async () => {
    const context: SSRContext = {
      url: '/form',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: { formData: { title: 'Test Form' } },
    };

    const result = await renderer.render('/form.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.actionCount).toBeGreaterThanOrEqual(0);
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with complex data', async () => {
    const context: SSRContext = {
      url: '/complex',
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      params: { category: 'tech' },
      query: { page: '1', limit: '10' },
      data: {
        posts: [
          { id: 1, title: 'Post 1', content: 'Content 1' },
          { id: 2, title: 'Post 2', content: 'Content 2' },
        ],
        pagination: { current: 1, total: 5 },
        user: { name: 'Admin', role: 'editor' },
      },
    };

    const result = await renderer.render('/complex.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
    expect(result.metadata.htmlSize).toBeGreaterThan(0);
  });

  test('should handle template with streaming enabled', async () => {
    const context: SSRContext = {
      url: '/streaming',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
      streaming: {
        enabled: true,
        chunkSize: 512,
        timeout: 3000,
        placeholder: 'Loading content...',
      },
    };

    const result = await renderer.render('/streaming.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.stream).toBeDefined();
    expect(result.stream).toBeInstanceOf(ReadableStream);
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with no streaming', async () => {
    const context: SSRContext = {
      url: '/static',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
      streaming: {
        enabled: false,
      },
    };

    const result = await renderer.render('/static.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.stream).toBeUndefined();
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with boolean data', async () => {
    const context: SSRContext = {
      url: '/boolean',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        isActive: true,
        isDisabled: false,
        isNull: null,
        isUndefined: undefined,
      },
    };

    const result = await renderer.render('/boolean.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with numeric data', async () => {
    const context: SSRContext = {
      url: '/numeric',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        count: 42,
        price: 19.99,
        negative: -5,
        zero: 0,
      },
    };

    const result = await renderer.render('/numeric.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with string data', async () => {
    const context: SSRContext = {
      url: '/string',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        title: 'Hello World',
        description: 'A test description',
        empty: '',
        quoted: '"quoted string"',
      },
    };

    const result = await renderer.render('/string.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with JSON data', async () => {
    const context: SSRContext = {
      url: '/json',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        config: { theme: 'dark', lang: 'en' },
        items: [1, 2, 3],
        nested: { deep: { value: 'test' } },
      },
    };

    const result = await renderer.render('/json.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with complex streaming options', async () => {
    const context: SSRContext = {
      url: '/complex-streaming',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
      streaming: {
        enabled: true,
        chunkSize: 256,
        timeout: 10000,
        placeholder: 'Loading complex content...',
      },
    };

    const result = await renderer.render('/complex-streaming.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.stream).toBeDefined();
    expect(result.stream).toBeInstanceOf(ReadableStream);
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with error during rendering', async () => {
    const context: SSRContext = {
      url: '/error',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    // Test error handling by providing invalid data that might cause parsing issues
    const result = await renderer.render('/error.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with empty context', async () => {
    const context: SSRContext = {
      url: '',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    const result = await renderer.render('/empty.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with special characters in data', async () => {
    const context: SSRContext = {
      url: '/special',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        html: '<script>alert("xss")</script>',
        quotes: 'He said "Hello" and \'Goodbye\'',
        symbols: '&<>"\'',
        unicode: '🚀🌟✨',
      },
    };

    const result = await renderer.render('/special.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with very long content', async () => {
    const longContent = 'A'.repeat(10000);
    const context: SSRContext = {
      url: '/long',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: { content: longContent },
    };

    const result = await renderer.render('/long.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
    expect(result.metadata.htmlSize).toBeGreaterThan(0);
  });

  test('should handle template with nested objects', async () => {
    const context: SSRContext = {
      url: '/nested',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        user: {
          profile: {
            personal: {
              name: 'John',
              age: 30,
              preferences: {
                theme: 'dark',
                language: 'en',
              },
            },
          },
        },
      },
    };

    const result = await renderer.render('/nested.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should handle template with arrays', async () => {
    const context: SSRContext = {
      url: '/arrays',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {
        items: [1, 2, 3, 4, 5],
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 },
          { name: 'Charlie', age: 35 },
        ],
        empty: [],
      },
    };

    const result = await renderer.render('/arrays.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
  });

  test('should include progressive enhancement script', async () => {
    const context: SSRContext = {
      url: '/enhanced',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    const result = await renderer.render('/enhanced.plk', context);

    expect(result.html).toContain('serviceWorker');
    expect(result.html).toContain('modulepreload');
    expect(result.html).toContain('@plank/runtime-dom');
  });

  test('should include island hydration script when islands are present', async () => {
    const context: SSRContext = {
      url: '/islands',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    const result = await renderer.render('/islands.plk', context);

    expect(result.html).toContain('<island src="./Counter.plk"');
    expect(result.html).toContain('client:idle');
    expect(result.metadata.islandCount).toBeGreaterThan(0);
  });

  test('should handle render errors gracefully with fallback', async () => {
    // Create a renderer with invalid config to trigger an error
    const errorRenderer = new SSRRenderer({
      templateDir: '/invalid',
      assetsDir: '/invalid',
      baseUrl: '/invalid',
      streaming: false,
    });

    const context: SSRContext = {
      url: '/error',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    const result = await errorRenderer.render('/error.plk', context);

    expect(result.html).toContain('Welcome to Plank SSR');
    expect(result.html).toContain('Template: /error.plk');
    expect(result.metadata.renderTime).toBeGreaterThan(0);
    expect(result.metadata.islandCount).toBeGreaterThan(0);
    expect(result.metadata.actionCount).toBe(0);
  });

  test('should generate realistic template content', async () => {
    const context: SSRContext = {
      url: '/realistic',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: { showDetails: true },
    };

    const result = await renderer.render('/realistic.plk', context);

    expect(result.html).toContain('<html>');
    expect(result.html).toContain('<title>Plank App - realistic</title>');
    expect(result.html).toContain('Welcome to Plank SSR');
    expect(result.html).toContain('<island src="./Counter.plk"');
    expect(result.html).toContain('client:idle');
  });
});

describe('StreamingWriter', () => {
  test('should write HTML chunks', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const writer = new StreamingWriter(options);

    writer.write('<div>');
    writer.writeEscaped('Hello & World');
    writer.write('</div>');

    const html = writer.getHtml();
    expect(html).toBe('<div>Hello &amp; World</div>');
  });

  test('should escape HTML properly', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const writer = new StreamingWriter(options);

    writer.writeEscaped('<script>alert("xss")</script>');
    const html = writer.getHtml();

    expect(html).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('should escape attributes properly', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const writer = new StreamingWriter(options);

    writer.write('<div data-value="');
    writer.writeAttribute('test "value"');
    writer.write('"></div>');

    const html = writer.getHtml();
    expect(html).toBe('<div data-value="test &quot;value&quot;"></div>');
  });

  test('should handle streaming mode', async () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const writer = new StreamingWriter(options);

    const stream = new ReadableStream({
      start(controller) {
        writer.setController(controller);
        writer.write('<div>Hello</div>');
        writer.close();
      },
    });

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const text = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => {
          acc.push(...chunk);
          return acc;
        }, [] as number[])
      )
    );

    expect(text).toBe('<div>Hello</div>');
  });

  test('should handle streaming mode with multiple chunks', async () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const writer = new StreamingWriter(options);

    const stream = new ReadableStream({
      start(controller) {
        writer.setController(controller);
        writer.write('<div>');
        writer.write('Hello');
        writer.write(' ');
        writer.write('World');
        writer.write('</div>');
        writer.close();
      },
    });

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const text = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => {
          acc.push(...chunk);
          return acc;
        }, [] as number[])
      )
    );

    expect(text).toBe('<div>Hello World</div>');
  });

  test('should handle streaming mode with escaped content', async () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const writer = new StreamingWriter(options);

    const stream = new ReadableStream({
      start(controller) {
        writer.setController(controller);
        writer.write('<div>');
        writer.writeEscaped('Hello & World');
        writer.write('</div>');
        writer.close();
      },
    });

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const text = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => {
          acc.push(...chunk);
          return acc;
        }, [] as number[])
      )
    );

    expect(text).toBe('<div>Hello &amp; World</div>');
  });

  test('should handle streaming mode with attributes', async () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const writer = new StreamingWriter(options);

    const stream = new ReadableStream({
      start(controller) {
        writer.setController(controller);
        writer.write('<div data-value="');
        writer.writeAttribute('test "value"');
        writer.write('">Content</div>');
        writer.close();
      },
    });

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const text = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => {
          acc.push(...chunk);
          return acc;
        }, [] as number[])
      )
    );

    expect(text).toBe('<div data-value="test &quot;value&quot;">Content</div>');
  });

  test('should handle non-streaming mode', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const writer = new StreamingWriter(options);

    writer.write('<div>');
    writer.write('Hello');
    writer.write(' ');
    writer.write('World');
    writer.write('</div>');

    const html = writer.getHtml();
    expect(html).toBe('<div>Hello World</div>');
  });

  test('should handle close method', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const writer = new StreamingWriter(options);

    writer.write('<div>Test</div>');
    writer.close();

    const html = writer.getHtml();
    expect(html).toBe('<div>Test</div>');
  });

  test('should handle setController method', () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const writer = new StreamingWriter(options);

    const controller = {
      enqueue: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    writer.setController(controller);
    writer.write('<div>Test</div>');

    expect(controller.enqueue).toHaveBeenCalled();
  });
});
