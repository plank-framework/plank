/**
 * @fileoverview Security utilities for Edge adapter
 */

/**
 * Content Security Policy configurations
 */
export interface CSPConfig {
  /** Default CSP policy */
  default?: string;
  /** CSP for development */
  development?: string;
  /** CSP for production */
  production?: string;
  /** Report-only mode */
  reportOnly?: boolean;
  /** Report URI for CSP violations */
  reportUri?: string;
}

/**
 * Security headers configuration
 */
export interface SecurityHeaders {
  /** Content Security Policy */
  csp?: CSPConfig;
  /** X-Frame-Options */
  frameOptions?: string;
  /** X-Content-Type-Options */
  contentTypeOptions?: string;
  /** X-XSS-Protection */
  xssProtection?: string;
  /** Referrer-Policy */
  referrerPolicy?: string;
  /** Permissions-Policy */
  permissionsPolicy?: string;
  /** Strict-Transport-Security */
  hsts?: string;
  /** Cross-Origin-Embedder-Policy */
  coep?: string;
  /** Cross-Origin-Opener-Policy */
  coop?: string;
  /** Cross-Origin-Resource-Policy */
  corp?: string;
}

/**
 * Error page templates
 */
export interface ErrorTemplates {
  /** 400 Bad Request */
  badRequest?: (error: Error) => string;
  /** 401 Unauthorized */
  unauthorized?: (error: Error) => string;
  /** 403 Forbidden */
  forbidden?: (error: Error) => string;
  /** 404 Not Found */
  notFound?: (error: Error) => string;
  /** 429 Too Many Requests */
  tooManyRequests?: (error: Error) => string;
  /** 500 Internal Server Error */
  internalServerError?: (error: Error) => string;
  /** 502 Bad Gateway */
  badGateway?: (error: Error) => string;
  /** 503 Service Unavailable */
  serviceUnavailable?: (error: Error) => string;
  /** 504 Gateway Timeout */
  gatewayTimeout?: (error: Error) => string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled?: boolean;
  /** Requests per window */
  requests?: number;
  /** Time window in seconds */
  window?: number;
  /** Rate limit key function */
  keyFunction?: (request: Request) => string;
  /** Custom rate limit headers */
  headers?: Record<string, string>;
}

/**
 * Security manager for Edge adapter
 */
export class SecurityManager {
  private securityHeaders: Required<SecurityHeaders>;
  private errorTemplates: Required<ErrorTemplates>;
  private rateLimitConfig: Required<RateLimitConfig>;

  constructor(
    securityHeaders: SecurityHeaders = {},
    errorTemplates: ErrorTemplates = {},
    rateLimitConfig: RateLimitConfig = {}
  ) {
    this.securityHeaders = this.initializeSecurityHeaders(securityHeaders);
    this.errorTemplates = this.initializeErrorTemplates(errorTemplates);
    this.rateLimitConfig = this.initializeRateLimitConfig(rateLimitConfig);
  }

  /**
   * Initialize security headers
   */
  private initializeSecurityHeaders(securityHeaders: SecurityHeaders): Required<SecurityHeaders> {
    return {
      csp: securityHeaders.csp ?? this.getDefaultCSP(),
      frameOptions: securityHeaders.frameOptions ?? 'DENY',
      contentTypeOptions: securityHeaders.contentTypeOptions ?? 'nosniff',
      xssProtection: securityHeaders.xssProtection ?? '1; mode=block',
      referrerPolicy: securityHeaders.referrerPolicy ?? 'strict-origin-when-cross-origin',
      permissionsPolicy: securityHeaders.permissionsPolicy ?? this.getDefaultPermissionsPolicy(),
      hsts: securityHeaders.hsts ?? 'max-age=31536000; includeSubDomains',
      coep: securityHeaders.coep ?? 'require-corp',
      coop: securityHeaders.coop ?? 'same-origin',
      corp: securityHeaders.corp ?? 'same-origin',
    };
  }

  /**
   * Initialize error templates
   */
  private initializeErrorTemplates(errorTemplates: ErrorTemplates): Required<ErrorTemplates> {
    return {
      badRequest: errorTemplates.badRequest ?? this.getDefaultErrorTemplate(400, 'Bad Request'),
      unauthorized:
        errorTemplates.unauthorized ?? this.getDefaultErrorTemplate(401, 'Unauthorized'),
      forbidden: errorTemplates.forbidden ?? this.getDefaultErrorTemplate(403, 'Forbidden'),
      notFound: errorTemplates.notFound ?? this.getDefaultErrorTemplate(404, 'Not Found'),
      tooManyRequests:
        errorTemplates.tooManyRequests ?? this.getDefaultErrorTemplate(429, 'Too Many Requests'),
      internalServerError:
        errorTemplates.internalServerError ??
        this.getDefaultErrorTemplate(500, 'Internal Server Error'),
      badGateway: errorTemplates.badGateway ?? this.getDefaultErrorTemplate(502, 'Bad Gateway'),
      serviceUnavailable:
        errorTemplates.serviceUnavailable ??
        this.getDefaultErrorTemplate(503, 'Service Unavailable'),
      gatewayTimeout:
        errorTemplates.gatewayTimeout ?? this.getDefaultErrorTemplate(504, 'Gateway Timeout'),
    };
  }

  /**
   * Initialize rate limit config
   */
  private initializeRateLimitConfig(rateLimitConfig: RateLimitConfig): Required<RateLimitConfig> {
    return {
      enabled: rateLimitConfig.enabled ?? true,
      requests: rateLimitConfig.requests ?? 100,
      window: rateLimitConfig.window ?? 60,
      keyFunction: rateLimitConfig.keyFunction ?? this.getDefaultRateLimitKey,
      headers: rateLimitConfig.headers ?? {},
    };
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(response: Response, isDev = false): Response {
    const headers = new Headers(response.headers);

    // Add CSP header
    this.addCSPHeader(headers, isDev);

    // Add other security headers
    this.addStandardSecurityHeaders(headers);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Add CSP header
   */
  private addCSPHeader(headers: Headers, isDev: boolean): void {
    const csp = this.getCSPHeader(isDev);
    if (csp) {
      const cspHeader = this.securityHeaders.csp.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      headers.set(cspHeader, csp);
    }
  }

  /**
   * Add standard security headers
   */
  private addStandardSecurityHeaders(headers: Headers): void {
    headers.set('X-Frame-Options', this.securityHeaders.frameOptions);
    headers.set('X-Content-Type-Options', this.securityHeaders.contentTypeOptions);
    headers.set('X-XSS-Protection', this.securityHeaders.xssProtection);
    headers.set('Referrer-Policy', this.securityHeaders.referrerPolicy);
    headers.set('Permissions-Policy', this.securityHeaders.permissionsPolicy);
    headers.set('Strict-Transport-Security', this.securityHeaders.hsts);
    headers.set('Cross-Origin-Embedder-Policy', this.securityHeaders.coep);
    headers.set('Cross-Origin-Opener-Policy', this.securityHeaders.coop);
    headers.set('Cross-Origin-Resource-Policy', this.securityHeaders.corp);
  }

  /**
   * Create error response with appropriate template
   */
  createErrorResponse(status: number, error: Error, isDev = false): Response {
    let template: (error: Error) => string;

    switch (status) {
      case 400:
        template = this.errorTemplates.badRequest;
        break;
      case 401:
        template = this.errorTemplates.unauthorized;
        break;
      case 403:
        template = this.errorTemplates.forbidden;
        break;
      case 404:
        template = this.errorTemplates.notFound;
        break;
      case 429:
        template = this.errorTemplates.tooManyRequests;
        break;
      case 500:
        template = this.errorTemplates.internalServerError;
        break;
      case 502:
        template = this.errorTemplates.badGateway;
        break;
      case 503:
        template = this.errorTemplates.serviceUnavailable;
        break;
      case 504:
        template = this.errorTemplates.gatewayTimeout;
        break;
      default:
        template = this.errorTemplates.internalServerError;
    }

    const html = template(error);
    const response = new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

    return this.addSecurityHeaders(response, isDev);
  }

  /**
   * Check rate limit for request
   */
  async checkRateLimit(
    request: Request,
    _env: unknown
  ): Promise<{ allowed: boolean; headers: Record<string, string> }> {
    if (!this.rateLimitConfig.enabled) {
      return { allowed: true, headers: {} };
    }

    this.rateLimitConfig.keyFunction(request);
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / this.rateLimitConfig.window);

    // In a real implementation, you'd use a KV store or cache
    // For now, we'll simulate rate limiting
    const current = 0; // await env.RATE_LIMIT_KV?.get(rateLimitKey) || 0;
    const newCount = current + 1;

    if (newCount > this.rateLimitConfig.requests) {
      const resetTime = (window + 1) * this.rateLimitConfig.window;
      const retryAfter = resetTime - now;

      return {
        allowed: false,
        headers: {
          'X-RateLimit-Limit': this.rateLimitConfig.requests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': retryAfter.toString(),
          ...this.rateLimitConfig.headers,
        },
      };
    }

    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': this.rateLimitConfig.requests.toString(),
        'X-RateLimit-Remaining': (this.rateLimitConfig.requests - newCount).toString(),
        'X-RateLimit-Reset': ((window + 1) * this.rateLimitConfig.window).toString(),
      },
    };
  }

  /**
   * Get CSP header based on environment
   */
  private getCSPHeader(isDev: boolean): string {
    const csp = isDev ? this.securityHeaders.csp.development : this.securityHeaders.csp.production;
    return csp || this.securityHeaders.csp.default || '';
  }

  /**
   * Get default CSP configuration
   */
  private getDefaultCSP(): CSPConfig {
    return {
      default:
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
      development:
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';",
      production:
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
      reportOnly: false,
    };
  }

  /**
   * Get default permissions policy
   */
  private getDefaultPermissionsPolicy(): string {
    return 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()';
  }

  /**
   * Get default error template
   */
  private getDefaultErrorTemplate(status: number, title: string): (error: Error) => string {
    return (error: Error) => `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${status} - ${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 2rem;
              background: #f8fafc;
              color: #334155;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .error-code {
              font-size: 4rem;
              font-weight: 700;
              color: #ef4444;
              margin: 0;
            }
            .error-title {
              font-size: 1.5rem;
              font-weight: 600;
              margin: 0.5rem 0 1rem 0;
            }
            .error-message {
              color: #64748b;
              margin-bottom: 1.5rem;
            }
            .error-details {
              background: #f1f5f9;
              padding: 1rem;
              border-radius: 4px;
              font-family: 'Monaco', 'Menlo', monospace;
              font-size: 0.875rem;
              white-space: pre-wrap;
              overflow-x: auto;
            }
            .back-link {
              display: inline-block;
              color: #3b82f6;
              text-decoration: none;
              font-weight: 500;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error-code">${status}</h1>
            <h2 class="error-title">${title}</h2>
            <p class="error-message">
              ${this.getErrorMessage(status)}
            </p>
            ${error.message ? `<div class="error-details">${error.message}</div>` : ''}
            <a href="/" class="back-link">← Go back to home</a>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get error message for status code
   */
  private getErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'The request was invalid or cannot be served.',
      401: 'Authentication is required to access this resource.',
      403: 'You do not have permission to access this resource.',
      404: 'The requested resource was not found.',
      429: 'Too many requests. Please try again later.',
      500: 'An internal server error occurred.',
      502: 'The server received an invalid response from an upstream server.',
      503: 'The server is temporarily unavailable.',
      504: 'The server did not receive a timely response from an upstream server.',
    };
    return messages[status] || 'An error occurred.';
  }

  /**
   * Get default rate limit key
   */
  private getDefaultRateLimitKey(request: Request): string {
    // Use IP address as default rate limit key
    const ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      request.headers.get('X-Real-IP') ||
      'unknown';
    return ip;
  }
}
