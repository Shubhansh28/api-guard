const { ApiGuardError } = require('../errors/ApiGuardError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Validate selected request properties with Zod schemas.
 * Parsed values replace the corresponding Express request property.
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
    const parsed = {};
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
      parsed[key] = result.data;
    }
    for (const [key, value] of Object.entries(parsed)) req[key] = value;
    return next();
  };
}

module.exports = { validateRequest };
