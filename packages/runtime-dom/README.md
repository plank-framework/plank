# @plank/runtime-dom

DOM binding runtime for Plank framework. Provides reactive bindings, view transitions, focus management, and islands system.

## Features

- ✅ **Reactive Bindings**: Connect signals to DOM elements
- ✅ **View Transitions**: Smooth animated page transitions
- ✅ **Focus Management**: Accessible navigation with skip links and announcements
- ✅ **Islands System**: Lazy load interactive components
- ✅ **Server Actions**: Form handling with optimistic updates
- ✅ **Directives**: Template directives for common patterns
- ✅ **Type-Safe**: Full TypeScript support

## Installation

```bash
pnpm add @plank/runtime-dom
```

## Reactive Bindings

### Text Binding

```typescript
import { signal } from '@plank/runtime-dom';
import { bindText } from '@plank/runtime-dom';

const count = signal(0);
const div = document.querySelector('#counter');

bindText(div, count);

count(42); // Updates DOM automatically
```

### Attribute Binding

```typescript
import { bindAttribute } from '@plank/runtime-dom';

const id = signal('user-123');
const element = document.querySelector('#profile');

bindAttribute(element, 'data-user-id', id);
```

### Class Binding

```typescript
import { bindClass } from '@plank/runtime-dom';

const isActive = signal(false);
const button = document.querySelector('button');

bindClass(button, 'active', isActive);

isActive(true); // Adds 'active' class
```

### Two-Way Binding

```typescript
import { bindInputValue } from '@plank/runtime-dom';

const name = signal('');
const input = document.querySelector('input');

bindInputValue(input, name);

// Input updates signal, signal updates input
```

## View Transitions

### Basic Usage

```typescript
import { createViewTransitions } from '@plank/runtime-dom';

const vt = createViewTransitions({
  duration: 300,
  easing: 'ease-in-out',
});

// Perform a smooth transition
await vt.transition(async () => {
  // Update DOM here
  document.querySelector('main').innerHTML = newContent;
});
```

### Named Transitions

```typescript
// Slide transition
await vt.transition(updateDOM, {
  transitionName: 'slide'
});

// Scale transition
await vt.transition(updateDOM, {
  transitionName: 'scale'
});
```

### Persistent Elements

```typescript
const vt = createViewTransitions({
  persistElements: ['header', 'nav', '.sidebar'],
});

// These elements will smoothly morph across transitions
await vt.transition(updateContent);
```

### With Lifecycle Hooks

```typescript
const vt = createViewTransitions({
  onBeforeTransition: async () => {
    console.log('Starting transition...');
    showLoadingBar();
  },
  onAfterTransition: async () => {
    console.log('Transition complete!');
    hideLoadingBar();
  },
});
```

## Focus Management

### Auto-Focus Main Content

```typescript
import { createFocusManager } from '@plank/runtime-dom';

const focus = createFocusManager();

// After navigation, focus main content
focus.focusMain();
```

### Skip Links

```typescript
const focus = createFocusManager();

// Create accessible skip link
focus.createSkipLink('Skip to main content', 'main');
```

### Screen Reader Announcements

```typescript
focus.announcePageChange('Welcome to About page');
```

### Focus Trapping

```typescript
const modal = document.querySelector('.modal');
const cleanup = focus.trapFocus(modal);

// Later, release the trap
cleanup();
```

## Islands System

### Create Island

```typescript
import { createIsland, registerIsland, initializeIsland } from '@plank/runtime-dom';

// Register island component
registerIsland('./Counter.plk', {
  mount: (element, props) => {
    const count = signal(props?.initial || 0);
    bindText(element, count);
    return effect(() => {
      console.log('Counter effect running');
    });
  },
  unmount: () => {
    console.log('Cleaning up counter');
  },
});

// Create and initialize island
const island = createIsland({
  src: './Counter.plk',
  strategy: 'load',
  props: { initial: 10 },
});

document.body.appendChild(island);
await initializeIsland(island, { src: './Counter.plk', strategy: 'load' });
```

### Loading Strategies

```typescript
// Load immediately
const eagerIsland = createIsland({
  src: './Header.plk',
  strategy: 'load',
});

// Load when browser is idle
const deferredIsland = createIsland({
  src: './Newsletter.plk',
  strategy: 'idle',
});

// Load when visible
const lazyIsland = createIsland({
  src: './Chart.plk',
  strategy: 'visible',
});

// Load on user interaction
const interactiveIsland = createIsland({
  src: './Modal.plk',
  strategy: 'interaction',
});
```

### Hydrate All Islands

```typescript
import { hydrateIslands } from '@plank/runtime-dom';

// Hydrate all islands on the page
await hydrateIslands();
```

## Server Actions

### Basic Action

```typescript
import { createAction } from '@plank/runtime-dom';

const submitForm = createAction('/api/submit', {
  onSuccess: (data) => {
    console.log('Success:', data);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// Execute action
const result = await submitForm.execute({ name: 'John' });

// Track loading state
console.log(submitForm.loading()); // true/false
console.log(submitForm.error());   // Error | null
console.log(submitForm.data());    // Response data
```

### Form Action

```typescript
import { createFormAction, bindActionToForm } from '@plank/runtime-dom';

const formAction = createFormAction('/api/create-todo');

const form = document.querySelector('form');
bindActionToForm(form, formAction);

// Form automatically handles submission with loading states
```

### Optimistic Updates

```typescript
import { createOptimisticAction } from '@plank/runtime-dom';

const updateTodo = createOptimisticAction('/api/todos/123', {
  optimisticUpdate: (data) => {
    // Update UI immediately
    todoList.addItem(data);
  },
  rollbackUpdate: () => {
    // Rollback on failure
    todoList.removeLastItem();
  },
});

await updateTodo.execute({ completed: true });
```

### Debounced Actions

```typescript
import { createDebouncedAction } from '@plank/runtime-dom';

// Search with 300ms debounce
const search = createDebouncedAction('/api/search', 300);

searchInput.addEventListener('input', (e) => {
  search.execute({ query: e.target.value });
});
```

## Router Integration

### Enhanced Router with Transitions

```typescript
import { createRouterWithTransitions } from '@plank/runtime-dom';

const router = createRouterWithTransitions({
  duration: 300,
  autoFocusMain: true,
  announcePageChanges: true,
  persistElements: ['header', 'nav'],
});

// Navigate with smooth transitions
await router.navigate(async () => {
  const response = await fetch('/about');
  const html = await response.text();
  document.querySelector('main').innerHTML = html;
}, {
  pageTitle: 'About',
});
```

## Directives

### Template Directives

```typescript
import { executeDirective } from '@plank/runtime-dom';

const count = signal(0);
const element = document.querySelector('#counter');

// Text binding
executeDirective(element, 'bind:value', 'count', { signal: count });

// Event handling
executeDirective(button, 'on:click', 'increment', {
  handler: () => count(count() + 1)
});

// Conditional rendering
executeDirective(div, 'x:if', 'visible', { signal: isVisible });

// Class toggling
executeDirective(button, 'class:active', 'isActive', { signal: isActive });
```

### Process Multiple Directives

```typescript
import { processDirectives } from '@plank/runtime-dom';

const effects = processDirectives(element, {
  'bind:value': count,
  'class:active': isActive,
  'on:click': handleClick,
  'attr:data-id': userId,
  'style:color': textColor,
});

// Clean up later
cleanupEffects(effects);
```

## API Reference

### Bindings

- `bindText(element, signal, options?)` - Bind to text content
- `bindAttribute(element, attr, signal, options?)` - Bind to attribute
- `bindProperty(element, prop, signal, options?)` - Bind to property
- `bindClass(element, className, signal, options?)` - Toggle class
- `bindStyle(element, prop, signal, options?)` - Bind to style
- `bindInputValue(input, signal, options?)` - Two-way input binding
- `bindCheckbox(checkbox, signal, options?)` - Two-way checkbox binding
- `unbindElement(element)` - Remove all bindings

### View Transitions

- `createViewTransitions(config?)` - Create transitions manager
- `ViewTransitions.transition(callback, options?)` - Perform transition
- `ViewTransitions.markPersistent(element, name)` - Mark element as persistent
- `ViewTransitions.isEnabled()` - Check if supported
- `withViewTransition(callback, options?)` - Single transition helper

### Focus Management

- `createFocusManager()` - Create focus manager
- `FocusManager.saveFocus()` - Save current focus
- `FocusManager.restoreFocus()` - Restore saved focus
- `FocusManager.focusMain()` - Focus main content
- `FocusManager.createSkipLink(text, selector)` - Create skip link
- `FocusManager.announcePageChange(message)` - Screen reader announcement
- `FocusManager.trapFocus(container)` - Trap focus in container

### Islands

- `createIsland(options)` - Create island element
- `registerIsland(src, component)` - Register component
- `loadIsland(src)` - Load component dynamically
- `mountIsland(element, options)` - Mount island
- `unmountIsland(element)` - Unmount island
- `initializeIsland(element, options)` - Initialize with strategy
- `initializeAllIslands()` - Hydrate all islands
- `hydrateIslands()` - Main entry point for hydration

### Actions

- `createAction(url, options?)` - Create action
- `createFormAction(url, options?)` - Form submission action
- `createOptimisticAction(url, options)` - With optimistic updates
- `createMutationAction(url, options?)` - Data mutation
- `createQueryAction(url, options?)` - Data fetching
- `createDebouncedAction(url, delay, options?)` - Debounced execution
- `createThrottledAction(url, limit, options?)` - Throttled execution
- `bindActionToForm(form, action)` - Bind action to form
- `bindActionToButton(button, action, data?)` - Bind action to button

## Built-in Transition Styles

The package includes these pre-built transitions:

- **Fade** (default): Smooth opacity transition
- **Slide**: Slide out left, slide in right
- **Slide Back**: Slide out right, slide in left
- **Scale**: Zoom in/out effect

Custom transitions via `transitionName`:

```typescript
await vt.transition(updateDOM, { transitionName: 'slide' });
```

## Browser Support

### View Transitions
- Chrome 111+
- Edge 111+
- Safari 18+ (limited)
- Graceful degradation in unsupported browsers

### Other Features
- All modern browsers
- Polyfills not required

## Performance

- **Bindings**: < 1ms overhead per binding
- **View Transitions**: Native browser performance
- **Islands**: Lazy loading reduces initial bundle
- **Focus Management**: < 0.1ms
- **Bundle Size**: ~4KB gzipped

## Examples

### Complete Page Transition

```typescript
import {
  createViewTransitions,
  createFocusManager,
  signal,
  bindText
} from '@plank/runtime-dom';

const vt = createViewTransitions();
const focus = createFocusManager();

async function navigateTo(url) {
  await vt.transition(async () => {
    // Fetch new page
    const response = await fetch(url);
    const html = await response.text();

    // Update content
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');
    const newMain = newDoc.querySelector('main');
    const currentMain = document.querySelector('main');

    if (newMain && currentMain) {
      currentMain.innerHTML = newMain.innerHTML;
    }

    // Update title
    document.title = newDoc.title;
  });

  // Focus main content
  focus.focusMain();

  // Announce to screen readers
  focus.announcePageChange(`Navigated to ${document.title}`);
}
```

### Interactive Island with State

```typescript
import { signal, effect } from '@plank/runtime-dom';

const CounterIsland = {
  mount: (element, props) => {
    const count = signal(props?.initial || 0);

    element.innerHTML = `
      <div>
        <p>Count: <span id="count"></span></p>
        <button id="increment">+</button>
        <button id="decrement">-</button>
      </div>
    `;

    const countSpan = element.querySelector('#count');
    const incrementBtn = element.querySelector('#increment');
    const decrementBtn = element.querySelector('#decrement');

    // Bind count to display
    bindText(countSpan, count);

    // Add event listeners
    incrementBtn.addEventListener('click', () => count(count() + 1));
    decrementBtn.addEventListener('click', () => count(count() - 1));

    return effect(() => {
      console.log('Count changed:', count());
    });
  },
  unmount: () => {
    console.log('Counter unmounted');
  },
};

registerIsland('./Counter.plk', CounterIsland);
```

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage

# Current: 126 tests passing, 80%+ coverage
```

## Integration

### With Plank Router

```typescript
import { createEnhancedRouter } from '@plank/router';

const router = createEnhancedRouter({
  viewTransitions: {
    duration: 300,
    persistElements: ['header', 'nav'],
  },
  autoFocusMain: true,
  announcePageChanges: true,
});

router.start();

// All navigations will have smooth transitions
```

### With SSR

```typescript
import { hydrateIslands } from '@plank/runtime-dom';

// After SSR, hydrate interactive islands
await hydrateIslands();
```

## Best Practices

### 1. Clean Up Bindings

```typescript
const effect = bindText(element, signal);

// Later, clean up
effect.stop();

// Or remove all bindings from element
unbindElement(element);
```

### 2. Use Formatters for Display

```typescript
bindText(element, price, {
  formatter: (value) => `$${value.toFixed(2)}`
});
```

### 3. Graceful Degradation

```typescript
const vt = createViewTransitions();

if (!vt.isEnabled()) {
  // Fall back to instant updates
  updateDOM();
} else {
  await vt.transition(updateDOM);
}
```

### 4. Island Loading Strategies

```typescript
// Eager: Header, navigation
strategy: 'load'

// Deferred: Newsletter signup, social shares
strategy: 'idle'

// Lazy: Charts, images below fold
strategy: 'visible'

// On-demand: Modals, dropdowns
strategy: 'interaction'
```

### 5. Accessibility First

```typescript
const focus = createFocusManager();

// Always provide skip links
focus.createSkipLink();

// Announce page changes
focus.announcePageChange('Navigated to Dashboard');

// Manage focus after navigation
focus.focusMain();
```

## TypeScript Types

```typescript
import type {
  BindingOptions,
  ViewTransitionConfig,
  TransitionOptions,
  IslandOptions,
  IslandComponent,
  ActionOptions,
  ActionResult,
} from '@plank/runtime-dom';
```

## DOM IR Execution

For advanced use cases, the package provides low-level DOM operation execution:

```typescript
import { executeDOMIR, createDOMExecutionContext } from '@plank/runtime-dom';

const operations = [
  { type: 'createElement', tag: 'div', attributes: { id: 'container' } },
  { type: 'createTextNode', text: 'Hello' },
  { type: 'appendChild', parent: containerEl, child: textNode },
];

const context = createDOMExecutionContext(document.body);
executeDOMIR(operations, context);
```

## License

Apache-2.0
