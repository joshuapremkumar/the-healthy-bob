'use strict';

/** Stub – Dev4 will implement Watson STT */
module.exports = {
  name: 'watson',
  isConfigured: () => !!(process.env.WATSON_STT_APIKEY && process.env.WATSON_STT_URL),
  supports: () => true,
  autoDetect: false,
  async transcribe(buffer, mimeType, langCode) {
    throw new Error('Watson STT not yet implemented');
  },
};
