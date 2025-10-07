/**
 * @fileoverview Unit tests for Bun adapter static file utilities
 */

import { describe, expect, it } from 'vitest';
import { getCacheControl, getMimeType } from '../static-files.js';

describe('Static file utilities', () => {
  describe('getMimeType', () => {
    it('should return correct MIME type for HTML files', () => {
      expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
      expect(getMimeType('page.HTML')).toBe('text/html; charset=utf-8');
    });

    it('should return correct MIME type for CSS files', () => {
      expect(getMimeType('styles.css')).toBe('text/css; charset=utf-8');
      expect(getMimeType('theme.CSS')).toBe('text/css; charset=utf-8');
    });

    it('should return correct MIME type for JavaScript files', () => {
      expect(getMimeType('script.js')).toBe('application/javascript; charset=utf-8');
      expect(getMimeType('app.JS')).toBe('application/javascript; charset=utf-8');
    });

    it('should return correct MIME type for JSON files', () => {
      expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
      expect(getMimeType('config.JSON')).toBe('application/json; charset=utf-8');
    });

    it('should return correct MIME type for image files', () => {
      expect(getMimeType('logo.png')).toBe('image/png');
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeType('icon.gif')).toBe('image/gif');
      expect(getMimeType('graphic.svg')).toBe('image/svg+xml');
      expect(getMimeType('favicon.ico')).toBe('image/x-icon');
      expect(getMimeType('image.webp')).toBe('image/webp');
    });

    it('should return correct MIME type for text files', () => {
      expect(getMimeType('readme.txt')).toBe('text/plain; charset=utf-8');
      expect(getMimeType('data.xml')).toBe('text/xml; charset=utf-8');
    });

    it('should return octet-stream for unknown file types', () => {
      expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
      expect(getMimeType('file')).toBe('application/octet-stream');
    });
  });

  describe('getCacheControl', () => {
    it('should return cacheable headers for static assets', () => {
      expect(getCacheControl('styles.css', false)).toBe('public, max-age=3600');
      expect(getCacheControl('script.js', false)).toBe('public, max-age=3600');
      expect(getCacheControl('image.png', false)).toBe('public, max-age=86400');
      expect(getCacheControl('font.woff2', false)).toBe('public, max-age=86400');
    });

    it('should return short cache for HTML files', () => {
      expect(getCacheControl('index.html', false)).toBe('public, max-age=300');
      expect(getCacheControl('page.html', false)).toBe('public, max-age=300');
    });

    it('should return short cache for unknown file types', () => {
      expect(getCacheControl('unknown.xyz', false)).toBe('public, max-age=300');
      expect(getCacheControl('file', false)).toBe('public, max-age=300');
    });

    it('should return no-cache in dev mode', () => {
      expect(getCacheControl('styles.css', true)).toBe('no-cache');
      expect(getCacheControl('image.png', true)).toBe('no-cache');
      expect(getCacheControl('index.html', true)).toBe('no-cache');
    });
  });
});
