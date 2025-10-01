# Signals

Fine-grained reactivity for efficient DOM updates.

## What are Signals?

Signals are **reactive primitives** that automatically track dependencies and update the DOM. They're:
- **Lightweight**: ~1 KB core runtime
- **Fast**: O(1) updates per dependent
- **Simple**: No virtual DOM, no re-renders
- **Precise**: Update only what changed

## Core Concepts

### 1. `signal()` - Reactive State

Create reactive state:

```typescript
import { signal } from '@plank/runtime-core';

const count = signal(0);

// Read value
console.log(count()); // 0

// Set value
count(5);
console.log(count()); // 5

// Update based on current value
count(count() + 1);
console.log(count()); // 6
```

### 2. `computed()` - Derived State

Compute values from signals:

```typescript
import { computed } from '@plank/runtime-core';

const count = signal(10);
const doubled = computed(() => count() * 2);

console.log(doubled()); // 20

count(5);
console.log(doubled()); // 10 (auto-updated!)
```

Computed values:
- Cache results
- Only recompute when dependencies change
- Are lazy by default

### 3. `effect()` - Side Effects

Run code when signals change:

```typescript
import { effect } from '@plank/runtime-core';

const name = signal('Alice');

effect(() => {
  console.log(`Hello, ${name()}!`);
});
// Logs: "Hello, Alice!"

name('Bob');
// Logs: "Hello, Bob!"
```

## Basic Examples

### Counter

```typescript
const count = signal(0);

// Update DOM when count changes
effect(() => {
  document.querySelector('#count').textContent = count();
});

// Increment button
document.querySelector('#increment').addEventListener('click', () => {
  count(count() + 1);
});
```

### Todo List

```typescript
const todos = signal([
  { id: 1, title: 'Learn signals', done: false },
  { id: 2, title: 'Build app', done: false },
]);

const remaining = computed(() => 
  todos().filter(t => !t.done).length
);

// Auto-update UI
effect(() => {
  document.querySelector('#remaining').textContent = remaining();
});

// Add todo
function addTodo(title) {
  todos([...todos(), {
    id: Date.now(),
    title,
    done: false,
  }]);
}

// Toggle todo
function toggleTodo(id) {
  todos(todos().map(t => 
    t.id === id ? { ...t, done: !t.done } : t
  ));
}
```

## Advanced Patterns

### Nested Signals

```typescript
const user = signal({
  name: 'Alice',
  email: 'alice@example.com',
  settings: {
    theme: 'dark',
    notifications: true,
  },
});

// Update nested property
user({
  ...user(),
  settings: {
    ...user().settings,
    theme: 'light',
  },
});
```

### Signal Arrays

```typescript
const items = signal([1, 2, 3]);

// Add item
items([...items(), 4]);

// Remove item
items(items().filter(i => i !== 2));

// Map items
items(items().map(i => i * 2));
```

### Batched Updates

Update multiple signals atomically:

```typescript
import { batch } from '@plank/runtime-core';

const firstName = signal('Alice');
const lastName = signal('Smith');
const fullName = computed(() => `${firstName()} ${lastName()}`);

// Without batch: fullName recomputes twice
firstName('Bob');
lastName('Jones');

// With batch: fullName recomputes once
batch(() => {
  firstName('Bob');
  lastName('Jones');
});
```

### Cleanup

Effects can return cleanup functions:

```typescript
const isActive = signal(true);

effect(() => {
  if (!isActive()) return;
  
  const interval = setInterval(() => {
    console.log('Tick');
  }, 1000);
  
  // Cleanup when effect re-runs or unmounts
  return () => clearInterval(interval);
});
```

## Performance Tips

### 1. Use Computed for Derived Values

```typescript
// ❌ Bad: Recalculates on every access
const total = () => items().reduce((sum, item) => sum + item.price, 0);

// ✅ Good: Cached until items() changes
const total = computed(() => 
  items().reduce((sum, item) => sum + item.price, 0)
);
```

### 2. Avoid Unnecessary Effects

```typescript
// ❌ Bad: Creates new effect on every render
function Component() {
  effect(() => {
    console.log(count());
  });
}

// ✅ Good: Create effect once
const count = signal(0);
effect(() => {
  console.log(count());
});
```

### 3. Batch Related Updates

```typescript
// ❌ Bad: Triggers 3 re-renders
x(1);
y(2);
z(3);

// ✅ Good: Triggers 1 re-render
batch(() => {
  x(1);
  y(2);
  z(3);
});
```

### 4. Use Untrack for Non-reactive Reads

```typescript
import { untrack } from '@plank/runtime-core';

const count = signal(0);
const other = signal(10);

// This effect only tracks count, not other
effect(() => {
  const c = count();
  const o = untrack(() => other());
  console.log(c + o);
});
```

## Debugging

### Track Dependencies

```typescript
import { getOwner } from '@plank/runtime-core';

const doubled = computed(() => count() * 2);

// Log dependencies
console.log(getOwner(doubled));
```

### Enable Dev Mode

```typescript
// In development
const count = signal(0, { dev: true, name: 'count' });
const doubled = computed(() => count() * 2, { dev: true, name: 'doubled' });
```

### Performance Profiling

```typescript
let computeCount = 0;

const expensive = computed(() => {
  computeCount++;
  console.log(`Computed ${computeCount} times`);
  return data().map(expensive Calculation);
});
```

## Common Patterns

### Form State

```typescript
const formData = signal({
  email: '',
  password: '',
});

const isValid = computed(() => {
  const { email, password } = formData();
  return email.includes('@') && password.length >= 8;
});

// Update field
function updateField(field, value) {
  formData({ ...formData(), [field]: value });
}
```

### Loading State

```typescript
const isLoading = signal(false);
const data = signal(null);
const error = signal(null);

async function fetchData() {
  isLoading(true);
  error(null);
  
  try {
    const response = await fetch('/api/data');
    data(await response.json());
  } catch (e) {
    error(e.message);
  } finally {
    isLoading(false);
  }
}
```

### Pagination

```typescript
const page = signal(1);
const pageSize = signal(10);
const items = signal([]);

const paginatedItems = computed(() => {
  const start = (page() - 1) * pageSize();
  const end = start + pageSize();
  return items().slice(start, end);
});

const totalPages = computed(() => 
  Math.ceil(items().length / pageSize())
);
```

## Integration with Islands

Signals work seamlessly with islands:

```html
<script type="module">
import { signal, effect } from '@plank/runtime-core';

// Create reactive state
const count = signal(0);

// Auto-update DOM
effect(() => {
  document.querySelector('#count').textContent = count();
});

// Event handlers
document.querySelector('#increment').addEventListener('click', () => {
  count(count() + 1);
});
</script>

<div>
  Count: <span id="count">0</span>
  <button id="increment">+</button>
</div>
```

## Learn More

- [Runtime Core API](../api/runtime-core.md) - Full signals API
- [Islands Guide](./islands.md) - Use signals in islands
- [Server Actions](./server-actions.md) - Signals + server state
