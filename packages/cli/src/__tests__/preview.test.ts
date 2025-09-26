/**
 * @fileoverview Tests for preview command
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewCommand } from '../commands/preview.js';

// Mock the http module
vi.mock('node:http', () => ({
  createServer: vi.fn(),
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
  cwd: vi.fn(() => '/tmp/plank-test-preview'),
  on: vi.fn(),
  listeners: vi.fn(() => []),
});

describe('preview command', () => {
  const testDir = '/tmp/plank-test-preview';
  const distDir = './dist';
  const distPath = resolve(testDir, distDir);

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
    // Create test dist directory
    await mkdir(distPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should start preview server with default options', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const { createServer } = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.mocked(createServer).mockReturnValue(mockServer as any);

    await previewCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('👀 Starting Plank preview server...');
    expect(mockConsole.log).toHaveBeenCalledWith(`📁 Project root: ${testDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📦 Serving from: ${distDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: http://localhost:3000');
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Preview server started successfully!');
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Preview available at: http://localhost:3000');
    expect(mockConsole.log).toHaveBeenCalledWith('🔄 Press Ctrl+C to stop the server');

    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should start preview server with custom options', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const { createServer } = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.mocked(createServer).mockReturnValue(mockServer as any);

    const options = {
      port: '4000',
      host: '0.0.0.0',
      dist: './build',
    };

    await previewCommand(options);

    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: http://0.0.0.0:4000');
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Preview available at: http://0.0.0.0:4000');
  });

  it('should exit with error if dist directory does not exist', async () => {
    // Remove the dist directory
    await rm(distPath, { recursive: true, force: true });

    await previewCommand();

    expect(mockConsole.error).toHaveBeenCalledWith(`❌ Build output not found: ${distPath}`);
    expect(mockConsole.error).toHaveBeenCalledWith(
      '💡 Run "plank build" first to create a production build'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle server creation errors', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock createServer to throw an error
    const { createServer } = await import('node:http');
    vi.mocked(createServer).mockImplementation(() => {
      throw new Error('Server creation failed');
    });

    await previewCommand();

    expect(mockConsole.error).toHaveBeenCalledWith('❌ Failed to start preview server:');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should display correct server information', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const { createServer } = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.mocked(createServer).mockReturnValue(mockServer as any);

    await previewCommand();

    expect(mockConsole.log).toHaveBeenCalledWith(`📁 Project root: ${testDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith(`📦 Serving from: ${distDir}`);
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: http://localhost:3000');
  });

  it('should set up graceful shutdown handlers', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const { createServer } = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.mocked(createServer).mockReturnValue(mockServer as any);

    await previewCommand();

    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should handle custom dist directory', async () => {
    const customDistDir = './build';
    const customDistPath = resolve(testDir, customDistDir);

    // Create custom dist directory
    await mkdir(customDistPath, { recursive: true });
    await writeFile(join(customDistPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const { createServer } = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.mocked(createServer).mockReturnValue(mockServer as any);

    const options = { dist: customDistDir };

    await previewCommand(options);

    expect(mockConsole.log).toHaveBeenCalledWith(`📦 Serving from: ${customDistDir}`);
  });

  it('should handle custom port and host', async () => {
    // Create a test HTML file
    await writeFile(join(distPath, 'index.html'), '<html><body>Test</body></html>');

    // Mock the server to prevent actual server creation
    const mockServer = {
      listen: vi.fn((_port, _host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
    };

    // Mock createServer to return our mock server
    const httpModule = await import('node:http');
    // biome-ignore lint/suspicious/noExplicitAny: <createServer is mocked>
    vi.spyOn(httpModule, 'createServer').mockReturnValue(mockServer as any);

    const options = {
      port: '8080',
      host: '127.0.0.1',
    };

    await previewCommand(options);

    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Server: http://127.0.0.1:8080');
    expect(mockConsole.log).toHaveBeenCalledWith('🌐 Preview available at: http://127.0.0.1:8080');
  });
});
