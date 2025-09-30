# @plank/actions

Server actions runtime for the Plank framework. Provides form-based mutations with CSRF protection, progressive enhancement, and type-safe server-side logic.

## Features

- ✅ **Server Actions**: Define type-safe server-side handlers
- ✅ **CSRF Protection**: Built-in token generation and validation
- ✅ **Progressive Enhancement**: Works without JavaScript
- ✅ **Form Binding**: Easy `<form use:action>` integration
- ✅ **Validation**: Field-level error handling
- ✅ **File Uploads**: Support for FormData including files

## Installation

```bash
pnpm add @plank/actions
```

## Usage

### Basic Action

```typescript
import { createActionRuntime } from '@plank/actions';

const runtime = createActionRuntime({
  secret: process.env.CSRF_SECRET,
});

// Define an action
const createTodo = runtime.defineAction(async (formData, context) => {
  const title = formData.get('title') as string;

  if (!title) {
    return {
      success: false,
      errors: { title: 'Title is required' },
    };
  }

  // Save to database
  const todo = await db.todos.create({ title });

  return {
    success: true,
    data: todo,
    redirect: `/todos/${todo.id}`,
  };
});
```

### In Templates

```html
<form use:action={createTodo}>
  <input name="title" required />
  <button>Create Todo</button>
</form>
```

### CSRF Protection

CSRF protection is enabled by default. Tokens are automatically verified:

```typescript
// Generate token for forms
const csrfToken = runtime.generateCSRFToken();

// Include in form (automatically handled by framework)
<input type="hidden" name="csrf_token" value={csrfToken} />
```

### Validation Errors

```typescript
const signupAction = runtime.defineAction(async (formData) => {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: Record<string, string> = {};

  if (!email?.includes('@')) {
    errors.email = 'Valid email required';
  }

  if (password?.length < 8) {
    errors.password = 'Password must be 8+ characters';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // Create user...
  return { success: true, redirect: '/dashboard' };
});
```

### Progressive Enhancement

Actions work with or without JavaScript:

```typescript
const subscribeAction = runtime.defineAction(async (formData, context) => {
  const email = formData.get('email') as string;

  // Check if AJAX request
  const isAjax = context.headers['x-requested-with'] === 'XMLHttpRequest';

  if (isAjax) {
    // Return JSON for JS clients
    return {
      success: true,
      data: { message: 'Subscribed!' },
    };
  }

  // Redirect for non-JS clients
  return {
    success: true,
    redirect: '/thank-you',
  };
});
```

## API

### `createActionRuntime(config?)`

Creates a new action runtime instance.

**Config Options:**
- `secret`: Secret key for CSRF tokens (required in production)
- `expiresIn`: Token expiration in seconds (default: 3600)
- `cookieName`: CSRF cookie name (default: 'plank-csrf')
- `headerName`: CSRF header name (default: 'x-plank-csrf-token')

### `runtime.defineAction(handler, options?)`

Defines a new server action.

**Handler:** `(formData: FormData, context: ActionContext) => Promise<ActionResult>`

**Options:**
- `name`: Action name for debugging
- `csrf`: Enable CSRF protection (default: true)

### `runtime.executeAction(actionId, formData, context)`

Executes an action by ID.

### `ActionResult`

```typescript
interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;                         // Result data
  error?: string;                   // General error
  errors?: Record<string, string>;  // Field errors
  redirect?: string;                // Redirect URL
  reload?: boolean;                 // Reload page
}
```

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage
```

## License

Apache-2.0
