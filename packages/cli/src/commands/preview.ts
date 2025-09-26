/**
 * @fileoverview Preview command implementation
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
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
        let filePath = resolve(distPath, req.url || '/');

        // Handle directory requests
        if (filePath.endsWith('/')) {
          filePath = resolve(filePath, 'index.html');
        }

        // Security check - ensure file is within dist directory
        if (!filePath.startsWith(distPath)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        // Try to read the file
        const content = await readFile(filePath);
        const ext = extname(filePath);

        // Set appropriate content type
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

        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (_error) {
        // File not found or other error
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
