# Server Actions

Handle form submissions and mutations on the server with built-in CSRF protection.

## What are Server Actions?

Server actions are **server-side functions** bound to forms or buttons. They:
- Run on the server (access to database, APIs, etc.)
- Have built-in CSRF protection
- Support progressive enhancement
- Enable optimistic UI updates
- Integrate with cache invalidation

## Basic Usage

### Create Todo Action

```html
<form use:action={createTodo}>
  <input name="title" placeholder="What needs to be done?" required />
  <button type="submit">Add Todo</button>
</form>

<script type="server">
export async function createTodo(formData, context) {
  const title = formData.get('title');
  
  // Validate
  if (!title || title.length < 3) {
    return {
      success: false,
      error: 'Title must be at least 3 characters',
    };
  }
  
  // Save to database
  const todo = await db.todos.create({
    title,
    userId: context.user.id,
    createdAt: new Date(),
  });
  
  // Invalidate cache
  await context.cache.invalidateTags(['todos']);
  
  return {
    success: true,
    data: { todo },
  };
}
</script>
```

## Action Context

Every action receives a `context` object:

```typescript
interface ActionContext {
  request: Request;           // Original HTTP request
  user?: User;               // Authenticated user (if any)
  session?: Session;         // User session
  cache: CacheManager;       // Cache invalidation
  cookies: CookieStore;      // Cookie access
  headers: Headers;          // Request headers
  locale?: string;           // User locale
  custom?: Record<string, unknown>; // Custom data
}
```

### Example: Auth-protected Action

```typescript
export async function deletePost(formData, context) {
  // Check authentication
  if (!context.user) {
    return {
      success: false,
      error: 'Authentication required',
    };
  }
  
  const postId = formData.get('postId');
  const post = await db.posts.findById(postId);
  
  // Check authorization
  if (post.authorId !== context.user.id) {
    return {
      success: false,
      error: 'Not authorized',
    };
  }
  
  await db.posts.delete(postId);
  await context.cache.invalidateTags(['posts', `post-${postId}`]);
  
  return { success: true };
}
```

## CSRF Protection

CSRF protection is **automatic** for all actions:

### Server-side Setup

```typescript
import { createCSRFManager } from '@plank/actions';

const csrf = createCSRFManager({
  secret: process.env.CSRF_SECRET,
  tokenLength: 32,
  cookieName: '_csrf',
  headerName: 'X-CSRF-Token',
});

// Add to middleware
app.use(csrf.middleware());
```

### Client-side Token

Add token to page:

```html
<head>
  <meta name="csrf-token" content="{csrfToken}" />
</head>
```

Plank automatically:
1. Extracts token from meta tag
2. Adds to action requests
3. Validates on server
4. Rejects invalid tokens

## Optimistic Updates

Update UI immediately, rollback on error:

```html
<script type="module">
import { useAction } from '@plank/actions';

const deleteTodo = useAction('/api/todos/delete', {
  method: 'DELETE',
  
  // Before request
  onOptimistic: (variables) => {
    // Remove from UI immediately
    todos(todos().filter(t => t.id !== variables.id));
  },
  
  // On success
  onSuccess: (data) => {
    showMessage('Todo deleted successfully');
  },
  
  // On error (auto-rollback)
  onError: (error) => {
    // UI automatically reverts
    showMessage('Failed to delete todo');
  },
});

// Execute with optimistic update
await deleteTodo.execute({ id: 123 });
</script>
```

## Form Enhancement

Progressive enhancement for forms:

```html
<form id="contact-form">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>

<script type="module">
import { enhanceForm } from '@plank/actions';

enhanceForm('#contact-form', {
  action: '/api/contact',
  method: 'POST',
  
  // Show loading state
  onSubmit: () => {
    document.querySelector('button').disabled = true;
  },
  
  // Handle success
  onSuccess: (data) => {
    document.querySelector('#contact-form').reset();
    showMessage('Message sent!');
  },
  
  // Handle errors
  onError: (error) => {
    if (error.validationErrors) {
      showFieldErrors(error.validationErrors);
    } else {
      showMessage(error.message);
    }
  },
  
  // Always cleanup
  onSettled: () => {
    document.querySelector('button').disabled = false;
  },
});
</script>
```

Without JavaScript, the form **still works** - it submits normally to the server.

## Validation

### Client-side Validation

```html
<form use:action={createUser}>
  <input 
    name="email" 
    type="email" 
    required 
    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
  />
  <input 
    name="password" 
    type="password" 
    required 
    minlength="8"
  />
  <button>Sign Up</button>
</form>
```

### Server-side Validation

```typescript
export async function createUser(formData, context) {
  const email = formData.get('email');
  const password = formData.get('password');
  
  // Validate
  const errors: Record<string, string> = {};
  
  if (!email || !email.includes('@')) {
    errors.email = 'Valid email is required';
  }
  
  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      validationErrors: errors,
    };
  }
  
  // Create user...
  return { success: true };
}
```

### Display Validation Errors

```html
<form use:action={createUser}>
  <div>
    <input name="email" type="email" />
    <span class="error" id="email-error"></span>
  </div>
  
  <div>
    <input name="password" type="password" />
    <span class="error" id="password-error"></span>
  </div>
  
  <button>Sign Up</button>
</form>

<script type="module">
import { useAction } from '@plank/actions';

const createUserAction = useAction('/api/users', {
  onError: (error) => {
    if (error.validationErrors) {
      for (const [field, message] of Object.entries(error.validationErrors)) {
        document.querySelector(`#${field}-error`).textContent = message;
      }
    }
  },
});
</script>
```

## File Uploads

Handle multipart form data:

```html
<form use:action={uploadFile} enctype="multipart/form-data">
  <input name="file" type="file" accept="image/*" required />
  <input name="title" type="text" required />
  <button>Upload</button>
</form>

<script type="server">
export async function uploadFile(formData, context) {
  const file = formData.get('file');
  const title = formData.get('title');
  
  // Validate file
  if (!file || file.size > 5 * 1024 * 1024) {
    return {
      success: false,
      error: 'File must be less than 5 MB',
    };
  }
  
  // Save file
  const buffer = await file.arrayBuffer();
  const path = await saveToStorage(buffer, file.name);
  
  // Create database record
  const upload = await db.uploads.create({
    title,
    path,
    size: file.size,
    mimeType: file.type,
  });
  
  return {
    success: true,
    data: { upload },
  };
}
</script>
```

## Cache Invalidation

Actions integrate with cache:

```typescript
export async function updatePost(formData, context) {
  const postId = formData.get('postId');
  const title = formData.get('title');
  
  await db.posts.update(postId, { title });
  
  // Invalidate specific post and list
  await context.cache.invalidateTags([
    `post-${postId}`,
    'posts-list',
  ]);
  
  return { success: true };
}
```

## Redirects

Redirect after successful action:

```typescript
export async function createPost(formData, context) {
  const post = await db.posts.create({
    title: formData.get('title'),
    content: formData.get('content'),
  });
  
  return {
    success: true,
    redirect: `/posts/${post.id}`,
  };
}
```

## Error Handling

```typescript
export async function riskyAction(formData, context) {
  try {
    // Attempt action
    await externalAPI.call();
    
    return { success: true };
  } catch (error) {
    // Log error
    console.error('Action failed:', error);
    
    // Return user-friendly message
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}
```

## Testing

### Unit Test

```typescript
import { describe, test, expect } from 'vitest';
import { createTodo } from './actions';

describe('createTodo', () => {
  test('creates todo successfully', async () => {
    const formData = new FormData();
    formData.append('title', 'Test todo');
    
    const context = {
      user: { id: 1 },
      cache: mockCache,
    };
    
    const result = await createTodo(formData, context);
    
    expect(result.success).toBe(true);
    expect(result.data.todo.title).toBe('Test todo');
  });
  
  test('validates title length', async () => {
    const formData = new FormData();
    formData.append('title', 'ab'); // Too short
    
    const result = await createTodo(formData, {});
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 3 characters');
  });
});
```

## Learn More

- [Caching Guide](./caching.md) - Cache invalidation strategies
- [Forms API](../api/actions.md#forms) - Form enhancement API
- [CSRF Protection](../api/actions.md#csrf) - Security details
