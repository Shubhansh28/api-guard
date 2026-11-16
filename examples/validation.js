const express = require('express');
const { z } = require('zod');
const { validateRequest, errorHandler } = require('../src');

const app = express();
app.use(express.json());
app.post('/users', validateRequest({
  body: z.object({ name: z.string().min(2), email: z.string().email() })
}), (req, res) => res.status(201).json({ success: true, user: req.validated.body }));
app.use(errorHandler());

if (require.main === module) app.listen(3001, () => console.log('Listening on http://localhost:3001'));
module.exports = app;
