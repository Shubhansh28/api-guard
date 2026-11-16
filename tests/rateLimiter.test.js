const { rateLimit, MemoryStore } = require('../src');

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); } };
}

function run(middleware, req = { ip: '10.0.0.1' }) {
  const res = response();
  return new Promise((resolve) => middleware(req, res, (error) => resolve({ error, res })));
}

describe('rateLimit', () => {
  it('allows requests under the limit and returns headers', async () => {
    const result = await run(rateLimit({ windowMs: 1000, maxRequests: 2 }));
    expect(result.error).toBeUndefined();
    expect(result.res.headers['ratelimit-remaining']).toBe('1');
  });

  it('returns an error after the limit', async () => {
    const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 });
    await run(middleware);
    const result = await run(middleware);
    expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.error.statusCode).toBe(429);
  });

  it('supports skip, custom keys, and custom stores', async () => {
    const increment = vi.fn(() => ({ totalHits: 1, resetTime: new Date(Date.now() + 1000) }));
    const result = await run(rateLimit({
      windowMs: 1000, maxRequests: 1, keyGenerator: () => 'client',
      skip: () => false, store: { increment }
    }));
    expect(result.error).toBeUndefined();
    expect(increment).toHaveBeenCalledWith('client', 1000);
    expect((await run(rateLimit({ windowMs: 1000, maxRequests: 1, skip: () => true }))).error).toBeUndefined();
  });

  it('expires memory entries and rejects invalid options', () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    store.increment('a', 100);
    vi.advanceTimersByTime(101);
    expect(store.increment('a', 100).totalHits).toBe(1);
    vi.useRealTimers();
    expect(() => rateLimit({ windowMs: 0, maxRequests: 1 })).toThrow();
    expect(() => rateLimit({ windowMs: 1, maxRequests: 0 })).toThrow();
  });
});
