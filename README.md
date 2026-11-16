# api-guard-js

Lightweight, modular Express middleware for common API protections: fixed-window rate limiting, exact IP blocking, Zod request validation, and consistent JSON errors.

> This package is application middleware, not a distributed rate limiter or a complete DDoS protection solution. The default store is process-local memory.

## Installation

```sh
npm install api-guard-js express
```

`zod` is a runtime dependency and is installed automatically. Express is a peer dependency, so your application controls its Express 4 or Express 5 version.

## Quick start

### CommonJS

```js
const express = require('express');
const { rateLimit, ipBlocker, errorHandler } = require('api-guard-js');

const app = express();
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));
app.use(ipBlocker({ blockedIPs: ['192.0.2.10'] }));
app.get('/health', (req, res) => res.json({ success: true }));
app.use(errorHandler());
```

### ES modules

```js
import express from 'express';
import { rateLimit, errorHandler } from 'api-guard-js';
```

## Rate limiting

`rateLimit(options)` uses a fixed window. Every key has one counter and reset time.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `windowMs` | positive integer | required | Window duration in milliseconds. |
| `maxRequests` | positive integer | required | Allowed requests per key and window. |
| `message` | string | `Too many requests` | Error message. |
| `statusCode` | integer | `429` | Response status for rejected requests. |
| `keyGenerator` | function | `req.ip` | Returns a non-empty client key; may be async. |
| `skip` | function | `() => false` | Returns true to bypass a request; may be async. |
| `standardHeaders` | boolean | `true` | Sends `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`. |
| `legacyHeaders` | boolean | `false` | Sends `X-RateLimit-*` headers. |
| `store` | object | `MemoryStore` | Must implement `increment(key, windowMs)`. |

The default `MemoryStore` cleans expired entries as new keys arrive. It is safe for concurrent requests in one Node.js process, but does not share state across processes, containers, or machines. A Redis store can be added later by implementing the same store contract.

Do not use arbitrary forwarding headers as identity. If your deployment is behind a trusted proxy, configure Express explicitly, for example `app.set('trust proxy', 1)`, and then `req.ip` can reflect that trusted proxy chain. Only configure the number or addresses of proxies you actually control.

## IP blocking

```js
app.use(ipBlocker({
  blockedIPs: ['203.0.113.8', '2001:db8::8'],
  allowedIPs: ['203.0.113.8'],
  message: 'Your address is not permitted'
}));
```

`allowedIPs` takes precedence over `blockedIPs`. Exact IPv4 and IPv6 values are supported, including IPv4-mapped IPv6 normalization. CIDR ranges are intentionally not accepted in this initial release. The default resolver uses `req.ip` (then the socket address), never `X-Forwarded-For` directly. Use `ipResolver` for a controlled, application-specific resolver.

## Request validation

```js
const { z } = require('zod');
const { validateRequest } = require('api-guard-js');

app.post('/users', validateRequest({
  body: z.object({ name: z.string().min(2), email: z.string().email() }),
  query: z.object({ invite: z.string().optional() }),
  params: z.object({ id: z.string().uuid() })
}), (req, res) => {
  // req.body, req.query, and req.params contain parsed Zod output.
  res.status(201).json({ success: true, user: req.body });
});
```

Only provided schemas are checked. Successful parsed values replace the corresponding request properties. A failure returns `400` with field paths and Zod messages.

## Error responses

Put `errorHandler()` after routes:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "path": ["body", "email"], "message": "Invalid email", "code": "invalid_string" }
    ]
  }
}
```

Built-in codes are `RATE_LIMIT_EXCEEDED`, `IP_BLOCKED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, and `API_ERROR`. Unknown errors always become a generic 500 response; stack traces and internal messages are never exposed. `errorHandler({ exposeDetails: true })` exposes details attached by package errors, which should only be used when those details are safe for clients.

For application errors, use `new ApiGuardError(code, message, statusCode, details)`.

## Compatibility and security

- Supports Express 4.18+ and Express 5.
- Supports Node.js 18.18+.
- Supports CommonJS and ES module consumers through package exports.
- Validate configuration at startup; invalid options throw clear `TypeError`s.
- IP blocking is exact-match only in 0.1.x.
- The in-memory limiter is not suitable for horizontally scaled deployments without a shared store.
- Use TLS, authentication, authorization, body-size limits, logging, and infrastructure-level protections for a complete API security posture.

## Development

```sh
npm install
npm test
npm run test:coverage
npm run lint
npm run pack:check
```

Run examples with `node examples/basic.js` or `node examples/validation.js`. Publishing is intentionally manual:

```sh
npm login
npm publish
```

Review the package contents and version before publishing. See [CONTRIBUTING.md](CONTRIBUTING.md) if contributing to a checkout.

## Contributing

Keep changes focused, add tests for behavior, run lint and the full test suite, and update the changelog and README for public API changes. Do not commit credentials or generated dependency directories.

## License

MIT
