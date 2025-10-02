# @plank/ui-primitives

UI primitive components and utilities for Plank applications. This package provides reusable, accessible, and performant UI components built with Plank's islands architecture.

## Status

🚧 **This package is currently empty and under development.**

## Planned Features

- **Button Components**: Primary, secondary, ghost, and icon buttons
- **Form Components**: Input, textarea, select, checkbox, radio, and form validation
- **Layout Components**: Container, grid, stack, and responsive utilities
- **Navigation Components**: Header, footer, breadcrumbs, and pagination
- **Feedback Components**: Alert, toast, modal, and loading states
- **Data Display**: Table, card, list, and badge components
- **Accessibility**: Full ARIA support and keyboard navigation
- **Theming**: CSS custom properties and design token integration

## Planned API

### Button Components

```typescript
import { Button, IconButton, ButtonGroup } from '@plank/ui-primitives';

// Basic button
<Button variant="primary" size="medium" on:click={handleClick}>
  Click me
</Button>

// Icon button
<IconButton icon="plus" aria-label="Add item" on:click={handleAdd} />

// Button group
<ButtonGroup>
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>
```

### Form Components

```typescript
import { Input, Textarea, Select, Checkbox, Radio } from '@plank/ui-primitives';

// Input with validation
<Input
  bind:value={email}
  type="email"
  placeholder="Enter your email"
  required
  error={emailError}
/>

// Select dropdown
<Select bind:value={country}>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
  <option value="uk">United Kingdom</option>
</Select>

// Checkbox
<Checkbox bind:checked={agreeToTerms}>
  I agree to the terms and conditions
</Checkbox>
```

### Layout Components

```typescript
import { Container, Grid, Stack, Spacer } from '@plank/ui-primitives';

// Container with responsive max-width
<Container maxWidth="lg">
  <h1>Page Title</h1>
  <p>Page content</p>
</Container>

// Grid layout
<Grid columns={3} gap={4}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Grid>

// Vertical stack
<Stack direction="vertical" gap={2}>
  <h2>Section 1</h2>
  <p>Content 1</p>
  <Spacer />
  <h2>Section 2</h2>
  <p>Content 2</p>
</Stack>
```

### Navigation Components

```typescript
import { Header, Footer, Breadcrumbs, Pagination } from '@plank/ui-primitives';

// Header with navigation
<Header>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
</Header>

// Breadcrumbs
<Breadcrumbs>
  <a href="/">Home</a>
  <a href="/products">Products</a>
  <span>Current Page</span>
</Breadcrumbs>

// Pagination
<Pagination
  current={currentPage}
  total={totalPages}
  on:change={handlePageChange}
/>
```

### Feedback Components

```typescript
import { Alert, Toast, Modal, LoadingSpinner } from '@plank/ui-primitives';

// Alert message
<Alert type="success" dismissible>
  Your changes have been saved successfully!
</Alert>

// Toast notification
<Toast type="info" duration={3000}>
  New message received
</Toast>

// Modal dialog
<Modal open={showModal} on:close={() => showModal = false}>
  <h2>Confirm Action</h2>
  <p>Are you sure you want to delete this item?</p>
  <ButtonGroup>
    <Button variant="danger" on:click={handleDelete}>Delete</Button>
    <Button variant="secondary" on:click={() => showModal = false}>Cancel</Button>
  </ButtonGroup>
</Modal>
```

## Design System Integration

The UI primitives will integrate with Plank's design system:

- **Design Tokens**: Consistent spacing, colors, typography, and shadows
- **CSS Custom Properties**: Themeable components with CSS variables
- **Responsive Design**: Mobile-first approach with breakpoint utilities
- **Dark Mode**: Built-in support for light and dark themes
- **Accessibility**: WCAG 2.1 AA compliance with full keyboard navigation

## Accessibility Features

- **ARIA Support**: Proper ARIA labels, roles, and states
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Semantic HTML and proper announcements
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Contrast**: WCAG AA compliant color combinations

## Performance

- **Islands Architecture**: Components load JavaScript only when needed
- **Tree Shaking**: Import only the components you use
- **CSS Optimization**: Minimal CSS with efficient selectors
- **Bundle Size**: Optimized for minimal JavaScript overhead

## Development

This package is part of the Plank monorepo. To contribute:

```bash
# Install dependencies
pnpm install

# Build the UI primitives (when implemented)
pnpm build --filter=@plank/ui-primitives

# Run tests (when implemented)
pnpm test --filter=@plank/ui-primitives
```

## Roadmap

1. **Phase 1**: Basic button and form components
2. **Phase 2**: Layout and navigation components
3. **Phase 3**: Feedback and data display components
4. **Phase 4**: Advanced components and theming system
5. **Phase 5**: Animation and interaction utilities

## Contributing

We welcome contributions! Please see the main Plank repository for contribution guidelines.

## License

Apache 2.0
