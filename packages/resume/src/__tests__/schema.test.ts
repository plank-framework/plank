/**
 * @fileoverview Tests for resumability schema
 */

import { describe, expect, it } from 'vitest';
import { RESUME_SCHEMA_VERSION } from '../schema.js';

describe('Resumability Schema', () => {
  describe('RESUME_SCHEMA_VERSION', () => {
    it('should have valid semantic version', () => {
      expect(RESUME_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should start with version 1.0.0', () => {
      expect(RESUME_SCHEMA_VERSION).toBe('1.0.0');
    });
  });
});
