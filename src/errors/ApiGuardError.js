class ApiGuardError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} statusCode
   * @param {unknown} [details=null]
   */
  constructor(code, message, statusCode, details = null) {
    super(message);
    this.name = 'ApiGuardError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, ApiGuardError);
  }
}

module.exports = { ApiGuardError };
