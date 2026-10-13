/**
 * An expected, client-facing error. Throw it anywhere in a request handler;
 * the central error middleware turns it into a JSON response:
 *   { error: { message, code, details? } }
 */
export class AppError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code ?? defaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message = 'Bad request', code, details) {
    return new AppError(400, message, { code, details });
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(401, message, { code });
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(403, message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(404, message, { code });
  }

  static conflict(message = 'Resource already exists', code = 'CONFLICT') {
    return new AppError(409, message, { code });
  }
}

function defaultCode(statusCode) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      429: 'RATE_LIMITED',
    }[statusCode] ?? 'INTERNAL_ERROR'
  );
}
