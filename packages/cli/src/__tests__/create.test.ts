/**
 * @fileoverview Tests for create command
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCommand } from '../commands/create.js';

// Mock console methods to avoid output during tests
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', mockConsole);
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn(),
  cwd: vi.fn(() => '/tmp/plank-test-create'),
});

describe('create command', () => {
  const testDir = '/tmp/plank-test-create';
  const projectName = 'test-project';
  const projectPath = resolve(testDir, projectName);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    // biome-ignore lint/suspicious/noExplicitAny: <process.exit is mocked>
    (process.exit as any).mockClear();

    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test project if it exists
    if (existsSync(projectPath)) {
      await rm(projectPath, { recursive: true, force: true });
    }
  });

  it('should create a new project with default options', async () => {
    await createCommand(projectName);

    // Check that project directory was created
    expect(existsSync(projectPath)).toBe(true);
    expect(existsSync(join(projectPath, 'app'))).toBe(true);
    expect(existsSync(join(projectPath, 'app', 'routes'))).toBe(true);
    expect(existsSync(join(projectPath, 'app', 'layouts'))).toBe(true);
    expect(existsSync(join(projectPath, 'public'))).toBe(true);

    // Check that files were created
    expect(existsSync(join(projectPath, 'package.json'))).toBe(true);
    expect(existsSync(join(projectPath, 'plank.config.ts'))).toBe(true);
    expect(existsSync(join(projectPath, 'README.md'))).toBe(true);
    expect(existsSync(join(projectPath, '.gitignore'))).toBe(true);
    expect(existsSync(join(projectPath, 'app', 'routes', 'index.plk'))).toBe(true);
    expect(existsSync(join(projectPath, 'app', 'routes', 'about.plk'))).toBe(true);
    expect(existsSync(join(projectPath, 'app', 'layouts', 'root.plk'))).toBe(true);

    // Check console output
    expect(mockConsole.log).toHaveBeenCalledWith(`🚀 Creating new Plank project: ${projectName}`);
    expect(mockConsole.log).toHaveBeenCalledWith('✅ Project created successfully!');
  });

  it('should exit with error if directory already exists', async () => {
    // Create the directory first
    await mkdir(projectPath, { recursive: true });

    await createCommand(projectName);

    expect(mockConsole.error).toHaveBeenCalledWith(`❌ Directory "${projectName}" already exists`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should create package.json with correct content', async () => {
    await createCommand(projectName);

    const packageJsonPath = join(projectPath, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    expect(packageJson.name).toBe(projectName);
    expect(packageJson.version).toBe('0.1.0');
    expect(packageJson.type).toBe('module');
    expect(packageJson.scripts).toEqual({
      dev: 'plank dev',
      build: 'plank build',
      preview: 'plank preview',
    });
    expect(packageJson.dependencies).toHaveProperty('@plank/core');
    expect(packageJson.devDependencies).toHaveProperty('@plank/cli');
  });

  it('should create plank.config.ts with correct content', async () => {
    await createCommand(projectName);

    const configPath = join(projectPath, 'plank.config.ts');
    expect(existsSync(configPath)).toBe(true);

    const configContent = await readFile(configPath, 'utf-8');
    expect(configContent).toContain("routesDir: './app/routes'");
    expect(configContent).toContain("layoutsDir: './app/layouts'");
    expect(configContent).toContain("publicDir: './public'");
  });

  it('should create sample route files', async () => {
    await createCommand(projectName);

    const indexRoutePath = join(projectPath, 'app', 'routes', 'index.plk');
    const aboutRoutePath = join(projectPath, 'app', 'routes', 'about.plk');

    expect(existsSync(indexRoutePath)).toBe(true);
    expect(existsSync(aboutRoutePath)).toBe(true);

    // Check that files contain expected content
    const indexContent = await readFile(indexRoutePath, 'utf-8');
    const aboutContent = await readFile(aboutRoutePath, 'utf-8');

    expect(indexContent).toContain('Welcome to Plank!');
    expect(aboutContent).toContain('About');
  });

  it('should create root layout file', async () => {
    await createCommand(projectName);

    const layoutPath = join(projectPath, 'app', 'layouts', 'root.plk');
    expect(existsSync(layoutPath)).toBe(true);

    const layoutContent = await readFile(layoutPath, 'utf-8');
    expect(layoutContent).toContain('<!DOCTYPE html>');
    expect(layoutContent).toContain('<slot />');
  });

  it('should create README with project name', async () => {
    await createCommand(projectName);

    const readmePath = join(projectPath, 'README.md');
    expect(existsSync(readmePath)).toBe(true);

    const readmeContent = await readFile(readmePath, 'utf-8');
    expect(readmeContent).toContain(`# ${projectName}`);
    expect(readmeContent).toContain('pnpm install');
    expect(readmeContent).toContain('pnpm dev');
  });

  it('should create .gitignore file', async () => {
    await createCommand(projectName);

    const gitignorePath = join(projectPath, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    const gitignoreContent = await readFile(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain('node_modules/');
    expect(gitignoreContent).toContain('dist/');
    expect(gitignoreContent).toContain('.env');
  });

  it('should handle errors gracefully', async () => {
    // Test with an invalid project name that would cause an error
    const invalidProjectName = '';

    await createCommand(invalidProjectName);

    // The function should handle the error and exit
    expect(mockConsole.error).toHaveBeenCalledWith(
      `❌ Directory "${invalidProjectName}" already exists`
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
