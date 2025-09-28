/**
 * @fileoverview Tests for manifest generation
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  generateRobotsTxt,
  generateRouteManifest,
  generateRouteTypes,
  generateSitemap,
  validateManifest,
} from '../manifest-generator.js';
import type { LayoutConfig, RouteConfig } from '../types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('Manifest Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should generate route manifest', async () => {
    const routes: RouteConfig[] = [
      {
        path: '/',
        filePath: '/app/routes/index.plk',
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/index.plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly',
        },
      },
    ];

    const layouts: LayoutConfig[] = [
      {
        filePath: '/app/routes/layout.plk',
        name: 'layout',
        isRoot: true,
        meta: {
          title: 'Root Layout',
          meta: {},
          stylesheets: [],
          scripts: [],
        },
      },
    ];

    const manifest = await generateRouteManifest(routes, layouts, '/tmp/manifest.json');

    expect(manifest.routes).toHaveLength(1);
    expect(manifest.layouts).toHaveProperty('layout');
    expect(manifest.rootLayout).toBe('/app/routes/layout.plk');
    expect(manifest.generatedAt).toBeDefined();
    expect(manifest.version).toBe('1.0.0');
  });

  test('should generate sitemap', () => {
    const manifest = {
      routes: [
        {
          path: '/',
          file: '/app/routes/index.plk',
          params: [],
          dynamic: false,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
        {
          path: '/users/[id]',
          file: '/app/routes/users/[id].plk',
          params: ['id'],
          dynamic: true,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const sitemap = generateSitemap(manifest, 'https://example.com');

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<urlset');
    expect(sitemap).toContain('https://example.com/');
    expect(sitemap).not.toContain('https://example.com/users/[id]'); // Dynamic routes excluded
  });

  test('should generate robots.txt', () => {
    const manifest = {
      routes: [
        {
          path: '/users/[id]',
          file: '/app/routes/users/[id].plk',
          params: ['id'],
          dynamic: true,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const robots = generateRobotsTxt(manifest, 'https://example.com');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /users/[id]');
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  test('should generate route types', () => {
    const manifest = {
      routes: [
        {
          path: '/',
          file: '/app/routes/index.plk',
          params: [],
          dynamic: false,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
        {
          path: '/users/[id]',
          file: '/app/routes/users/[id].plk',
          params: ['id'],
          dynamic: true,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
        {
          path: '/posts/[...slug]',
          file: '/app/routes/posts/[...slug].plk',
          params: ['...slug'],
          dynamic: true,
          catchAll: true,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const types = generateRouteTypes(manifest);

    expect(types).toContain('export type RoutePath =');
    expect(types).toContain("| '/'");
    expect(types).toContain('export type RouteParams = {');
    expect(types).toContain("'id': string;");
    expect(types).toContain("'slug': string[];");
  });

  test('should validate manifest', () => {
    const validManifest = {
      routes: [
        {
          path: '/',
          file: '/app/routes/index.plk',
          params: [],
          dynamic: false,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const errors = validateManifest(validManifest);
    expect(errors).toHaveLength(0);

    const invalidManifest = {
      routes: [],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '',
      version: '',
    };

    const invalidErrors = validateManifest(invalidManifest);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });

  test('should generate manifest with nested layouts', async () => {
    const routes: RouteConfig[] = [
      {
        path: '/users',
        filePath: '/app/routes/users.plk',
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: '/app/routes/users/layout.plk',
        pagePath: '/app/routes/users.plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly',
        },
      },
    ];

    const layouts: LayoutConfig[] = [
      {
        filePath: '/app/routes/layout.plk',
        name: 'layout',
        isRoot: true,
        meta: {
          title: 'Root Layout',
          meta: {},
          stylesheets: [],
          scripts: [],
        },
      },
      {
        filePath: '/app/routes/users/layout.plk',
        name: 'layout',
        isRoot: false,
        parent: '/',
        meta: {
          title: 'Users Layout',
          meta: {},
          stylesheets: [],
          scripts: [],
        },
      },
    ];

    const manifest = await generateRouteManifest(routes, layouts, '/tmp/manifest.json');

    expect(manifest.routes).toHaveLength(1);
    expect(manifest.layouts).toHaveProperty('layout');
    expect(manifest.rootLayout).toBe('/app/routes/layout.plk');
    expect(manifest.routes[0]?.meta.layoutChain).toEqual(['/app/routes/users/layout.plk']);
  });

  test('should generate sitemap with complex routes', () => {
    const manifest = {
      routes: [
        {
          path: '/',
          file: '/app/routes/index.plk',
          params: [],
          dynamic: false,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.8,
            changefreq: 'daily' as const,
          },
        },
        {
          path: '/users/[id]',
          file: '/app/routes/users/[id].plk',
          params: ['id'],
          dynamic: true,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: false,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
        {
          path: '/posts/[...slug]',
          file: '/app/routes/posts/[...slug].plk',
          params: ['...slug'],
          dynamic: true,
          catchAll: true,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: false,
            priority: 0.3,
            changefreq: 'weekly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const sitemap = generateSitemap(manifest, 'https://example.com');

    expect(sitemap).toContain('https://example.com/');
    expect(sitemap).toContain('<priority>0.8</priority>');
    expect(sitemap).toContain('<changefreq>daily</changefreq>');
    expect(sitemap).not.toContain('https://example.com/users/[id]'); // Dynamic routes excluded
    expect(sitemap).not.toContain('https://example.com/posts/[...slug]'); // Catch-all routes excluded
  });

  test('should generate robots.txt with complex routes', () => {
    const manifest = {
      routes: [
        {
          path: '/api/users/[id]',
          file: '/app/routes/api/users/[id].plk',
          params: ['id'],
          dynamic: true,
          catchAll: false,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
        {
          path: '/posts/[...slug]',
          file: '/app/routes/posts/[...slug].plk',
          params: ['...slug'],
          dynamic: true,
          catchAll: true,
          layout: undefined,
          methods: ['GET'],
          meta: {
            indexable: true,
            priority: 0.5,
            changefreq: 'monthly' as const,
          },
        },
      ],
      layouts: {},
      rootLayout: undefined,
      generatedAt: '2024-01-01T00:00:00.000Z',
      version: '1.0.0',
    };

    const robots = generateRobotsTxt(manifest, 'https://example.com');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /api/users/[id]');
    expect(robots).toContain('Disallow: /posts/[...slug]');
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});
