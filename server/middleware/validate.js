import { AppError } from '../utils/AppError.js';

export function formatZodIssues(error) {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * Validate request parts with zod schemas, e.g. validate({ body: schema, params: schema }).
 * Parsed (coerced, trimmed, defaulted) values are placed on `req.validated[part]`;
 * handlers should read from there rather than from the raw request.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.validated ??= {};
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      throw new AppError(400, 'Please check the highlighted fields', {
        code: 'VALIDATION_ERROR',
        details: formatZodIssues(result.error),
      });
    }
    req.validated[part] = result.data;
  }
  next();
};
