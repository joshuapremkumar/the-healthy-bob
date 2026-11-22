'use strict';

/**
 * Stub translate service.
 * translateMany returns a translations map with "[target] text" for each target.
 * Dev3 will replace this with real translation logic.
 */
async function translateMany(text, sourceLang, targetLangs) {
  const translations = {};
  for (const lang of targetLangs) {
    translations[lang] = `[${lang}] ${text}`;
  }
  return { translations, provider: 'stub' };
}

/** Stub provider list – real adapters added by Dev3 */
const providers = [];

module.exports = { translateMany, providers };
