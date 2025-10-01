/**
 * @fileoverview Static file serving with MIME types
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * MIME type map
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

/**
 * Get MIME type from file extension
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if path is safe (no directory traversal)
 */
export function isSafePath(requestPath: string): boolean {
  // Check for obvious directory traversal patterns
  if (requestPath.includes('..')) {
    return false;
  }

  // Normalize the path
  const normalized = join('/', requestPath);

  // Must start with / and contain no ..
  return normalized.startsWith('/') && !normalized.includes('..');
}

/**
 * Resolve static file path
 */
export async function resolveStaticFile(
  staticDir: string,
  requestPath: string
): Promise<string | null> {
  if (!isSafePath(requestPath)) {
    return null;
  }

  const filePath = join(staticDir, requestPath);

  try {
    const stats = await stat(filePath);

    if (!stats.isFile()) {
      return null;
    }

    return filePath;
  } catch {
    return null;
  }
}

/**
 * Get cache control header for file type
 */
export function getCacheControl(filePath: string, dev = false): string {
  if (dev) {
    return 'no-cache';
  }

  // Immutable assets (with hash in filename)
  if (/\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/i.test(filePath)) {
    return 'public, max-age=31536000, immutable';
  }

  // Images and fonts
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(filePath)) {
    return 'public, max-age=86400'; // 1 day
  }

  // CSS and JS
  if (/\.(css|js)$/i.test(filePath)) {
    return 'public, max-age=3600'; // 1 hour
  }

  // Everything else
  return 'public, max-age=300'; // 5 minutes
}
