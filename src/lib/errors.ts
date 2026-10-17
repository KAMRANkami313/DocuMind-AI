export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(message, 'BAD_REQUEST', 400, details);
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(message, 'UNAUTHORIZED', 401);
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(message, 'FORBIDDEN', 403);
}

export function notFound(message = 'Not found'): AppError {
  return new AppError(message, 'NOT_FOUND', 404);
}

export function tooManyRequests(
  message = 'Too many requests',
  reset?: number,
): AppError {
  return new AppError(message, 'RATE_LIMIT_EXCEEDED', 429, { reset });
}

export function payloadTooLarge(message = 'Payload too large'): AppError {
  return new AppError(message, 'PAYLOAD_TOO_LARGE', 413);
}

export function unsupportedMediaType(
  message = 'Unsupported media type',
): AppError {
  return new AppError(message, 'UNSUPPORTED_MEDIA_TYPE', 415);
}

export function internalError(message = 'Internal server error'): AppError {
  return new AppError(message, 'INTERNAL_ERROR', 500);
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return internalError(err.message);
  }
  return internalError('Unknown error');
}

export interface AppErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export function appErrorToResponse(err: AppError): AppErrorResponse {
  return {
    error: err.message,
    code: err.code,
    details: err.details,
  };
}