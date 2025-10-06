/**
 * @fileoverview Streaming SSR utilities for Deno adapter
 */

/**
 * Streaming response options
 */
export interface StreamingOptions {
  /** Enable backpressure handling */
  backpressure?: boolean;
  /** Chunk size for streaming */
  chunkSize?: number;
  /** Timeout for stream operations */
  timeout?: number;
}

/**
 * Create a stream with backpressure handling
 */
function createBackpressureStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const reader = stream.getReader();
      let isReading = false;

      const pump = async (): Promise<void> => {
        if (isReading) return;
        isReading = true;

        try {
          await processStream(reader, controller);
        } catch (error) {
          controller.error(error);
        } finally {
          isReading = false;
        }
      };

      const processStream = async (
        reader: ReadableStreamDefaultReader<Uint8Array>,
        controller: ReadableStreamDefaultController<Uint8Array>
      ): Promise<void> => {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          // Check if we can write without backpressure
          if (controller.desiredSize && controller.desiredSize <= 0) {
            // Backpressure detected, wait a bit
            await new Promise((resolve) => setTimeout(resolve, 10));
            continue;
          }

          controller.enqueue(value);
        }
      };

      pump();
    },
    cancel() {
      stream.cancel();
    },
  });
}

/**
 * Create a streaming response with backpressure handling
 */
export function createStreamingResponse(
  stream: ReadableStream<Uint8Array>,
  options: StreamingOptions = {}
): Response {
  const { backpressure = true } = options;

  // Wrap the stream with backpressure handling if enabled
  const wrappedStream = backpressure ? createBackpressureStream(stream) : stream;

  return new Response(wrappedStream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

/**
 * Convert a string to a streaming response
 */
export function stringToStreamResponse(content: string, options: StreamingOptions = {}): Response {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  // Split content into chunks
  const chunkSize = options.chunkSize || 8192;
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(encoder.encode(content.slice(i, i + chunkSize)));
  }

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return createStreamingResponse(stream, options);
}

/**
 * Create a streaming response from an async generator
 */
export function createAsyncStreamResponse(
  generator: AsyncGenerator<string, void, unknown>,
  options: StreamingOptions = {}
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return createStreamingResponse(stream, options);
}

/**
 * Create a streaming response from Deno file
 */
export function createFileStreamResponse(
  file: Deno.FsFile,
  options: StreamingOptions = {}
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const pump = async (): Promise<void> => {
        try {
          await processFileStream(file, controller, options);
        } catch (error) {
          controller.error(error);
        }
      };

      pump();
    },
    cancel() {
      file.close();
    },
  });

  return createStreamingResponse(stream, options);
}

/**
 * Process file stream with backpressure handling
 */
async function processFileStream(
  file: Deno.FsFile,
  controller: ReadableStreamDefaultController<Uint8Array>,
  options: StreamingOptions
): Promise<void> {
  const buffer = new Uint8Array(8192);

  while (true) {
    const bytesRead = await file.read(buffer);
    if (bytesRead === null || bytesRead === 0) {
      controller.close();
      break;
    }

    // Check backpressure
    if (options.backpressure && controller.desiredSize && controller.desiredSize <= 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }

    controller.enqueue(buffer.slice(0, bytesRead));
  }
}
