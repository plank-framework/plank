/**
 * @fileoverview Convert Node.js HTTP requests to Web Request objects
 */

import type { IncomingMessage } from 'node:http';

/**
 * Convert Node.js IncomingMessage to Web Request
 */
export function nodeRequestToWebRequest(req: IncomingMessage, baseURL: string): Request {
  const url = new URL(req.url || '/', baseURL);
  const method = req.method || 'GET';

  // Build headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  // Build request init
  const init: RequestInit = {
    method,
    headers,
  };

  // Add body for methods that support it
  if (method !== 'GET' && method !== 'HEAD') {
    // Convert Node stream to ReadableStream
    init.body = nodeStreamToReadableStream(req);
    // Required for streaming request bodies
    (init as { duplex?: string }).duplex = 'half';
  }

  return new Request(url.toString(), init);
}

/**
 * Convert Node.js readable stream to Web ReadableStream
 */
function nodeStreamToReadableStream(nodeStream: IncomingMessage): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      nodeStream.on('end', () => {
        controller.close();
      });

      nodeStream.on('error', (err) => {
        controller.error(err);
      });
    },

    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * Get base URL from request
 */
export function getBaseURL(req: IncomingMessage): string {
  const protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http';
  const host = req.headers.host || 'localhost';
  return `${protocol}://${host}`;
}
