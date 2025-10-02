# @plank/dev-server

Development server with hot module replacement (HMR) and Vite integration for Plank applications.

## Features

- **Hot Module Replacement**: Instant updates when files change
- **Vite Integration**: Built on Vite for fast development experience
- **Error Overlays**: Rich error display in the browser
- **File Watching**: Automatic rebuilds on file changes
- **Island Hydration**: Development-time island component loading
- **Source Maps**: Full source map support for debugging

## API

### `createDevServer(config)`

Creates a development server instance.

```typescript
import { createDevServer } from '@plank/dev-server';

const server = await createDevServer({
  root: './app',
  port: 3000,
  host: 'localhost',
  open: true,
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  publicDir: './public',
  https: false,
  hmr: true,
  watch: true,
  plugins: [],
  env: {}
});

await server.start();
```

### DevServerConfig

```typescript
interface DevServerConfig {
  /** Project root directory */
  root: string;
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Open browser on start */
  open: boolean;
  /** Routes directory */
  routesDir: string;
  /** Layouts directory */
  layoutsDir: string;
  /** Public assets directory */
  publicDir: string;
  /** Enable HTTPS */
  https: boolean;
  /** Enable HMR */
  hmr: boolean;
  /** Enable file watching */
  watch: boolean;
  /** Vite plugins */
  plugins: any[];
  /** Environment variables */
  env: Record<string, string>;
}
```

### Error Overlay

The dev server provides rich error overlays for compilation and runtime errors:

```typescript
import { createErrorOverlay, generateErrorOverlayScript } from '@plank/dev-server';

// Create error overlay HTML
const errorOverlay = createErrorOverlay(error, {
  type: 'error',
  file: 'component.plk',
  line: 10,
  column: 5
});

// Generate overlay script
const script = generateErrorOverlayScript(errorOverlay);
```

### Vite Plugin

The dev server includes a Vite plugin for seamless integration:

```typescript
import { plankPlugin } from '@plank/dev-server';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    plankPlugin({
      // Plugin options
    })
  ]
});
```

## Development Server Features

### Hot Module Replacement

The dev server provides instant updates when you modify files:

- **Template changes**: `.plk` files are recompiled and updated
- **Script changes**: JavaScript changes trigger HMR updates
- **Style changes**: CSS updates are applied instantly
- **Island updates**: Island components are rehydrated

### File Watching

The server watches for changes in:

- Route files (`app/routes/*.plk`)
- Layout files (`app/layouts/*.plk`)
- Island components (`app/islands/*.plk`)
- Public assets (`public/*`)
- Configuration files (`plank.config.ts`)

### Error Handling

Rich error reporting with:

- **Compilation errors**: Template syntax and TypeScript errors
- **Runtime errors**: JavaScript execution errors
- **Build errors**: Asset processing and bundling issues
- **Source maps**: Full stack traces with original file locations

## Usage

The dev server is typically used through the Plank CLI:

```bash
plank dev
```

Or programmatically:

```typescript
import { createDevServer } from '@plank/dev-server';

const server = await createDevServer({
  root: process.cwd(),
  port: 3000,
  host: 'localhost',
  open: true,
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  publicDir: './public',
  https: false,
  hmr: true,
  watch: true,
  plugins: [],
  env: {}
});

// Start the server
await server.start();

// Stop the server
await server.stop();
```

## Events

The dev server emits events for integration:

```typescript
server.on('ready', (url) => {
  console.log(`Server ready at ${url}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

server.on('hmr', (update) => {
  console.log('HMR update:', update);
});
```

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the dev server
pnpm build --filter=@plank/dev-server

# Run tests
pnpm test --filter=@plank/dev-server

# Run tests with coverage
pnpm test:coverage --filter=@plank/dev-server
```

## License

Apache 2.0
