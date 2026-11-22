'use strict';

<<<<<<< HEAD
/** Stub – Dev4 will implement ElevenLabs STT */
module.exports = {
  name: 'elevenlabs',
  isConfigured: () => !!process.env.ELEVENLABS_API_KEY,
  supports: () => true,
  autoDetect: true,
  async transcribe(buffer, mimeType, langCode) {
    throw new Error('ElevenLabs STT not yet implemented');
  },
};
=======
const name = 'elevenlabs';

// ISO 639-3 -> ISO 639-1 mapping for languages returned by ElevenLabs
const ISO3_TO_1 = {
  hin: 'hi',
  tam: 'ta',
  tel: 'te',
  ben: 'bn',
  mar: 'mr',
  guj: 'gu',
  kan: 'kn',
  mal: 'ml',
  pan: 'pa',
  urd: 'ur',
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  ara: 'ar',
  zho: 'zh',
  cmn: 'zh'
};

// The 15 contract languages + "auto"
const SUPPORTED_LANGS = new Set([
  'auto',
  'en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur',
  'es', 'fr', 'ar', 'zh'
]);

function isConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

async function init() {
  // No pre-flight needed; ElevenLabs models are fixed
}

function supports(lang) {
  const lang2 = lang === 'auto' ? 'auto' : (lang || '').split('-')[0].toLowerCase();
  return SUPPORTED_LANGS.has(lang2);
}

function toLang1(code) {
  if (!code) return null;
  // Already 2-letter?
  if (code.length === 2) return code.toLowerCase();
  // 3-letter ISO 639-3
  return ISO3_TO_1[code.toLowerCase()] || code.toLowerCase().slice(0, 2);
}

async function transcribe(buffer, mimeType, lang) {
  if (!isConfigured()) throw new Error('ElevenLabs STT is not configured');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const model = process.env.ELEVENLABS_STT_MODEL || 'scribe_v2';

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), 'speech.webm');
  form.append('model_id', model);
  form.append('tag_audio_events', 'false');

  const lang2 = (lang || '').split('-')[0].toLowerCase();
  if (lang && lang !== 'auto') {
    form.append('language_code', lang2);
  }

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs STT failed ${res.status}: ${body}`);
  }

  const json = await res.json();

  const text = (json.text || '').trim();
  const language = toLang1(json.language_code) || (lang !== 'auto' ? lang2 : 'en');
  const confidence = json.language_probability != null ? json.language_probability : 0.8;

  return { text, language, confidence };
}

module.exports = { name, isConfigured, init, supports, autoDetect: true, transcribe };
>>>>>>> a0af027 (feat(dev4): add STT adapters, speech route, and browser speech client)
