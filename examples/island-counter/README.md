# Island Counter Example

This example demonstrates Plank's **islands architecture** with interactive components that load JavaScript only when needed.

## Features

- 🏝️ **Islands Architecture** - Interactive components within static HTML
- ⚡ **Progressive Loading** - Different loading strategies for optimal performance
- 🎯 **Client-side Interactivity** - Reactive components with signals
- 📱 **Mobile Optimized** - Minimal JavaScript for better mobile performance

## Islands Included

### 1. Counter Island (`client:load`)
- **Loading Strategy**: Loads immediately when page loads
- **Use Case**: Critical interactive elements like navigation or primary CTAs
- **Features**: Increment, decrement, and reset functionality

### 2. Timer Island (`client:idle`)
- **Loading Strategy**: Loads when browser is idle
- **Use Case**: Secondary features like analytics or non-critical widgets
- **Features**: Start, stop, reset timer with real-time updates

### 3. Chart Island (`client:visible`)
- **Loading Strategy**: Loads when element becomes visible in viewport
- **Use Case**: Below-the-fold content like charts or interactive visualizations
- **Features**: Interactive bar chart with click-to-highlight and data manipulation

## Template Directives

The directives page demonstrates all core Plank template directives with **automatic compilation** - you write directives in your templates, and Plank auto-generates the mount function!

### Event Handlers (`on:*`)
```plk
<script type="client">
import { signal } from '@plank/runtime-core';

export const count = signal(0);
export function handleClick() {
  count(count() + 1);
}
</script>

<button on:click={handleClick}>Click Me!</button>
<p>Clicks: {count()}</p>
```
Attach event listeners to elements. Plank automatically generates `bindEvent` calls in the mount function.

### Two-way Binding (`bind:*`)
```plk
<script type="client">
import { signal } from '@plank/runtime-core';

export const username = signal('');
</script>

<input bind:value={username} type="text" />
<p>Hello, {username() || 'Stranger'}!</p>
```
Create reactive two-way data bindings. Plank uses `bindInputValue` for text inputs and `bindCheckbox` for checkboxes.

### Conditional Rendering (`x:if`)
```plk
<script type="client">
import { signal } from '@plank/runtime-core';

export const isVisible = signal(false);
</script>

<input bind:value={isVisible} type="checkbox" />
<div x:if={isVisible()}>
  <p>This content is conditionally rendered!</p>
</div>
```
Show or hide elements based on boolean conditions using reactive effects.

### Dynamic Classes (`class:*`)
```plk
<script type="client">
import { signal } from '@plank/runtime-core';

export const activeButton = signal('primary');
</script>

<button class:active={activeButton() === 'primary'} on:click={() => setActive('primary')}>
  Primary
</button>
```
Toggle CSS classes dynamically using `bindClass` with computed expressions.

### List Rendering (`x:for`)
```html
<ul>
  <li x:for={todo of todos} x:key={todo.id}>
    {todo.text}
  </li>
</ul>
```
Efficiently render lists with proper element cloning and keying (coming soon).

## How It Works: Automatic Directive Compilation

Plank's dev server automatically compiles directives into efficient runtime bindings. When you write:

```plk
<button on:click={handleClick}>Click</button>
<input bind:value={username} />
<div class:active={isActive()}>Content</div>
```

Plank generates:
```js
export function mount(element, props = {}) {
  const effects = [];

  // Auto-generated bindings using runtime utilities
  effects.push(bindEvent(element.querySelectorAll('button')[0], 'click', handleClick));
  effects.push(bindInputValue(element.querySelectorAll('input')[0], username));
  effects.push(bindClass(element.querySelectorAll('div')[0], 'active', computed(() => isActive())));

  return { unmount: () => effects.forEach(e => e?.stop?.()) };
}
```

**No manual DOM manipulation needed!** Just write declarative directives.

## Loading Strategies

```html
<!-- Loads immediately -->
<island src="./Counter.plk" client:load>
  <div>Loading counter...</div>
</island>

<!-- Loads when browser is idle -->
<island src="./Timer.plk" client:idle>
  <div>Loading timer...</div>
</island>

<!-- Loads when visible -->
<island src="./Chart.plk" client:visible>
  <div>Loading chart...</div>
</island>
```

## Project Structure

```
app/
├── layouts/
│   └── layout.plk          # Root layout (header, footer, styles)
├── routes/
│   ├── index.plk           # Home page with interactive demos
│   └── about.plk           # About islands architecture
└── islands/
    ├── Counter.plk         # Counter island (client:load)
    ├── Timer.plk           # Timer island (client:idle)
    └── Chart.plk           # Chart island (client:visible)
```

## Pages

- **Home (/)** - Interactive demos showing all three island loading strategies in action
- **About (/about)** - Comprehensive guide to islands architecture, benefits, and use cases
- **Directives (/directives)** - Interactive examples demonstrating all core template directives

## Architecture

This example demonstrates:

- **Static HTML Foundation** - Pages are mostly static HTML with CSS
- **Progressive Enhancement** - Interactive features are added progressively
- **Code Splitting** - Each island loads its own JavaScript bundle
- **Performance Optimization** - Minimal initial JavaScript payload

## Performance Benefits

- **Faster Initial Load** - Static content loads instantly
- **Better User Experience** - Interactive elements appear progressively
- **Reduced Bandwidth** - JavaScript loads only when needed
- **Improved Mobile Performance** - Less JavaScript execution on initial load

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

4. Observe the loading behavior:
   - Counter loads immediately (client:load)
   - Timer loads when browser is idle (client:idle)
   - Chart loads when scrolled into view (client:visible)

5. Build for production:
   ```bash
   pnpm build
   ```

6. Preview the production build:
   ```bash
   pnpm preview
   ```

## Island Component Structure

Each island follows this pattern:

```html
<script type="client">
import { signal } from '@plank/runtime-core';
import { bindText, bindAttribute } from '@plank/runtime-dom';

export function mount(element, props) {
  const count = signal(0);

  bindText(element.querySelector('.count'), count);
  bindAttribute(element.querySelector('.increment'), 'onclick', () => {
    count.value++;
  });

  return {
    unmount: () => console.log('Island unmounted')
  };
}
</script>

<div class="counter">
  <p>Count: <span class="count">0</span></p>
  <button class="increment">Increment</button>
</div>
```

## Key Takeaways

- Islands allow you to add interactivity only where needed
- Different loading strategies optimize for different use cases
- Static HTML provides the foundation, islands add enhancement
- Progressive enhancement leads to better performance and user experience

This example proves that you can build rich, interactive applications while maintaining excellent performance and progressive enhancement principles.
