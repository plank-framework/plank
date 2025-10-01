/**
 * @fileoverview Tests for request converter
 */

import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import { getBaseURL, nodeRequestToWebRequest } from '../request-converter.js';

describe('nodeRequestToWebRequest', () => {
  it('should convert GET request', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.url = '/test?foo=bar';
    req.method = 'GET';
    req.headers = { 'user-agent': 'test' };

    const webReq = nodeRequestToWebRequest(req, 'http://localhost:3000');

    expect(webReq.url).toBe('http://localhost:3000/test?foo=bar');
    expect(webReq.method).toBe('GET');
    expect(webReq.headers.get('user-agent')).toBe('test');
  });

  it('should handle missing URL', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = 'GET';

    const webReq = nodeRequestToWebRequest(req, 'http://localhost:3000');

    expect(webReq.url).toBe('http://localhost:3000/');
  });

  it('should handle array headers', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.url = '/';
    req.method = 'GET';
    req.headers = { 'set-cookie': ['a=1', 'b=2'] };

    const webReq = nodeRequestToWebRequest(req, 'http://localhost:3000');

    expect(webReq.headers.get('set-cookie')).toBe('a=1, b=2');
  });

  it('should handle POST with body', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.url = '/api/data';
    req.method = 'POST';
    req.headers = { 'content-type': 'application/json' };

    const webReq = nodeRequestToWebRequest(req, 'http://localhost:3000');

    expect(webReq.method).toBe('POST');
    expect(webReq.body).toBeDefined();
  });
});

describe('getBaseURL', () => {
  it('should construct HTTP base URL', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.headers = { host: 'example.com:8080' };

    const baseURL = getBaseURL(req);

    expect(baseURL).toBe('http://example.com:8080');
  });

  it('should default to localhost', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);

    const baseURL = getBaseURL(req);

    expect(baseURL).toBe('http://localhost');
  });

  it('should detect HTTPS from encrypted socket', () => {
    const socket = new Socket();
    (socket as unknown as { encrypted: boolean }).encrypted = true;
    const req = new IncomingMessage(socket);
    req.headers = { host: 'secure.example.com' };

    const baseURL = getBaseURL(req);

    expect(baseURL).toBe('https://secure.example.com');
  });
});
