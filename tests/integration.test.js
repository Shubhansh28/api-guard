const express5 = require('express');
const express4 = require('express4');
const request = require('supertest');
const { z } = require('zod');
const { rateLimit, ipBlocker, validateRequest, errorHandler } = require('../src');

function createApp(express) {
  const app = express();
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, maxRequests: 1 }));
  app.use(ipBlocker({ blockedIPs: ['198.51.100.10'], allowedIPs: ['127.0.0.1'] }));
  app.post('/users/:id', validateRequest({
    body: z.object({ name: z.string().min(2) }),
    query: z.object({ active: z.coerce.boolean() }),
    params: z.object({ id: z.string().uuid() })
  }), (req, res) => res.status(201).json({ user: req.validated }));
  app.get('/error', () => { throw new Error('private failure'); });
  app.use(errorHandler());
  return app;
}

describe.each([
  ['Express 4', express4],
  ['Express 5', express5]
])('%s integration', (name, express) => {
  it('returns parsed data and rate-limit headers', async () => {
    const response = await request(createApp(express))
      .post('/users/550e8400-e29b-41d4-a716-446655440000?active=true')
      .send({ name: 'Ada' });
    expect(response.status).toBe(201);
    expect(response.body.user.body.name).toBe('Ada');
    expect(response.body.user.query.active).toBe(true);
    expect(response.headers['ratelimit-remaining']).toBe('0');
  });

  it('returns validation errors and generic unknown errors', async () => {
    const app = createApp(express);
    const invalid = await request(app).post('/users/not-an-id?active=true').send({ name: 'A' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    const unknown = await request(createApp(express)).get('/error');
    expect(unknown.status).toBe(500);
    expect(unknown.body.error.message).toBe('Internal server error');
  });

  it('returns blocked and allowlisted IP responses', async () => {
    const blockedApp = express();
    blockedApp.use(ipBlocker({ blockedIPs: ['127.0.0.1'] }));
    blockedApp.use(errorHandler());
    const blocked = await request(blockedApp).get('/');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('IP_BLOCKED');

    const allowedApp = express();
    allowedApp.use(ipBlocker({ blockedIPs: ['127.0.0.1'], allowedIPs: ['127.0.0.1'] }));
    allowedApp.get('/', (req, res) => res.json({ ok: true }));
    allowedApp.use(errorHandler());
    expect((await request(allowedApp).get('/')).status).toBe(200);
  });

  it('returns 429 and Retry-After after the limit', async () => {
    const app = createApp(express);
    const path = '/users/550e8400-e29b-41d4-a716-446655440000?active=true';
    await request(app).post(path).send({ name: 'Ada' });
    const response = await request(app).post(path).send({ name: 'Ada' });
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(0);
    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
