'use strict';

<<<<<<< HEAD
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
=======
const name = 'watson';

function isConfigured() {
  return !!(process.env.WATSON_STT_APIKEY && process.env.WATSON_STT_URL);
}

// 2-letter lang -> Watson model name, built by init()
const langMap = {};

async function init() {
  if (!isConfigured()) return;

  const baseUrl = process.env.WATSON_STT_URL.replace(/\/$/, '');
  const auth = Buffer.from(`apikey:${process.env.WATSON_STT_APIKEY}`).toString('base64');

  let models;
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) throw new Error(`Watson STT /v1/models returned ${res.status}`);
    const json = await res.json();
    models = json.models || [];
  } catch (err) {
    console.error('[watson-stt] init failed:', err.message);
    return;
  }

  // Build 2-letter -> model name map.
  // Priority per lang:
  //   1. Exact locale match (e.g. "hi-IN", "en-US")
  //   2. Names ending "_Multimedia"
  //   3. Names ending "_Telephony"
  // For "en" prefer en-US over en-IN etc.

  const bucket = {}; // 2-letter -> { exact, multimedia, telephony }

  for (const m of models) {
    const id = m.name; // e.g. "en-US_BroadbandModel", "hi-IN_Multimedia"
    const parts = id.split('_');
    if (!parts[0] || !parts[0].includes('-')) continue;
    const locale = parts[0]; // e.g. "en-US"
    const lang2 = locale.split('-')[0].toLowerCase();

    if (!bucket[lang2]) bucket[lang2] = { exact: [], multimedia: [], telephony: [] };

    // Exact locale match (name starts with locale and nothing after first underscore)
    // e.g. "hi-IN" -> name === "hi-IN" (unlikely but handle it) or "hi-IN_<anything>"
    const afterLocale = id.slice(locale.length + 1); // strip "hi-IN_"
    if (afterLocale === '' || id === locale) {
      bucket[lang2].exact.push({ id, locale });
    } else if (afterLocale.endsWith('Multimedia')) {
      bucket[lang2].multimedia.push({ id, locale });
    } else if (afterLocale.endsWith('Telephony')) {
      bucket[lang2].telephony.push({ id, locale });
    }
  }

  for (const [lang2, b] of Object.entries(bucket)) {
    // Choose best model
    let chosen = null;

    if (lang2 === 'en') {
      // Prefer en-US for English
      const preferUS = (arr) => arr.find(x => x.locale === 'en-US') || arr[0];
      chosen = preferUS(b.exact) || preferUS(b.multimedia) || preferUS(b.telephony);
    } else {
      chosen = b.exact[0] || b.multimedia[0] || b.telephony[0];
    }

    if (chosen) langMap[lang2] = chosen.id;
  }
}

function supports(lang) {
  if (!lang || lang === 'auto') return false;
  const lang2 = lang.split('-')[0].toLowerCase();
  return !!langMap[lang2];
}

async function transcribe(buffer, mimeType, lang) {
  if (!isConfigured()) throw new Error('Watson STT is not configured');

  const lang2 = (lang || '').split('-')[0].toLowerCase();
  const model = langMap[lang2];
  if (!model) throw new Error(`Watson STT: no model for language "${lang}"`);

  const baseUrl = process.env.WATSON_STT_URL.replace(/\/$/, '');
  const auth = Buffer.from(`apikey:${process.env.WATSON_STT_APIKEY}`).toString('base64');
  const url = `${baseUrl}/v1/recognize?model=${encodeURIComponent(model)}&smart_formatting=true`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': mimeType || 'audio/webm;codecs=opus'
    },
    body: buffer
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Watson STT recognize failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const results = (json.results || []).filter(r => r.final);

  const textParts = [];
  const confidences = [];

  for (const r of results) {
    const alt = r.alternatives && r.alternatives[0];
    if (!alt) continue;
    if (alt.transcript) textParts.push(alt.transcript.trim());
    if (typeof alt.confidence === 'number') confidences.push(alt.confidence);
  }

  const text = textParts.join(' ');
  const confidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.8;

  return { text, language: lang, confidence };
}

module.exports = { name, isConfigured, init, supports, autoDetect: false, transcribe };
>>>>>>> a0af027 (feat(dev4): add STT adapters, speech route, and browser speech client)
