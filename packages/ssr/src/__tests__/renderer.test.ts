/**
 * @fileoverview Tests for server-side renderer
 */

import { describe, expect, test } from 'vitest';
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
    expect(result.html).toContain('Hello from Plank SSR!');
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
    expect(result.metadata.islandCount).toBe(0);
    expect(result.metadata.actionCount).toBe(0);
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
      new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
    );

    expect(text).toBe('<div>Hello</div>');
  });
});
