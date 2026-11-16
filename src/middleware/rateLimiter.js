const { MemoryStore } = require('../stores/memoryStore');
const { ApiGuardError } = require('../errors/ApiGuardError');
const ERROR_CODES = require('../constants/errorCodes');

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('rateLimit options must be an object');
  }
  if (!Number.isInteger(options.windowMs) || options.windowMs <= 0) {
    throw new TypeError('rateLimit windowMs must be a positive integer');
  }
  if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
    throw new TypeError('rateLimit maxRequests must be a positive integer');
  }
  if (options.message !== undefined && typeof options.message !== 'string') {
    throw new TypeError('rateLimit message must be a string');
  }
  if (options.statusCode !== undefined && (!Number.isInteger(options.statusCode) || options.statusCode < 400)) {
    throw new TypeError('rateLimit statusCode must be an integer >= 400');
  }
  for (const name of ['keyGenerator', 'skip']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') {
      throw new TypeError(`rateLimit ${name} must be a function`);
    }
  }
  if (options.store !== undefined && (typeof options.store !== 'object' || typeof options.store.increment !== 'function')) {
    throw new TypeError('rateLimit store must provide an increment function');
  }
}

/**
 * Fixed-window in-memory (or compatible store) rate limiting middleware.
 * @param {object} options
 * @returns {import('express').RequestHandler}
 */
function rateLimit(options = {}) {
  validateOptions(options);
  const config = {
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
    message: options.message || 'Too many requests',
    statusCode: options.statusCode || 429,
    keyGenerator: options.keyGenerator || ((req) => req.ip || req.socket?.remoteAddress || 'unknown'),
    skip: options.skip || (() => false),
    standardHeaders: options.standardHeaders !== false,
    legacyHeaders: options.legacyHeaders === true,
    store: options.store || new MemoryStore()
  };

  return (req, res, next) => {
    Promise.resolve()
      .then(() => config.skip(req))
      .then((skip) => {
        if (skip) return next();
        return Promise.resolve(config.keyGenerator(req)).then((key) => {
          if (typeof key !== 'string' || key.length === 0) {
            throw new TypeError('rateLimit keyGenerator must return a non-empty string');
          }
          return config.store.increment(key, config.windowMs);
        });
      })
      .then((result) => {
        if (!result) return;
        if (!Number.isInteger(result.totalHits) || !(result.resetTime instanceof Date)) {
          throw new TypeError('rateLimit store.increment must return totalHits and resetTime');
        }
        const remaining = Math.max(0, config.maxRequests - result.totalHits);
        const resetSeconds = Math.max(0, Math.ceil((result.resetTime.getTime() - Date.now()) / 1000));
        if (config.standardHeaders) {
          res.setHeader('RateLimit-Limit', config.maxRequests);
          res.setHeader('RateLimit-Remaining', remaining);
          res.setHeader('RateLimit-Reset', resetSeconds);
        }
        if (config.legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', config.maxRequests);
          res.setHeader('X-RateLimit-Remaining', remaining);
          res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000));
        }
        if (result.totalHits > config.maxRequests) {
          res.setHeader('Retry-After', resetSeconds);
          return next(new ApiGuardError(ERROR_CODES.RATE_LIMIT_EXCEEDED, config.message, config.statusCode, {
            limit: config.maxRequests,
            remaining: 0,
            resetTime: result.resetTime.toISOString()
          }));
        }
        return next();
      })
      .catch(next);
  };
}

module.exports = { rateLimit };
