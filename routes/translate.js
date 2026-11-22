'use strict';

/**
 * routes/translate.js  –  Dev 3
 * Mounted at /api/translate in server.js.
 *
 * POST /api/translate          { text, source, target }         -> { translatedText, provider }
 * POST /api/translate/detect   { text, hint? }                  -> { code, confidence, method }
 * POST /api/translate/speech/synthesize { text, lang }          -> audio bytes  OR  { provider:"browser" }
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { translate } = require('../services/translate');
const { detectLanguage } = require('../services/detect');
const { getChain, getAdapter } = require('../config/providers');

// Ensure TTS adapters are registered (they self-register on require)
require('../services/tts/watson');
require('../services/tts/elevenlabs');

const router = Router();

// ── POST /api/translate ───────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { text, source, target } = req.body;
  if (!text || !target) return res.status(400).json({ error: 'text and target are required' });

  try {
    const result = await translate(text, source || 'en', target);
    res.json({ translatedText: result.text, provider: result.provider });
  } catch (err) {
    console.error('[/translate] failed:', err.message);
    res.status(502).json({ error: 'Translation failed' });
  }
});

// ── POST /api/translate/detect ────────────────────────────────────────────────
router.post('/detect', requireAuth, async (req, res) => {
  const { text, hint } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  // detectLanguage never throws
  const result = await detectLanguage(text, hint || null);
  res.json(result);
});

// ── TTS audio clip cache (last 100 clips, keyed "lang|text") ─────────────────
const TTS_CACHE_MAX = 100;
const ttsCache = new Map(); // key -> { audio: Buffer, mimeType }

function ttsGet(key) {
  if (!ttsCache.has(key)) return undefined;
  const v = ttsCache.get(key);
  ttsCache.delete(key);
  ttsCache.set(key, v); // LRU bump
  return v;
}

function ttsSet(key, val) {
  if (ttsCache.has(key)) ttsCache.delete(key);
  else if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
  ttsCache.set(key, val);
}

// ── POST /api/translate/speech/synthesize ─────────────────────────────────────
router.post('/speech/synthesize', requireAuth, async (req, res) => {
  const { text, lang } = req.body;

  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
  if (text.length > 1000) return res.status(400).json({ error: 'text must be <= 1000 chars' });
  if (!lang) return res.status(400).json({ error: 'lang is required' });

  // Check cache first
  const cacheKey = `${lang}|${text}`;
  const cached = ttsGet(cacheKey);
  if (cached) {
    res.set('Content-Type', cached.mimeType);
    res.set('X-Provider', 'cache');
    return res.send(cached.audio);
  }

  // Iterate the TTS provider chain
  const chain = getChain('tts', lang);

  for (const name of chain) {
    // "browser" = client must handle it
    if (name === 'browser') {
      return res.json({ provider: 'browser' });
    }

    const adapter = getAdapter('tts', name);
    if (!adapter) continue;

    try {
      const { audio, mimeType } = await adapter.synthesize(text, lang);
      ttsSet(cacheKey, { audio, mimeType });
      res.set('Content-Type', mimeType);
      res.set('X-Provider', name);
      return res.send(audio);
    } catch (err) {
      // Log provider name + error message; never log the text
      console.error(`[tts] ${name} failed:`, err.message);
    }
  }

  res.status(502).json({ error: 'All TTS providers failed' });
});

module.exports = router;
