# Installation

Get started with Plank in under 5 minutes.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PNPM** 9+ (required for monorepo)
- **TypeScript** 5+ (for best experience)

## Quick Start

### 1. Create New Project

```bash
npx plank create my-app
```

This scaffolds a new Plank project with:
- File-based routing setup
- Example pages and islands
- TypeScript configuration
- Development server ready

### 2. Choose a Template

```bash
? Select a template:
  ❯ Marketing Site (0 KB JS)
    App with Islands (10 KB JS)
    Full-Stack App (35 KB JS)
```

**Marketing Site**: Static content, zero JavaScript
**App with Islands**: Some interactivity with islands
**Full-Stack App**: Complete app with actions, routing, caching

### 3. Install Dependencies

```bash
cd my-app
pnpm install
```

### 4. Start Dev Server

```bash
pnpm dev
```

Your app is now running at `http://localhost:3000` 🎉

## Manual Setup

If you prefer to set up Plank manually:

### Install Packages

```bash
pnpm add @plank/compiler @plank/runtime-core @plank/runtime-dom @plank/router @plank/ssr
pnpm add -D @plank/cli @plank/dev-server typescript
```

### Create Configuration

Create `plank.config.ts`:

```typescript
import { defineConfig } from '@plank/cli';

export default defineConfig({
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  publicDir: './public',
  outputDir: './dist',
  budgets: {
    marketing: 10 * 1024,  // 10 KB
    app: 35 * 1024,        // 35 KB
    static: 0,             // 0 KB
  },
});
```

### Create Directory Structure

```bash
mkdir -p app/routes app/layouts public
```

### Create First Route

Create `app/routes/index.plk`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Plank App</title>
</head>
<body>
  <h1>Hello, Plank!</h1>
  <p>This page ships 0 KB JavaScript.</p>
</body>
</html>
```

### Add Scripts to package.json

```json
{
  "scripts": {
    "dev": "plank dev",
    "build": "plank build",
    "preview": "plank preview"
  }
}
```

### Start Development

```bash
pnpm dev
```

## Next Steps

- [Create Your First App](./first-app.md)
- [Understand Project Structure](./project-structure.md)
- [Learn About Islands](../guides/islands.md)
- [Deploy to Production](./deployment.md)

## Upgrading

To upgrade Plank to the latest version:

```bash
pnpm update @plank/*
```

Check the [CHANGELOG](../../CHANGELOG.md) for breaking changes.

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
pnpm dev --port 3001
```

### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

Ensure your `tsconfig.json` extends `@plank/tsconfig`:

```json
{
  "extends": "@plank/tsconfig",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["./app/*"]
    }
  }
}
```

## Need Help?

- [Documentation](../README.md)
- [GitHub Issues](https://github.com/plank/plank/issues)
- [Discord Community](https://discord.gg/plank)
