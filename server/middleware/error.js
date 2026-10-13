import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/** Map known library errors onto AppError so clients get consistent responses. */
function normalizeError(err) {
  if (err instanceof AppError) return err;

  // body-parser errors
  if (err.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON', 'INVALID_JSON');
  if (err.type === 'entity.too.large') return new AppError(413, 'Request body is too large');

  if (err instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`Invalid value for "${err.path}"`, 'INVALID_ID');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return AppError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
  }
  if (err?.code === 11000) return AppError.conflict('A record with these details already exists');

  return null;
}

// Express recognizes error middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const known = normalizeError(err);
  const status = known?.statusCode ?? 500;

  if (status >= 500) {
    req.log?.error({ err }, 'Unhandled error');
  } else {
    req.log?.debug({ err: { message: err.message, code: known?.code } }, 'Request failed');
  }

  const body = {
    error: {
      message: known?.message ?? (config.isProd ? 'Something went wrong. Please try again.' : err.message),
      code: known?.code ?? 'INTERNAL_ERROR',
      ...(known?.details && { details: known.details }),
    },
  };

  if (!known && !config.isProd) body.error.stack = err.stack;
  res.status(status).json(body);
}
