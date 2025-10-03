/**
 * @fileoverview Tests for build command
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCommand } from '../commands/build.js';

// Mock the router module
vi.mock('@plank/router', () => ({
  FileBasedRouter: vi.fn(),
}));

// Mock the config module
vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
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
  cwd: vi.fn(() => '/tmp/plank-test-build'),
});

describe('build command', () => {
  const testDir = '/tmp/plank-test-build';
  const routesDir = './app/routes';
  const layoutsDir = './app/layouts';
  const publicDir = './public';
  const outputDir = './dist';
  const routesPath = resolve(testDir, routesDir);
  const publicPath = resolve(testDir, publicDir);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    // biome-ignore lint/suspicious/noExplicitAny: <process.exit is mocked>
    (process.exit as any).mockClear();

    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
    // Create test directories
    await mkdir(routesPath, { recursive: true });
    await mkdir(publicPath, { recursive: true });

    // Mock loadConfig
    const { loadConfig } = await import('../config.js');
    vi.mocked(loadConfig).mockResolvedValue({
      routesDir,
      layoutsDir,
      publicDir,
      outputDir,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should build project with default options', async () => {
    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([
        { path: '/', file: 'index.plk' },
        { path: '/about', file: 'about.plk' },
      ]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('🔨 Building Plank application for production...');
    expect(mockConsole.log).toHaveBeenCalledWith(`📁 Project root: ${testDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📂 Routes directory: ${routesDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📂 Layouts directory: ${layoutsDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📂 Public directory: ${publicDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📦 Output directory: ${outputDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith('🗜️  Minify: Yes');
    expect(mockConsole.log).toHaveBeenCalledWith('🗺️  Source maps: No');

    expect(FileBasedRouter).toHaveBeenCalledWith({
      routesDir,
      layoutsDir,
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    });

    expect(mockRouter.initialize).toHaveBeenCalled();
    expect(mockRouter.getRoutes).toHaveBeenCalled();

    expect(mockConsole.log).toHaveBeenCalledWith('✅ Found 2 routes');
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Build completed successfully!');
    expect(mockConsole.log).toHaveBeenCalledWith(`📦 Output available in: ${outputDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith('📋 Route manifest: 2 routes discovered');
  });

  it('should build project with custom options', async () => {
    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    const options = {
      output: './build',
      minify: false,
      sourcemap: true,
    };

    await buildCommand(options);

    expect(mockConsole.log).toHaveBeenCalledWith('📦 Output directory: ./build');
    expect(mockConsole.log).toHaveBeenCalledWith('🗜️  Minify: No');
    expect(mockConsole.log).toHaveBeenCalledWith('🗺️  Source maps: Yes');
  });

  it('should handle missing routes directory gracefully', async () => {
    // Remove the routes directory
    await rm(routesPath, { recursive: true, force: true });

    // Mock the router to return empty routes when directory doesn't exist
    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    // Should complete successfully with 0 routes
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Found 0 routes');
  });

  it('should handle router initialization errors', async () => {
    const mockRouter = {
      initialize: vi.fn().mockRejectedValue(new Error('Router initialization failed')),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Build failed:');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should copy public assets if public directory exists', async () => {
    // Create a test file in public directory
    await writeFile(join(publicPath, 'test.txt'), 'test content');

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('📁 Copying public assets...');
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Public assets copied');
  });

  it('should skip public assets if public directory does not exist', async () => {
    // Remove the public directory
    await rm(publicPath, { recursive: true, force: true });

    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    // Should not log public assets copying
    expect(mockConsole.log).not.toHaveBeenCalledWith('📁 Copying public assets...');
  });

  it('should create output directory', async () => {
    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('🔨 Building Plank application for production...');
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Build completed successfully!');
  });

  it('should display build progress messages', async () => {
    const mockRouter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRoutes: vi.fn().mockReturnValue([]),
      generateManifest: vi.fn().mockReturnValue({ routes: [] }),
    };

    const { FileBasedRouter } = await import('@plank/router');
    // biome-ignore lint/suspicious/noExplicitAny: <FileBasedRouter is mocked>
    vi.mocked(FileBasedRouter).mockImplementation(() => mockRouter as any);

    await buildCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('⏳ Build process starting...');
    expect(mockConsole.log).toHaveBeenCalledWith('🔍 Discovering routes...');
    expect(mockConsole.log).toHaveBeenCalledWith('📋 Generating route manifest...');
    expect(mockConsole.log).toHaveBeenCalledWith('🏗️  Building static pages...');
    expect(mockConsole.log).toHaveBeenCalledWith('📦 Generating client bundles...');
  });
});
