import { describe, it, expect } from 'vitest';
import {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  payloadTooLarge,
  unsupportedMediaType,
  internalError,
  toAppError,
  appErrorToResponse,
} from '../errors';

describe('AppError', () => {
  it('constructs with message, code, statusCode, details', () => {
    const err = new AppError('test message', 'TEST_CODE', 418, { key: 'value' });
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.details).toEqual({ key: 'value' });
    expect(err.name).toBe('AppError');
  });

  it('defaults statusCode to 400', () => {
    const err = new AppError('msg', 'CODE');
    expect(err.statusCode).toBe(400);
  });
});

describe('error factories', () => {
  it('badRequest returns 400', () => {
    const err = badRequest('bad', { field: 'x' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.details).toEqual({ field: 'x' });
  });

  it('unauthorized returns 401', () => {
    const err = unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });

  it('forbidden returns 403', () => {
    const err = forbidden('no access');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('notFound returns 404', () => {
    const err = notFound('missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('tooManyRequests returns 429 with reset', () => {
    const err = tooManyRequests('slow down', 60);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.details).toEqual({ reset: 60 });
  });

  it('payloadTooLarge returns 413', () => {
    const err = payloadTooLarge('too big');
    expect(err.statusCode).toBe(413);
  });

  it('unsupportedMediaType returns 415', () => {
    const err = unsupportedMediaType('not pdf');
    expect(err.statusCode).toBe(415);
  });

  it('internalError returns 500', () => {
    const err = internalError('boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('toAppError', () => {
  it('returns same AppError if already AppError', () => {
    const original = badRequest('original');
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it('wraps Error into internalError', () => {
    const result = toAppError(new Error('wrapped'));
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('wrapped');
  });

  it('handles unknown values', () => {
    const result = toAppError('string error');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('Unknown error');
  });
});

describe('appErrorToResponse', () => {
  it('converts AppError to response object', () => {
    const err = badRequest('invalid', { field: 'email' });
    const response = appErrorToResponse(err);
    expect(response.error).toBe('invalid');
    expect(response.code).toBe('BAD_REQUEST');
    expect(response.details).toEqual({ field: 'email' });
  });
});