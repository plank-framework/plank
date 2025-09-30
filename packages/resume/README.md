# @plank/resume

Resumability serialization for the Plank framework. Enables **instant interactivity** by serializing reactive state on the server and resuming on the client without re-executing constructors.

## What is Resumability?

Traditional hydration re-executes all component constructors on the client. **Resumability** serializes the reactive state (signals, computed values, event listeners) on the server and restores it on the client, making the app interactive **instantly** without re-execution.

### Benefits

- ⚡ **Instant Interactivity**: No constructor re-execution
- 📦 **Smaller Bundles**: Only hydration code, not initialization
- 🚀 **Faster TTI**: Time to Interactive dramatically reduced
- 💾 **State Preservation**: Exact server state restored

## Installation

```bash
pnpm add @plank/resume
```

## Usage

### Server-Side Serialization

```typescript
import { createSerializer } from '@plank/resume';
import { signal, computed } from '@plank/runtime-core';

// Create serializer
const serializer = createSerializer({
  maxSnapshotSize: 1024 * 1024, // 1 MB
  compress: true,
});

// Register signals
const count = signal(42);
const doubled = computed(() => count() * 2);

serializer.registerSignal(count);
serializer.registerComputed(doubled);

// Create snapshot
const snapshot = serializer.createSnapshot({
  route: '/counter',
  locale: 'en',
  custom: { theme: 'dark' },
});

// Embed in HTML
const html = serializer.embedInHTML(snapshot);
// Include in <head>: <script type="application/plank-resume">...</script>
```

### Client-Side Resume

```typescript
import { createBootstrap, quickResume } from '@plank/resume';

// Quick resume (recommended)
const result = await quickResume({
  fallbackToHydration: true,
  timeout: 5000,
  onProgress: (step, progress) => {
    console.log(`${step}: ${progress * 100}%`);
  },
});

if (result.success) {
  console.log(`Resumed in ${result.metrics.resumeTime}ms`);
  console.log(`Signals: ${result.metrics.signalsRestored}`);
  console.log(`Listeners: ${result.metrics.listenersRestored}`);
} else {
  console.error('Resume failed:', result.error);
}

// Or with manual control
const bootstrap = createBootstrap();

if (ResumabilityBootstrap.canResume()) {
  await bootstrap.resume();
} else {
  // Fallback to traditional hydration
  hydrateApp();
}
```

## API

### `createSerializer(config?)`

Creates a server-side serializer for capturing reactive state.

**Config Options**:
- `enabled`: Enable resumability (default: true)
- `serializeFunctions`: Serialize function sources (default: false, security risk)
- `maxSnapshotSize`: Maximum snapshot size in bytes (default: 1MB)
- `compress`: Enable compression (default: true)
- `versionStrategy`: Version compatibility ('strict' | 'compatible' | 'ignore')

### `serializer.registerSignal(signal)`

Register a signal for serialization. Only signals with `isSerializable: true` are included.

### `serializer.registerComputed(computed)`

Register a computed value for serialization.

### `serializer.createSnapshot(options)`

Create a complete resumability snapshot.

**Options**:
- `route`: Current route (required)
- `locale`: User locale (optional)
- `custom`: Custom metadata (optional)

### `serializer.embedInHTML(snapshot)`

Generate HTML script tag with embedded snapshot.

### `createBootstrap(options?)`

Creates a client-side bootstrap for resuming application state.

**Options**:
- `fallbackToHydration`: Fallback to hydration on errors (default: true)
- `timeout`: Resume timeout in ms (default: 5000)
- `onError`: Error callback
- `onProgress`: Progress callback

### `bootstrap.resume()`

Resume application from embedded snapshot.

**Returns**: `Promise<ResumeResult>`

```typescript
interface ResumeResult {
  success: boolean;
  error?: Error;
  fallback?: 'partial-hydration' | 'full-hydration';
  metrics: {
    resumeTime: number;
    signalsRestored: number;
    listenersRestored: number;
    componentsResumed: number;
  };
}
```

### `quickResume(options?)`

Convenience function that creates bootstrap and resumes in one call.

### `ResumabilityBootstrap.canResume()`

Static method to check if resumability data is available.

## Serialization Format

The snapshot is embedded as a JSON object in the HTML:

```html
<script type="application/plank-resume" id="plank-resume-data">
{
  "version": "1.0.0",
  "timestamp": 1727750000000,
  "signals": {
    "signal_123": {
      "id": "signal_123",
      "value": 42,
      "dependents": ["computed_456"],
      "isSerializable": true
    }
  },
  "computeds": {
    "computed_456": {
      "id": "computed_456",
      "value": 84,
      "dependencies": ["signal_123"],
      "isDirty": false
    }
  },
  "nodes": {
    "btn_789": {
      "nodeId": "btn_789",
      "tagName": "BUTTON",
      "dataAttrs": {},
      "listeners": [
        {
          "event": "click",
          "handlerId": "handler_abc"
        }
      ]
    }
  },
  "components": {},
  "islands": {},
  "meta": {
    "route": "/counter"
  }
}
</script>
```

## Performance

Resumability provides significant performance improvements:

- **Traditional Hydration**: ~200ms to re-execute components
- **Resumability**: ~20ms to restore state (10x faster!)

## Security

### Function Serialization

By default, function sources are **not serialized** for security. Enable only if you control the serialization environment:

```typescript
const serializer = createSerializer({
  serializeFunctions: true, // ⚠️ Security risk!
});
```

### XSS Protection

The serializer automatically escapes HTML special characters when embedding:

```typescript
const html = serializer.embedInHTML(snapshot);
// <, >, & are escaped as \u003c, \u003e, \u0026
```

## Versioning

Snapshots include a schema version for compatibility checking:

- **Strict**: Exact version match required
- **Compatible** (default): Same major version
- **Ignore**: No version checking

## Examples

### Counter with Resumability

```typescript
// Server
import { createSerializer } from '@plank/resume';
import { signal } from '@plank/runtime-core';

const serializer = createSerializer();
const count = signal(0);

serializer.registerSignal(count);

const snapshot = serializer.createSnapshot({ route: '/counter' });
const resumeScript = serializer.embedInHTML(snapshot);

// Include in HTML <head>

// Client
import { quickResume } from '@plank/resume';

const result = await quickResume();

if (result.success) {
  // count signal is already at correct value!
  // Event listeners are already attached!
  // App is interactive immediately!
}
```

### Todo List with Optimistic Updates

```typescript
// Server
const serializer = createSerializer();
const todos = signal([
  { id: '1', title: 'Buy milk', completed: false },
  { id: '2', title: 'Walk dog', completed: true },
]);

serializer.registerSignal(todos);

// Client resumes with exact todo state
// No need to fetch or re-compute
```

## Testing

```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage

# Current: 88.21% coverage, 37/37 tests passing
```

## License

Apache-2.0
