# @plank/react

React interop for Plank framework. Use existing React components as Plank islands for progressive migration and component reuse.

## Features

- ✅ **Wrap React Components**: Use React components as Plank islands
- ✅ **Props Support**: Pass props from Plank to React
- ✅ **Lifecycle Management**: Proper mount/unmount handling
- ✅ **Signal Bridge**: Subscribe to Plank signals from React
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Lightweight**: Minimal wrapper overhead

## Installation

```bash
pnpm add @plank/react react react-dom
```

## Basic Usage

### Register React Component as Island

```typescript
import { registerReactIsland } from '@plank/react';
import { Counter } from './Counter';

// Register React component
registerReactIsland('./islands/Counter.tsx', Counter);
```

### In Your Plank Template

```html
<!-- Use React component as island -->
<island src="./islands/Counter.tsx" client:load>
  <div>Loading counter...</div>
</island>
```

### React Component

```tsx
// Counter.tsx
export function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = React.useState(initial);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
    </div>
  );
}
```

## Advanced Usage

### Register Multiple Components

```typescript
import { registerReactIslands } from '@plank/react';
import { Counter } from './Counter';
import { TodoList } from './TodoList';
import { Chart } from './Chart';

registerReactIslands({
  './islands/Counter.tsx': Counter,
  './islands/TodoList.tsx': TodoList,
  './islands/Chart.tsx': Chart,
});
```

### With Error Boundary

```typescript
import { wrapReactComponent } from '@plank/react';

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryComponent>
      {children}
    </ErrorBoundaryComponent>
  );
}

const island = wrapReactComponent(Counter, {
  errorBoundary: ErrorBoundary,
});
```

### Custom Render Function

```typescript
import { wrapReactComponent } from '@plank/react';
import { Provider } from 'some-state-library';

const island = wrapReactComponent(Counter, {
  render: (Component, props) => (
    <Provider>
      <Component {...props} />
    </Provider>
  ),
});
```

## Signal Bridge

### Use Plank Signal in React

```typescript
import { signal } from '@plank/runtime-dom';
import { useSignal } from '@plank/react';

// Create Plank signal
const count = signal(0);

// Use in React component
function ReactCounter() {
  const currentCount = useSignal(count);

  return (
    <div>
      <p>Count: {currentCount}</p>
      <button onClick={() => count(count() + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### Create Plank Signal from React

```typescript
import { createPlankSignal } from '@plank/react';

function ReactComponent() {
  const plankSignal = createPlankSignal(0);

  return (
    <button onClick={() => plankSignal(plankSignal() + 1)}>
      Click me
    </button>
  );
}
```

### Sync React State to Plank

```typescript
import { signal } from '@plank/runtime-dom';
import { useSyncToSignal } from '@plank/react';

const sharedCount = signal(0);

function ReactCounter() {
  const [count, setCount] = React.useState(0);

  // Sync React state to Plank signal
  useSyncToSignal(sharedCount, count);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## Complete Example

### Plank App Entry

```typescript
// app.ts
import { registerReactIslands } from '@plank/react';
import { hydrateIslands } from '@plank/runtime-dom';

// Import React components
import { Counter } from './islands/Counter';
import { TodoList } from './islands/TodoList';
import { Newsletter } from './islands/Newsletter';

// Register all React islands
registerReactIslands({
  './islands/Counter.tsx': Counter,
  './islands/TodoList.tsx': TodoList,
  './islands/Newsletter.tsx': Newsletter,
});

// Hydrate all islands (including React ones)
await hydrateIslands();
```

### Plank Template

```html
<!-- index.plk -->
<!DOCTYPE html>
<html>
<head>
  <title>Plank + React</title>
</head>
<body>
  <h1>Welcome to Plank with React Islands</h1>

  <!-- React Counter Island -->
  <island src="./islands/Counter.tsx" client:load>
    <div>Loading counter...</div>
  </island>

  <!-- React Todo List (load when visible) -->
  <island src="./islands/TodoList.tsx" client:visible>
    <div>Loading todos...</div>
  </island>

  <!-- React Newsletter (load when idle) -->
  <island src="./islands/Newsletter.tsx" client:idle>
    <div>Loading newsletter...</div>
  </island>
</body>
</html>
```

### React Counter Component

```tsx
// islands/Counter.tsx
import React from 'react';

export interface CounterProps {
  initial?: number;
  label?: string;
}

export function Counter({ initial = 0, label = 'Count' }: CounterProps) {
  const [count, setCount] = React.useState(initial);

  return (
    <div className="counter">
      <p>{label}: {count}</p>
      <div className="buttons">
        <button onClick={() => setCount(count - 1)}>-</button>
        <button onClick={() => setCount(count + 1)}>+</button>
        <button onClick={() => setCount(0)}>Reset</button>
      </div>
    </div>
  );
}
```

### React Todo List Component

```tsx
// islands/TodoList.tsx
import React from 'react';

export function TodoList() {
  const [todos, setTodos] = React.useState<string[]>([]);
  const [input, setInput] = React.useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, input]);
      setInput('');
    }
  };

  return (
    <div className="todo-list">
      <h2>Todo List</h2>
      <div className="input-group">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map((todo, i) => (
          <li key={i}>
            {todo}
            <button onClick={() => setTodos(todos.filter((_, idx) => idx !== i))}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Migration Guide

### From React App to Plank

1. **Keep your React components** - No rewrite needed!
2. **Register components as islands** - One line per component
3. **Use in Plank templates** - Replace React routes with Plank routes
4. **Gradual migration** - Migrate one component at a time

### Example Migration

**Before (Pure React):**
```tsx
// App.tsx
function App() {
  return (
    <div>
      <Header />
      <Counter initial={0} />
      <TodoList />
      <Footer />
    </div>
  );
}
```

**After (Plank + React Islands):**
```html
<!-- index.plk -->
<html>
  <body>
    <!-- Static HTML (zero JS) -->
    <header>
      <h1>My App</h1>
    </header>

    <!-- Interactive React islands -->
    <island src="./Counter.tsx" client:load>
      Loading...
    </island>

    <island src="./TodoList.tsx" client:visible>
      Loading...
    </island>

    <!-- Static footer (zero JS) -->
    <footer>
      <p>© 2024 My App</p>
    </footer>
  </body>
</html>
```

**Result:**
- Header: **0 KB JS** (static HTML)
- Counter: **~2 KB JS** (React + component)
- TodoList: **~2 KB JS** (lazy loaded)
- Footer: **0 KB JS** (static HTML)
- **Total initial JS: ~2 KB** (vs ~80 KB for full React app)

## API Reference

### `wrapReactComponent(Component, options?)`

Wraps a React component as a Plank island.

**Parameters:**
- `Component`: React component to wrap
- `options?`: Optional configuration
  - `render?`: Custom render function
  - `errorBoundary?`: Error boundary component

**Returns:** `IslandComponent`

### `createReactIsland(Component, options?)`

Alias for `wrapReactComponent`.

### `registerReactIsland(src, Component, options?)`

Registers a React component in the island registry.

**Parameters:**
- `src`: Island source path (e.g., `'./Counter.tsx'`)
- `Component`: React component
- `options?`: Optional configuration

### `registerReactIslands(islands)`

Registers multiple React components at once.

**Parameters:**
- `islands`: Object mapping src paths to components

### `useSignal(plankSignal)`

React hook to subscribe to a Plank signal.

**Parameters:**
- `plankSignal`: Plank signal to subscribe to

**Returns:** Current signal value

### `createPlankSignal(initialValue)`

Creates a Plank signal from React.

**Parameters:**
- `initialValue`: Initial signal value

**Returns:** Plank signal

### `useSyncToSignal(plankSignal, value)`

Syncs React state to a Plank signal.

**Parameters:**
- `plankSignal`: Target Plank signal
- `value`: React state value to sync

## Performance

- **Wrapper overhead**: < 1KB gzipped
- **Per-component**: Same as regular React (no additional overhead)
- **Bundle splitting**: Each island loads independently
- **Lazy loading**: Use `client:visible` or `client:idle` strategies

## Best Practices

### 1. Use Islands for Interactivity Only

```html
<!-- ❌ Don't wrap entire page in React -->
<island src="./App.tsx" client:load>
  <div>...</div>
</island>

<!-- ✅ Do: Use islands for interactive widgets -->
<header>Static HTML</header>
<island src="./Search.tsx" client:load />
<main>Static content</main>
<island src="./Comments.tsx" client:visible />
```

### 2. Choose Appropriate Loading Strategy

```html
<!-- Critical: Load immediately -->
<island src="./Navigation.tsx" client:load />

<!-- Non-critical: Load when idle -->
<island src="./Newsletter.tsx" client:idle />

<!-- Below fold: Load when visible -->
<island src="./Footer.tsx" client:visible />

<!-- On-demand: Load on interaction -->
<island src="./Modal.tsx" client:interaction />
```

### 3. Keep Islands Small

```tsx
// ❌ Don't: Large islands with many sub-components
export function LargeIsland() {
  return (
    <div>
      <Header />
      <Sidebar />
      <Content />
      <Footer />
    </div>
  );
}

// ✅ Do: Small, focused islands
export function SearchBox() {
  const [query, setQuery] = React.useState('');
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 4. Progressive Enhancement

```tsx
// React component with server state
export function Counter({ initial }: { initial: number }) {
  const [count, setCount] = React.useState(initial);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

```html
<!-- Server renders initial state -->
<island src="./Counter.tsx" client:load data-prop-initial="42">
  <!-- Fallback content (shown until hydrated) -->
  <div>Count: 42</div>
</island>
```

## TypeScript Support

```typescript
import type { ComponentType } from 'react';
import type { IslandComponent } from '@plank/runtime-dom';
import { wrapReactComponent } from '@plank/react';

// Fully typed React component
interface CounterProps {
  initial: number;
  onUpdate?: (count: number) => void;
}

const Counter: ComponentType<CounterProps> = ({ initial, onUpdate }) => {
  // Component implementation
};

// Wrapped as typed island
const island: IslandComponent<CounterProps> = wrapReactComponent(Counter);
```

## Limitations

1. **React Concurrent Features**: Some concurrent features may not work in island mode
2. **Context**: React context is scoped per island (not shared across islands)
3. **Portals**: React portals work within the island container only
4. **Suspense**: Suspense boundaries work, but islands load independently

## Bundle Size

- **@plank/react**: ~1 KB gzipped
- **React + ReactDOM**: ~45 KB gzipped (peer dependency)
- **Your components**: Variable

**Total for a simple Counter island**: ~46 KB gzipped

Compare to full React SPA: ~80-150 KB for the entire app

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage
```

## Examples

See [examples/](../../../examples/) for complete working examples combining Plank with React islands.

## License

Apache-2.0
