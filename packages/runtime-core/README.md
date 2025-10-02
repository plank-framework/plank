# @plank/runtime-core

The core reactive runtime for Plank applications, providing fine-grained reactivity through signals, computed values, and effects with microtask scheduling and SSR serialization support.

## Features

- **Signals**: Reactive primitives for state management
- **Computed Values**: Derived state that automatically updates
- **Effects**: Side effects that run when dependencies change
- **Microtask Scheduling**: Batched updates for optimal performance
- **SSR Serialization**: Support for server-side rendering and resumability
- **Dependency Tracking**: Automatic dependency graph management

## API

### `signal(value)`

Creates a reactive signal that can be read and written.

```typescript
import { signal } from '@plank/runtime-core';

const count = signal(0);
console.log(count.value); // 0

count.value = 42;
console.log(count.value); // 42
```

### `computed(fn)`

Creates a computed value that automatically updates when its dependencies change.

```typescript
import { signal, computed } from '@plank/runtime-core';

const firstName = signal('John');
const lastName = signal('Doe');

const fullName = computed(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value); // "John Doe"

firstName.value = 'Jane';
console.log(fullName.value); // "Jane Doe"
```

### `effect(fn)`

Creates a side effect that runs when its dependencies change.

```typescript
import { signal, effect } from '@plank/runtime-core';

const count = signal(0);

effect(() => {
  console.log(`Count is now: ${count.value}`);
});

count.value = 1; // Logs: "Count is now: 1"
count.value = 2; // Logs: "Count is now: 2"
```

## Types

### `Signal<T>`

```typescript
interface Signal<T> {
  (): T;
  (value: T): void;
  readonly value: T;
  readonly dependencies: Set<Computed<unknown>>;
  readonly dependents: Set<ReactiveValue>;
  readonly id: string;
  readonly isSerializable: boolean;
}
```

### `Computed<T>`

```typescript
interface Computed<T> {
  (): T;
  readonly value: T;
  readonly dependencies: Set<ReactiveValue>;
  readonly dependents: Set<ReactiveValue>;
  readonly isDirty: boolean;
  readonly id: string;
  readonly isSerializable: boolean;
}
```

### `Effect`

```typescript
interface Effect {
  (): void | (() => void);
  stop(): void;
  readonly isActive: boolean;
  readonly dependencies: Set<Signal<unknown>>;
  readonly id: string;
}
```

## Advanced Features

### Dependency Tracking

The runtime automatically tracks dependencies between signals, computed values, and effects:

```typescript
const a = signal(1);
const b = signal(2);

const sum = computed(() => a.value + b.value);
// sum.dependencies contains a and b

effect(() => {
  console.log(`Sum: ${sum.value}`);
});
// effect.dependencies contains sum, a, and b
```

### Microtask Scheduling

Updates are batched using microtasks for optimal performance:

```typescript
const count = signal(0);

// Multiple updates in the same tick are batched
count.value = 1;
count.value = 2;
count.value = 3;

// Effects only run once after all updates
effect(() => {
  console.log(count.value); // Logs: 3 (only once)
});
```

### SSR Serialization

Signals and computed values support serialization for server-side rendering:

```typescript
const serverData = signal({ user: 'John' });
serverData.isSerializable = true;

// On the server
const serialized = JSON.stringify(serverData.value);

// On the client
const hydrated = signal(JSON.parse(serialized));
```

### Effect Cleanup

Effects can return cleanup functions:

```typescript
effect(() => {
  const timer = setInterval(() => {
    console.log('Timer tick');
  }, 1000);

  // Return cleanup function
  return () => clearInterval(timer);
});
```

## Performance Characteristics

- **Fine-grained reactivity**: Only affected components update
- **Batched updates**: Multiple changes in one tick trigger single effect run
- **Lazy evaluation**: Computed values only recalculate when accessed
- **Memory efficient**: Automatic cleanup of unused dependencies
- **SSR optimized**: Minimal overhead for server-side rendering

## Usage in Templates

When used with Plank templates, these primitives power the reactive system:

```html
<script>
  import { signal, computed } from '@plank/runtime-core';

  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }
</script>

<div>
  <p>Count: {count()}</p>
  <p>Doubled: {doubled()}</p>
  <button on:click={increment}>Increment</button>
</div>
```

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the runtime core
pnpm build --filter=@plank/runtime-core

# Run tests
pnpm test --filter=@plank/runtime-core

# Run tests with coverage
pnpm test:coverage --filter=@plank/runtime-core
```

## License

Apache 2.0
