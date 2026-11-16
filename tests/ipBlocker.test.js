const { ipBlocker } = require('../src');

function run(middleware, req = { ip: '127.0.0.1' }) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error)));
}

describe('ipBlocker', () => {
  it('blocks IPv4 and allows an allowlisted address', async () => {
    const options = { blockedIPs: ['127.0.0.1'], allowedIPs: ['127.0.0.1'] };
    expect(await run(ipBlocker(options))).toBeUndefined();
    const error = await run(ipBlocker({ blockedIPs: ['127.0.0.1'] }));
    expect(error.code).toBe('IP_BLOCKED');
    expect(error.statusCode).toBe(403);
  });

  it('supports IPv6 and does not use spoofable forwarding headers', async () => {
    const error = await run(ipBlocker({ blockedIPs: ['::1'] }), {
      ip: '::1', headers: { 'x-forwarded-for': '127.0.0.1' }
    });
    expect(error.code).toBe('IP_BLOCKED');
    expect(await run(ipBlocker({ blockedIPs: ['127.0.0.1'] }), {
      ip: '10.0.0.1', headers: { 'x-forwarded-for': '127.0.0.1' }
    })).toBeUndefined();
  });

  it('rejects invalid IP configuration', () => {
    expect(() => ipBlocker({ blockedIPs: ['not-an-ip'] })).toThrow();
    expect(() => ipBlocker({ blockedIPs: '127.0.0.1' })).toThrow();
  });
});
