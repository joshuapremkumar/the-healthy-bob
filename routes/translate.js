'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// POST /api/translate  – stub: echo with target prefix
router.post('/', requireAuth, (req, res) => {
  const { text, source, target } = req.body;
  res.json({ translatedText: `[${target}] ${text}`, provider: 'stub' });
});

// POST /api/detect  – stub: return hint or "en"
router.post('/detect', requireAuth, (req, res) => {
  const { text, hint } = req.body;
  res.json({ code: hint || 'en', confidence: 0.5, method: 'hint' });
});

module.exports = router;
