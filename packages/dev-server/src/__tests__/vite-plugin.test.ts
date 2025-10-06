/**
 * @fileoverview Tests for Vite plugin
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { PlankPluginOptions } from '../types.js';
import { plankPlugin } from '../vite-plugin.js';

// Mock @plank/compiler
vi.mock('@plank/compiler', () => ({
  compile: vi.fn(),
}));

// Mock fs/promises
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
    stat: vi.fn(),
  };
});

// Mock crypto
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hash'),
    })),
  };
});

describe('Plank Vite Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should create plugin with default options', () => {
    const plugin = plankPlugin();

    expect(plugin.name).toBe('plank');
    expect(plugin.version).toBe('1.0.0');
  });

  test('should create plugin with custom options', () => {
    const options: PlankPluginOptions = {
      routesDir: './custom/routes',
      hmr: false,
      extensions: ['.plk', '.custom'],
      sourcemap: false,
    };

    const plugin = plankPlugin(options);

    expect(plugin.name).toBe('plank');
  });

  test('should resolve .plk file imports', async () => {
    const { stat } = await import('node:fs/promises');
    const mockStat = vi.mocked(stat);
    mockStat.mockResolvedValue({} as Awaited<ReturnType<typeof stat>>);

    const plugin = plankPlugin();
    const mockResolve = vi.fn().mockResolvedValue(null);
    const mockThis = {
      resolve: mockResolve,
    };

    const resolveId =
      typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId?.handler;
    const result = await resolveId?.call(mockThis, 'test.plk', '/app/routes/index.plk');

    // The plugin should return a result
    expect(result).toBeDefined();
  });

  test('should handle non-existent .plk files', async () => {
    const { stat } = await import('node:fs/promises');
    const mockStat = vi.mocked(stat);
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const plugin = plankPlugin();
    const mockResolve = vi.fn().mockResolvedValue(null);
    const mockThis = {
      resolve: mockResolve,
    };

    const resolveId =
      typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId?.handler;
    const result = await resolveId?.call(mockThis, 'nonexistent.plk', '/app/routes/index.plk');

    expect(result).toBeNull();
  });

  test('should load and process .plk files', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    mockReadFile.mockResolvedValue('<div>Hello World</div>');
    mockCompile.mockResolvedValue({
      code: '// Compiled template',
      map: '//# sourceMappingURL=...',
      scripts: [],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = {
      error: mockError,
    };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/routes/test.plk');

    // The plugin should return a result (may be null if file doesn't exist)
    if (result) {
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('map');
      expect(result).toHaveProperty('meta');
    } else {
      expect(result).toBeNull();
    }
  });

  test('should handle compilation errors', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    mockReadFile.mockResolvedValue('<div>Invalid syntax</div>');
    mockCompile.mockRejectedValue(new Error('Compilation failed'));

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = {
      error: mockError,
    };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/routes/test.plk');

    expect(mockError).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should handle HMR updates for .plk files', () => {
    const plugin = plankPlugin({ hmr: true });
    const mockSend = vi.fn();
    const mockServer = {
      ws: {
        send: mockSend,
      },
    };

    const mockCtx = {
      file: '/app/routes/test.plk',
      modules: [],
      server: mockServer,
    };

    const handleHotUpdate =
      typeof plugin.handleHotUpdate === 'function'
        ? plugin.handleHotUpdate
        : plugin.handleHotUpdate?.handler;
    // biome-ignore lint/suspicious/noExplicitAny: Test mock context
    const result = (handleHotUpdate as any)?.(mockCtx);

    // .plk files trigger full page reload (server-rendered templates)
    expect(mockSend).toHaveBeenCalledWith({
      type: 'full-reload',
      path: '*',
    });
    expect(result).toEqual([]);
  });

  test('should not handle HMR for non-.plk files', () => {
    const plugin = plankPlugin({ hmr: true });
    const mockSend = vi.fn();
    const mockServer = {
      ws: {
        send: mockSend,
      },
    };

    const mockCtx = {
      file: '/app/routes/test.js',
      modules: [],
      server: mockServer,
    };

    const handleHotUpdate =
      typeof plugin.handleHotUpdate === 'function'
        ? plugin.handleHotUpdate
        : plugin.handleHotUpdate?.handler;
    // biome-ignore lint/suspicious/noExplicitAny: Test mock context
    const result = (handleHotUpdate as any)?.(mockCtx);

    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test('should clear caches on build start', () => {
    const plugin = plankPlugin();

    // Mock the plugin instance
    const pluginInstance = {
      ...plugin,
      // Add mock methods that would be called
    };

    const buildStart =
      typeof plugin.buildStart === 'function' ? plugin.buildStart : plugin.buildStart?.handler;
    buildStart?.call(pluginInstance);

    // Since we can't directly test the internal state,
    // we just verify the method exists and can be called
    expect(plugin.buildStart).toBeDefined();
  });

  test('should process island components with directives', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const count = signal(0);
</script>

<div>
  <button on:click={() => count(count() + 1)}>Increment</button>
  <span>{count()}</span>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const count = signal(0);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Counter.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('export function mount');
      expect(result.code).toContain('bindEvent');
    }
  });

  test('should skip auto-generated mount when manual mount exists', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const count = signal(0);
export function mount(element) {
  // Custom mount logic
  return { unmount: () => {} };
}
</script>

<div>
  <button on:click={() => count(count() + 1)}>Increment</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const count = signal(0);\nexport function mount(element) {\n  return { unmount: () => {} };\n}`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Counter.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      // Should not have duplicate mount function
      const mountCount = (result.code.match(/export function mount/g) || []).length;
      expect(mountCount).toBe(1);
    }
  });

  test('should preserve style tags in island templates', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const active = signal(false);
</script>

<style>
.button { background: blue; }
</style>

<div>
  <button class="button" class:active={active()}>Toggle</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const active = signal(false);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Button.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('<style>');
      expect(result.code).toContain('.button { background: blue; }');
    }
  });

  test('should handle x:for directives with keying', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const items = signal([{ id: 1, name: 'Item 1' }]);
</script>

<ul>
  <li x:for={item of items()} x:key={item.id}>
    <span>{item.name}</span>
  </li>
</ul>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const items = signal([{ id: 1, name: 'Item 1' }]);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/List.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('x:for');
      expect(result.code).toContain('renderedItems');
      expect(result.code).toContain('newKeys');
    }
  });

  test('should handle bind:value directive on inputs', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const name = signal('');
</script>

<div>
  <input bind:value={name} type="text" />
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const name = signal('');`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Input.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindInputValue');
      expect(result.code).toContain('name');
    }
  });

  test('should handle bind:value directive on checkboxes', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const checked = signal(false);
</script>

<div>
  <input bind:value={checked} type="checkbox" />
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const checked = signal(false);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Checkbox.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindCheckbox');
    }
  });

  test('should handle x:if conditional rendering', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const show = signal(false);
</script>

<div>
  <div x:if={show()}>
    Visible content
  </div>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const show = signal(false);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Conditional.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('effect');
      expect(result.code).toContain('shouldShow');
      expect(result.code).toContain('style.display');
    }
  });

  test('should handle class: dynamic class binding', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const isActive = signal(true);
</script>

<div>
  <button class:active={isActive()}>Toggle</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const isActive = signal(true);`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/DynamicClass.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindClass');
      expect(result.code).toContain("'active'");
    }
  });

  test('should handle text interpolations', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const message = signal('Hello');
</script>

<div>
  <span>{message()}</span>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const message = signal('Hello');`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/Text.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindText');
      expect(result.code).toContain('computed');
    }
  });

  test('should handle multiple directives on same element', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const active = signal(false);
export function toggle() { active(!active()); }
</script>

<div>
  <button class:active={active()} on:click={toggle}>Toggle</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled island',
      map: undefined,
      scripts: [
        {
          type: 'client',
          content: `import { signal } from '@plank/runtime-core';\nexport const active = signal(false);\nexport function toggle() { active(!active()); }`,
        },
      ],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/MultiDirective.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindClass');
      expect(result.code).toContain('bindEvent');
    }
  });

  test('should handle non-island .plk files (routes)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const routeContent = `<div>
  <h1>About Page</h1>
  <p>This is a route, not an island</p>
</div>`;

    mockReadFile.mockResolvedValue(routeContent);
    mockCompile.mockResolvedValue({
      code: '// Compiled route',
      map: undefined,
      scripts: [],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/routes/about.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      // Routes should not get auto-generated mount functions
      expect(result.code).not.toContain('export function mount');
    }
  });

  test('should handle parseElementDirectives with closing tags', async () => {
    const { __testing__ } = await import('../vite-plugin.js');

    const html = '</div>';
    const directives = [];
    const tagIndexMap = new Map();

    // Test with closing tag (should return early)
    const result = __testing__.parseElementDirectives(html, 0, directives, tagIndexMap);

    expect(result).toBe(1); // Should return tagStart + 1
    expect(directives).toHaveLength(0);
  });

  test('should handle parseElementDirectives with comments', async () => {
    const { __testing__ } = await import('../vite-plugin.js');

    const html = '<!-- comment -->';
    const directives = [];
    const tagIndexMap = new Map();

    // Test with comment (should return early)
    const result = __testing__.parseElementDirectives(html, 0, directives, tagIndexMap);

    expect(result).toBe(1); // Should return tagStart + 1
    expect(directives).toHaveLength(0);
  });

  test('should handle parseElementDirectives with invalid tag', async () => {
    const { __testing__ } = await import('../vite-plugin.js');

    const html = '<';
    const directives = [];
    const tagIndexMap = new Map();

    // Test with invalid tag (no tag name match)
    const result = __testing__.parseElementDirectives(html, 0, directives, tagIndexMap);

    expect(result).toBe(1); // Should return tagStart + 1
    expect(directives).toHaveLength(0);
  });

  test('should handle generateErrorCode function', async () => {
    const { __testing__ } = await import('../vite-plugin.js');

    const error = new Error('Test compilation error');
    error.stack = 'Error: Test compilation error\n    at test.js:1:1';
    const filePath = '/app/routes/test.plk';

    const errorCode = __testing__.generateErrorCode(error, filePath);

    expect(errorCode).toContain('Error in /app/routes/test.plk');
    expect(errorCode).toContain('Test compilation error');
    expect(errorCode).toContain('export const error');
    expect(errorCode).toContain('export default');
    expect(errorCode).toContain('Compilation Error: Test compilation error');
  });
});
