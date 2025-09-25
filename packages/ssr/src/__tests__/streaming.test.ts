/**
 * @fileoverview Tests for streaming utilities
 */

import { describe, test, expect } from 'vitest';
import { StreamingResponse, ProgressiveEnhancement, StreamingTemplates } from '../streaming.js';
import type { StreamingOptions } from '../types.js';

describe('StreamingResponse', () => {
  test('should write HTML chunks', () => {
    const options: StreamingOptions = {
      enabled: false
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
      placeholder: 'Custom loading...'
    };
    const response = new StreamingResponse(options);

    response.writePlaceholder();
    const html = response.getHtml();
    
    expect(html).toContain('Custom loading...');
    expect(html).toContain('plank-placeholder');
  });

  test('should write hydration script', () => {
    const options: StreamingOptions = {
      enabled: false
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
      enabled: false
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
      enabled: true
    };
    const response = new StreamingResponse(options);

    const stream = response.createStream();
    expect(stream).toBeInstanceOf(ReadableStream);
  });
});

describe('ProgressiveEnhancement', () => {
  test('should generate enhancement script', () => {
    const script = ProgressiveEnhancement.generateEnhancementScript();
    
    expect(script).toContain('serviceWorker');
    expect(script).toContain('modulepreload');
    expect(script).toContain('@plank/runtime-dom');
  });

  test('should generate viewport meta', () => {
    const meta = ProgressiveEnhancement.generateViewportMeta();
    
    expect(meta).toContain('viewport');
    expect(meta).toContain('width=device-width');
  });

  test('should generate preconnect hints', () => {
    const hints = ProgressiveEnhancement.generatePreconnectHints([
      'https://api.example.com',
      'https://cdn.example.com'
    ]);
    
    expect(hints).toContain('preconnect');
    expect(hints).toContain('api.example.com');
    expect(hints).toContain('cdn.example.com');
  });
});

describe('StreamingTemplates', () => {
  test('should generate document structure', () => {
    const html = StreamingTemplates.generateDocument(
      'Test Page',
      '<h1>Hello</h1>',
      {
        lang: 'en',
        styles: ['/style.css'],
        scripts: ['/app.js'],
        preconnect: ['https://api.example.com']
      }
    );

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('style.css');
    expect(html).toContain('app.js');
    expect(html).toContain('api.example.com');
  });

  test('should generate card skeleton', () => {
    const skeleton = StreamingTemplates.generateSkeleton('card');
    
    expect(skeleton).toContain('skeleton-card');
    expect(skeleton).toContain('skeleton-image');
    expect(skeleton).toContain('skeleton-content');
    expect(skeleton).toContain('@keyframes');
  });

  test('should generate list skeleton', () => {
    const skeleton = StreamingTemplates.generateSkeleton('list');
    
    expect(skeleton).toContain('skeleton-list');
    expect(skeleton).toContain('skeleton-item');
  });

  test('should generate text skeleton', () => {
    const skeleton = StreamingTemplates.generateSkeleton('text');
    
    expect(skeleton).toContain('skeleton-text');
    expect(skeleton).toContain('skeleton-line');
  });

  test('should generate image skeleton', () => {
    const skeleton = StreamingTemplates.generateSkeleton('image');
    
    expect(skeleton).toContain('skeleton-image');
  });
});
