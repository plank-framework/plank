/**
 * @fileoverview Unit tests for Bun adapter streaming utilities
 */

import { describe, expect, it } from 'vitest';
import {
  createAsyncStreamResponse,
  createBackpressureStream,
  createStreamingResponse,
  stringToStreamResponse,
} from '../streaming.js';

describe('Streaming utilities', () => {
  describe('createStreamingResponse', () => {
    it('should create streaming response with default options', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.close();
        },
      });

      const response = createStreamingResponse(stream);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should create streaming response with custom options', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const response = createStreamingResponse(stream, {
        contentType: 'application/json',
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('stringToStreamResponse', () => {
    it('should convert string to streaming response', () => {
      const response = stringToStreamResponse('Hello World');

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should handle empty string', () => {
      const response = stringToStreamResponse('');

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('createAsyncStreamResponse', () => {
    it('should create response from async generator', () => {
      async function* generator() {
        yield 'Hello';
        yield 'World';
      }

      const response = createAsyncStreamResponse(generator());

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('createBackpressureStream', () => {
    it('should create backpressure stream wrapper', () => {
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('test'));
          controller.close();
        },
      });

      const backpressureStream = createBackpressureStream(sourceStream);

      expect(backpressureStream).toBeInstanceOf(ReadableStream);
    });

    it('should handle empty stream', () => {
      const sourceStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const backpressureStream = createBackpressureStream(sourceStream);

      expect(backpressureStream).toBeInstanceOf(ReadableStream);
    });
  });
});
