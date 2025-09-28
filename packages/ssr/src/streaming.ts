/**
 * @fileoverview Streaming HTML utilities for progressive rendering
 */

import type { StreamingOptions } from './types.js';

/**
 * Streaming response builder
 */
export class StreamingResponse {
  private chunks: string[] = [];
  private encoder = new TextEncoder();
  private controller?: ReadableStreamDefaultController<Uint8Array>;

  constructor(private options: StreamingOptions) {}

  /**
   * Write HTML chunk
   */
  write(chunk: string): void {
    if (this.options.enabled && this.controller) {
      this.controller.enqueue(this.encoder.encode(chunk));
    } else {
      this.chunks.push(chunk);
    }
  }

  /**
   * Write HTML with proper escaping
   */
  writeEscaped(text: string): void {
    this.write(this.escapeHtml(text));
  }

  /**
   * Write attribute value with proper escaping
   */
  writeAttribute(value: string): void {
    this.write(this.escapeAttribute(value));
  }

  /**
   * Write placeholder for loading state
   */
  writePlaceholder(content?: string): void {
    const placeholder = content || this.options.placeholder || 'Loading...';
    this.write(`<div class="plank-placeholder">${this.escapeHtml(placeholder)}</div>`);
  }

  /**
   * Write script tag for hydration
   */
  writeHydrationScript(islandId: string, props: Record<string, unknown>): void {
    this.write(`<script type="module">
      import { hydrateIsland } from '@plank/runtime-dom';
      hydrateIsland('${islandId}', ${JSON.stringify(props)});
    </script>`);
  }

  /**
   * Write CSS for loading states
   */
  writeLoadingStyles(): void {
    this.write(`<style>
      .plank-placeholder {
        opacity: 0.6;
        animation: plank-pulse 1.5s ease-in-out infinite;
      }
      @keyframes plank-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    </style>`);
  }

  /**
   * Get accumulated HTML if not streaming
   */
  getHtml(): string {
    return this.chunks.join('');
  }

  /**
   * Set stream controller
   */
  setController(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this.controller = controller;
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.controller) {
      this.controller.close();
    }
  }

  /**
   * Create readable stream
   */
  createStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        this.setController(controller);
      },
      cancel: () => {
        this.close();
      },
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape attribute value
   */
  private escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

/**
 * Generate HTML for progressive enhancement
 */
export function generateEnhancementScript(baseUrl = '/'): string {
  return `<script type="module">
    // Progressive enhancement for Plank
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('${baseUrl}sw.js').catch(() => {
        // Service worker registration failed, continue without it
      });
    }

    // Preload critical resources
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = '${baseUrl}@plank/runtime-dom';
    document.head.appendChild(link);

    // Add error boundary for client-side errors
    window.addEventListener('error', (event) => {
      console.error('Plank Error:', event.error);
      // Could send to error reporting service
    });

    // Add unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Plank Unhandled Promise Rejection:', event.reason);
      // Could send to error reporting service
    });

    // Add performance monitoring
    if ('performance' in window && 'mark' in performance) {
      performance.mark('plank-enhancement-start');
    }
  </script>`;
}

/**
 * Generate viewport meta tag
 */
export function generateViewportMeta(): string {
  return '<meta name="viewport" content="width=device-width, initial-scale=1">';
}

/**
 * Generate preconnect hints
 */
export function generatePreconnectHints(domains: string[]): string {
  return domains.map((domain) => `<link rel="preconnect" href="${domain}">`).join('\n');
}

/**
 * Generate HTML document structure
 */
export function generateDocument(
  title: string,
  content: string,
  options: {
    lang?: string;
    charset?: string;
    viewport?: string;
    styles?: string[];
    scripts?: string[];
    preconnect?: string[];
    baseUrl?: string;
    enableProgressiveEnhancement?: boolean;
  } = {}
): string {
  const {
    lang = 'en',
    charset = 'utf-8',
    viewport = 'width=device-width, initial-scale=1',
    styles = [],
    scripts = [],
    preconnect = [],
    baseUrl = '/',
    enableProgressiveEnhancement = true,
  } = options;

  const progressiveEnhancementScript = enableProgressiveEnhancement
    ? generateEnhancementScript(baseUrl)
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="${charset}">
  <meta name="viewport" content="${viewport}">
  <title>${escapeHtml(title)}</title>
  ${preconnect.map((domain) => `<link rel="preconnect" href="${domain}">`).join('\n')}
  ${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
  ${progressiveEnhancementScript}
</head>
<body>
  ${content}
  ${scripts.map((src) => `<script type="module" src="${src}"></script>`).join('\n')}
</body>
</html>`;
}

/**
 * Generate loading skeleton
 */
export function generateSkeleton(type: 'card' | 'list' | 'text' | 'image'): string {
  const skeletons = {
    card: `<div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
      </div>
    </div>`,
    list: `<div class="skeleton-list">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>`,
    text: `<div class="skeleton-text">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>`,
    image: `<div class="skeleton-image"></div>`,
  };

  return skeletons[type] + generateSkeletonStyles();
}

/**
 * Generate skeleton CSS
 */
function generateSkeletonStyles(): string {
  return `<style>
    .skeleton-card, .skeleton-list, .skeleton-text, .skeleton-image {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
    }
    .skeleton-card {
      border-radius: 8px;
      padding: 16px;
      margin: 8px 0;
    }
    .skeleton-image {
      width: 100%;
      height: 200px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .skeleton-title {
      height: 20px;
      width: 60%;
      margin-bottom: 8px;
    }
    .skeleton-line {
      height: 16px;
      width: 100%;
      margin-bottom: 8px;
    }
    .skeleton-line.short {
      width: 80%;
    }
    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  </style>`;
}

/**
 * Generate streaming placeholder for progressive loading
 */
export function generateStreamingPlaceholder(
  type: 'content' | 'island' | 'data' = 'content',
  options: {
    message?: string;
    showSpinner?: boolean;
    className?: string;
  } = {}
): string {
  const {
    message = 'Loading...',
    showSpinner = true,
    className = 'plank-streaming-placeholder',
  } = options;

  const spinner = showSpinner ? '<div class="plank-spinner"></div>' : '';

  return `<div class="${className}" data-type="${type}">
    ${spinner}
    <span class="plank-message">${escapeHtml(message)}</span>
  </div>`;
}

/**
 * Generate streaming boundary markers for progressive enhancement
 */
export function generateStreamingBoundary(id: string, type: 'start' | 'end' = 'start'): string {
  const marker = type === 'start' ? '<!--plank-stream-start:' : '<!--plank-stream-end:';
  return `${marker}${id}-->`;
}

/**
 * Generate error boundary for streaming failures
 */
export function generateErrorBoundary(error: string, fallback?: string): string {
  const fallbackContent = fallback || 'An error occurred while loading this content.';

  return `<div class="plank-error-boundary" data-error="${escapeHtml(error)}">
    <div class="plank-error-content">
      <h3>Loading Error</h3>
      <p>${escapeHtml(fallbackContent)}</p>
      <details>
        <summary>Technical Details</summary>
        <pre>${escapeHtml(error)}</pre>
      </details>
    </div>
  </div>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
