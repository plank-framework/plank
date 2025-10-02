/**
 * @fileoverview Error overlay for development server
 */

import type { ErrorOverlay } from './types.js';

/**
 * Generate error overlay HTML
 */
export function generateErrorOverlay(error: ErrorOverlay): string {
  const { message, stack, file, line, column, type, code } = error;
  const isError = type === 'error';
  const color = isError ? '#ff4757' : '#ffa502';
  const icon = isError ? '!' : '⚠';
  const title = isError ? 'Compilation Error' : 'Warning';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plank Development Error</title>
  <style>
    ${generateErrorOverlayStyles(color)}
  </style>
</head>
<body>
  <div class="error-overlay">
    <div class="error-container">
      ${generateErrorHeader(icon, title)}
      ${generateErrorBody(message, file, line, column, code, stack)}
      ${generateErrorActions()}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate error overlay styles
 */
function generateErrorOverlayStyles(color: string): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
      line-height: 1.6;
      overflow-x: hidden;
    }

    .error-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .error-container {
      background: #2a2a2a;
      border-radius: 12px;
      border: 1px solid ${color};
      max-width: 800px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .error-header {
      padding: 20px 24px;
      border-bottom: 1px solid #3a3a3a;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .error-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      background: ${color};
      color: #ffffff;
    }

    .error-title {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
    }

    .error-body {
      padding: 24px;
    }

    .error-message {
      font-size: 16px;
      margin-bottom: 16px;
      color: #ffffff;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .error-location {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border-left: 4px solid ${color};
    }

    .error-file {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 14px;
      color: #ffffff;
      margin-bottom: 8px;
    }

    .error-line {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 14px;
      color: #888;
    }

    .error-stack {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 13px;
      color: #888;
      white-space: pre-wrap;
      overflow-x: auto;
    }

    .error-actions {
      padding: 20px 24px;
      border-top: 1px solid #3a3a3a;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .error-button {
      padding: 8px 16px;
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      background: #2a2a2a;
      color: #ffffff;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .error-button:hover {
      background: #3a3a3a;
      border-color: #4a4a4a;
    }

    .error-button.primary {
      background: ${color};
      border-color: ${color};
    }

    .error-button.primary:hover {
      background: ${color === '#ff4757' ? '#ff3742' : '#ff9500'};
    }

    .error-code {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 13px;
      color: #888;
      border-left: 4px solid #4a4a4a;
    }

    @media (max-width: 768px) {
      .error-overlay {
        padding: 10px;
      }

      .error-container {
        max-height: 90vh;
      }

      .error-header {
        padding: 16px 20px;
      }

      .error-body {
        padding: 20px;
      }

      .error-actions {
        padding: 16px 20px;
        flex-direction: column;
      }
    }
  `;
}

/**
 * Generate error header
 */
function generateErrorHeader(icon: string, title: string): string {
  return `
    <div class="error-header">
      <div class="error-icon">${icon}</div>
      <div class="error-title">${title}</div>
    </div>
  `;
}

/**
 * Generate error body
 */
function generateErrorBody(
  message: string,
  file?: string,
  line?: number,
  column?: number,
  code?: string,
  stack?: string
): string {
  const locationHtml = file
    ? `
      <div class="error-location">
        <div class="error-file">${escapeHtml(file)}</div>
        ${line ? `<div class="error-line">Line ${line}${column ? `, Column ${column}` : ''}</div>` : ''}
      </div>
    `
    : '';

  const codeHtml = code
    ? `
      <div class="error-code">${escapeHtml(code)}</div>
    `
    : '';

  const stackHtml = stack
    ? `
      <div class="error-stack">${escapeHtml(stack)}</div>
    `
    : '';

  return `
    <div class="error-body">
      <div class="error-message">${escapeHtml(message)}</div>
      ${locationHtml}
      ${codeHtml}
      ${stackHtml}
    </div>
  `;
}

/**
 * Generate error actions
 */
function generateErrorActions(): string {
  return `
    <div class="error-actions">
      <button class="error-button" onclick="window.location.reload()">
        Reload Page
      </button>
      <button class="error-button primary" onclick="window.close()">
        Dismiss
      </button>
    </div>
  `;
}

/**
 * Generate error overlay script for injection
 */
export function generateErrorOverlayScript(error: ErrorOverlay): string {
  const overlayHtml = generateErrorOverlay(error);
  const encodedHtml = Buffer.from(overlayHtml).toString('base64');

  return `
(function() {
  if (document.getElementById('plank-error-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'plank-error-overlay';
  overlay.innerHTML = atob('${encodedHtml}');
  document.body.appendChild(overlay);

  // Auto-dismiss after 10 seconds for warnings
  if ('${error.type}' === 'warning') {
    setTimeout(() => {
      const overlay = document.getElementById('plank-error-overlay');
      if (overlay) {
        overlay.remove();
      }
    }, 10000);
  }
})();
`;
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

/**
 * Create error overlay from Error object
 */
export function createErrorOverlay(
  error: Error,
  options: {
    file?: string;
    line?: number;
    column?: number;
    type?: 'error' | 'warning';
    code?: string;
  } = {}
): ErrorOverlay {
  const result: ErrorOverlay = {
    message: error.message,
    type: options.type || 'error',
  };

  if (error.stack !== undefined) {
    result.stack = error.stack;
  }
  if (options.file !== undefined) {
    result.file = options.file;
  }
  if (options.line !== undefined) {
    result.line = options.line;
  }
  if (options.column !== undefined) {
    result.column = options.column;
  }
  if (options.code !== undefined) {
    result.code = options.code;
  }

  return result;
}

/**
 * Create warning overlay
 */
export function createWarningOverlay(
  message: string,
  options: {
    file?: string;
    line?: number;
    column?: number;
    code?: string;
  } = {}
): ErrorOverlay {
  const result: ErrorOverlay = {
    message,
    type: 'warning',
  };

  if (options.file !== undefined) {
    result.file = options.file;
  }
  if (options.line !== undefined) {
    result.line = options.line;
  }
  if (options.column !== undefined) {
    result.column = options.column;
  }
  if (options.code !== undefined) {
    result.code = options.code;
  }

  return result;
}
