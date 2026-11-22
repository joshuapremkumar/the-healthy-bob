'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// POST /api/speech/transcribe  – stub: tell client to use browser STT
router.post('/transcribe', requireAuth, (req, res) => {
  res.json({ provider: 'browser' });
});

// POST /api/speech/synthesize  – stub: tell client to use browser TTS
router.post('/synthesize', requireAuth, (req, res) => {
  res.json({ provider: 'browser' });
});

module.exports = router;
