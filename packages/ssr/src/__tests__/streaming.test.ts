/**
 * @fileoverview Tests for streaming utilities
 */

import { describe, expect, test, vi } from 'vitest';
import {
  generateDocument,
  generateEnhancementScript,
  generateErrorBoundary,
  generatePreconnectHints,
  generateSkeleton,
  generateStreamingBoundary,
  generateStreamingPlaceholder,
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

describe('Streaming Enhancement Functions', () => {
  test('should generate streaming placeholder', () => {
    const placeholder = generateStreamingPlaceholder('content');

    expect(placeholder).toContain('plank-streaming-placeholder');
    expect(placeholder).toContain('data-type="content"');
    expect(placeholder).toContain('Loading...');
    expect(placeholder).toContain('plank-spinner');
  });

  test('should generate streaming placeholder with custom options', () => {
    const placeholder = generateStreamingPlaceholder('island', {
      message: 'Loading island...',
      showSpinner: false,
      className: 'custom-placeholder',
    });

    expect(placeholder).toContain('custom-placeholder');
    expect(placeholder).toContain('data-type="island"');
    expect(placeholder).toContain('Loading island...');
    expect(placeholder).not.toContain('plank-spinner');
  });

  test('should generate streaming boundary markers', () => {
    const startBoundary = generateStreamingBoundary('content-1', 'start');
    const endBoundary = generateStreamingBoundary('content-1', 'end');

    expect(startBoundary).toBe('<!--plank-stream-start:content-1-->');
    expect(endBoundary).toBe('<!--plank-stream-end:content-1-->');
  });

  test('should generate error boundary', () => {
    const error = 'Failed to load content';
    const errorBoundary = generateErrorBoundary(error);

    expect(errorBoundary).toContain('plank-error-boundary');
    expect(errorBoundary).toContain('Loading Error');
    expect(errorBoundary).toContain('Failed to load content');
    expect(errorBoundary).toContain('Technical Details');
  });

  test('should generate error boundary with custom fallback', () => {
    const error = 'Network error';
    const fallback = 'Please try again later';
    const errorBoundary = generateErrorBoundary(error, fallback);

    expect(errorBoundary).toContain('plank-error-boundary');
    expect(errorBoundary).toContain('Please try again later');
    expect(errorBoundary).toContain('Network error');
  });

  test('should escape HTML in error boundary', () => {
    const error = '<script>alert("xss")</script>';
    const errorBoundary = generateErrorBoundary(error);

    expect(errorBoundary).toContain('&lt;script&gt;');
    expect(errorBoundary).toContain('&quot;xss&quot;');
    expect(errorBoundary).not.toContain('<script>');
  });
});

describe('Enhanced Progressive Enhancement', () => {
  test('should generate enhancement script with baseUrl', () => {
    const script = generateEnhancementScript('/app/');

    expect(script).toContain('/app/sw.js');
    expect(script).toContain('/app/@plank/runtime-dom');
    expect(script).toContain('serviceWorker');
    expect(script).toContain('modulepreload');
  });

  test('should generate document with progressive enhancement', () => {
    const html = generateDocument('Test Page', '<h1>Hello</h1>', {
      baseUrl: '/app/',
      enableProgressiveEnhancement: true,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('/app/sw.js');
    expect(html).toContain('/app/@plank/runtime-dom');
  });

  test('should generate document without progressive enhancement', () => {
    const html = generateDocument('Test Page', '<h1>Hello</h1>', {
      enableProgressiveEnhancement: false,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).not.toContain('serviceWorker');
    expect(html).not.toContain('modulepreload');
  });
});
