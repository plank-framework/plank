# Islands Architecture

Ship JavaScript only where you need interactivity.

## What are Islands?

Islands are **interactive components** surrounded by static HTML. They:
- Load JavaScript independently
- Hydrate only when needed
- Don't affect the rest of the page
- Enable partial interactivity

Think of them as "islands of interactivity" in a sea of static HTML.

## Loading Strategies

Plank supports three loading strategies:

### 1. `client:load` - Immediate

Loads and hydrates immediately on page load.

```html
<island src="./Counter.plk" client:load>
  <div>Loading counter...</div>
</island>
```

**Use for**: Critical, above-the-fold interactivity

### 2. `client:idle` - When Browser is Idle

Loads when the browser is idle (`requestIdleCallback`).

```html
<island src="./Newsletter.plk" client:idle>
  <form><!-- Fallback form --></form>
</island>
```

**Use for**: Important but not critical features

### 3. `client:visible` - When Scrolled Into View

Loads when the island enters the viewport (`IntersectionObserver`).

```html
<island src="./Comments.plk" client:visible>
  <div>Scroll down to load comments...</div>
</island>
```

**Use for**: Below-the-fold content, lazy-loaded features

## Creating an Island

Islands are just `.plk` files in your `islands/` directory:

### Simple Counter Island

Create `app/islands/Counter.plk`:

```html
<script type="module">
import { signal } from '@plank/runtime-core';

const count = signal(0);

function increment() {
  count(count() + 1);
}

function decrement() {
  count(count() - 1);
}

// Update DOM when count changes
import { effect } from '@plank/runtime-core';
effect(() => {
  const countEl = document.querySelector('#count');
  if (countEl) {
    countEl.textContent = count();
  }
});

// Attach event listeners
document.querySelector('#increment')?.addEventListener('click', increment);
document.querySelector('#decrement')?.addEventListener('click', decrement);
</script>

<div class="counter">
  <button id="decrement">-</button>
  <span id="count">0</span>
  <button id="increment">+</button>
</div>

<style>
.counter {
  display: flex;
  align-items: center;
  gap: 1rem;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1.5rem;
  border: none;
  background: #0066cc;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

### Using the Island

In any route (`app/routes/index.plk`):

```html
<h1>Welcome</h1>
<p>This page is static HTML (0 KB JS)</p>

<!-- Island loads JavaScript only here -->
<island src="../islands/Counter.plk" client:load>
  <div>Loading counter...</div>
</island>

<p>More static content below...</p>
```

## Props Passing

Pass data from server to island:

```html
<island 
  src="../islands/Product.plk" 
  client:visible
  props:product-id="12345"
  props:name="Coffee Mug"
  props:price="19.99"
>
  <div>Loading product...</div>
</island>
```

Access props in island:

```javascript
const productId = document.currentScript?.dataset.productId;
const name = document.currentScript?.dataset.name;
const price = parseFloat(document.currentScript?.dataset.price);
```

## Fallback Content

Islands should always provide fallback content:

```html
<island src="./Newsletter.plk" client:idle>
  <!-- This shows while loading OR if JavaScript fails -->
  <form action="/api/subscribe" method="POST">
    <input name="email" type="email" required />
    <button>Subscribe</button>
  </form>
</island>
```

This ensures **progressive enhancement** - the app works without JavaScript.

## Performance Tips

### 1. Use the Right Loading Strategy

```html
<!-- ❌ Bad: Everything loads immediately -->
<island src="./Comments.plk" client:load></island>
<island src="./RelatedPosts.plk" client:load></island>
<island src="./Newsletter.plk" client:load></island>

<!-- ✅ Good: Prioritize critical features -->
<island src="./Comments.plk" client:visible></island>
<island src="./RelatedPosts.plk" client:visible></island>
<island src="./Newsletter.plk" client:idle></island>
```

### 2. Share Dependencies

Islands automatically share runtime dependencies:

```javascript
// Both islands use the same @plank/runtime-core bundle
import { signal } from '@plank/runtime-core';
```

### 3. Code Split Large Islands

```javascript
// Lazy load heavy features
const chart = await import('./chart.js');
chart.render(data);
```

### 4. Measure Bundle Size

```bash
plank analyze --route=/dashboard
```

## Advanced Patterns

### Nested Islands

Islands can contain other islands:

```html
<!-- Parent island -->
<island src="./Dashboard.plk" client:load>
  <div>
    <!-- Child islands load independently -->
    <island src="./Chart.plk" client:visible></island>
    <island src="./Table.plk" client:visible></island>
  </div>
</island>
```

### Conditional Islands

Load islands based on conditions:

```html
<script>
const isPremium = user?.plan === 'premium';
</script>

{#if isPremium}
  <island src="./AdvancedFeatures.plk" client:load></island>
{:else}
  <div>Upgrade to access advanced features</div>
{/if}
```

### Dynamic Islands

Load islands dynamically:

```javascript
async function loadIsland(name) {
  const module = await import(`./islands/${name}.plk`);
  return module.default;
}
```

## Debugging

### Check What's Loaded

```bash
# See island bundles
plank analyze --what-ships
```

### Dev Tools

```javascript
// Log island lifecycle
console.log('Island mounted:', this);
```

### Performance Profiling

```javascript
// Measure island load time
performance.mark('island-start');
// ... island code ...
performance.mark('island-end');
performance.measure('island-load', 'island-start', 'island-end');
```

## Common Patterns

### Search Input

```html
<island src="./Search.plk" client:load>
  <form action="/search">
    <input name="q" placeholder="Search..." />
  </form>
</island>
```

### Image Gallery

```html
<island src="./Gallery.plk" client:visible>
  <!-- Fallback: Static images -->
  <div class="grid">
    <img src="/photo1.jpg" alt="Photo 1" />
    <img src="/photo2.jpg" alt="Photo 2" />
  </div>
</island>
```

### Live Chat

```html
<island src="./Chat.plk" client:idle>
  <a href="/contact">Contact us</a>
</island>
```

## Learn More

- [Resumability](./resumability.md) - Zero-latency island hydration
- [Server Actions](./server-actions.md) - Island + server integration
- [React Integration](./react-integration.md) - Use React components as islands
