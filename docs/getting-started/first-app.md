# Your First Plank App

Build a todo app to learn Plank's core concepts.

## What We'll Build

A simple todo application demonstrating:
- File-based routing
- Interactive islands
- Server actions
- Reactive state
- Zero JS on static content

**Total JavaScript**: ~8 KB gzipped

## Step 1: Create the Project

```bash
npx plank create todo-app
cd todo-app
pnpm install
pnpm dev
```

## Step 2: Create the Home Route

Create `app/routes/index.plk`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main>
    <h1>My Todos</h1>

    <!-- This is static HTML - 0 KB JS -->
    <p>A simple todo app built with Plank</p>

    <!-- This island loads JavaScript only for interactivity -->
    <island src="../islands/TodoList.plk" client:load>
      <div>Loading todos...</div>
    </island>
  </main>
</body>
</html>
```

## Step 3: Create the Todo Island

Create `app/islands/TodoList.plk`:

```html
<script type="module">
import { signal, computed, effect } from '@plank/runtime-core';

// Reactive state
const todos = signal([
  { id: 1, title: 'Learn Plank', completed: true },
  { id: 2, title: 'Build an app', completed: false },
]);

const activeTodos = computed(() =>
  todos().filter(t => !t.completed)
);

// Render function
function render() {
  const list = document.querySelector('#todo-list');
  if (!list) return;

  list.innerHTML = todos().map(todo => `
    <li class="todo-item ${todo.completed ? 'completed' : ''}">
      <input
        type="checkbox"
        ${todo.completed ? 'checked' : ''}
        data-id="${todo.id}"
      />
      <span>${todo.title}</span>
      <button data-id="${todo.id}">Delete</button>
    </li>
  `).join('');

  // Update count
  document.querySelector('#active-count').textContent = activeTodos();
}

// Event delegation
document.addEventListener('click', (e) => {
  const target = e.target;

  if (target.matches('input[type="checkbox"]')) {
    const id = parseInt(target.dataset.id);
    todos(todos().map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  }

  if (target.matches('button')) {
    const id = parseInt(target.dataset.id);
    todos(todos().filter(t => t.id !== id));
  }
});

// Auto-render on state changes
effect(() => {
  render();
});

// Initial render
render();
</script>

<div class="todo-container">
  <div class="todo-stats">
    <span id="active-count">0</span> active todos
  </div>

  <ul id="todo-list">
    <!-- Will be rendered by JavaScript -->
  </ul>

  <form id="add-todo">
    <input
      type="text"
      placeholder="What needs to be done?"
      required
    />
    <button type="submit">Add</button>
  </form>
</div>

<style>
.todo-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.todo-item.completed span {
  text-decoration: line-through;
  color: #999;
}

.todo-stats {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 1rem;
}
</style>
```

## Step 4: Add Styles

Create `public/styles.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  color: #333;
}

main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0052a3;
}
```

## Step 5: Run the App

```bash
pnpm dev
```

Open `http://localhost:3000` and you'll see your todo app! 🎉

## What's Happening?

### 1. Static Shell (0 KB JS)
The main HTML page is server-rendered with zero JavaScript.

### 2. Interactive Island (~8 KB JS)
The `TodoList.plk` island:
- Loads only its JavaScript
- Uses signals for reactivity
- Updates DOM efficiently
- Handles user interactions

### 3. Progressive Enhancement
- Works without JavaScript (shows loading state)
- Enhanced with JavaScript when available
- Graceful degradation

## Next Steps

### Add Server Actions

Replace client-side state with server persistence:

```html
<form use:action={createTodo}>
  <input name="title" required />
  <button>Add</button>
</form>

<script type="server">
export async function createTodo(formData) {
  const title = formData.get('title');
  await db.todos.create({ title });
  return { success: true };
}
</script>
```

### Add Caching

Cache todos for performance:

```typescript
import { createCacheManager } from '@plank/cache';

const cache = createCacheManager();
await cache.set('todos', todos, { tags: ['todos'] });

// Invalidate on mutation
await cache.invalidateTags(['todos']);
```

### Add Client-Side Routing

Enable smooth navigation:

```typescript
import { createClientRouter } from '@plank/router';

const router = createClientRouter();
router.start();
```

## Learn More

- [Islands Architecture](../guides/islands.md)
- [Server Actions](../guides/server-actions.md)
- [Signals Guide](../guides/signals.md)
- [Project Structure](./project-structure.md)
