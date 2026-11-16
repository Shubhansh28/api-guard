describe('module imports', () => {
  it('supports CommonJS and ESM consumers', async () => {
    const commonjs = require('../src');
    const esm = await import('../src/index.mjs');
    expect(typeof commonjs.rateLimit).toBe('function');
    expect(typeof esm.rateLimit).toBe('function');
  });
});
