/**
 * @fileoverview Tests for response handler
 */

import { ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import { sendError } from '../response-handler.js';

describe('sendError', () => {
  it('should send production error page', () => {
    const socket = new Socket();
    const res = new ServerResponse(socket as never);

    let sentData = '';
    res.write = (chunk: unknown) => {
      sentData += String(chunk);
      return true;
    };
    res.end = ((data?: unknown) => {
      if (data && typeof data === 'string') {
        sentData += data;
      }
      return res;
    }) as never;

    sendError(new Error('Test error'), res, false);

    expect(res.statusCode).toBe(500);
    expect(sentData).toContain('500 - Internal Server Error');
    expect(sentData).not.toContain('Test error');
  });

  it('should send development error page with stack', () => {
    const socket = new Socket();
    const res = new ServerResponse(socket as never);

    let sentData = '';
    res.write = (chunk: unknown) => {
      sentData += String(chunk);
      return true;
    };
    res.end = ((data?: unknown) => {
      if (data && typeof data === 'string') {
        sentData += data;
      }
      return res;
    }) as never;

    sendError(new Error('Test error'), res, true);

    expect(res.statusCode).toBe(500);
    expect(sentData).toContain('Internal Server Error');
    expect(sentData).toContain('Test error');
  });
});
