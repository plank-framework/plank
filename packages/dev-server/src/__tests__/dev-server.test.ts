/**
 * @fileoverview Tests for development server
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDevServer, defaultDevServerConfig, PlankDevServer } from '../dev-server.js';
import type { DevServerConfig } from '../types.js';

// Mock vite
vi.mock('vite', () => ({
  createServer: vi.fn(),
}));

// Mock @plank/router
vi.mock('@plank/router', () => ({
  createRouter: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    watch: vi.fn(),
  };
});

describe('PlankDevServer', () => {
  let config: DevServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      root: '/test/project',
      port: 3000,
      host: 'localhost',
      open: false,
      routesDir: './app/routes',
      hmr: true,
      watch: false, // Disable watching in tests
      plugins: [],
      env: {},
      https: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should create dev server with default config', () => {
    const server = createDevServer(defaultDevServerConfig);
    expect(server).toBeInstanceOf(PlankDevServer);
  });

  test('should create dev server with custom config', () => {
    const server = new PlankDevServer(config);
    expect(server).toBeInstanceOf(PlankDevServer);
  });

  test('should start development server', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.start();

    expect(createRouter).toHaveBeenCalled();
    expect(createServer).toHaveBeenCalled();
    expect(mockViteServer.listen).toHaveBeenCalled();
    expect(server.isRunning()).toBe(true);
  });

  test('should stop development server', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.start();
    await server.stop();

    expect(mockViteServer.close).toHaveBeenCalled();
    expect(mockRouter.destroy).toHaveBeenCalled();
    expect(server.isRunning()).toBe(false);
  });

  test('should restart development server', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.restart();

    expect(mockRouter.initialize).toHaveBeenCalledTimes(1);
    expect(mockViteServer.listen).toHaveBeenCalledTimes(1);
    expect(server.isRunning()).toBe(true);
  });

  test('should get server URL', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.start();

    const url = server.getUrl();
    expect(url).toBe('http://localhost:3000');
  });

  test('should get router instance', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.start();

    const router = server.getRouter();
    expect(router).toBe(mockRouter);
  });

  test('should throw error when getting URL without running server', () => {
    const server = new PlankDevServer(config);

    expect(() => server.getUrl()).toThrow('Server is not running');
  });

  test('should throw error when getting router without initialization', () => {
    const server = new PlankDevServer(config);

    expect(() => server.getRouter()).toThrow('Router is not initialized');
  });

  test('should not start server if already running', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.start();
    await server.start(); // Second start should be ignored

    expect(mockRouter.initialize).toHaveBeenCalledTimes(1);
    expect(mockViteServer.listen).toHaveBeenCalledTimes(1);
  });

  test('should not stop server if not running', async () => {
    const { createServer } = await import('vite');
    const { createRouter } = await import('@plank/router');

    const mockViteServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ws: {
        send: vi.fn(),
      },
    };

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    vi.mocked(createServer).mockResolvedValue(
      mockViteServer as unknown as Awaited<ReturnType<typeof createServer>>
    );
    vi.mocked(createRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof createRouter>
    );

    const server = new PlankDevServer(config);
    await server.stop(); // Stop without starting should be ignored

    expect(mockViteServer.close).not.toHaveBeenCalled();
    expect(mockRouter.destroy).not.toHaveBeenCalled();
  });
});
