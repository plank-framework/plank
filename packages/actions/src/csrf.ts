/**
 * @fileoverview CSRF token generation and validation
 */

import { createHash, randomBytes } from 'node:crypto';
import type { CSRFConfig, CSRFTokenPayload } from './types.js';

/**
 * Default CSRF configuration
 */
const DEFAULT_CONFIG: Required<CSRFConfig> = {
  secret: process.env.PLANK_CSRF_SECRET || 'plank-default-secret-change-me',
  expiresIn: 3600, // 1 hour
  cookieName: 'plank-csrf',
  headerName: 'x-plank-csrf-token',
};

/**
 * CSRF token manager
 */
export class CSRFManager {
  private config: Required<CSRFConfig>;

  constructor(config?: Partial<CSRFConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Warn if using default secret in production
    if (
      this.config.secret === DEFAULT_CONFIG.secret &&
      process.env.NODE_ENV === 'production'
    ) {
      console.warn(
        '⚠️  Using default CSRF secret! Set PLANK_CSRF_SECRET environment variable.'
      );
    }
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(): string {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + this.config.expiresIn * 1000;

    const payload: CSRFTokenPayload = {
      token,
      expiresAt,
    };

    // Create signature
    const signature = this.sign(payload);

    // Encode payload and signature
    return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;
  }

  /**
   * Verify a CSRF token
   */
  verifyToken(token: string): boolean {
    try {
      const [encodedPayload, signature] = token.split('.');

      if (!encodedPayload || !signature) {
        return false;
      }

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString()
      ) as CSRFTokenPayload;

      // Check expiration
      if (Date.now() > payload.expiresAt) {
        return false;
      }

      // Verify signature
      const expectedSignature = this.sign(payload);
      return signature === expectedSignature;
    } catch {
      return false;
    }
  }

  /**
   * Sign a payload
   */
  private sign(payload: CSRFTokenPayload): string {
    const data = JSON.stringify(payload);
    return createHash('sha256')
      .update(data)
      .update(this.config.secret)
      .digest('base64url');
  }

  /**
   * Get cookie name for CSRF token
   */
  getCookieName(): string {
    return this.config.cookieName;
  }

  /**
   * Get header name for CSRF token
   */
  getHeaderName(): string {
    return this.config.headerName;
  }

  /**
   * Extract CSRF token from request
   */
  extractToken(headers: Record<string, string>, cookies?: Record<string, string>): string | null {
    // Try header first
    const headerToken = headers[this.config.headerName.toLowerCase()];
    if (headerToken) {
      return headerToken;
    }

    // Try cookie
    if (cookies) {
      const cookieToken = cookies[this.config.cookieName];
      if (cookieToken) {
        return cookieToken;
      }
    }

    return null;
  }
}

/**
 * Create a new CSRF manager instance
 */
export function createCSRFManager(config?: Partial<CSRFConfig>): CSRFManager {
  return new CSRFManager(config);
}
