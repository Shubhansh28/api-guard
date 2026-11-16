const { ApiGuardError } = require('../errors/ApiGuardError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Validate selected request properties with Zod schemas.
 * Parsed values are exposed under req.validated without mutating Express request properties.
 * @param {{body?: object, query?: object, params?: object}} schemas
 * @returns {import('express').RequestHandler}
 */
function validateRequest(schemas = {}) {
  if (!schemas || typeof schemas !== 'object' || Array.isArray(schemas)) {
    throw new TypeError('validateRequest schemas must be an object');
  }
  for (const key of ['body', 'query', 'params']) {
    if (schemas[key] !== undefined || key in schemas) {
      if (!schemas[key] || typeof schemas[key].safeParse !== 'function') {
        throw new TypeError(`validateRequest ${key} must be a Zod schema`);
      }
    }
  }
  return (req, res, next) => {
    const validated = {};
    for (const key of ['body', 'query', 'params']) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          path: [key, ...issue.path],
          message: issue.message,
          code: issue.code
        }));
        return next(new ApiGuardError(ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', 400, details));
      }
      validated[key] = result.data;
    }
    req.validated = validated;
    return next();
  };
}

module.exports = { validateRequest };
