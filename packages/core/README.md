# @plank/core

The core Plank framework package that provides essential functionality for building Plank applications. This package bundles all the runtime functionality needed for islands architecture with fine-grained reactivity.

## Installation

```bash
npm install @plank/core
```

## Features

- **Reactive Primitives**: Signals, computed values, and effects for fine-grained reactivity
- **DOM Bindings**: Template directive bindings for interactive components
- **Configuration**: Framework configuration utilities
- **Bundled Runtime**: All necessary runtime functionality in a single package

## API

### Reactive Primitives

#### `signal(value)`

Creates a reactive signal that can be read and written.

```typescript
import { signal } from '@plank/core';

const count = signal(0);
console.log(count.value); // 0

count.value = 42;
console.log(count.value); // 42
```

#### `computed(fn)`

Creates a computed value that automatically updates when its dependencies change.

```typescript
import { signal, computed } from '@plank/core';

const firstName = signal('John');
const lastName = signal('Doe');

const fullName = computed(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value); // "John Doe"

firstName.value = 'Jane';
console.log(fullName.value); // "Jane Doe"
```

#### `effect(fn)`

Creates a side effect that runs when its dependencies change.

```typescript
import { signal, effect } from '@plank/core';

const count = signal(0);

effect(() => {
  console.log(`Count is now: ${count.value}`);
});

count.value = 1; // Logs: "Count is now: 1"
count.value = 2; // Logs: "Count is now: 2"
```

### DOM Bindings

#### `bindText(element, signal)`

Binds a signal to an element's text content.

```typescript
import { signal, bindText } from '@plank/core';

const message = signal('Hello World');
const element = document.querySelector('#message');

bindText(element, message);
// Element text updates when message.value changes
```

#### `bindEvent(element, event, handler)`

Binds an event handler to an element.

```typescript
import { bindEvent } from '@plank/core';

const button = document.querySelector('#button');

bindEvent(button, 'click', () => {
  console.log('Button clicked!');
});
```

#### `bindInputValue(element, signal)`

Creates two-way binding between an input element and a signal.

```typescript
import { signal, bindInputValue } from '@plank/core';

const name = signal('');
const input = document.querySelector('#name-input');

bindInputValue(input, name);
// Input value and signal stay in sync
```

#### `bindCheckbox(element, signal)`

Creates two-way binding between a checkbox and a boolean signal.

```typescript
import { signal, bindCheckbox } from '@plank/core';

const isChecked = signal(false);
const checkbox = document.querySelector('#checkbox');

bindCheckbox(checkbox, isChecked);
// Checkbox state and signal stay in sync
```

#### `bindClass(element, className, signal)`

Conditionally applies a CSS class based on a signal value.

```typescript
import { signal, bindClass } from '@plank/core';

const isActive = signal(false);
const element = document.querySelector('#element');

bindClass(element, 'active', isActive);
// Adds/removes 'active' class based on isActive.value
```

#### `hydrateIslands()`

Hydrates all island components on the page.

```typescript
import { hydrateIslands } from '@plank/core';

// Call this after the DOM is ready
hydrateIslands();
```

### Configuration

#### `defineConfig(config)`

Defines the Plank configuration for your application.

```typescript
import { defineConfig } from '@plank/core';

export default defineConfig({
  // Configuration options
});
```

## Template Directives

When using Plank templates (`.plk` files), these bindings are automatically generated:

```html
<!-- Event handlers -->
<button on:click={handleClick}>Click me</button>

<!-- Two-way binding -->
<input bind:value={name} />

<!-- Conditional rendering -->
<div x:if={showMessage}>Hello {name}!</div>

<!-- List rendering -->
<div x:for={item in items}>{item.name}</div>

<!-- Dynamic classes -->
<div class:active={isActive}>Content</div>
```

## Islands Architecture

Plank uses an islands architecture where interactive components are isolated:

```html
<island src="./Counter.plk" client:load>
  <div>Loading...</div>
</island>
```

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the core package
pnpm build --filter=@plank/core

# Run tests
pnpm test --filter=@plank/core
```

## License

Apache 2.0
