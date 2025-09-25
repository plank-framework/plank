# Plank Framework

A **reactive**, HTML-first frontend framework that ships near-zero JavaScript by default, adds interactivity through islands, and uses server actions for data mutations.

## 🎯 One-Line Goal

Plank delivers SPA-quality UX with MPA-style cost, avoiding JSX and virtual DOM while favoring web standards and running on **Node 20+**, **Bun**, and **Edge runtimes**.

## ✨ Key Features

- **HTML-first, JavaScript minimal** - Ship near-zero JS by default
- **Progressive enhancement** - Works without JavaScript, enhanced with it
- **Fine-grained reactivity** - Signals over virtual DOM re-renders
- **Server actions** - Form-based mutations over ad-hoc client fetches
- **Web standards first** - Use platform APIs before custom solutions
- **Performance as feature** - Measurable budgets with CI enforcement

## 🏗️ Architecture

### Layered Design
- **Compiler layer** – parses `.plk` templates, lowers directives to DOM instructions, splits islands
- **Runtime core** – signals graph, scheduler, DOM binding engine, a11y utilities
- **Server layer** – SSR renderer with streaming, resumability serializer, actions runtime
- **Router** – file-based server router plus client enhancer with Navigation API + View Transitions
- **Adapters** – Node 20+ (primary), Bun (high-performance), Edge (Cloudflare/Vercel), Deno (optional)

### Package Structure
```
packages/
├── compiler/          # Template parser and code generation
├── runtime-core/      # Signals and scheduler
├── runtime-dom/       # DOM bindings
├── router/           # File-based routing
├── ssr/              # Server-side rendering
├── resume/           # Resumability serialization
├── actions/          # Server actions runtime
├── cache/            # Cache tag management
├── cli/              # Command-line interface
├── dev-server/       # Development server
├── adapters/         # Runtime adapters
├── interop/          # Framework interop
└── ui-primitives/    # Accessible UI components
```

## 🚀 Quick Start

```bash
# Create a new Plank project
npx create-plank my-app
cd my-app

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 📝 Template Language

Authoring is HTML with a small directive layer. No JSX.

```html
<!-- Events -->
<button on:click={handleClick}>Click me</button>

<!-- Bindings -->
<input bind:value={name} />

<!-- Conditionals -->
<div x:if={isVisible}>Content</div>

<!-- Lists -->
<ul>
  <li x:for={item of items} x:key={item.id}>
    {item.name}
  </li>
</ul>

<!-- Islands -->
<island src="./Counter.plk" client:load></island>

<!-- Server actions -->
<form use:action={createTodo}>
  <input name="title" required />
  <button>Create</button>
</form>
```

## ⚡ Performance Budgets

- **Marketing routes**: ≤10 KB gzip JavaScript
- **App routes**: ≤35 KB gzip initial JavaScript
- **Static routes**: 0 KB JavaScript (unless islands present)
- **Build fails** when budgets are exceeded

## 🛠️ Development

### Prerequisites
- Node.js 20+ (LTS)
- PNPM 9+

### Setup
```bash
# Clone the repository
git clone https://github.com/plankjs/plank.git
cd plank

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

### CLI Commands
```bash
plank create <project-name>    # Scaffold new project
plank dev                      # Development server
plank build                    # Production build
plank preview                  # Preview production build
plank analyze                  # Budget analysis and "what ships" report
```

## 📋 Roadmap

### Phase A – Foundations (8 weeks)
- Parser for `.plk` templates and directives
- Signals runtime and DOM binding engine
- SSR renderer for initial HTML
- File-based router and manifest
- Islands detection and code splitting
- Dev server with HMR and error overlay

### Phase B – Advanced Rendering & Data (10 weeks)
- Serializer and client resume bootstrap
- Server actions with form binding and optimistic updates
- Cache tag invalidation across server, edge, client
- Streaming SSR for list pages
- Budgets analyzer and "what ships" report

### Phase C – Platform UX & Ecosystem (12 weeks)
- Router client enhancer with Navigation API + View Transitions
- Speculation Rules helpers
- Interop wrappers for React/Svelte/Vue
- UI primitives and accessibility utilities
- Plugin system and i18n plugin
- Edge/Bun/Deno adapters production-ready

## 🎯 Success Criteria

- Real sites ship 0–10 KB JS on most routes
- Typical dashboard beats reference Next app by ≥20% on main-thread time and initial JS
- Positive developer feedback from at least 5 pilot teams

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md) Code of Conduct.

## 📚 Documentation

- [Requirements](docs/requirements.md) - Complete framework specifications
- [Plan](docs/plan.md) - Architecture overview and roadmap phases
- [Tasks](docs/tasks.md) - Granular task breakdown and implementation roadmap

## 🔗 Links

- [Website](https://plankjs.dev) (coming soon)
- [Documentation](https://docs.plankjs.dev) (coming soon)
- [Discord](https://discord.gg/plank) (coming soon)
- [Twitter](https://twitter.com/plankjs) (coming soon)
