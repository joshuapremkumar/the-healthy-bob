'use strict';

/**
 * services/translate.js  –  Dev 3
 * Translation providers: watsonx (primary) and mymemory (fallback).
 * Exports: providers[], translate(text, source, target), translateMany(text, source, targets)
 */

const { getChain, registerAdapter } = require('../config/providers');

// ── Language name map for the 15 contract languages ──────────────────────────
const LANG_NAMES = {
  en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  ur: 'Urdu', es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese',
};

// ── Tiny LRU cache (300 entries, keyed "src|tgt|text") ───────────────────────
class LRUCache {
  constructor(max) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val); // bump to most-recent
    return val;
  }
  set(key, val) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      // evict least-recently-used (first key)
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, val);
  }
}
const cache = new LRUCache(300);

// ── IAM token cache for watsonx ───────────────────────────────────────────────
let _iamToken = null;
let _iamExpiry = 0; // ms epoch

async function getIamToken() {
  const now = Date.now();
  // Refresh 5 min before expiry
  if (_iamToken && now < _iamExpiry - 5 * 60 * 1000) return _iamToken;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(process.env.WATSONX_APIKEY)}`,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`IAM ${res.status}`);
    const data = await res.json();
    _iamToken = data.access_token;
    // expires_in is in seconds
    _iamExpiry = now + (data.expires_in || 3600) * 1000;
    return _iamToken;
  } finally {
    clearTimeout(timer);
  }
}

// ── watsonx adapter ───────────────────────────────────────────────────────────
const watsonxAdapter = {
  name: 'watsonx',
  isConfigured() {
    return !!(process.env.WATSONX_APIKEY && process.env.WATSONX_PROJECT_ID && process.env.WATSONX_URL);
  },
  supports(lang) { return true; }, // LLM handles all langs
  languages: Object.keys(LANG_NAMES),

  async translate(text, source, target) {
    const token = await getIamToken();
    const srcName = LANG_NAMES[source] || source;
    const tgtName = LANG_NAMES[target] || target;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const url = `${process.env.WATSONX_URL}/ml/v1/text/chat?version=2024-10-08`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: process.env.WATSONX_MODEL_ID,
          project_id: process.env.WATSONX_PROJECT_ID,
          messages: [
            {
              role: 'system',
              content: `You are a medical interpreter. Translate the user's text from ${srcName} to ${tgtName}. ` +
                       'Preserve meaning, symptoms, numbers, medicine names and dosages exactly. Reply with the translation only.',
            },
            { role: 'user', content: text },
          ],
          max_tokens: 500,
          temperature: 0,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`watsonx ${res.status}`);
      const data = await res.json();
      let translated = data.choices[0].message.content.trim();
      // Strip surrounding quotes if present
      translated = translated.replace(/^["']|["']$/g, '');
      return { text: translated, provider: 'watsonx' };
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── mymemory adapter ──────────────────────────────────────────────────────────
const mymemoryAdapter = {
  name: 'mymemory',
  isConfigured() { return true; }, // no key required (email optional)
  supports(lang) { return true; },
  languages: Object.keys(LANG_NAMES),

  async translate(text, source, target) {
    const params = new URLSearchParams({
      q: text,
      langpair: `${source}|${target}`,
    });
    if (process.env.MYMEMORY_EMAIL) params.append('de', process.env.MYMEMORY_EMAIL);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`mymemory HTTP ${res.status}`);
      const data = await res.json();
      if (data.responseStatus !== 200) throw new Error(`mymemory status ${data.responseStatus}`);
      return { text: data.responseData.translatedText, provider: 'mymemory' };
    } finally {
      clearTimeout(timer);
    }
  },
};

// Register both adapters with the provider registry
registerAdapter('translate', watsonxAdapter);
registerAdapter('translate', mymemoryAdapter);

/** Exported providers array */
const providers = [watsonxAdapter, mymemoryAdapter];

// ── Core translate function ───────────────────────────────────────────────────

/**
 * translate(text, source, target) -> {text, provider}
 * Tries adapters in getChain order; uses LRU cache.
 */
async function translate(text, source, target) {
  // Same language – return unchanged
  if (source === target) return { text, provider: 'passthrough' };

  const cacheKey = `${source}|${target}|${text}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const chain = getChain('translate', target);
  const { getAdapter } = require('../config/providers');

  for (const name of chain) {
    const adapter = getAdapter('translate', name);
    if (!adapter || !adapter.translate) continue;
    try {
      const result = await adapter.translate(text, source, target);
      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      // log and try next
      console.error(`[translate] ${name} failed:`, err.message);
    }
  }
  throw new Error('All translation providers failed');
}

/**
 * translateMany(text, source, targets) -> {translations:{code:text}, provider}
 * Runs all targets in parallel; a failed target pivots via English first.
 */
async function translateMany(text, source, targets) {
  const results = await Promise.allSettled(
    targets.map(async (tgt) => {
      try {
        return { tgt, ...(await translate(text, source, tgt)) };
      } catch {
        // Pivot via English: src->en then en->tgt
        if (source !== 'en' && tgt !== 'en') {
          try {
            const mid = await translate(text, source, 'en');
            const final = await translate(mid.text, 'en', tgt);
            return { tgt, text: final.text, provider: final.provider };
          } catch {}
        }
        return { tgt, text: '[translation unavailable]', provider: 'none' };
      }
    })
  );

  const translations = {};
  let lastProvider = 'none';
  for (const r of results) {
    if (r.status === 'fulfilled') {
      translations[r.value.tgt] = r.value.text;
      if (r.value.provider !== 'none') lastProvider = r.value.provider;
    }
  }
  return { translations, provider: lastProvider };
}

module.exports = { providers, translate, translateMany };
