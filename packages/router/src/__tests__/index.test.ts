/**
 * @fileoverview Tests for router package exports
 */

import { describe, expect, test } from 'vitest';
import * as Router from '../index.js';

describe('Router Package Exports', () => {
  test('should export FileBasedRouter', () => {
    expect(Router.FileBasedRouter).toBeDefined();
  });

  test('should export createRouter', () => {
    expect(Router.createRouter).toBeDefined();
  });

  test('should export defaultRouterConfig', () => {
    expect(Router.defaultRouterConfig).toBeDefined();
  });

  test('should export route discovery functions', () => {
    expect(Router.discoverRouteFiles).toBeDefined();
    expect(Router.validateRoutePath).toBeDefined();
    expect(Router.normalizeRoutePath).toBeDefined();
    expect(Router.matchesRoutePattern).toBeDefined();
  });

  test('should export route configuration functions', () => {
    expect(Router.buildRouteConfig).toBeDefined();
    expect(Router.buildLayoutConfig).toBeDefined();
    expect(Router.validateRouteConfig).toBeDefined();
    expect(Router.sortRoutesBySpecificity).toBeDefined();
    expect(Router.findRouteByPath).toBeDefined();
  });

  test('should export manifest generation functions', () => {
    expect(Router.generateRouteManifest).toBeDefined();
    expect(Router.generateSitemap).toBeDefined();
    expect(Router.generateRobotsTxt).toBeDefined();
    expect(Router.generateRouteTypes).toBeDefined();
    expect(Router.validateManifest).toBeDefined();
    expect(Router.loadManifest).toBeDefined();
  });
});
