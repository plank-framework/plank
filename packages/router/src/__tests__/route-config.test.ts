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
});
