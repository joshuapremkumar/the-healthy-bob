'use strict';

/** Stub – Dev3 will implement Watson TTS */
module.exports = {
  name: 'watson',
  isConfigured: () => !!(process.env.WATSON_TTS_APIKEY && process.env.WATSON_TTS_URL),
  supports: () => true,
  async synthesize(text, langCode) {
    throw new Error('Watson TTS not yet implemented');
  },
};
