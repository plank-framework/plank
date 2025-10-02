# @plank/compiler

The Plank template compiler that transforms `.plk` templates into optimized JavaScript code with reactive bindings and island components.

## Features

- **Template Parsing**: Parses `.plk` files with HTML, directives, and embedded scripts
- **Directive Compilation**: Compiles template directives (`on:click`, `bind:value`, `x:if`, `x:for`, `class:active`) to reactive JavaScript
- **Island Detection**: Identifies and extracts island components for code splitting
- **Server Actions**: Compiles server-side form actions and handlers
- **Code Generation**: Generates optimized JavaScript with proper imports and exports
- **Source Maps**: Optional source map generation for debugging

## API

### `compile(source, options)`

Compiles a Plank template to JavaScript.

```typescript
import { compile } from '@plank/compiler';

const result = compile(`
<div>
  <button on:click={handleClick}>Click me</button>
  <input bind:value={name} />
  <div x:if={showMessage}>Hello {name}!</div>
</div>

<script>
  import { signal } from '@plank/runtime-core';

  const name = signal('');
  const showMessage = signal(false);

  function handleClick() {
    showMessage.value = !showMessage.value;
  }
</script>
`, {
  dev: true,
  target: 'client',
  sourceMap: true,
  filename: 'component.plk'
});
```

### Compiler Options

```typescript
interface CompilerOptions {
  /** Enable development mode with additional debugging info */
  dev?: boolean;
  /** Target runtime environment */
  target?: 'node' | 'bun' | 'edge' | 'deno' | 'client' | 'server';
  /** Enable source maps */
  sourceMap?: boolean;
  /** Source file path for error reporting */
  filename?: string;
}
```

### Compile Result

```typescript
interface CompileResult {
  /** Generated JavaScript code */
  code: string;
  /** Source map if enabled */
  map?: string;
  /** Scripts found in the template */
  scripts: Array<{ type: 'server' | 'client'; content: string; exports?: string[] }>;
  /** List of dependencies found in the template */
  dependencies: string[];
  /** Islands detected in the template */
  islands: string[];
  /** Server actions found */
  actions: string[];
  /** Code-split chunks for islands */
  chunks: Array<{
    src: string;
    strategy: string;
    code: string;
    dependencies: string[];
    id: string;
  }>;
  /** Parsing errors */
  errors: Array<{ message: string; line: number; column: number; filename?: string }>;
}
```

## Template Syntax

### Directives

- **Event Handlers**: `on:click={handler}`, `on:input={handler}`
- **Two-way Binding**: `bind:value={signal}`, `bind:checked={signal}`
- **Conditional Rendering**: `x:if={condition}`
- **List Rendering**: `x:for={item in items}`
- **Dynamic Classes**: `class:active={isActive}`, `class:disabled={isDisabled}`

### Islands

```html
<island src="./Counter.plk" client:load>
  <div>Loading...</div>
</island>
```

### Server Actions

```html
<form use:action={handleSubmit}>
  <input name="email" type="email" required />
  <button type="submit">Subscribe</button>
</form>
```

## Grammar

The compiler includes a comprehensive grammar definition for Plank templates:

```typescript
import {
  DIRECTIVE_PATTERNS,
  EXPRESSION_OPERATORS,
  ISLAND_STRATEGIES,
  isValidDirective,
  isValidExpression,
  isValidIslandStrategy
} from '@plank/compiler';
```

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the compiler
pnpm build --filter=@plank/compiler

# Run tests
pnpm test --filter=@plank/compiler

# Run tests with coverage
pnpm test:coverage --filter=@plank/compiler
```

## License

Apache 2.0
