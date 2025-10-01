# Plank Framework Documentation

**HTML-first, JavaScript minimal** - A modern web framework that ships near-zero JavaScript by default.

## What is Plank?

Plank is a web framework built on three core principles:

1. **Progressive Enhancement** - Works without JavaScript, enhanced with it
2. **Islands Architecture** - Ship JavaScript only where needed
3. **Performance First** - Measurable budgets enforced in CI

```html
<!-- A complete Plank page -->
<h1>Welcome to Plank</h1>
<p>This page ships 0 KB JavaScript.</p>

<!-- Add interactivity only where needed -->
<island src="./Counter.plk" client:load>
  <div>Loading...</div>
</island>
```

## Quick Start

```bash
# Create new project
npx plank create my-app

# Start dev server
cd my-app
pnpm dev

# Build for production
pnpm build
```

## Documentation Sections

### 📚 Getting Started
- [Installation](./getting-started/installation.md)
- [Your First App](./getting-started/first-app.md)
- [Project Structure](./getting-started/project-structure.md)
- [Deployment](./getting-started/deployment.md)

### 📖 Guides
- [Routing](./guides/routing.md) - File-based routing
- [Islands](./guides/islands.md) - Interactive components
- [Server Actions](./guides/server-actions.md) - Form submissions & mutations
- [Signals](./guides/signals.md) - Reactive state management
- [View Transitions](./guides/view-transitions.md) - Animated page transitions
- [Caching](./guides/caching.md) - Tag-based cache invalidation
- [Resumability](./guides/resumability.md) - Instant interactivity
- [React Integration](./guides/react-integration.md) - Use React components as islands

### 🔌 API Reference
- [@plank/compiler](./api/compiler.md) - Template compilation
- [@plank/runtime-core](./api/runtime-core.md) - Signals & reactivity
- [@plank/runtime-dom](./api/runtime-dom.md) - DOM directives
- [@plank/router](./api/router.md) - File-based routing
- [@plank/ssr](./api/ssr.md) - Server-side rendering
- [@plank/actions](./api/actions.md) - Server actions
- [@plank/cache](./api/cache.md) - Cache management
- [@plank/resume](./api/resume.md) - Resumability
- [@plank/adapter-node](./api/adapter-node.md) - Node.js adapter
- [@plank/interop/react](./api/react-interop.md) - React interop

### 🎯 Examples
- [Marketing Site](./examples/marketing-site.md) - Zero JS static site
- [Todo App](./examples/todo-app.md) - Server actions demo
- [Dashboard](./examples/dashboard.md) - Islands with client routing
- [E-commerce](./examples/ecommerce.md) - Full production app

## Core Features

### ✅ Zero JavaScript by Default
```html
<!-- Marketing page - 0 KB JS -->
<h1>Welcome</h1>
<p>Fast, SEO-friendly, accessible.</p>
```

### ✅ Islands Architecture
```html
<!-- Interactive widget - 5 KB JS -->
<island src="./NewsletterForm.plk" client:visible>
  <form><!-- Fallback --></form>
</island>
```

### ✅ Server Actions
```html
<form use:action={createTodo}>
  <input name="title" required />
  <button>Create</button>
</form>
```

### ✅ Fine-Grained Reactivity
```typescript
const count = signal(0);
const doubled = computed(() => count() * 2);
effect(() => console.log(doubled()));
```

### ✅ Performance Budgets
```typescript
export default {
  budgets: {
    marketing: 10 * 1024,  // 10 KB max
    app: 35 * 1024,        // 35 KB max
    static: 0              // 0 KB required
  }
};
```

## Performance

Plank beats Next.js by **≥20%** on:
- Initial JavaScript bytes
- Time to Interactive (TTI)
- Main-thread execution time
- Largest Contentful Paint (LCP)

Real sites ship **0-10 KB JS** on most routes.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Progressive enhancement for older browsers
- Server-side rendering for full compatibility

## Community

- [GitHub](https://github.com/plank/plank)
- [Discord](https://discord.gg/plank)
- [Twitter](https://twitter.com/plankframework)

## License

Apache-2.0 - See [LICENSE](../LICENSE)
