'use strict';

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
