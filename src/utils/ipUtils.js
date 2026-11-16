const net = require('node:net');

function ipv4FromMappedIpv6(ip) {
  const [left, right] = ip.split('::');
  const leftParts = left ? left.split(':').filter(Boolean) : [];
  const rightParts = right ? right.split(':').filter(Boolean) : [];
  const rawParts = [...leftParts, ...rightParts];
  const lastPart = rawParts[rawParts.length - 1];
  if (net.isIP(lastPart) === 4) {
    const octets = lastPart.split('.').map(Number);
    rawParts.splice(rawParts.length - 1, 1, ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16));
  }
  const parts = right === undefined
    ? rawParts
    : [...leftParts, ...Array(8 - rawParts.length).fill('0'), ...rawParts.slice(leftParts.length)];
  if (parts.length !== 8 || parts.slice(0, 5).some((part) => part !== '0') || parts[5] !== 'ffff') {
    return null;
  }
  const high = Number.parseInt(parts[6], 16);
  const low = Number.parseInt(parts[7], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low)) return null;
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:') && net.isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (net.isIP(ip) === 6) ip = ipv4FromMappedIpv6(ip) || ip;
  return net.isIP(ip) ? ip : null;
}

function defaultIpResolver(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress);
}

module.exports = { normalizeIp, defaultIpResolver };
