const express = require('express');
const { rateLimit, ipBlocker, errorHandler } = require('../src');

const app = express();
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));
app.use(ipBlocker({ blockedIPs: ['192.0.2.10'] }));
app.get('/health', (req, res) => res.json({ success: true }));
app.use(errorHandler());

if (require.main === module) app.listen(3000, () => console.log('Listening on http://localhost:3000'));
module.exports = app;
