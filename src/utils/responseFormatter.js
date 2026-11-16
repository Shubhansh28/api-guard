/**
 * Create the package's stable error response shape.
 * @param {string} code
 * @param {string} message
 * @param {unknown} [details=null]
 * @returns {{success: false, error: {code: string, message: string, details: unknown}}}
 */
function formatErrorResponse(code, message, details = null) {
  return {
    success: false,
    error: { code, message, details }
  };
}

module.exports = { formatErrorResponse };
