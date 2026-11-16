const { ApiGuardError } = require('../errors/ApiGuardError');
const ERROR_CODES = require('../constants/errorCodes');
const { normalizeIp, defaultIpResolver } = require('../utils/ipUtils');

function normalizeList(value, name) {
  if (value === undefined) return new Set();
  if (!Array.isArray(value)) throw new TypeError(`ipBlocker ${name} must be an array`);
  const result = new Set();
  for (const item of value) {
    const ip = normalizeIp(item);
    if (!ip) throw new TypeError(`ipBlocker ${name} contains an invalid IP address`);
    result.add(ip);
  }
  return result;
}

/**
 * Block exact IP addresses. Allowlisted addresses always take precedence.
 * @param {object} [options]
 * @returns {import('express').RequestHandler}
 */
function ipBlocker(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('ipBlocker options must be an object');
  }
  const blockedIPs = normalizeList(options.blockedIPs, 'blockedIPs');
  const allowedIPs = normalizeList(options.allowedIPs, 'allowedIPs');
  if (options.message !== undefined && typeof options.message !== 'string') {
    throw new TypeError('ipBlocker message must be a string');
  }
  if (options.statusCode !== undefined && (!Number.isInteger(options.statusCode) || options.statusCode < 400)) {
    throw new TypeError('ipBlocker statusCode must be an integer >= 400');
  }
  if (options.ipResolver !== undefined && typeof options.ipResolver !== 'function') {
    throw new TypeError('ipBlocker ipResolver must be a function');
  }
  const resolver = options.ipResolver || defaultIpResolver;
  const message = options.message || 'Access denied';
  const statusCode = options.statusCode || 403;

  return (req, res, next) => {
    const ip = normalizeIp(resolver(req));
    if (!ip) return next(new TypeError('ipBlocker IP resolver must return a valid IP address'));
    if (!allowedIPs.has(ip) && blockedIPs.has(ip)) {
      return next(new ApiGuardError(ERROR_CODES.IP_BLOCKED, message, statusCode, { ip }));
    }
    return next();
  };
}

module.exports = { ipBlocker };
