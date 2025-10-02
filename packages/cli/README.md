# @plank/cli

The Plank CLI provides command-line tools for creating, building, and managing Plank applications.

## Installation

```bash
npm install -g @plank/cli
```

## Commands

### `plank create <name>`

Creates a new Plank application with the specified name.

```bash
plank create my-app
cd my-app
```

### `plank dev`

Starts the development server with hot module replacement and live reloading.

```bash
plank dev
```

The development server will:
- Serve your application at `http://localhost:3000`
- Watch for file changes and reload automatically
- Provide error overlays for compilation issues
- Support hot module replacement for islands

### `plank build`

Builds your Plank application for production.

```bash
plank build
```

The build process will:
- Compile `.plk` templates to static HTML
- Bundle island components with reactive bindings
- Generate optimized JavaScript bundles
- Create production-ready static files in the `dist/` directory

### `plank preview`

Serves the built application locally for testing.

```bash
plank preview
```

This command serves the files from the `dist/` directory, allowing you to test the production build locally.

## Configuration

Plank applications are configured via `plank.config.ts`:

```typescript
import { defineConfig } from '@plank/core';

export default defineConfig({
  // Configuration options
});
```

## Features

- **Islands Architecture**: Interactive components that load JavaScript only when needed
- **Template Directives**: Declarative UI with `on:click`, `bind:value`, `x:if`, `x:for`, `class:active`
- **Server-Side Rendering**: Fast initial page loads with SSR
- **Hot Module Replacement**: Fast development with instant updates
- **Production Optimization**: Optimized builds with minimal JavaScript bundles

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build --filter=@plank/cli

# Run tests
pnpm test --filter=@plank/cli
```

## License

Apache 2.0
