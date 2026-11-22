'use strict';

<<<<<<< HEAD
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
=======
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const providers = require('../config/providers');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio/* files are accepted'));
    }
  }
});

// POST /api/speech/transcribe
router.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const lang = (req.body.lang && req.body.lang.trim()) || 'auto';

  // 20-second overall timeout
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(504).json({ error: 'Transcription timed out' });
    }
  }, 20000);

  try {
    const chain = providers.getChain('stt', lang);

    for (const adapterName of chain) {
      if (timedOut) break;

      // "browser" is a pseudo-provider – instruct the client to handle it
      if (adapterName === 'browser') {
        clearTimeout(timer);
        return res.json({ provider: 'browser' });
      }

      const adapter = providers.getAdapter('stt', adapterName);
      if (!adapter) continue;

      try {
        const result = await adapter.transcribe(req.file.buffer, req.file.mimetype, lang);

        if (!result || !result.text || !result.text.trim()) {
          // Empty result – try next adapter
          continue;
        }

        clearTimeout(timer);
        if (timedOut) return; // response already sent
        return res.json({
          text: result.text,
          language: result.language,
          confidence: result.confidence,
          provider: adapterName
        });
      } catch (err) {
        // Log the error (without audio bytes or transcript) and try next
        console.error(`[speech/transcribe] adapter "${adapterName}" error:`, err.message);
      }
    }

    // All adapters exhausted without a result
    clearTimeout(timer);
    if (!timedOut && !res.headersSent) {
      res.status(422).json({ error: 'Could not transcribe audio with any available provider' });
    }
  } catch (err) {
    clearTimeout(timer);
    console.error('[speech/transcribe] unexpected error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
>>>>>>> a0af027 (feat(dev4): add STT adapters, speech route, and browser speech client)
});

module.exports = router;
