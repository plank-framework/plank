/**
 * @fileoverview Tests for route configuration
 */

import { describe, expect, test } from 'vitest';
import {
  buildLayoutConfig,
  buildRouteConfig,
  findRouteByPath,
  sortRoutesBySpecificity,
  validateRouteConfig,
} from '../route-config.js';
import type { RouteFileInfo } from '../types.js';

describe('Route Configuration', () => {
  test('should build route configuration from files', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'page',
        path: '/app/routes/index.plk',
        routePath: '/',
        name: 'index',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
      {
        type: 'layout',
        path: '/app/routes/layout.plk',
        routePath: '/',
        name: 'layout',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const routes = buildRouteConfig(files);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/');
    expect(routes[0]?.isDynamic).toBe(false);
    expect(routes[0]?.methods).toContain('GET');
  });

  test('should build layout configuration from files', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'layout',
        path: '/app/routes/layout.plk',
        routePath: '/',
        name: 'layout',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const layouts = buildLayoutConfig(files);

    expect(layouts).toHaveLength(1);
    expect(layouts[0]?.name).toBe('layout');
    expect(layouts[0]?.isRoot).toBe(true);
  });

  test('should validate route configuration', () => {
    const validRoute = {
      path: '/users',
      filePath: '/app/routes/users.plk',
      params: [],
      isDynamic: false,
      isCatchAll: false,
      layoutPath: undefined,
      pagePath: '/app/routes/users.plk',
      methods: ['GET'],
      meta: {
        indexable: true,
        priority: 0.5,
        changefreq: 'monthly' as const,
      },
    };

    const errors = validateRouteConfig(validRoute);
    expect(errors).toHaveLength(0);

    const invalidRoute = {
      path: 'users', // Missing leading slash
      filePath: '',
      params: [],
      isDynamic: false,
      isCatchAll: false,
      layoutPath: undefined,
      pagePath: '',
      methods: [],
      meta: {
        indexable: true,
        priority: 0.5,
        changefreq: 'monthly' as const,
      },
    };

    const invalidErrors = validateRouteConfig(invalidRoute);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });

  test('should sort routes by specificity', () => {
    const routes = [
      {
        path: '/users/[id]',
        filePath: '/app/routes/users/[id].plk',
        params: ['id'],
        isDynamic: true,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users/[id].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
      {
        path: '/users',
        filePath: '/app/routes/users.plk',
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users.plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    const sorted = sortRoutesBySpecificity(routes);

    expect(sorted[0]?.path).toBe('/users'); // Static route first
    expect(sorted[1]?.path).toBe('/users/[id]'); // Dynamic route second
  });

  test('should find route by path', () => {
    const routes = [
      {
        path: '/users',
        filePath: '/app/routes/users.plk',
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users.plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
      {
        path: '/users/[id]',
        filePath: '/app/routes/users/[id].plk',
        params: ['id'],
        isDynamic: true,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users/[id].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    const exactMatch = findRouteByPath(routes, '/users');
    expect(exactMatch?.path).toBe('/users');

    const dynamicMatch = findRouteByPath(routes, '/users/123');
    expect(dynamicMatch?.path).toBe('/users/[id]');

    const noMatch = findRouteByPath(routes, '/nonexistent');
    expect(noMatch).toBeNull();
  });

  test('should build nested layout configuration', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'layout',
        path: '/app/routes/layout.plk',
        routePath: '/',
        name: 'layout',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
      {
        type: 'layout',
        path: '/app/routes/users/layout.plk',
        routePath: '/users',
        name: 'layout',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const layouts = buildLayoutConfig(files);

    expect(layouts).toHaveLength(2);
    expect(layouts[0]?.isRoot).toBe(true);
    expect(layouts[1]?.isRoot).toBe(false);
  });

  test('should handle catch-all routes', () => {
    const routes = [
      {
        path: '/posts/[...slug]',
        filePath: '/app/routes/posts/[...slug].plk',
        params: ['...slug'],
        isDynamic: true,
        isCatchAll: true,
        layoutPath: undefined,
        pagePath: '/app/routes/posts/[...slug].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    const catchAllMatch = findRouteByPath(routes, '/posts/hello/world');
    expect(catchAllMatch?.path).toBe('/posts/[...slug]');

    // /posts should match the catch-all route /posts/[...slug] with empty slug
    const emptyCatchAllMatch = findRouteByPath(routes, '/posts');
    expect(emptyCatchAllMatch).toBe(routes[0]); // Should match the catch-all route
  });

  test('should handle optional parameters', () => {
    const routes = [
      {
        path: '/users/[[id]]',
        filePath: '/app/routes/users/[[id]].plk',
        params: ['?id'],
        isDynamic: true,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users/[[id]].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    const withParam = findRouteByPath(routes, '/users/123');
    expect(withParam?.path).toBe('/users/[[id]]');

    const withoutParam = findRouteByPath(routes, '/users');
    expect(withoutParam?.path).toBe('/users/[[id]]');
  });

  test('should handle complex route configurations', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'page',
        name: 'index',
        path: '/app/routes/index.plk',
        routePath: '/',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
      {
        type: 'page',
        name: '[id]',
        path: '/app/routes/users/[id].plk',
        routePath: '/users/[id]',
        isDynamic: true,
        isCatchAll: false,
        params: ['id'],
      },
      {
        type: 'page',
        name: '[...slug]',
        path: '/app/routes/posts/[...slug].plk',
        routePath: '/posts/[...slug]',
        isDynamic: true,
        isCatchAll: true,
        params: ['...slug'],
      },
      {
        type: 'layout',
        name: 'layout',
        path: '/app/routes/layout.plk',
        routePath: '/',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const routes = buildRouteConfig(files);
    const layouts = buildLayoutConfig(files);

    expect(routes).toHaveLength(3);
    expect(layouts).toHaveLength(1);

    // Test route sorting by specificity
    const sortedRoutes = sortRoutesBySpecificity(routes);
    expect(sortedRoutes[0]?.path).toBe('/');
    expect(sortedRoutes[1]?.path).toBe('/posts/[...slug]'); // Catch-all routes come after static
    expect(sortedRoutes[2]?.path).toBe('/users/[id]');
  });

  test('should handle route matching edge cases', () => {
    const routes = [
      {
        path: '/users/[id]',
        filePath: '/app/routes/users/[id].plk',
        params: ['id'],
        isDynamic: true,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '/app/routes/users/[id].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    // Test edge cases
    expect(findRouteByPath(routes, '/users')).toBeNull();
    expect(findRouteByPath(routes, '/users/')).toBeNull();
    expect(findRouteByPath(routes, '/users/123')).toBe(routes[0]);
    expect(findRouteByPath(routes, '/users/123/')).toBe(routes[0]); // Trailing slash should still match
    expect(findRouteByPath(routes, '/users/123/posts')).toBeNull();
  });

  test('should handle layout configuration edge cases', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'layout',
        name: 'layout',
        path: '/app/routes/layout.plk',
        routePath: '/',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
      {
        type: 'layout',
        name: 'layout',
        path: '/app/routes/users/layout.plk',
        routePath: '/users',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const layouts = buildLayoutConfig(files);
    expect(layouts).toHaveLength(2);

    // Test layout hierarchy
    const rootLayout = layouts.find((l) => l.name === 'layout' && l.isRoot);
    const usersLayout = layouts.find((l) => l.name === 'layout' && !l.isRoot);

    expect(rootLayout).toBeDefined();
    expect(usersLayout).toBeDefined();
    // The parent should be the route path of the parent layout
    expect(usersLayout?.parent).toBe('/users'); // This is the actual parent path
  });

  test('should validate route configuration data', () => {
    const files: RouteFileInfo[] = [
      {
        type: 'page',
        name: 'index',
        path: '/app/routes/index.plk',
        routePath: '/',
        isDynamic: false,
        isCatchAll: false,
        params: [],
      },
    ];

    const routes = buildRouteConfig(files);
    const route = routes[0];

    // Test route properties
    expect(route?.path).toBe('/');
    expect(route?.isDynamic).toBe(false);
    expect(route?.isCatchAll).toBe(false);
    expect(route?.params).toEqual([]);
    expect(route?.meta).toBeDefined();
    expect(route?.meta.layoutChain).toBeUndefined();
  });

  test('should handle empty file arrays', () => {
    const routes = buildRouteConfig([]);
    const layouts = buildLayoutConfig([]);

    expect(routes).toHaveLength(0);
    expect(layouts).toHaveLength(0);
  });

  test('should handle route matching with complex patterns', () => {
    const routes = [
      {
        path: '/api/[...slug]',
        filePath: '/app/routes/api/[...slug].plk',
        params: ['...slug'],
        isDynamic: true,
        isCatchAll: true,
        layoutPath: undefined,
        pagePath: '/app/routes/api/[...slug].plk',
        methods: ['GET'],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    // Test catch-all matching
    // /api should match the catch-all route /api/[...slug] with empty slug
    expect(findRouteByPath(routes, '/api')).toBe(routes[0]);
    expect(findRouteByPath(routes, '/api/users')).toBe(routes[0]);
    expect(findRouteByPath(routes, '/api/users/123')).toBe(routes[0]);
    expect(findRouteByPath(routes, '/api/users/123/posts')).toBe(routes[0]);
  });

  test('should handle route validation with various error cases', () => {
    const invalidRoutes = [
      {
        path: 'users', // Missing leading slash
        filePath: '',
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '',
        methods: [],
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
      {
        path: '/users',
        filePath: '', // Empty file path
        params: [],
        isDynamic: false,
        isCatchAll: false,
        layoutPath: undefined,
        pagePath: '',
        methods: [], // Empty methods
        meta: {
          indexable: true,
          priority: 0.5,
          changefreq: 'monthly' as const,
        },
      },
    ];

    for (const route of invalidRoutes) {
      const errors = validateRouteConfig(route);
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});
