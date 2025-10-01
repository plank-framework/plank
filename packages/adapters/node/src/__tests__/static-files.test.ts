/**
 * @fileoverview Tests for static file utilities
 */

import { describe, expect, it } from 'vitest';
import { getCacheControl, getMimeType, isSafePath } from '../static-files.js';

describe('getMimeType', () => {
  it('should return correct MIME type for common files', () => {
    expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
    expect(getMimeType('style.css')).toBe('text/css; charset=utf-8');
    expect(getMimeType('script.js')).toBe('application/javascript; charset=utf-8');
    expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
  });

  it('should return MIME type for images', () => {
    expect(getMimeType('photo.png')).toBe('image/png');
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('favicon.ico')).toBe('image/x-icon');
  });

  it('should return MIME type for fonts', () => {
    expect(getMimeType('font.woff')).toBe('font/woff');
    expect(getMimeType('font.woff2')).toBe('font/woff2');
    expect(getMimeType('font.ttf')).toBe('font/ttf');
  });

  it('should handle case insensitivity', () => {
    expect(getMimeType('FILE.HTML')).toBe('text/html; charset=utf-8');
    expect(getMimeType('FILE.JS')).toBe('application/javascript; charset=utf-8');
  });

  it('should return default for unknown extensions', () => {
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
  });
});

describe('isSafePath', () => {
  it('should allow safe paths', () => {
    expect(isSafePath('/index.html')).toBe(true);
    expect(isSafePath('/assets/logo.png')).toBe(true);
    expect(isSafePath('/js/app.js')).toBe(true);
  });

  it('should reject directory traversal', () => {
    expect(isSafePath('../etc/passwd')).toBe(false);
    expect(isSafePath('/assets/../../../etc/passwd')).toBe(false);
  });

  it('should normalize paths', () => {
    expect(isSafePath('///index.html')).toBe(true);
    expect(isSafePath('./index.html')).toBe(true);
  });
});

describe('getCacheControl', () => {
  it('should return no-cache in dev mode', () => {
    expect(getCacheControl('any-file.js', true)).toBe('no-cache');
  });

  it('should set immutable for hashed assets', () => {
    const result = getCacheControl('app.a1b2c3d4.js', false);
    expect(result).toContain('immutable');
    expect(result).toContain('max-age=31536000');
  });

  it('should cache images for 1 day', () => {
    expect(getCacheControl('photo.png', false)).toContain('max-age=86400');
    expect(getCacheControl('icon.svg', false)).toContain('max-age=86400');
  });

  it('should cache CSS/JS for 1 hour', () => {
    expect(getCacheControl('style.css', false)).toContain('max-age=3600');
    expect(getCacheControl('script.js', false)).toContain('max-age=3600');
  });

  it('should cache other files for 5 minutes', () => {
    expect(getCacheControl('data.json', false)).toContain('max-age=300');
  });
});
