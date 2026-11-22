'use strict';

/**
 * services/tts/watson.js  –  Dev 3
 * Watson TTS adapter (Basic auth: "apikey:<WATSON_TTS_APIKEY>").
 * init() fetches /v1/voices and builds a 2-letter lang → best voice map.
 * synthesize(text, lang) POSTs to /v1/synthesize and returns audio/mpeg.
 */

const { registerAdapter } = require('../../config/providers');

// Map: 2-letter lang code → Watson voice name (populated by init())
let voiceMap = {}; // e.g. { en: 'en-US_AllisonV3Voice', hi: 'hi-IN_HiraNeural', ... }
let initialized = false;

/** Basic-auth header for Watson */
function basicAuth() {
  const key = process.env.WATSON_TTS_APIKEY || '';
  return 'Basic ' + Buffer.from(`apikey:${key}`).toString('base64');
}

const adapter = {
  name: 'watson',

  isConfigured() {
    return !!(process.env.WATSON_TTS_APIKEY && process.env.WATSON_TTS_URL);
  },

  /**
   * init() – fetch available voices and build the lang→voice map.
   * Called once on first use (lazy) or explicitly at server startup.
   */
  async init() {
    if (initialized) return;
    if (!this.isConfigured()) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(`${process.env.WATSON_TTS_URL}/v1/voices`, {
        headers: { Authorization: basicAuth() },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Watson TTS /v1/voices ${res.status}`);
      const data = await res.json();

      const map = {}; // lang2 -> best voice name so far
      const rank = (name) => {
        // Higher = preferred
        if (/Expressive/i.test(name)) return 3;
        if (/Natural/i.test(name)) return 2;
        if (/V3/i.test(name)) return 1;
        return 0;
      };

      for (const v of data.voices || []) {
        // voice.language is like "en-US" or "hi-IN"
        const lang2 = v.language ? v.language.split('-')[0] : null;
        if (!lang2) continue;

        // For English, prefer en-US over en-GB etc.
        if (lang2 === 'en' && v.language !== 'en-US') {
          if (map['en']) continue; // already have a US voice (assigned below)
        }

        const current = map[lang2];
        if (!current || rank(v.name) > rank(current)) {
          map[lang2] = v.name;
        }

        // Explicitly prefer en-US voices for English
        if (lang2 === 'en' && v.language === 'en-US') {
          if (!map['en'] || rank(v.name) >= rank(map['en'])) {
            map['en'] = v.name;
          }
        }
      }

      voiceMap = map;
      initialized = true;
      console.log('[watson-tts] Voice map built:', Object.keys(voiceMap).join(', '));
    } finally {
      clearTimeout(timer);
    }
  },

  supports(lang) {
    // If not yet initialized, conservatively say yes and let synthesize handle it
    if (!initialized) return true;
    return !!(voiceMap[lang]);
  },

  /**
   * synthesize(text, lang) -> {audio: Buffer, mimeType: "audio/mpeg"}
   */
  async synthesize(text, lang) {
    // Lazy init
    if (!initialized) await this.init();

    const voice = voiceMap[lang];
    if (!voice) throw new Error(`Watson TTS: no voice for lang "${lang}"`);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const url = `${process.env.WATSON_TTS_URL}/v1/synthesize?voice=${encodeURIComponent(voice)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: basicAuth(),
          'Content-Type': 'application/json',
          Accept: 'audio/mp3',
        },
        body: JSON.stringify({ text }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Watson TTS synthesize ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      return { audio: Buffer.from(arrayBuf), mimeType: 'audio/mpeg' };
    } finally {
      clearTimeout(timer);
    }
  },
};

// Register with provider registry
registerAdapter('tts', adapter);

module.exports = adapter;
