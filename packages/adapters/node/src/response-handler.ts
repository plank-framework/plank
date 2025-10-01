/**
 * @fileoverview Convert Web Response to Node.js HTTP response
 */

import { createReadStream } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Send Web Response to Node.js ServerResponse
 */
export async function sendWebResponse(
  webResponse: Response,
  nodeResponse: ServerResponse
): Promise<void> {
  // Set status
  nodeResponse.statusCode = webResponse.status;
  nodeResponse.statusMessage = webResponse.statusText;

  // Set headers
  for (const [key, value] of webResponse.headers.entries()) {
    nodeResponse.setHeader(key, value);
  }

  // Send body
  if (webResponse.body) {
    await pipeWebStreamToNode(webResponse.body, nodeResponse);
  } else {
    nodeResponse.end();
  }
}

/**
 * Pipe Web ReadableStream to Node.js response
 */
async function pipeWebStreamToNode(
  webStream: ReadableStream<Uint8Array>,
  nodeResponse: ServerResponse
): Promise<void> {
  const reader = webStream.getReader();
  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();

        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (error) {
        this.destroy(error as Error);
      }
    },
  });

  await pipeline(nodeStream, nodeResponse);
}

/**
 * Send file as response
 */
export async function sendFile(
  filePath: string,
  nodeResponse: ServerResponse,
  options: {
    contentType?: string;
    cacheControl?: string;
  } = {}
): Promise<void> {
  // Set headers
  if (options.contentType) {
    nodeResponse.setHeader('Content-Type', options.contentType);
  }

  if (options.cacheControl) {
    nodeResponse.setHeader('Cache-Control', options.cacheControl);
  }

  // Stream file
  const fileStream = createReadStream(filePath);

  await pipeline(fileStream, nodeResponse);
}

/**
 * Send error response
 */
export function sendError(error: Error, nodeResponse: ServerResponse, dev = false): void {
  nodeResponse.statusCode = 500;
  nodeResponse.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = dev ? createDevErrorPage(error) : createProdErrorPage();

  nodeResponse.end(html);
}

/**
 * Create development error page
 */
function createDevErrorPage(error: Error): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Internal Server Error</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #e53e3e; }
    pre { background: #f7fafc; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <h1>⚠️ Internal Server Error</h1>
  <h2>${error.name}: ${error.message}</h2>
  <pre><code>${error.stack || 'No stack trace available'}</code></pre>
</body>
</html>
  `.trim();
}

/**
 * Create production error page
 */
function createProdErrorPage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Internal Server Error</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
    h1 { color: #718096; }
  </style>
</head>
<body>
  <h1>500 - Internal Server Error</h1>
  <p>Something went wrong. Please try again later.</p>
</body>
</html>
  `.trim();
}
