'use strict';

const { Router } = require('express');
const providers = require('../config/providers');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// GET /api/config/providers
router.get('/providers', requireAuth, (req, res) => {
  res.json({ config: providers.getConfig(), capabilities: providers.capabilities() });
});

// PATCH /api/config/providers  (doctor only)
router.patch('/providers', requireAuth, requireRole('doctor'), (req, res) => {
  const patch = req.body;
  const valid = ['stt', 'tts', 'translate'];

  for (const kind of Object.keys(patch)) {
    if (!valid.includes(kind)) {
      return res.status(400).json({ error: `Unknown provider kind: ${kind}` });
    }
    const kindPatch = patch[kind];
    if (kindPatch.primary !== undefined) {
      if (!providers.getAdapter(kind, kindPatch.primary)) {
        return res.status(400).json({ error: `Unknown provider "${kindPatch.primary}" for ${kind}` });
      }
    }
    if (kindPatch.fallbacks !== undefined) {
      if (!Array.isArray(kindPatch.fallbacks)) {
        return res.status(400).json({ error: `fallbacks for ${kind} must be an array` });
      }
      for (const name of kindPatch.fallbacks) {
        if (!providers.getAdapter(kind, name)) {
          return res.status(400).json({ error: `Unknown provider "${name}" for ${kind}` });
        }
      }
    }
  }

  providers.setConfig(patch);

  // Emit providers:updated to all connected sockets
  const io = req.app.get('io');
  if (io) io.emit('providers:updated');

  res.json({ config: providers.getConfig(), capabilities: providers.capabilities() });
});

module.exports = router;
