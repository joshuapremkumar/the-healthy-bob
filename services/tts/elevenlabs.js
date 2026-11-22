'use strict';

/**
 * services/tts/elevenlabs.js  –  Dev 3
 * ElevenLabs TTS adapter.
 * Supports all 15 contract languages (multilingual model).
 * synthesize(text, lang) -> {audio: Buffer, mimeType: "audio/mpeg"}
 */

const { registerAdapter } = require('../../config/providers');

// All 15 contract language codes – ElevenLabs multilingual model covers them all
const CONTRACT_LANGS = ['en','hi','bn','ta','te','mr','gu','kn','ml','pa','ur','es','fr','ar','zh'];

const adapter = {
  name: 'elevenlabs',

  isConfigured() {
    return !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
  },

  supports(lang) {
    // ElevenLabs multilingual model covers all 15 contract languages
    return CONTRACT_LANGS.includes(lang);
  },

  languages: CONTRACT_LANGS,

  /**
   * synthesize(text, lang) -> {audio: Buffer, mimeType: "audio/mpeg"}
   */
  async synthesize(text, lang) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, model_id: model }),
          signal: ctrl.signal,
        }
      );
      if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}`);
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
