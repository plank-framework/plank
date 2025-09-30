/**
 * @fileoverview Tests for directive compilation in islands
 * These tests verify the actual directive extraction and code generation
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { __testing__, plankPlugin } from '../vite-plugin.js';

// Mock @plank/compiler but allow actual execution
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
      digest: vi.fn(() => 'test-hash'),
    })),
  };
});

describe('Directive Compilation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should compile on:click event handlers', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const count = signal(0);
export function increment() { count(count() + 1); }
</script>

<div>
  <button on:click={increment}>Click me</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><button>Click me</button></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const count = signal(0);\nexport function increment() { count(count() + 1); }`,
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
    const result = await load?.call(mockThis, '/app/islands/EventHandler.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindEvent');
      expect(result.code).toContain('increment');
      expect(result.code).toContain("'click'");
    }
  });

  test('should compile on:click with arrow functions', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const count = signal(0);
</script>

<div>
  <button on:click={() => count(count() + 1)}>+1</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><button>+1</button></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
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
    const result = await load?.call(mockThis, '/app/islands/ArrowFunction.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindEvent');
      expect(result.code).toContain('() => count(count() + 1)');
    }
  });

  test('should compile bind:value for text inputs', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const username = signal('');
</script>

<div>
  <input bind:value={username} type="text" placeholder="Enter name" />
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><input type="text" placeholder="Enter name" /></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const username = signal('');`,
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
    const result = await load?.call(mockThis, '/app/islands/TextInput.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindInputValue');
      expect(result.code).toContain('username');
    }
  });

  test('should compile bind:value for checkboxes as bindCheckbox', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const agreed = signal(false);
</script>

<div>
  <input bind:value={agreed} type="checkbox" />
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><input type="checkbox" /></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const agreed = signal(false);`,
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
    const result = await load?.call(mockThis, '/app/islands/CheckboxInput.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('bindCheckbox');
      expect(result.code).toContain('agreed');
    }
  });

  test('should compile class: directives', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const isActive = signal(false);
</script>

<div>
  <button class="btn" class:active={isActive()}>Toggle</button>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><button class="btn">Toggle</button></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const isActive = signal(false);`,
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
      expect(result.code).toContain('computed');
      expect(result.code).toContain('Boolean');
    }
  });

  test('should compile x:if conditional rendering', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const visible = signal(true);
</script>

<div>
  <p x:if={visible()}>This is conditional</p>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><p>This is conditional</p></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const visible = signal(true);`,
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

  test('should compile x:for with array rendering', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const todos = signal([
  { id: 1, text: 'First' },
  { id: 2, text: 'Second' }
]);
export function removeTodo(id) {
  todos(todos().filter(t => t.id !== id));
}
</script>

<ul>
  <li x:for={todo of todos()} x:key={todo.id}>
    <span>{todo.text}</span>
    <button on:click={() => removeTodo(todo.id)}>Remove</button>
  </li>
</ul>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<ul><li></li></ul>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const todos = signal([{ id: 1, text: 'First' }, { id: 2, text: 'Second' }]);\nexport function removeTodo(id) { todos(todos().filter(t => t.id !== id)); }`,
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
    const result = await load?.call(mockThis, '/app/islands/TodoList.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('effect');
      expect(result.code).toContain('renderedItems');
      expect(result.code).toContain('newKeys');
      expect(result.code).toContain('todo');
      expect(result.code).toContain('itemTemplate');
    }
  });

  test('should handle complex expressions in directives', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const count = signal(5);
</script>

<div>
  <div x:if={count() > 3 && count() < 10}>
    Count is between 3 and 10
  </div>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><div>Count is between 3 and 10</div></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const count = signal(5);`,
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
    const result = await load?.call(mockThis, '/app/islands/ComplexExpression.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('count() > 3 && count() < 10');
    }
  });

  test('should strip directives from template HTML', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const value = signal('');
</script>

<div>
  <input bind:value={value} type="text" />
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><input type="text" /></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const value = signal('');`,
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
      // Template should not contain directive attributes
      const templateMatch = result.code.match(/const template = "([^"]+)"/);
      if (templateMatch?.[1]) {
        expect(templateMatch[1]).not.toContain('bind:value');
      }
    }
  });

  test('should handle islands with no directives', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const data = signal('test');
export function mount(element) {
  return { unmount: () => {} };
}
</script>

<div>
  <p>Static content</p>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><p>Static content</p></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const data = signal('test');\nexport function mount(element) { return { unmount: () => {} }; }`,
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
    const result = await load?.call(mockThis, '/app/islands/Static.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      // Should use the manual mount, not generate auto-bindings
      const mountCount = (result.code.match(/export function mount/g) || []).length;
      expect(mountCount).toBe(1);
    }
  });

  test('should handle islands with dependencies', async () => {
    const { readFile } = await import('node:fs/promises');
    const { compile } = await import('@plank/compiler');

    const mockReadFile = vi.mocked(readFile);
    const mockCompile = vi.mocked(compile);

    const islandContent = `<script type="client">
import { signal } from '@plank/runtime-core';
export const value = signal(0);
</script>

<div>
  <span>{value()}</span>
</div>`;

    mockReadFile.mockResolvedValue(islandContent);
    mockCompile.mockResolvedValue({
      code: '<div><span>0</span></div>',
      map: undefined,
      scripts: [
        {
          type: 'client' as const,
          content: `import { signal } from '@plank/runtime-core';\nexport const value = signal(0);`,
        },
      ],
      dependencies: ['@plank/runtime-dom'],
      islands: [],
      actions: [],
      chunks: [],
      errors: [],
    });

    const plugin = plankPlugin();
    const mockError = vi.fn();
    const mockThis = { error: mockError };

    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load?.handler;
    const result = await load?.call(mockThis, '/app/islands/WithDeps.plk');

    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'code' in result) {
      expect(result.code).toContain('@plank/runtime-dom');
    }
  });
});

describe('Directive Helper Functions', () => {
  const {
    stripDirectives,
    extractDirectivesFromHTML,
    extractForLoops,
    extractTextInterpolations,
    extractHTMLFromPlk,
  } = __testing__;

  describe('stripDirectives', () => {
    test('should remove on:click directives', () => {
      const html = '<button on:click={handleClick}>Click</button>';
      const result = stripDirectives(html);
      expect(result).not.toContain('on:click');
      expect(result).toContain('<button');
      expect(result).toContain('>Click</button>');
    });

    test('should remove bind:value directives', () => {
      const html = '<input bind:value={name} type="text" />';
      const result = stripDirectives(html);
      expect(result).not.toContain('bind:value');
      expect(result).toContain('<input');
      expect(result).toContain('type="text"');
    });

    test('should remove class:active directives', () => {
      const html = '<div class:active={isActive}>Content</div>';
      const result = stripDirectives(html);
      expect(result).not.toContain('class:active');
      expect(result).toContain('<div');
    });

    test('should handle directives with arrow functions', () => {
      const html = '<button on:click={() => console.log("test")}>Click</button>';
      const result = stripDirectives(html);
      expect(result).not.toContain('on:click');
      expect(result).not.toContain('() =>');
    });

    test('should handle directives with complex expressions', () => {
      const html = '<div x:if={count() > 5 && count() < 10}>Content</div>';
      const result = stripDirectives(html);
      expect(result).not.toContain('x:if');
      expect(result).not.toContain('count()');
    });

    test('should handle multiple directives on same element', () => {
      const html = '<button class:active={isActive} on:click={toggle}>Toggle</button>';
      const result = stripDirectives(html);
      expect(result).not.toContain('class:active');
      expect(result).not.toContain('on:click');
      expect(result).toContain('<button');
      expect(result).toContain('>Toggle</button>');
    });
  });

  describe('extractDirectivesFromHTML', () => {
    test('should extract on:click directive', () => {
      const html = '<div><button on:click={increment}>Click</button></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.type).toBe('on');
      expect(directives[0]?.attribute).toBe('click');
      expect(directives[0]?.value).toBe('increment');
      expect(directives[0]?.selector).toBe('button');
      expect(directives[0]?.index).toBe(0);
    });

    test('should extract bind:value directive', () => {
      const html = '<div><input bind:value={name} type="text" /></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.type).toBe('bind');
      expect(directives[0]?.attribute).toBe('value');
      expect(directives[0]?.value).toBe('name');
      expect(directives[0]?.selector).toBe('input');
    });

    test('should detect checkbox inputs', () => {
      const html = '<div><input bind:value={checked} type="checkbox" /></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.isCheckbox).toBe(true);
    });

    test('should extract class: directive', () => {
      const html = '<div><button class:active={isActive}>Toggle</button></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.type).toBe('class');
      expect(directives[0]?.attribute).toBe('active');
      expect(directives[0]?.value).toBe('isActive');
    });

    test('should extract x:if directive', () => {
      const html = '<div><p x:if={isVisible()}>Content</p></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.type).toBe('x:if');
      expect(directives[0]?.value).toBe('isVisible()');
    });

    test('should handle multiple directives on same element', () => {
      const html = '<div><button class:active={isActive} on:click={toggle}>Toggle</button></div>';
      const directives = extractDirectivesFromHTML(html);

      // Should extract both directives
      expect(directives.length).toBeGreaterThanOrEqual(2);
      const types = directives.map((d) => d.type);
      expect(types).toContain('class');
      expect(types).toContain('on');
    });

    test('should use per-tag indexing', () => {
      const html =
        '<div><button on:click={first}>A</button><button on:click={second}>B</button></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(2);
      expect(directives[0]?.index).toBe(0);
      expect(directives[1]?.index).toBe(1);
      expect(directives[0]?.selector).toBe('button');
      expect(directives[1]?.selector).toBe('button');
    });

    test('should count all elements, not just those with directives', () => {
      const html = '<div><div>First</div><div x:if={show}>Second</div></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      // Outer div (index 0), First div (index 1), Second div with x:if (index 2)
      expect(directives[0]?.index).toBe(2);
    });

    test('should handle arrow functions with > in expressions', () => {
      const html = '<div><button on:click={() => count() > 5}>Click</button></div>';
      const directives = extractDirectivesFromHTML(html);

      expect(directives).toHaveLength(1);
      expect(directives[0]?.value).toContain('>');
      expect(directives[0]?.value).toBe('() => count() > 5');
    });
  });

  describe('extractForLoops', () => {
    test('should extract x:for directive', () => {
      const html = '<ul><li x:for={item of items()}>Text</li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.itemVar).toBe('item');
      expect(loops[0]?.itemsVar).toBe('items()');
      expect(loops[0]?.containerTag).toBe('li');
    });

    test('should extract x:key expression', () => {
      const html = '<ul><li x:for={item of items()} x:key={item.id}>Text</li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.keyExpr).toBe('item.id');
    });

    test('should extract loop template', () => {
      const html = '<ul><li x:for={item of items()}><span>{item.name}</span></li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.template).toContain('<li');
      expect(loops[0]?.template).toContain('<span>');
    });

    test('should preserve original template with directives', () => {
      const html =
        '<ul><li x:for={item of items()} x:key={item.id}><button on:click={() => remove(item.id)}>Del</button></li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.originalTemplate).toContain('on:click');
      expect(loops[0]?.originalTemplate).toContain('x:for');
    });

    test('should strip directives from cleaned template', () => {
      const html =
        '<ul><li x:for={item of items()}><button on:click={remove}>Del</button></li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.template).not.toContain('on:click');
      expect(loops[0]?.template).not.toContain('x:for');
    });

    test('should handle nested elements in loop', () => {
      const html =
        '<ul><li x:for={item of items()}><span>{item.text}</span><button>Remove</button></li></ul>';
      const loops = extractForLoops(html);

      expect(loops).toHaveLength(1);
      expect(loops[0]?.template).toContain('<span>');
      expect(loops[0]?.template).toContain('<button>');
    });
  });

  describe('extractTextInterpolations', () => {
    test('should extract simple text interpolation', () => {
      const html = '<div><span>{count()}</span></div>';
      const interpolations = extractTextInterpolations(html);

      expect(interpolations).toHaveLength(1);
      expect(interpolations[0]?.expression).toBe('count()');
    });

    test('should extract expression with operators', () => {
      const html = '<div><span>{count() * 2}</span></div>';
      const interpolations = extractTextInterpolations(html);

      expect(interpolations).toHaveLength(1);
      expect(interpolations[0]?.expression).toBe('count() * 2');
    });

    test('should skip interpolations inside x:for loops', () => {
      const html =
        '<ul><li x:for={item of items()}><span>{item.name}</span></li></ul><p><span>{count()}</span></p>';
      const interpolations = extractTextInterpolations(html);

      // Should only extract {count()}, not {item.name}
      expect(interpolations.length).toBeGreaterThan(0);
      const expressions = interpolations.map((i) => i.expression);
      expect(expressions).toContain('count()');
      expect(expressions).not.toContain('item.name');
    });

    test('should use class name for selector when available', () => {
      const html = '<div><span class="my-class">{value()}</span></div>';
      const interpolations = extractTextInterpolations(html);

      expect(interpolations).toHaveLength(1);
      expect(interpolations[0]?.selector).toContain('my-class');
    });

    test('should use nth-of-type selector when no class', () => {
      const html = '<div><span>{first()}</span><span>{second()}</span></div>';
      const interpolations = extractTextInterpolations(html);

      expect(interpolations).toHaveLength(2);
      expect(interpolations[0]?.selector).toContain('nth-of-type');
    });
  });

  describe('extractHTMLFromPlk', () => {
    test('should remove script tags', () => {
      const content = `<script type="client">
export const count = signal(0);
</script>
<div>Content</div>`;
      const html = extractHTMLFromPlk(content);

      expect(html).not.toContain('<script');
      expect(html).toContain('<div>Content</div>');
    });

    test('should preserve style tags', () => {
      const content = `<style>
.button { background: blue; }
</style>
<div>Content</div>`;
      const html = extractHTMLFromPlk(content);

      expect(html).toContain('<style>');
      expect(html).toContain('.button { background: blue; }');
    });

    test('should strip directives from HTML', () => {
      const content = `<div>
  <button on:click={handleClick} class:active={isActive}>Click</button>
</div>`;
      const html = extractHTMLFromPlk(content);

      expect(html).not.toContain('on:click');
      expect(html).not.toContain('class:active');
      expect(html).toContain('<button');
    });

    test('should handle complex nested structures', () => {
      const content = `<script>export const data = signal(0);</script>
<style>.test { color: red; }</style>
<div>
  <button on:click={fn} class:active={test}>
    <span>{value()}</span>
  </button>
</div>`;
      const html = extractHTMLFromPlk(content);

      expect(html).not.toContain('<script');
      expect(html).toContain('<style>');
      expect(html).not.toContain('on:click');
      expect(html).not.toContain('class:active');
      expect(html).toContain('<div>');
      expect(html).toContain('<button>');
    });
  });

  describe('generateMountFunction', () => {
    const { generateMountFunction } = __testing__;

    test('should generate mount function for directives', () => {
      const content = `<div>
  <button on:click={increment}>+1</button>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('export function mount');
      expect(mount).toContain('bindEvent');
    });

    test('should return empty when manual mount exists', () => {
      const content = `<script type="client">
export function mount(element) {
  return { unmount: () => {} };
}
</script>
<div><button>Click</button></div>`;
      const scripts = [
        {
          content: 'export function mount(element) {\n  return { unmount: () => {} };\n}',
        },
      ];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toBe('');
    });

    test('should handle x:for loops', () => {
      const content = `<ul>
  <li x:for={item of items()} x:key={item.id}>
    <span>{item.text}</span>
  </li>
</ul>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('effect');
      expect(mount).toContain('renderedItems');
      expect(mount).toContain('newKeys');
      expect(mount).toContain('itemTemplate');
    });

    test('should handle text interpolations', () => {
      const content = `<div>
  <span>{count()}</span>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('bindText');
      expect(mount).toContain('computed');
    });

    test('should handle x:if conditionals', () => {
      const content = `<div>
  <p x:if={visible()}>Conditional content</p>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('effect');
      expect(mount).toContain('shouldShow');
      expect(mount).toContain('style.display');
    });

    test('should handle class: bindings', () => {
      const content = `<div>
  <button class:active={isActive()}>Toggle</button>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('bindClass');
      expect(mount).toContain('computed');
      expect(mount).toContain('Boolean');
    });

    test('should handle bind:value on inputs', () => {
      const content = `<div>
  <input bind:value={name} type="text" />
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('bindInputValue');
    });

    test('should handle bind:value on checkboxes', () => {
      const content = `<div>
  <input bind:value={checked} type="checkbox" />
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('bindCheckbox');
    });

    test('should import required runtime utilities', () => {
      const content = `<div>
  <button on:click={fn}>Click</button>
  <input bind:value={val} />
  <div class:active={act}>Text</div>
  <p><span>{value()}</span></p>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain("from '@plank/runtime-core'");
      expect(mount).toContain("from '@plank/runtime-dom'");
      expect(mount).toContain('bindEvent');
      expect(mount).toContain('bindInputValue');
      expect(mount).toContain('bindClass');
      expect(mount).toContain('bindText');
    });

    test('should handle islands with no directives', () => {
      const content = `<div>
  <p>Static content</p>
</div>`;
      const scripts = [];
      const mount = generateMountFunction(content, scripts);

      expect(mount).toContain('export function mount');
      expect(mount).toContain('return');
    });
  });
});
