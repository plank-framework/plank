# Plank Project Plan
Version: 1.1-draft

---

## Architecture Overview

### Layered Design
- **Compiler layer** – parses `.plk` templates, lowers directives to DOM instructions, splits islands, emits server/client bundles, performs static analysis for budgets and action boundaries.
- **Runtime core** – signals graph, scheduler, DOM binding engine, a11y utilities.
- **Server layer** – SSR renderer with streaming, resumability serializer, actions runtime, cache tag manager.
- **Router** – file-based server router plus client enhancer with Navigation API + View Transitions + Speculation Rules.
- **Tooling** – CLI, dev server with Vite plugin, analyzer, plugin system.
- **Adapters** – Node 20+ (primary), Bun (high-performance), Edge (Cloudflare/Vercel), Deno (optional).

### Package Topology

```bash
packages/
compiler
runtime-core
runtime-dom
router
ssr
resume
actions
cache
cli
dev-server
adapters/{node,bun,edge,deno}
interop/{react,svelte,vue}
ui-primitives
```

### Monorepo Setup
* **Package manager**: PNPM 9+
* **Build orchestration**: Turborepo with incremental caching
* **Language**: TypeScript 5.x strict
* **Module format**: ESM only
* **Primary runtime**: Node 20+ (LTS)
* **Secondary runtimes**: Bun (fast SSR), Edge (Workers/Vercel), Deno (optional)

---

## Roadmap Phases

### Phase A – Foundations
Goal: End-to-end SSR with HTML templates, signals, basic islands, and dev server.

Deliverables
* Parser for `.plk` templates and directives.
* Signals runtime and DOM binding engine.
* SSR renderer for initial HTML.
* File-based router and manifest.
* Islands detection and code splitting.
* Dev server with HMR and error overlay.
* Minimal CLI (`create`, `dev`, `build`, `preview`).
* Examples: zero-JS marketing page and island counter.

Exit Criteria
* Todo MVC demo with <10 KB client bundle for the island page.

---

### Phase B – Advanced Rendering & Data
Goal: Resumability, actions, streaming, cache tags, budgets.

Deliverables
* Serializer and client resume bootstrap.
* Server actions with form binding and optimistic updates.
* Cache tag invalidation across server, edge, client.
* Streaming SSR for list pages.
* Budgets analyzer and “what ships” report.

Exit Criteria
* Dashboard example with streaming table and optimistic form updates.
* Budgets enforced in CI.

---

### Phase C – Platform UX & Ecosystem
Goal: SPA polish via platform APIs, interop, plugins, docs, and adapters.

Deliverables
* Router client enhancer with Navigation API + View Transitions.
* Speculation Rules helpers.
* Interop wrappers for React/Svelte/Vue.
* UI primitives and accessibility utilities.
* Plugin system and i18n plugin.
* Edge/Bun/Deno adapters production-ready.
* Docs site, playground, and starter templates.

Exit Criteria
* Public beta with complete documentation and at least three starter templates.

---

## Risk Mitigation
* **Resumability complexity** – strict serialization schema and fallback to partial hydration.
* **Runtime divergence** – isolate adapters and run CI matrix across Node, Bun, Edge, Deno.
* **SEO for “Plank”** – consistent branding as “Plank Framework” or “PlankJS” in docs and npm scope.

---

## Metrics
* Build size per route, initial JS bytes, TTI, main-thread time, LCP.
* Action latency and optimistic success rate.
* Dev server HMR round-trip time.
* Benchmark comparisons with Next.js.

---

## Timeline (approx.)
* Phase A: ~8 weeks
* Phase B: ~10 weeks
* Phase C: ~12 weeks
* Public beta target: ~30 weeks from project start.
