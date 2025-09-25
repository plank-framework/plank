# Plank Framework Requirements
Version: 1.1-draft
Owner: Core Team
Audience: Contributors and early adopters

---

## 0. One-Line Goal
Plank is a **reactive**, HTML-first frontend framework that ships near-zero JavaScript by default, adds interactivity through islands, and uses server actions for data mutations.
It avoids JSX and virtual DOM, favors web standards, and runs on **Node 20+** (baseline), **Bun**, and **Edge runtimes**, with optional **Deno** support.

---

## 1. Problem Statement
Modern stacks often:
- Ship too much JavaScript to the client.
- Hide simple interactions behind complex client state.
- Tie developers to JSX and VDOM mental models.
- Make mutations and caching an afterthought.
- Treat platform capabilities (Navigation API, View Transitions, Popover, Speculation Rules) as optional instead of first-class.

Plank must deliver SPA-quality UX with MPA-style cost, and a simple reactive model that feels native to the web.

---

## 2. Key Decisions
| Area | Decision |
|------|---------|
| **License** | **Apache 2.0** – permissive, explicit patent grant, enterprise-friendly. |
| **Runtime Targets** | **Node 20+ (LTS)** as primary reference runtime.<br>**Bun** adapter for high-performance SSR and dev server speed.<br>**Edge** adapters (Cloudflare Workers, Vercel Edge, etc.) for global low-latency deployments.<br>**Deno** adapter as an optional secondary target. |
| **Package Manager** | PNPM 9+ |
| **Monorepo Tool** | Turborepo with build caching |
| **Language** | TypeScript 5.x strict mode |
| **Module Format** | Pure ESM output only |

---

## 3. Core Principles
* HTML first, JavaScript minimal.
* Progressive enhancement by default.
* Fine-grained reactivity via signals rather than tree re-renders.
* Server actions over ad-hoc client fetches.
* Prefer web standards before custom APIs.
* Performance as a feature – measurable budgets and CI enforcement.
* Developer experience without magic.

---

## 4. Target Users and Use Cases
* Product teams needing app-like UX with strict performance budgets.
* Content + app hybrids: marketing sites with dashboards, docs with interactive sandboxes.
* Teams migrating away from heavy client frameworks toward server defaults.
* Edge-oriented deployments requiring low-latency streaming.

Example scenarios:
* Marketing site with **0 KB JS** on most routes, small islands for menus and carousels.
* Account dashboard with optimistic form updates via server actions.
* Data-heavy admin screens that stream server-rendered fragments and resume client interactivity only where needed.

---

## 5. Naming and Conventions
* Framework name: **Plank**
* CLI: `plank` (`create-plank` for scaffolding)
* File extension for templates: `.plk`
* Config file: `plank.config.ts`
* Package scope: `@plank/*`

---

## 6. Template Language
Authoring is HTML with a small directive layer. No JSX.

Required directives:
* Events: `on:click={fn}`
* Bindings: `bind:value={signal}`
* Conditionals: `x:if`, `x:else`, `x:show`
* Lists: `x:for={item of list}` with `x:key`
* Classes/attributes: `class:active`, `attr:data-id`
* Islands: `<island src="./Counter.plk" client:load|client:idle|client:visible>`
* Server action hooks: `use:action={signup}` on `<form>`

Compile-time guarantees:
* Static analysis of directives and scope.
* Safe escaping and XSS protection by default.
* Dead-code elimination for unused client paths.

---

## 7. Reactivity Model
* Primitives: `signal<T>()`, `computed()`, `effect()`.
* Fine-grained dependency graph and microtask scheduler.
* DOM bindings patch only affected nodes.
* SSR serialization markers for resumability.

Performance target: `signal` update is O(1) per dependent binding.

---

## 8. Rendering Pipeline
* **Server-side rendering** by default with streaming.
* **Resumability mode** for islands and opt-in pages:
  * Serialize reactive graph and event wiring.
  * Client resumes without re-executing constructors.
* Partial hydration fallback when resumability is disabled or unsupported.

---

## 9. Routing & Navigation
* File-based routing from `/app/routes`.
* Nested layouts with slots.
* MPA by default: server navigations.
* Optional client router enhancer:
  * Navigation API for link interception.
  * View Transitions for animated cross-doc transitions.
  * Scroll & focus restoration.
  * Speculation Rules for prefetch/prerender.

---

## 10. Data, Actions, and Cache
* Server actions bound to forms:
  ```html
  <form use:action={createTodo}>
    <input name="title" required />
    <button>Create</button>
  </form>
  <script type="server">
    export async function createTodo(formData, ctx) { /* ... */ }
  </script>
*	Client helper useAction() for optimistic UI and cache invalidation.
*	Cache tagging with server/edge/client adapters.

---

## 11. Performance Requirements
*	Zero JS on a static route unless an island is present.
*	Per-route JS budgets:
*	Marketing: ≤10 KB gzip.
*	App routes: ≤35 KB gzip initial.
*	Build fails or warns when a route exceeds its budget.
*	Built-in “what ships” report.

---

## 12. Accessibility & i18n
*	Accessible UI primitives (Dialog, Popover, Menu, Tooltip).
*	Focus management utilities in runtime.
*	Optional i18n plugin with compile-time extraction.

---

## 13. Security
*	CSRF protection helpers for actions.
*	HTML escaping by default.
*	Content Security Policy recommendations in starter templates.

---

## 14. Tooling & DX
*	PNPM + Turborepo monorepo.
*	Dev server with Vite plugin, HMR, and error overlay.
*	CLI commands: dev, build, preview, analyze.
*	Plugin API for compiler and router.

---

## 15. Interop
*	Web Component wrapper for React/Vue/Svelte components as islands.

---

## 16. Testing & Quality
*	Vitest for unit tests, Playwright for E2E.
*	Bench harness comparing Plank vs Next on TTI and JS bytes.

---

## 17. Telemetry
*	Opt-in anonymous usage and performance metrics.
*	CLI switch: --telemetry=on|off.

---

## 18. Governance
*	License: Apache 2.0.
*	Code of Conduct: Contributor Covenant.
*	RFC process for breaking changes.

---

## 19. Success Criteria
*	Real sites ship 0–10 KB JS on most routes.
*	Typical dashboard beats reference Next app by ≥20 % on main-thread time and initial JS.
*	Positive developer feedback from at least 5 pilot teams.
