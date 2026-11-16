const { ApiGuardError } = require('./ApiGuardError');
const ERROR_CODES = require('../constants/errorCodes');
const { formatErrorResponse } = require('../utils/responseFormatter');

/**
 * Express error middleware. Put this after all routes and middleware.
 * @param {{exposeDetails?: boolean}} [options]
 * @returns {import('express').ErrorRequestHandler}
 */
function errorHandler(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('errorHandler options must be an object');
  }
  if (options.exposeDetails !== undefined && typeof options.exposeDetails !== 'boolean') {
    throw new TypeError('errorHandler exposeDetails must be a boolean');
  }
  const exposeDetails = options.exposeDetails === true;

  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const isApiError = error instanceof ApiGuardError;
    const statusCode = isApiError && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
    const code = isApiError ? error.code : ERROR_CODES.INTERNAL_ERROR;
    const message = isApiError ? error.message : 'Internal server error';
    const details = isApiError && exposeDetails ? error.details : null;
    res.status(statusCode).json(formatErrorResponse(code, message, details));
  };
}

module.exports = { errorHandler };
