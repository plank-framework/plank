/**
 * @fileoverview Static file utilities for Bun adapter
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

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
  '.xml': 'text/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

export function getMimeType(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  const ext = dot >= 0 ? filePath.substring(dot).toLowerCase() : '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function isSafePath(requestPath: string): boolean {
  if (requestPath.includes('..')) return false;
  const normalized = join('/', requestPath);
  return normalized.startsWith('/') && !normalized.includes('..');
}

export async function resolveStaticFile(
  staticDir: string,
  requestPath: string
): Promise<string | null> {
  if (!isSafePath(requestPath)) return null;
  const filePath = join(staticDir, requestPath);
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    return filePath;
  } catch {
    return null;
  }
}

export function getCacheControl(filePath: string, dev = false): string {
  if (dev) return 'no-cache';
  if (/\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/i.test(filePath)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(filePath)) {
    return 'public, max-age=86400';
  }
  if (/\.(css|js)$/i.test(filePath)) {
    return 'public, max-age=3600';
  }
  return 'public, max-age=300';
}
