/**
 * @fileoverview Tests for dev-server package exports
 */

import { describe, expect, test } from 'vitest';
import * as DevServer from '../index.js';

describe('Dev-Server Package Exports', () => {
  test('should export PlankDevServer', () => {
    expect(DevServer.PlankDevServer).toBeDefined();
  });

  test('should export createDevServer', () => {
    expect(DevServer.createDevServer).toBeDefined();
  });

  test('should export defaultDevServerConfig', () => {
    expect(DevServer.defaultDevServerConfig).toBeDefined();
  });

  test('should export plankPlugin', () => {
    expect(DevServer.plankPlugin).toBeDefined();
  });

  test('should export error overlay functions', () => {
    expect(DevServer.generateErrorOverlay).toBeDefined();
    expect(DevServer.generateErrorOverlayScript).toBeDefined();
    expect(DevServer.createErrorOverlay).toBeDefined();
    expect(DevServer.createWarningOverlay).toBeDefined();
  });
});
