/**
 * @fileoverview Tests for dev command
 */

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { devCommand } from '../commands/dev.js';

// Mock the dev-server module
vi.mock('@plank/dev-server', () => ({
  createDevServer: vi.fn(),
}));

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', mockConsole);
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn(),
  cwd: vi.fn(() => '/tmp/plank-test-dev'),
  on: vi.fn(),
});

describe('dev command', () => {
  const testDir = '/tmp/plank-test-dev';
  const routesDir = './app/routes';
  const routesPath = resolve(testDir, routesDir);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    // biome-ignore lint/suspicious/noExplicitAny: <process.exit is mocked>
    (process.exit as any).mockClear();
    // biome-ignore lint/suspicious/noExplicitAny: <process.on is mocked>
    (process.on as any).mockClear();

    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
    // Create test routes directory
    await mkdir(routesPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should start development server with default options', async () => {
    const mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    await devCommand();

    expect(createDevServer).toHaveBeenCalledWith({
      root: testDir,
      port: 3000,
      host: 'localhost',
      open: true,
      routesDir: './app/routes',
      hmr: true,
      watch: true,
      plugins: [],
      env: {},
      https: false,
    });

    expect(mockServer.start).toHaveBeenCalled();
    expect(mockConsole.log).toHaveBeenCalledWith('🚀 Starting Plank development server...');
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Development server started successfully!');
  });

  it('should start development server with custom options', async () => {
    const mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    const options = {
      port: '4000',
      host: '0.0.0.0',
      open: false,
      routesDir: './src/pages',
      https: true,
    };

    await devCommand(options);

    expect(createDevServer).toHaveBeenCalledWith({
      root: testDir,
      port: 4000,
      host: '0.0.0.0',
      open: false,
      routesDir: './src/pages',
      hmr: true,
      watch: true,
      plugins: [],
      env: {},
      https: true,
    });
  });

  it('should exit with error if routes directory does not exist', async () => {
    // Remove the routes directory
    await rm(routesPath, { recursive: true, force: true });

    await devCommand();

    expect(mockConsole.error).toHaveBeenCalledWith(`❌ Routes directory not found: ${routesPath}`);
    expect(mockConsole.error).toHaveBeenCalledWith(
      "💡 Make sure you're in a Plank project directory or specify the correct routes directory with --routes-dir"
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle server start errors', async () => {
    const mockServer = {
      start: vi.fn().mockRejectedValue(new Error('Port already in use')),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    await devCommand();

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Failed to start development server:');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should set up graceful shutdown handlers', async () => {
    const mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    await devCommand();

    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should display correct server information', async () => {
    const mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    await devCommand();

    expect(mockConsole.log).toHaveBeenCalledWith(`📁 Project root: ${testDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📂 Routes directory: ${routesDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: http://localhost:3000');
    expect(mockConsole.log).toHaveBeenCalledWith(
      '📝 Edit your .plk files and see changes instantly'
    );
    expect(mockConsole.log).toHaveBeenCalledWith('🔄 Press Ctrl+C to stop the server');
  });

  it('should display HTTPS server information when enabled', async () => {
    const mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const { createDevServer } = await import('@plank/dev-server');
    // biome-ignore lint/suspicious/noExplicitAny: Mock server for testing
    vi.mocked(createDevServer).mockReturnValue(mockServer as any);

    await devCommand({ https: true });

    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: https://localhost:3000');
  });
});
