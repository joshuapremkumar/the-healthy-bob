'use strict';

/**
 * services/detect.js  –  Dev 3
 * detectLanguage(text, hint) -> {code, confidence, method}
 *
 * Strategy:
 *  1. Unicode-script detection: check dominant non-Latin script blocks.
 *  2. For Arabic script: disambiguate Urdu vs Arabic via franc or hint.
 *  3. For Latin text: use franc-min (ESM, loaded once via dynamic import).
 *     - Short text (<12 chars) or romanised Indic → fall back to hint.
 *  4. Never throws; falls back to hint or "en".
 */

// ── franc-min ESM singleton ───────────────────────────────────────────────────
let _franc = null;

async function getFranc() {
  if (_franc) return _franc;
  // franc-min is ESM-only; load once and cache
  const mod = await import('franc-min');
  _franc = mod.franc;
  return _franc;
}

// ── Unicode script range helpers ──────────────────────────────────────────────

function scriptShare(text, regex) {
  const letters = text.replace(/\s+/g, '');
  if (!letters.length) return 0;
  const matches = letters.match(regex) || [];
  return matches.length / letters.length;
}

// Script regexes (Unicode ranges)
const SCRIPT = {
  devanagari: /[\u0900-\u097F]/g,
  bengali:    /[\u0980-\u09FF]/g,
  gurmukhi:   /[\u0A00-\u0A7F]/g,
  gujarati:   /[\u0A80-\u0AFF]/g,
  tamil:      /[\u0B80-\u0BFF]/g,
  telugu:     /[\u0C00-\u0C7F]/g,
  kannada:    /[\u0C80-\u0CFF]/g,
  malayalam:  /[\u0D00-\u0D7F]/g,
  arabic:     /[\u0600-\u06FF\u0750-\u077F]/g,  // covers both Urdu and Arabic
  han:        /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
};

// Indic language codes (used to detect romanised input)
const INDIC_CODES = new Set(['hi','bn','pa','gu','ta','te','kn','ml','mr','ur']);

// franc-min ISO 639-3 → ISO 639-1 map (limited to contract languages)
const FRANC_MAP = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  urd: 'ur',
  arb: 'ar',
  mar: 'mr',
};

/**
 * detectLanguage(text, hint) -> {code, confidence, method}
 */
async function detectLanguage(text, hint) {
  try {
    if (!text || text.trim().length === 0) {
      return { code: hint || 'en', confidence: 0.5, method: 'hint' };
    }

    const t = text.trim();

    // ── 1. Unicode script detection ───────────────────────────────────────────
    const scriptChecks = [
      { key: 'devanagari', code: 'hi' },  // may become 'mr' – checked below
      { key: 'bengali',    code: 'bn' },
      { key: 'gurmukhi',   code: 'pa' },
      { key: 'gujarati',   code: 'gu' },
      { key: 'tamil',      code: 'ta' },
      { key: 'telugu',     code: 'te' },
      { key: 'kannada',    code: 'kn' },
      { key: 'malayalam',  code: 'ml' },
      { key: 'han',        code: 'zh' },
    ];

    for (const { key, code } of scriptChecks) {
      const share = scriptShare(t, new RegExp(SCRIPT[key].source, 'g'));
      if (share >= 0.4) {
        const confidence = share >= 0.9 ? 0.95 : share;

        // Devanagari: disambiguate hi vs mr via franc
        if (code === 'hi') {
          try {
            const franc = await getFranc();
            const f = franc(t);
            if (f === 'mar') return { code: 'mr', confidence, method: 'script' };
          } catch {}
        }
        return { code, confidence, method: 'script' };
      }
    }

    // ── 2. Arabic script: disambiguate ur vs ar ───────────────────────────────
    const arabicShare = scriptShare(t, new RegExp(SCRIPT.arabic.source, 'g'));
    if (arabicShare >= 0.4) {
      const confidence = arabicShare >= 0.9 ? 0.95 : arabicShare;
      try {
        const franc = await getFranc();
        const f = franc(t);
        if (f === 'urd') return { code: 'ur', confidence, method: 'script' };
        if (f === 'arb') return { code: 'ar', confidence, method: 'script' };
      } catch {}
      // Fallback: use hint if it's ur or ar, otherwise default ar
      if (hint === 'ur' || hint === 'ar') return { code: hint, confidence: 0.6, method: 'hint' };
      return { code: 'ar', confidence, method: 'script' };
    }

    // ── 3. Latin script: use franc-min ────────────────────────────────────────

    // Short text → not reliable, use hint
    if (t.length < 12) {
      return { code: hint || 'en', confidence: 0.5, method: 'hint' };
    }

    // Romanised Indic: Latin text but hint is an Indic language
    if (hint && INDIC_CODES.has(hint)) {
      return { code: hint, confidence: 0.55, method: 'hint' };
    }

    // Run franc-min (limited to eng/spa/fra for Latin)
    try {
      const franc = await getFranc();
      const f = franc(t, { only: ['eng', 'spa', 'fra'] });
      if (f && f !== 'und' && FRANC_MAP[f]) {
        return { code: FRANC_MAP[f], confidence: 0.75, method: 'franc' };
      }
    } catch {}

    // ── 4. Final fallback ─────────────────────────────────────────────────────
    return { code: hint || 'en', confidence: 0.5, method: 'hint' };

  } catch {
    // Never throws
    return { code: hint || 'en', confidence: 0.5, method: 'hint' };
  }
}

module.exports = { detectLanguage };
