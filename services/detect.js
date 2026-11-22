'use strict';

/**
 * Stub detect service. Returns the hint language or "en".
 * Dev3 will replace this with real language detection.
 */
async function detectLanguage(text, hint) {
  return { code: hint || 'en', confidence: 0.5, method: 'hint' };
}

module.exports = { detectLanguage };
