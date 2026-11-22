'use strict';

/** Stub – Dev3 will implement ElevenLabs TTS */
module.exports = {
  name: 'elevenlabs',
  isConfigured: () => !!process.env.ELEVENLABS_API_KEY,
  supports: () => true,
  async synthesize(text, langCode) {
    throw new Error('ElevenLabs TTS not yet implemented');
  },
};
