/**
 * @fileoverview Preview command implementation
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';

export interface PreviewOptions {
  port?: string;
  host?: string;
  dist?: string;
}

export async function previewCommand(options: PreviewOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const port = parseInt(options.port || '3000', 10);
  const host = options.host || 'localhost';
  const distDir = options.dist || './dist';

  // Check if build output exists
  const distPath = resolve(projectRoot, distDir);

  if (!existsSync(distPath)) {
    console.error(`❌ Build output not found: ${distPath}`);
    console.error('💡 Run "plank build" first to create a production build');
    process.exit(1);
  }

  console.log('👀 Starting Plank preview server...');
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`📦 Serving from: ${distDir}`);
  console.log(`🌐 Server: http://${host}:${port}`);

  try {
    // Create a simple static file server
    const server = createServer(async (req, res) => {
      try {
        const filePath = resolveFilePath(req.url || '/', distPath);

        if (!isPathSafe(filePath, distPath)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        const content = await readFile(filePath);
        const contentType = getContentType(filePath);

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (_error) {
        send404Response(res);
      }
    });

    // Start the server
    server.listen(port, host, () => {
      console.log('✅ Preview server started successfully!');
      console.log(`🌐 Preview available at: http://${host}:${port}`);
      console.log('');
      console.log('🔄 Press Ctrl+C to stop the server');
    });

    // Handle graceful shutdown
    const shutdown = () => {
      console.log('\n🛑 Shutting down preview server...');
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ Failed to start preview server:');
    console.error(error);
    process.exit(1);
  }
}

function resolveFilePath(url: string, distPath: string): string {
  if (url === '/') {
    return resolve(distPath, 'index.html');
  }

  const relativePath = url.startsWith('/') ? url.slice(1) : url;
  let filePath = resolve(distPath, relativePath);

  if (filePath.endsWith('/')) {
    filePath = resolve(filePath, 'index.html');
  } else if (!existsSync(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (existsSync(htmlPath)) {
      filePath = htmlPath;
    }
  }

  return filePath;
}

function isPathSafe(filePath: string, distPath: string): boolean {
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const normalizedDistPath = distPath.replace(/\\/g, '/');
  return normalizedFilePath.startsWith(normalizedDistPath);
}

function getContentType(filePath: string): string {
  const ext = extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

function send404Response(res: ServerResponse<IncomingMessage>): void {
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>404 - Not Found</title>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <a href="/">← Back to home</a>
      </body>
    </html>
  `);
}
