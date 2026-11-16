const { z } = require('zod');
const { validateRequest } = require('../src');

function run(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve({ error, req })));
}

describe('validateRequest', () => {
  const schemas = {
    body: z.object({ name: z.string().min(2) }),
    query: z.object({ active: z.coerce.boolean() }),
    params: z.object({ id: z.string().uuid() })
  };

  it('accepts and exposes parsed body, query, and params', async () => {
    const result = await run(validateRequest(schemas), {
      body: { name: 'Ada' }, query: { active: 'true' },
      params: { id: '550e8400-e29b-41d4-a716-446655440000' }
    });
    expect(result.error).toBeUndefined();
    expect(result.req.query.active).toBe(true);
  });

  it('returns field paths for invalid data', async () => {
    const result = await run(validateRequest(schemas), {
      body: { name: 'A' }, query: { active: 'no' }, params: { id: 'bad' }
    });
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.details.some((item) => item.path.includes('body'))).toBe(true);
  });

  it('rejects non-Zod schemas', () => {
    expect(() => validateRequest({ body: {} })).toThrow();
  });
});
