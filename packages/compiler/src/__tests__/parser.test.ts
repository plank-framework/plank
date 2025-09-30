/**
 * @fileoverview Tests for Plank template parser
 */

import { describe, expect, test } from 'vitest';
import { compile, parse, validate } from '../index.js';

describe('Plank Parser', () => {
  test('should parse simple HTML template', () => {
    const source = `
      <div class="container">
        <h1>Hello World</h1>
        <p>This is a test</p>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toHaveLength(1);
    expect(result.ast.children?.[0]?.type).toBe('element');
    expect(result.ast.children?.[0]?.tag).toBe('div');
  });

  test('should parse template with directives', () => {
    const source = `
      <div>
        <button on:click={handleClick}>Click me</button>
        <input bind:value={name} placeholder="Enter name">
        <div x:if={isVisible}>Visible content</div>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.children).toHaveLength(1);

    const div = result.ast.children?.[0];
    expect(div).toBeDefined();
    expect(div?.children).toHaveLength(3);

    // Check button with event handler
    const button = div?.children?.[0];
    expect(button?.tag).toBe('button');
    expect(button?.directive?.type).toBe('on');
    expect(button?.directive?.name).toBe('on:click');
    expect(button?.directive?.value).toBe('{handleClick}');

    // Check input with binding
    const input = div?.children?.[1];
    expect(input?.tag).toBe('input');
    expect(input?.directive?.type).toBe('bind');
    expect(input?.directive?.name).toBe('bind:value');
    expect(input?.directive?.value).toBe('{name}');

    // Check conditional div
    const conditionalDiv = div?.children?.[2];
    expect(conditionalDiv?.tag).toBe('div');
    expect(conditionalDiv?.directive?.type).toBe('x-if');
    expect(conditionalDiv?.directive?.name).toBe('x:if');
    expect(conditionalDiv?.directive?.value).toBe('{isVisible}');
  });

  test('should parse island components', () => {
    const source = `
      <div>
        <island src="./Counter.plk" client:load>
          <div>Loading counter...</div>
        </island>
        <island src="./Chart.plk" client:idle>
          <div>Loading chart...</div>
        </island>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.islands).toHaveLength(2);
    expect(result.islands).toContain('./Counter.plk');
    expect(result.islands).toContain('./Chart.plk');

    const div = result.ast.children?.[0];
    expect(div).toBeDefined();
    expect(div?.children).toHaveLength(2);

    // Check first island
    const firstIsland = div?.children?.[0];
    expect(firstIsland?.tag).toBe('island');
    expect(firstIsland?.island?.src).toBe('./Counter.plk');
    expect(firstIsland?.island?.strategy).toBe('load');

    // Check second island
    const secondIsland = div?.children?.[1];
    expect(secondIsland?.tag).toBe('island');
    expect(secondIsland?.island?.src).toBe('./Chart.plk');
    expect(secondIsland?.island?.strategy).toBe('idle');
  });

  test('should parse server actions', () => {
    const source = `
      <form use:action={createTodo}>
        <input name="title" required>
        <button type="submit">Create</button>
      </form>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.actions).toHaveLength(1);
    expect(result.actions).toContain('{createTodo}');

    const form = result.ast.children?.[0];
    expect(form?.tag).toBe('form');
    expect(form?.directive?.type).toBe('use-action');
    expect(form?.directive?.name).toBe('use:action');
    expect(form?.directive?.value).toBe('{createTodo}');
  });

  test('should parse script blocks', () => {
    const source = `
      <div>Content</div>

      <script type="server">
        export async function loadData() {
          return { title: "Hello" };
        }
      </script>

      <script>
        import { signal } from '@plank/runtime-core';
        const count = signal(0);
      </script>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.scripts).toHaveLength(2);

    // Check server script
    const serverScript = result.scripts[0];
    expect(serverScript?.type).toBe('server');
    expect(serverScript?.content).toContain('export async function loadData');

    // Check client script
    const clientScript = result.scripts[1];
    expect(clientScript?.type).toBe('client');
    expect(clientScript?.content).toContain('import { signal }');
  });

  test('should extract server script exports', () => {
    const source = `
      <script type="server">
        export async function loadData() {
          return { title: "Hello" };
        }

        export function validateUser() {
          return true;
        }

        export async function createPost() {
          return { id: 1 };
        }
      </script>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.scripts).toHaveLength(1);

    const serverScript = result.scripts[0];
    expect(serverScript?.type).toBe('server');
    expect(serverScript?.exports).toEqual(['loadData', 'validateUser', 'createPost']);
  });

  test('should handle server script with no exports', () => {
    const source = `
      <script type="server">
        const data = { title: "Hello" };
        console.log(data);
      </script>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.scripts).toHaveLength(1);

    const serverScript = result.scripts[0];
    expect(serverScript?.type).toBe('server');
    expect(serverScript?.exports).toEqual([]);
  });

  test('should handle client script exports (no extraction)', () => {
    const source = `
      <script>
        export const count = signal(0);
        export function increment() {
          count.set(count() + 1);
        }
      </script>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.scripts).toHaveLength(1);

    const clientScript = result.scripts[0];
    expect(clientScript?.type).toBe('client');
    expect(clientScript?.exports).toBeUndefined();
  });

  test('should validate template syntax', () => {
    const validSource = `
      <div>
        <button on:click={handleClick}>Click</button>
      </div>
    `;

    const invalidSource = `
      <div>
        <button on:invalid-directive={value}>Click</button>
      </div>
    `;

    const validResult = validate(validSource);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidResult = validate(invalidSource);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', () => {
    const source = `
      <div>
        <island>Missing src attribute</island>
      </div>
    `;

    const result = parse(source);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('Island missing required "src" attribute');
  });

  test('should handle parse options with filename', () => {
    const source = `
      <div>
        <island>Missing src attribute</island>
      </div>
    `;

    const result = parse(source, { filename: 'test.plk' });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.filename).toBe('test.plk');
  });

  test('should handle parse options with dev mode', () => {
    const source = `
      <div>
        <button on:click={handleClick}>Click me</button>
      </div>
    `;

    const result = parse(source, { dev: true });

    expect(result.errors).toHaveLength(0);
    expect(result.ast.type).toBe('template');
  });

  test('should extract actions from nested elements', () => {
    const source = `
      <div>
        <form use:action={createTodo}>
          <input name="title" required>
        </form>
        <div>
          <form use:action={updateTodo}>
            <input name="id" required>
          </form>
        </div>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.actions).toHaveLength(2);
    expect(result.actions).toContain('{createTodo}');
    expect(result.actions).toContain('{updateTodo}');
  });

  test('should extract islands from nested elements', () => {
    const source = `
      <div>
        <island src="./Counter.plk" client:load>
          <div>Loading counter...</div>
        </island>
        <div>
          <island src="./Chart.plk" client:idle>
            <div>Loading chart...</div>
          </island>
        </div>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.islands).toHaveLength(2);
    expect(result.islands).toContain('./Counter.plk');
    expect(result.islands).toContain('./Chart.plk');
  });

  test('should handle multiple parsing errors', () => {
    const source = `
      <div>
        <island>Missing src attribute</island>
        <island src="">Empty src attribute</island>
        <form use:action={}>Empty action</form>
      </div>
    `;

    const result = parse(source);

    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors[0]?.message).toContain('Island missing required "src" attribute');
  });

  test('should handle expression parsing', () => {
    const source = `
      <div>
        <button on:click={handleClick}>Click me</button>
        <input bind:value={user.name}>
        <div x:if={isVisible}>Content</div>
      </div>
    `;

    const result = parse(source);

    // Check if there are any errors and log them for debugging
    if (result.errors.length > 0) {
      console.log('Parse errors:', result.errors);
    }

    expect(result.errors).toHaveLength(0);
    expect(result.ast.children).toHaveLength(1);

    const div = result.ast.children?.[0];
    expect(div?.children).toHaveLength(3);

    // Check that expressions are parsed as variables
    const button = div?.children?.[0];
    expect(button?.directive?.value).toBe('{handleClick}');

    const input = div?.children?.[1];
    expect(input?.directive?.value).toBe('{user.name}');

    const conditionalDiv = div?.children?.[2];
    expect(conditionalDiv?.directive?.value).toBe('{isVisible}');
  });

  test('should handle parser errors gracefully', () => {
    const source = `
      <div>
        <button on:invalid-directive={value}>Click</button>
      </div>
    `;

    const result = parse(source);

    // Should still parse successfully but may have validation errors
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toHaveLength(1);
  });

  test('should handle malformed HTML gracefully', () => {
    const source = `
      <div>
        <p>Unclosed paragraph
        <div>Nested div
      </div>
    `;

    const result = parse(source);

    // Should still parse and return an AST
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toBeDefined();
  });

  test('should handle empty template', () => {
    const source = '';

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toHaveLength(0);
  });

  test('should handle whitespace-only template', () => {
    const source = '   \n  \t  ';

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toHaveLength(0);
  });

  test('should handle complex nested structures', () => {
    const source = `
      <div class="container">
        <header>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
            </ul>
          </nav>
        </header>
        <main>
          <section>
            <article>
              <h1>Title</h1>
              <p>Content</p>
            </article>
          </section>
        </main>
        <footer>
          <p>Footer content</p>
        </footer>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.type).toBe('template');
    expect(result.ast.children).toHaveLength(1);

    const container = result.ast.children?.[0];
    expect(container?.tag).toBe('div');
    expect(container?.attributes?.class).toBe('container');
    expect(container?.children).toHaveLength(3);

    const header = container?.children?.[0];
    expect(header?.tag).toBe('header');
    expect(header?.children).toHaveLength(1);

    const nav = header?.children?.[0];
    expect(nav?.tag).toBe('nav');
    expect(nav?.children).toHaveLength(1);

    const ul = nav?.children?.[0];
    expect(ul?.tag).toBe('ul');
    expect(ul?.children).toHaveLength(2);
  });

  test('should handle self-closing tags', () => {
    const source = `
      <div>
        <img src="image.jpg" alt="Image">
        <br>
        <hr>
        <input type="text" name="field">
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.children).toHaveLength(1);

    const div = result.ast.children?.[0];
    expect(div?.children).toHaveLength(4);

    const img = div?.children?.[0];
    expect(img?.tag).toBe('img');
    expect(img?.attributes?.src).toBe('image.jpg');
    expect(img?.attributes?.alt).toBe('Image');

    const br = div?.children?.[1];
    expect(br?.tag).toBe('br');

    const hr = div?.children?.[2];
    expect(hr?.tag).toBe('hr');

    const input = div?.children?.[3];
    expect(input?.tag).toBe('input');
    expect(input?.attributes?.type).toBe('text');
    expect(input?.attributes?.name).toBe('field');
  });

  test('should handle text nodes with special characters', () => {
    const source = `
      <div>
        <p>Text with &amp; entities</p>
        <p>Text with &lt; and &gt; symbols</p>
        <p>Text with &quot;quotes&quot; and &apos;apostrophes&apos;</p>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.children).toHaveLength(1);

    const div = result.ast.children?.[0];
    expect(div?.children).toHaveLength(3);

    const p1 = div?.children?.[0];
    expect(p1?.children?.[0]?.text).toBe('Text with & entities');

    const p2 = div?.children?.[1];
    expect(p2?.children?.[0]?.text).toBe('Text with < and > symbols');

    const p3 = div?.children?.[2];
    expect(p3?.children?.[0]?.text).toBe('Text with "quotes" and \'apostrophes\'');
  });

  test('should handle attributes with special characters', () => {
    const source = `
      <div>
        <input data-value="value with spaces" data-special="special&chars">
        <button title="Button with &quot;quotes&quot;">Click</button>
      </div>
    `;

    const result = parse(source);

    expect(result.errors).toHaveLength(0);
    expect(result.ast.children).toHaveLength(1);

    const div = result.ast.children?.[0];
    expect(div?.children).toHaveLength(2);

    const input = div?.children?.[0];
    expect(input?.attributes?.['data-value']).toBe('value with spaces');
    expect(input?.attributes?.['data-special']).toBe('special&chars');

    const button = div?.children?.[1];
    expect(button?.attributes?.title).toBe('Button with "quotes"');
  });
});

describe('Plank Compiler', () => {
  test('should compile simple template', () => {
    const source = `
      <div class="container">
        <h1>Hello World</h1>
        <button on:click={handleClick}>Click me</button>
      </div>
    `;

    const result = compile(source);

    expect(result.code).toContain('import { signal, computed, effect } from \'@plank/runtime-dom\'');
    expect(result.scripts).toHaveLength(0);
    expect(result.dependencies).toHaveLength(1);
    expect(result.islands).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test('should compile template with options', () => {
    const source = `
      <div>
        <island src="./Counter.plk" client:load>
          <div>Loading...</div>
        </island>
        <form use:action={createTodo}>
          <input name="title" required>
        </form>
      </div>
    `;

    const options = {
      dev: true,
      target: 'node' as const,
      sourceMap: true,
      filename: 'test.plk',
    };

    const result = compile(source, options);

    expect(result.code).toContain('import { SSRRenderer, StreamingWriter } from \'@plank/ssr\'');
    expect(result.scripts).toHaveLength(0);
    expect(result.dependencies).toHaveLength(1);
    expect(result.islands).toHaveLength(1);
    expect(result.islands).toContain('./Counter.plk');
    expect(result.actions).toHaveLength(1);
    expect(result.actions).toContain('createTodo');
    expect(result.errors).toHaveLength(0);
  });

  test('should compile template with scripts', () => {
    const source = `
      <div>Content</div>

      <script type="server">
        export async function loadData() {
          return { title: "Hello" };
        }
      </script>

      <script>
        import { signal } from '@plank/runtime-core';
        const count = signal(0);
      </script>
    `;

    const result = compile(source);

    expect(result.code).toContain('import { signal, computed, effect } from \'@plank/runtime-dom\'');
    expect(result.scripts).toHaveLength(2);
    expect(result.scripts[0]?.type).toBe('server');
    expect(result.scripts[1]?.type).toBe('client');
    expect(result.dependencies).toHaveLength(1);
    expect(result.islands).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test('should handle compilation errors', () => {
    const source = `
      <div>
        <island>Missing src attribute</island>
      </div>
    `;

    const result = compile(source);

    expect(result.code).toContain('import { signal, computed, effect } from \'@plank/runtime-dom\'');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('Island missing required "src" attribute');
  });

  test('should compile with default options', () => {
    const source = '<div>Simple content</div>';

    const result = compile(source);

    expect(result.code).toContain('import { signal, computed, effect } from \'@plank/runtime-dom\'');
    expect(result.scripts).toHaveLength(0);
    expect(result.dependencies).toHaveLength(1);
    expect(result.islands).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
