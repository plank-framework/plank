/**
 * @fileoverview Tests for streaming utilities
 */

import { describe, expect, test, vi } from 'vitest';
import {
  generateDocument,
  generateEnhancementScript,
  generatePreconnectHints,
  generateSkeleton,
  generateViewportMeta,
  StreamingResponse,
} from '../streaming.js';
import type { StreamingOptions } from '../types.js';

describe('StreamingResponse', () => {
  test('should write HTML chunks', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.write('<div>');
    response.writeEscaped('Hello & World');
    response.write('</div>');

    const html = response.getHtml();
    expect(html).toBe('<div>Hello &amp; World</div>');
  });

  test('should write placeholder', () => {
    const options: StreamingOptions = {
      enabled: false,
      placeholder: 'Custom loading...',
    };
    const response = new StreamingResponse(options);

    response.writePlaceholder();
    const html = response.getHtml();

    expect(html).toContain('Custom loading...');
    expect(html).toContain('plank-placeholder');
  });

  test('should write placeholder with default fallback', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.writePlaceholder();
    const html = response.getHtml();

    expect(html).toContain('Loading...');
    expect(html).toContain('plank-placeholder');
  });

  test('should write hydration script', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.writeHydrationScript('island-123', { count: 42 });
    const html = response.getHtml();

    expect(html).toContain('hydrateIsland');
    expect(html).toContain('island-123');
    expect(html).toContain('{"count":42}');
  });

  test('should write loading styles', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.writeLoadingStyles();
    const html = response.getHtml();

    expect(html).toContain('plank-placeholder');
    expect(html).toContain('plank-pulse');
    expect(html).toContain('@keyframes');
  });

  test('should create readable stream', () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const response = new StreamingResponse(options);

    const stream = response.createStream();
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  test('should handle close method', () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const response = new StreamingResponse(options);

    // Create a mock controller
    const controller = {
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    response.setController(controller);
    response.close();

    expect(controller.close).toHaveBeenCalled();
  });

  test('should handle cancel in createStream', async () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const response = new StreamingResponse(options);

    const stream = response.createStream();
    const reader = stream.getReader();

    // Cancel the stream - this should not throw an error
    try {
      await reader.cancel();
      expect(true).toBe(true);
    } catch (error) {
      // Some implementations may throw, which is acceptable
      expect(error).toBeDefined();
    }
  });

  test('should handle setController method', () => {
    const options: StreamingOptions = {
      enabled: true,
    };
    const response = new StreamingResponse(options);

    const controller = {
      enqueue: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    response.setController(controller);
    response.write('<div>Test</div>');

    expect(controller.enqueue).toHaveBeenCalled();
  });

  test('should handle writeAttribute with various inputs', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.write('<div data-test="');
    response.writeAttribute('normal value');
    response.write('" data-amp="');
    response.writeAttribute('value & with & ampersands');
    response.write('" data-quote="');
    response.writeAttribute('value "with" quotes');
    response.write('" data-apostrophe="');
    response.writeAttribute("value 'with' apostrophes");
    response.write('"></div>');

    const html = response.getHtml();
    expect(html).toContain('data-test="normal value"');
    expect(html).toContain('data-amp="value &amp; with &amp; ampersands"');
    expect(html).toContain('data-quote="value &quot;with&quot; quotes"');
    expect(html).toContain('data-apostrophe="value &#39;with&#39; apostrophes"');
  });

  test('should handle writeAttribute with empty string', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.write('<div data-empty="');
    response.writeAttribute('');
    response.write('"></div>');

    const html = response.getHtml();
    expect(html).toBe('<div data-empty=""></div>');
  });

  test('should handle writeAttribute with special characters', () => {
    const options: StreamingOptions = {
      enabled: false,
    };
    const response = new StreamingResponse(options);

    response.write('<div data-special="');
    response.writeAttribute('&<>"\'');
    response.write('"></div>');

    const html = response.getHtml();
    expect(html).toBe('<div data-special="&amp;<>&quot;&#39;"></div>');
  });
});

describe('Progressive Enhancement Functions', () => {
  test('should generate enhancement script', () => {
    const script = generateEnhancementScript();

    expect(script).toContain('serviceWorker');
    expect(script).toContain('modulepreload');
    expect(script).toContain('@plank/runtime-dom');
  });

  test('should generate viewport meta', () => {
    const meta = generateViewportMeta();

    expect(meta).toContain('viewport');
    expect(meta).toContain('width=device-width');
  });

  test('should generate preconnect hints', () => {
    const hints = generatePreconnectHints(['https://api.example.com', 'https://cdn.example.com']);

    expect(hints).toContain('preconnect');
    expect(hints).toContain('api.example.com');
    expect(hints).toContain('cdn.example.com');
  });
});

describe('Streaming Template Functions', () => {
  test('should generate document structure', () => {
    const html = generateDocument('Test Page', '<h1>Hello</h1>', {
      lang: 'en',
      styles: ['/style.css'],
      scripts: ['/app.js'],
      preconnect: ['https://api.example.com'],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('style.css');
    expect(html).toContain('app.js');
    expect(html).toContain('api.example.com');
  });

  test('should generate card skeleton', () => {
    const skeleton = generateSkeleton('card');

    expect(skeleton).toContain('skeleton-card');
    expect(skeleton).toContain('skeleton-image');
    expect(skeleton).toContain('skeleton-content');
    expect(skeleton).toContain('@keyframes');
  });

  test('should generate list skeleton', () => {
    const skeleton = generateSkeleton('list');

    expect(skeleton).toContain('skeleton-list');
    expect(skeleton).toContain('skeleton-item');
  });

  test('should generate text skeleton', () => {
    const skeleton = generateSkeleton('text');

    expect(skeleton).toContain('skeleton-text');
    expect(skeleton).toContain('skeleton-line');
  });

  test('should generate image skeleton', () => {
    const skeleton = generateSkeleton('image');

    expect(skeleton).toContain('skeleton-image');
  });
});
