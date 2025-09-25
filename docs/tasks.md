# Plank Task Breakdown
Version: 1.1-draft

This file provides the **granular roadmap** for implementing Plank according to requirements.md and plan.md.
Tasks are grouped by phase and numbered for easy issue tracking.

## 0. Repo & Tooling
0.1 Monorepo bootstrap with PNPM workspaces and Turborepo.
0.2 Add Apache 2.0 LICENSE and project-wide README.
0.3 Configure TypeScript 5.x strict mode with project references.
0.4 CI matrix: Node 20, Bun latest, Deno latest for adapters.
0.5 Changesets for versioning and canary releases.

## 1. Phase A – Foundations
1.1 Define `.plk` grammar and directive list (on, bind, x:if, x:for, etc.).
1.2 Implement parser and generate IR of DOM operations.
1.3 Build `@plank/runtime-core` signals graph, scheduler, and microtask updates.
1.4 Create DOM binding runtime applying IR with minimal ops.
1.5 Implement server renderer (`@plank/ssr`) with streaming HTML output.
1.6 File-based router with nested layouts and manifest generation.
1.7 Islands detection and code-splitting in compiler.
1.8 Dev server with Vite plugin and HMR for `.plk` files.
1.9 CLI (`create`, `dev`, `build`, `preview`) with starter template.
1.10 Example apps: `marketing-zero-js` and `island-counter`.

## 2. Phase B – Advanced Rendering & Data
2.1 Define serialization schema for resumability.
2.2 Implement server serializer embedding signals graph.
2.3 Client bootstrap to resume without re-executing constructors.
2.4 Partial hydration fallback for non-resumable routes.
2.5 Server actions runtime with `<form use:action>` support and `useAction()` helper.
2.6 Optimistic UI updates and rollback logic.
2.7 Cache tagging API with server/edge/client adapters.
2.8 Streaming SSR with progressive reveal and placeholders.
2.9 Budgets analyzer CLI (`plank analyze`) enforcing per-route JS limits.
2.10 Example apps: dashboard-actions, streaming-list, cache-tags.

## 3. Phase C – Platform UX & Ecosystem
3.1 Router client enhancer using Navigation API and View Transitions.
3.2 Speculation Rules helper for prefetch/prerender.
3.3 Interop wrappers for React, Svelte, and Vue as islands.
3.4 UI primitives (Dialog, Popover, Menu, Tooltip) with full ARIA compliance.
3.5 Plugin API (`transformTemplate`, `transformClientChunk`, etc.) and sample plugins (i18n, icon inlining).
3.6 Adapters for Node 20+, Bun, Edge, and Deno with fetch-compatible interfaces.
3.7 Documentation site with live playground and at least 20 guides.
3.8 Bench harness comparing Plank vs Next on initial JS and TTI.

## 4. Cross-cutting
4.1 Error handling with directive-level diagnostics.
4.2 Security hardening: CSRF middleware, default HTML escaping.
4.3 Telemetry opt-in with anonymous usage metrics.
4.4 Accessibility sweeps (automated + manual).
4.5 Contributor experience: RFC template, issue templates, “good first issue” labels.
4.6 Release channels: nightly canaries, weekly alphas, monthly betas.

Completion of these tasks yields a fully functional **Plank 1.0 beta** that matches all goals in `requirements.md`.