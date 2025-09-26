/**
 * @fileoverview Dev command implementation
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDevServer } from '@plank/dev-server';

export interface DevOptions {
  port?: string;
  host?: string;
  open?: boolean;
  routesDir?: string;
  https?: boolean;
}

export async function devCommand(options: DevOptions = {}): Promise<void> {
  const port = parseInt(options.port || '3000', 10);
  const host = options.host || 'localhost';
  const open = options.open ?? true;
  const routesDir = options.routesDir || './app/routes';
  const https = options.https ?? false;

  // Check if we're in a Plank project
  const projectRoot = process.cwd();
  const routesPath = resolve(projectRoot, routesDir);

  if (!existsSync(routesPath)) {
    console.error(`❌ Routes directory not found: ${routesPath}`);
    console.error(
      "💡 Make sure you're in a Plank project directory or specify the correct routes directory with --routes-dir"
    );
    process.exit(1);
  }

  console.log('🚀 Starting Plank development server...');
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`📂 Routes directory: ${routesDir}`);
  console.log(`🌐 Server: http${https ? 's' : ''}://${host}:${port}`);

  try {
    const server = createDevServer({
      root: projectRoot,
      port,
      host,
      open,
      routesDir,
      hmr: true,
      watch: true,
      plugins: [],
      env: {},
      https,
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down development server...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await server.start();

    console.log('✅ Development server started successfully!');
    console.log('📝 Edit your .plk files and see changes instantly');
    console.log('🔄 Press Ctrl+C to stop the server');
  } catch (error) {
    console.error('❌ Failed to start development server:');
    console.error(error);
    process.exit(1);
  }
}
