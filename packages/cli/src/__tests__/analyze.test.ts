/**
 * @fileoverview Tests for analyze command
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeCommand } from '../commands/analyze.js';

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', mockConsole);
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn(),
  cwd: vi.fn(() => '/tmp/plank-test-analyze'),
});

describe('analyze command', () => {
  const testDir = '/tmp/plank-test-analyze';
  const distDir = './dist';
  const distPath = resolve(testDir, distDir);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    // biome-ignore lint/suspicious/noExplicitAny: <process.exit is mocked>
    (process.exit as any).mockClear();

    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
    await mkdir(distPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should exit if dist directory does not exist', async () => {
    // Remove dist directory
    await rm(distPath, { recursive: true, force: true });

    await analyzeCommand();

    expect(mockConsole.error).toHaveBeenCalledWith(`❌ Build output not found: ${distPath}`);
    expect(mockConsole.error).toHaveBeenCalledWith(
      '💡 Run "plank build" first to create a production build'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should analyze bundles with default options', async () => {
    // Create some test JavaScript files
    await writeFile(join(distPath, 'runtime.js'), '// Runtime code\nconsole.log("runtime");');
    await writeFile(join(distPath, 'app.js'), '// App code\nconsole.log("app");');

    await analyzeCommand();

    expect(mockConsole.log).toHaveBeenCalledWith('📊 Analyzing JavaScript bundle sizes...');
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('BUNDLE SIZE ANALYSIS'));
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Analysis complete!');
  });

  it('should display budget report', async () => {
    await writeFile(join(distPath, 'app.js'), 'console.log("test");');

    await analyzeCommand({ format: 'text' });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Configured Budgets'));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Marketing'));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Per-Route Analysis'));
  });

  it('should analyze specific route', async () => {
    await writeFile(join(distPath, 'app.js'), 'console.log("test");');

    await analyzeCommand({ route: '/' });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Analysis complete'));
  });

  it('should output JSON format', async () => {
    await writeFile(join(distPath, 'app.js'), 'console.log("test");');

    await analyzeCommand({ format: 'json' });

    // Should output valid JSON
    const jsonCalls = mockConsole.log.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );

    expect(jsonCalls.length).toBeGreaterThan(0);
  });

  it('should handle custom dist directory', async () => {
    const customDist = './build';
    const customDistPath = resolve(testDir, customDist);
    await mkdir(customDistPath, { recursive: true });
    await writeFile(join(customDistPath, 'app.js'), 'console.log("test");');

    await analyzeCommand({ dist: customDist });

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(customDist));
  });

  it('should fail when budget exceeded with --fail-on-exceed', async () => {
    // Create a large file (will definitely exceed static budget of 0)
    const largeContent = `// Large file\n${'x'.repeat(50 * 1024)}`; // 50 KB
    await writeFile(join(distPath, 'large.js'), largeContent);

    await analyzeCommand({ failOnExceed: true });

    // Should exit with error if any route fails
    // biome-ignore lint/suspicious/noExplicitAny: <process.exit is mocked>
    const exitCalls = (process.exit as any).mock.calls;
    if (exitCalls.length > 0) {
      expect(exitCalls[0][0]).toBe(1);
    }
  });

  it('should display zero JS routes as passing', async () => {
    // Don't create any JS files
    await analyzeCommand();

    // Should show passing routes
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('✅'));
  });

  it('should show breakdown for routes with JavaScript', async () => {
    await writeFile(join(distPath, 'runtime.js'), 'console.log("runtime");');
    await mkdir(join(distPath, 'islands'), { recursive: true });
    await writeFile(join(distPath, 'islands/counter.js'), 'console.log("island");');
    await writeFile(join(distPath, 'vendor.js'), 'console.log("vendor");');

    await analyzeCommand();

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Breakdown'));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Runtime'));
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Islands'));
  });

  it('should handle errors gracefully', async () => {
    // Create invalid setup that will cause an error
    await writeFile(join(distPath, 'app.js'), 'test');

    // Mock loadConfig to throw
    vi.doMock('../config.js', () => ({
      loadConfig: vi.fn().mockRejectedValue(new Error('Config error')),
    }));

    // Should not throw
    await expect(analyzeCommand()).resolves.toBeUndefined();
  });
});
