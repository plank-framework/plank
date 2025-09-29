# Plank Examples

This directory contains example applications demonstrating different aspects of the Plank framework.

## Available Examples

### 1. Marketing Zero JS (`marketing-zero-js/`)

A marketing website that ships **zero JavaScript** by default, showcasing Plank's core philosophy of progressive enhancement.

**Features:**
- ✅ Zero JavaScript on all pages
- ✅ Server-side rendering for fast initial loads
- ✅ SEO optimized with semantic HTML
- ✅ Mobile-friendly with minimal resources
- ✅ Perfect Core Web Vitals scores

**Use Cases:**
- Marketing websites
- Documentation sites
- Content-heavy applications
- SEO-critical pages

**Pages:**
- Home (`/`) - Landing page with hero and features
- Features (`/features`) - Detailed feature overview
- About (`/about`) - Mission and philosophy
- Documentation (`/docs`) - Getting started guide

### 2. Island Counter (`island-counter/`)

An interactive application demonstrating Plank's **islands architecture** with components that load JavaScript only when needed.

**Features:**
- 🏝️ Islands architecture with progressive loading
- ⚡ Different loading strategies (load, idle, visible)
- 🎯 Interactive components with reactive state
- 📱 Optimized for mobile performance

**Islands Included:**
- **Counter** (`client:load`) - Loads immediately, critical interactivity
- **Timer** (`client:idle`) - Loads when browser is idle
- **Chart** (`client:visible`) - Loads when scrolled into view

**Use Cases:**
- Interactive dashboards
- Content with embedded widgets
- Progressive web applications
- Feature-rich websites

## Getting Started with Examples

### Prerequisites

Make sure you have the Plank framework built and available:

```bash
# From the project root
pnpm install
pnpm build
```

### Running an Example

1. Navigate to the example directory:
   ```bash
   cd examples/marketing-zero-js  # or examples/island-counter
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
# Build the example
pnpm build

# Preview the production build
pnpm preview
```

## Performance Comparison

| Example | Initial JS | Use Case | Performance |
|---------|------------|----------|-------------|
| Marketing Zero JS | 0 KB | Static content | ⚡ Instant |
| Island Counter | ~5-10 KB | Interactive features | 🚀 Fast |

## Learning Path

### For Beginners
1. Start with **Marketing Zero JS** to understand static content
2. Explore the file structure and routing system
3. Learn about layouts and component composition

### For Intermediate Users
1. Study **Island Counter** to understand islands architecture
2. Experiment with different loading strategies
3. Learn about reactive state management with signals

### For Advanced Users
1. Customize the examples with your own components
2. Implement new islands with different loading strategies
3. Optimize performance and bundle sizes

## Key Concepts Demonstrated

### Marketing Zero JS
- File-based routing
- Layout composition
- Static content optimization
- SEO best practices
- Performance budgets

### Island Counter
- Islands architecture
- Progressive loading strategies
- Reactive state management
- Client-side interactivity
- Code splitting and lazy loading

## Contributing

Want to add a new example? Here's how:

1. Create a new directory in `examples/`
2. Follow the structure of existing examples
3. Include a comprehensive README
4. Add proper package.json with Plank dependencies
5. Submit a pull request

## Questions?

- Check the main [Plank documentation](../../README.md)
- Join our community discussions
- Open an issue for bugs or feature requests

These examples showcase the power and flexibility of the Plank framework. Start with the marketing site to understand the foundation, then explore islands to see how interactivity can be added progressively.
