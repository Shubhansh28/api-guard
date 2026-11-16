const net = require('node:net');

function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:') && net.isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return net.isIP(ip) ? ip : null;
}

function defaultIpResolver(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress);
}

module.exports = { normalizeIp, defaultIpResolver };
