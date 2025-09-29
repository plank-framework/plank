/**
 * @fileoverview Integration tests for CLI commands with other packages
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCommand } from '../commands/create.js';
import { devCommand } from '../commands/dev.js';
import { buildCommand } from '../commands/build.js';
import { previewCommand } from '../commands/preview.js';

// Mock dependencies to avoid actual server creation
vi.mock('@plank/dev-server', () => ({
  createDevServer: vi.fn().mockReturnValue({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(true),
    getUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getRouter: vi.fn().mockReturnValue({}),
  }),
}));

vi.mock('@plank/router', () => ({
  FileBasedRouter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getRoutes: vi.fn().mockReturnValue([
      { path: '/', file: 'index.plk' },
      { path: '/about', file: 'about.plk' },
    ]),
    generateManifest: vi.fn().mockReturnValue({ routes: [] }),
  })),
}));

vi.mock('node:http', () => ({
  createServer: vi.fn().mockReturnValue({
    listen: vi.fn().mockImplementation((_port, _host, callback) => {
      if (callback) callback();
      return { close: vi.fn() };
    }),
    close: vi.fn(),
  }),
}));

describe('CLI Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create temporary test directory
    testDir = join(process.cwd(), 'test-temp-cli-integration');
    await mkdir(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  test('should create project and integrate with dev server', async () => {
    const projectName = 'test-project';

    // Create project using CLI
    await createCommand(projectName, {
      typescript: false,
      tailwind: false,
    });

    // Verify project structure was created
    const projectPath = resolve(testDir, projectName);
    expect(await readFile(join(projectPath, 'package.json'), 'utf-8')).toContain(projectName);
    expect(await readFile(join(projectPath, 'plank.config.ts'), 'utf-8')).toContain('defineConfig');
    expect(await readFile(join(projectPath, 'app/routes/index.plk'), 'utf-8')).toContain('Welcome to Plank');
    expect(await readFile(join(projectPath, 'app/routes/about.plk'), 'utf-8')).toContain('About');

    // Change to project directory
    process.chdir(projectPath);

    // Test dev command integration
    const devOptions = {
      port: '3001',
      host: 'localhost',
      open: false,
      routesDir: './app/routes',
    };

    // This should not throw an error
    await expect(devCommand(devOptions)).resolves.not.toThrow();
  });

  test('should integrate build command with router', async () => {
    // Create a minimal project structure for build testing
    await mkdir(join(testDir, 'app', 'routes'), { recursive: true });
    await mkdir(join(testDir, 'app', 'layouts'), { recursive: true });
    await mkdir(join(testDir, 'public'), { recursive: true });

    // Create package.json
    const packageJson = {
      name: 'test-build-project',
      version: '0.1.0',
      type: 'module',
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create plank.config.ts
    const configContent = `import { defineConfig } from 'plank';

export default defineConfig({
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  publicDir: './public',
});
`;
    await writeFile(join(testDir, 'plank.config.ts'), configContent);

    // Create test routes
    await writeFile(join(testDir, 'app/routes/index.plk'), '<div>Home</div>');
    await writeFile(join(testDir, 'app/routes/about.plk'), '<div>About</div>');

    // Test build command integration
    const buildOptions = {
      output: './dist',
      minify: true,
      sourcemap: false,
    };

    // This should not throw an error
    await expect(buildCommand(buildOptions)).resolves.not.toThrow();
  });

  test('should integrate preview command with build output', async () => {
    // Create mock build output
    await mkdir(join(testDir, 'dist'), { recursive: true });
    await writeFile(join(testDir, 'dist/index.html'), '<html><body>Preview Test</body></html>');
    await writeFile(join(testDir, 'dist/about.html'), '<html><body>About Page</body></html>');

    // Test preview command integration
    const previewOptions = {
      port: '3002',
      host: 'localhost',
      dist: './dist',
    };

    // This should not throw an error
    await expect(previewCommand(previewOptions)).resolves.not.toThrow();
  });

  test('should handle full project lifecycle', async () => {
    const projectName = 'lifecycle-test';

    // Step 1: Create project
    await createCommand(projectName, {
      typescript: false,
      tailwind: false,
    });

    const projectPath = resolve(testDir, projectName);
    process.chdir(projectPath);

    // Step 2: Verify project structure
    const packageJson = JSON.parse(await readFile('package.json', 'utf-8'));
    expect(packageJson.name).toBe(projectName);
    expect(packageJson.scripts.dev).toBe('plank dev');
    expect(packageJson.scripts.build).toBe('plank build');

    // Step 3: Test dev command (mocked)
    await expect(devCommand({ port: '3003', open: false })).resolves.not.toThrow();

    // Step 4: Test build command (mocked)
    await expect(buildCommand({ output: './dist' })).resolves.not.toThrow();

    // Step 5: Create mock build output for preview
    await mkdir('./dist', { recursive: true });
    await writeFile('./dist/index.html', '<html><body>Lifecycle Test</body></html>');

    // Step 6: Test preview command (mocked)
    await expect(previewCommand({ port: '3004', dist: './dist' })).resolves.not.toThrow();
  });

  test('should handle CLI error scenarios gracefully', async () => {
    // Test dev command with non-existent routes directory
    const devOptions = {
      port: '3005',
      routesDir: './nonexistent/routes',
    };

    // This should exit with code 1, but we can't test process.exit in vitest
    // So we test that the function throws an error
    await expect(devCommand(devOptions)).rejects.toThrow();
  });

  test('should handle build command with missing routes', async () => {
    // Test build command with non-existent routes directory
    const buildOptions = {
      output: './dist',
    };

    // This should exit with code 1, but we can't test process.exit in vitest
    // So we test that the function throws an error
    await expect(buildCommand(buildOptions)).rejects.toThrow();
  });

  test('should handle preview command with missing dist', async () => {
    // Test preview command with non-existent dist directory
    const previewOptions = {
      port: '3006',
      dist: './nonexistent-dist',
    };

    // This should exit with code 1, but we can't test process.exit in vitest
    // So we test that the function throws an error
    await expect(previewCommand(previewOptions)).rejects.toThrow();
  });

  test('should create project with TypeScript and Tailwind options', async () => {
    const projectName = 'ts-tailwind-project';

    // Create project with TypeScript and Tailwind
    await createCommand(projectName, {
      typescript: true,
      tailwind: true,
    });

    const projectPath = resolve(testDir, projectName);
    process.chdir(projectPath);

    // Verify project structure
    expect(await readFile('package.json', 'utf-8')).toContain(projectName);
    expect(await readFile('plank.config.ts', 'utf-8')).toContain('defineConfig');
    expect(await readFile('app/routes/index.plk', 'utf-8')).toContain('Welcome to Plank');
  });

  test('should handle different port configurations', async () => {
    // Create minimal project for port testing
    await mkdir(join(testDir, 'app', 'routes'), { recursive: true });
    await writeFile(join(testDir, 'app/routes/index.plk'), '<div>Port Test</div>');

    // Test different ports
    const ports = ['3000', '3001', '8080', '5000'];

    for (const port of ports) {
      await expect(devCommand({ port, open: false })).resolves.not.toThrow();
    }
  });

  test('should handle HTTPS configuration', async () => {
    // Create minimal project for HTTPS testing
    await mkdir(join(testDir, 'app', 'routes'), { recursive: true });
    await writeFile(join(testDir, 'app/routes/index.plk'), '<div>HTTPS Test</div>');

    // Test HTTPS configuration
    await expect(devCommand({
      port: '3007',
      open: false,
      https: true
    })).resolves.not.toThrow();
  });

  test('should handle custom routes directory', async () => {
    const customRoutesDir = './custom-routes';
    await mkdir(join(testDir, customRoutesDir), { recursive: true });
    await writeFile(join(testDir, customRoutesDir, 'index.plk'), '<div>Custom Routes</div>');

    // Test with custom routes directory
    await expect(devCommand({
      port: '3008',
      open: false,
      routesDir: customRoutesDir
    })).resolves.not.toThrow();
  });
});
