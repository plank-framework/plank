/**
 * @fileoverview Development server implementation
 */

import { EventEmitter } from 'node:events';
import { watch } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { relative, resolve } from 'node:path';

import type { FileBasedRouter } from '@plank/router';
import type { ViteDevServer } from 'vite';

import type { DevServer, DevServerConfig, FileChangeEvent, HMRUpdate } from './types.js';
import { plankPlugin } from './vite-plugin.js';

/**
 * Development server implementation
 */
export class PlankDevServer extends EventEmitter implements DevServer {
  private server: ViteDevServer | null = null;
  private router: FileBasedRouter | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private config: DevServerConfig;
  private isRunningFlag = false;

  constructor(config: DevServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the development server
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      return;
    }

    try {
      // Create router
      const { createRouter } = await import('@plank/router');
      this.router = createRouter({
        routesDir: this.config.routesDir,
        layoutsDir: resolve(this.config.routesDir, '../layouts'),
        extensions: ['.plk', '.ts', '.js'],
        defaultLayout: undefined,
        generateManifest: true,
        manifestPath: undefined,
        watch: this.config.watch,
      });

      await this.router.initialize();

      // Create Vite server
      const { createServer } = await import('vite');
      this.server = await createServer({
        root: this.config.root,
        server: {
          port: this.config.port,
          host: this.config.host,
          open: this.config.open,
          https: this.config.https
            ? {
                cert: this.config.cert,
                key: this.config.key,
              }
            : undefined,
          // biome-ignore lint/suspicious/noExplicitAny: Vite server config type compatibility
        } as any,
        plugins: [
          plankPlugin({
            routesDir: this.config.routesDir,
            hmr: this.config.hmr,
            sourcemap: true,
          }),
          // Add middleware plugin for routing
          {
            name: 'plank-router-middleware',
            configureServer: (server) => {
              server.middlewares.use(async (req, res, next) => {
                try {
                  const handled = await this.handleRouteRequest(req, res);
                  if (!handled) {
                    next();
                  }
                } catch (error) {
                  console.error('Route rendering error:', error);
                  next();
                }
              });
            },
          },
          ...this.config.plugins,
        ],
        define: {
          'process.env': this.config.env,
        },
        resolve: {
          alias: {
            '@': resolve(this.config.root, 'src'),
            '~': this.config.root,
            // biome-ignore lint/suspicious/noExplicitAny: Vite alias config type compatibility
          } as any,
        },
      });

      // Start file watching
      if (this.config.watch) {
        this.startWatching();
      }

      // Start the server
      await this.server.listen();
      this.isRunningFlag = true;

      this.emit('server:start');
    } catch (error) {
      this.emit('error', {
        message: `Failed to start development server: ${(error as Error).message}`,
        stack: (error as Error).stack,
        type: 'error',
      });
      throw error;
    }
  }

  /**
   * Stop the development server
   */
  async stop(): Promise<void> {
    if (!this.isRunningFlag) {
      return;
    }

    try {
      // Stop file watching
      this.stopWatching();

      // Stop Vite server
      if (this.server) {
        await this.server.close();
        this.server = null;
      }

      // Cleanup router
      if (this.router) {
        this.router.destroy();
        this.router = null;
      }

      this.isRunningFlag = false;
      this.emit('server:stop');
    } catch (error) {
      this.emit('error', {
        message: `Failed to stop development server: ${(error as Error).message}`,
        stack: (error as Error).stack,
        type: 'error',
      });
      throw error;
    }
  }

  /**
   * Restart the development server
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }

    const protocol = this.config.https ? 'https' : 'http';
    const host = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
    return `${protocol}://${host}:${this.config.port}`;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Get the router instance
   */
  getRouter(): FileBasedRouter {
    if (!this.router) {
      throw new Error('Router is not initialized');
    }
    return this.router;
  }

  /**
   * Handle route request
   */
  private async handleRouteRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    // Skip non-GET requests and API routes
    if (req.method !== 'GET' || req.url?.startsWith('/api/') || req.url?.startsWith('/_vite')) {
      return false;
    }

    // Get the router and try to match the route
    const router = this.router;
    if (!router) {
      return false;
    }

    const match = router.match(req.url || '/');
    if (!match) {
      return false;
    }

    // Import and render the route component
    const { SSRRenderer } = await import('@plank/ssr');
    const renderer = new SSRRenderer({
      templateDir: this.config.root,
      assetsDir: resolve(this.config.root, 'dist'),
      baseUrl: `http://${this.config.host}:${this.config.port}`,
      streaming: false,
    });

    const result = await renderer.render(match.route.pagePath, {
      url: req.url || '/',
      method: req.method || 'GET',
      headers: req.headers as Record<string, string>,
      params: match.params,
      query: Object.fromEntries(new URL(req.url || '/', `http://${req.headers.host}`).searchParams),
      data: {},
    });

    const html = result.html;

    res.setHeader('Content-Type', 'text/html');
    res.end(html);
    return true;
  }

  /**
   * Start file watching
   */
  private startWatching(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(
      this.config.routesDir,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename || filename.startsWith('.')) {
          return;
        }

        const filePath = resolve(this.config.routesDir, filename);
        const relativePath = relative(this.config.root, filePath);

        const changeEvent: FileChangeEvent = {
          type: eventType === 'rename' ? 'add' : 'change',
          path: relativePath,
          timestamp: Date.now(),
        };

        this.emit('file:change', changeEvent);

        // Handle route updates
        if (filename.endsWith('.plk')) {
          this.emit('route:update', relativePath);
        }

        // Send HMR update
        if (this.config.hmr && this.server) {
          const update: HMRUpdate = {
            type: 'js-update',
            path: relativePath,
            timestamp: Date.now(),
          };

          this.emit('hmr:update', update);

          // Send to Vite HMR
          this.server.ws.send({
            type: 'update',
            updates: [
              {
                type: 'js-update',
                path: relativePath,
                timestamp: Date.now(),
                acceptedPath: relativePath,
              },
            ],
          });
        }
      }
    );
  }

  /**
   * Stop file watching
   */
  private stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

/**
 * Create a new development server
 */
export function createDevServer(config: DevServerConfig): PlankDevServer {
  return new PlankDevServer(config);
}

/**
 * Default development server configuration
 */
export const defaultDevServerConfig: DevServerConfig = {
  root: process.cwd(),
  port: 3000,
  host: 'localhost',
  open: true,
  routesDir: './app/routes',
  hmr: true,
  watch: true,
  plugins: [],
  env: {},
  https: false,
};
