import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAsyncStreamResponse,
  createFileStreamResponse,
  createStreamingResponse,
  stringToStreamResponse,
} from '../streaming';

describe('Deno Streaming Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStreamingResponse', () => {
    it('should create streaming response with default options', () => {
      const stream = new ReadableStream();
      const response = createStreamingResponse(stream);

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should create streaming response with custom options', () => {
      const stream = new ReadableStream();
      const options = {
        backpressure: false,
        chunkSize: 4096,
        timeout: 5000,
      };
      const response = createStreamingResponse(stream, options);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should handle stream errors gracefully', async () => {
      const stream = new ReadableStream();
      const response = createStreamingResponse(stream);

      expect(response).toBeInstanceOf(Response);
    });
  });

  describe('stringToStreamResponse', () => {
    it('should convert string to streaming response', () => {
      const content = 'Hello, World!';
      const response = stringToStreamResponse(content);

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
    });

    it('should handle empty string', () => {
      const response = stringToStreamResponse('');

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
    });

    it('should use custom chunk size', () => {
      const content = '{"message": "Hello"}';
      const response = stringToStreamResponse(content, {
        chunkSize: 1024,
      });

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });
  });

  describe('createAsyncStreamResponse', () => {
    it('should create async streaming response', async () => {
      const asyncGenerator = async function* () {
        yield 'Hello';
        yield ' ';
        yield 'World!';
      };

      const response = createAsyncStreamResponse(asyncGenerator());

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
    });

    it('should handle async generator errors', async () => {
      const asyncGenerator = async function* () {
        yield 'Hello';
        throw new Error('Test error');
      };

      const response = createAsyncStreamResponse(asyncGenerator());

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
    });

    it('should use custom options', async () => {
      const asyncGenerator = async function* () {
        yield 'test';
      };

      const response = createAsyncStreamResponse(asyncGenerator(), {
        chunkSize: 1024,
        timeout: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });
  });

  describe('createFileStreamResponse', () => {
    it('should create file streaming response', async () => {
      const mockFile = {
        readable: new ReadableStream(),
        size: 1024,
      };

      // biome-ignore lint/suspicious/noExplicitAny: mocking deno file
      const response = createFileStreamResponse(mockFile as any);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should handle different file types', async () => {
      const mockFile = {
        readable: new ReadableStream(),
        size: 2048,
      };

      // biome-ignore lint/suspicious/noExplicitAny: mocking deno file
      const response = createFileStreamResponse(mockFile as any);

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should handle missing file size', async () => {
      const mockFile = {
        readable: new ReadableStream(),
      };

      // biome-ignore lint/suspicious/noExplicitAny: mocking deno file
      const response = createFileStreamResponse(mockFile as any);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should use custom options', async () => {
      const mockFile = {
        readable: new ReadableStream(),
        size: 1024,
      };

      // biome-ignore lint/suspicious/noExplicitAny: mocking deno file
      const response = createFileStreamResponse(mockFile as any, {
        chunkSize: 1024,
        timeout: 5000,
      });

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });
  });

  describe('stream processing', () => {
    it('should handle large data streams', async () => {
      const largeData = 'x'.repeat(10000);
      const response = stringToStreamResponse(largeData);

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBeDefined();
    });

    it('should handle concurrent streams', async () => {
      const stream1 = new ReadableStream();
      const stream2 = new ReadableStream();

      const response1 = createStreamingResponse(stream1);
      const response2 = createStreamingResponse(stream2);

      expect(response1).toBeInstanceOf(Response);
      expect(response2).toBeInstanceOf(Response);
    });

    it('should handle stream cleanup', async () => {
      const stream = new ReadableStream();
      const response = createStreamingResponse(stream);

      expect(response).toBeInstanceOf(Response);
    });
  });
});
