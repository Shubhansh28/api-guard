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
    const increment = vi.fn(async () => ({ totalHits: 1, resetTime: new Date(Date.now() + 1000) }));
    const result = await run(rateLimit({
      windowMs: 1000, maxRequests: 1, keyGenerator: () => 'client',
      skip: () => false, store: { increment }
    }));
    expect(result.error).toBeUndefined();
    expect(increment).toHaveBeenCalledWith('client', 1000);
    expect((await run(rateLimit({ windowMs: 1000, maxRequests: 1, skip: () => true }))).error).toBeUndefined();
  });

  it('passes key generator and store failures to next once', async () => {
    const keyError = new Error('key failed');
    const storeError = new Error('store failed');
    expect((await run(rateLimit({ windowMs: 1000, maxRequests: 1, keyGenerator: () => { throw keyError; } }))).error)
      .toBe(keyError);
    expect((await run(rateLimit({ windowMs: 1000, maxRequests: 1, store: { increment: async () => { throw storeError; } } }))).error)
      .toBe(storeError);
  });

  it('rejects invalid custom store results', async () => {
    for (const result of [
      { totalHits: 0, resetTime: new Date(Date.now() + 1000) },
      { totalHits: 1.5, resetTime: new Date(Date.now() + 1000) },
      { totalHits: 1, resetTime: new Date('invalid') }
    ]) {
      const outcome = await run(rateLimit({ windowMs: 1000, maxRequests: 1, store: { increment: () => result } }));
      expect(outcome.error).toBeInstanceOf(TypeError);
    }
  });

  it('calls skip exactly once and does not call the key generator', async () => {
    const skip = vi.fn(() => true);
    const keyGenerator = vi.fn();
    const outcome = await run(rateLimit({ windowMs: 1000, maxRequests: 1, skip, keyGenerator }));
    expect(outcome.error).toBeUndefined();
    expect(skip).toHaveBeenCalledTimes(1);
    expect(keyGenerator).not.toHaveBeenCalled();
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

  it('bounds expired-entry cleanup during increments', () => {
    vi.useFakeTimers();
    const store = new MemoryStore({ cleanupInterval: 1, maxCleanupKeys: 2 });
    for (let index = 0; index < 5; index += 1) {
      store.increment(`client-${index}`, 10);
    }
    vi.advanceTimersByTime(11);
    store.increment('fresh-client', 100);
    expect(store.entries.size).toBeLessThan(5);
    store.clear();
    vi.useRealTimers();
  });

  it('eventually inspects expired entries beyond the first cleanup batch', () => {
    vi.useFakeTimers();
    const store = new MemoryStore({ cleanupInterval: 100, maxCleanupKeys: 2 });
    for (let index = 0; index < 5; index += 1) store.increment(`client-${index}`, 10);
    vi.advanceTimersByTime(11);

    store.cleanup();
    expect(store.entries.has('client-4')).toBe(true);
    store.cleanup();
    store.cleanup();
    expect(store.entries.size).toBe(0);
    vi.useRealTimers();
  });
});
