'use strict';

const fs = require('fs');
const path = require('path');

const PROVIDERS_FILE = path.join(__dirname, '..', 'data', 'providers.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

// ── in-memory registry ────────────────────────────────────────────────────────
// { stt: Map<name, adapter>, tts: Map<name, adapter>, translate: Map<name, adapter> }
const registry = {
  stt: new Map(),
  tts: new Map(),
  translate: new Map(),
};

// Built-in "browser" pseudo-adapter for stt and tts
const browserAdapter = {
  name: 'browser',
  isConfigured: () => true,
  supports: () => true,
  autoDetect: true,
};
registry.stt.set('browser', browserAdapter);
registry.tts.set('browser', browserAdapter);

// ── runtime config (loaded lazily / on demand) ────────────────────────────────
let _config = null;

function loadConfig() {
  if (_config) return _config;

  const defaults = {
    stt: {
      primary: process.env.STT_PROVIDER || 'watson',
      fallbacks: (process.env.STT_FALLBACKS || 'elevenlabs,browser').split(',').map(s => s.trim()).filter(Boolean),
    },
    tts: {
      primary: process.env.TTS_PROVIDER || 'watson',
      fallbacks: (process.env.TTS_FALLBACKS || 'elevenlabs,browser').split(',').map(s => s.trim()).filter(Boolean),
    },
    translate: {
      primary: process.env.TRANSLATE_PROVIDER || 'watsonx',
      fallbacks: (process.env.TRANSLATE_FALLBACKS || 'mymemory').split(',').map(s => s.trim()).filter(Boolean),
    },
  };

  if (fs.existsSync(PROVIDERS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf8'));
      _config = deepMerge(defaults, saved);
    } catch {
      _config = defaults;
    }
  } else {
    _config = defaults;
  }

  return _config;
}

function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function saveConfig(cfg) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = PROVIDERS_FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, PROVIDERS_FILE);
}

// ── public API ────────────────────────────────────────────────────────────────

function registerAdapter(kind, adapter) {
  if (!registry[kind]) throw new Error(`Unknown adapter kind: ${kind}`);
  registry[kind].set(adapter.name, adapter);
}

function getAdapter(kind, name) {
  return registry[kind] ? registry[kind].get(name) : undefined;
}

/**
 * Returns ordered list of adapter names usable for the given lang.
 * - For lang "auto" on STT: only adapters with autoDetect=true (+ browser).
 * - "browser" always appended for stt/tts if not already present.
 */
function getChain(kind, langCode) {
  const cfg = loadConfig();
  const kindCfg = cfg[kind];
  if (!kindCfg) return [];

  const ordered = [kindCfg.primary, ...kindCfg.fallbacks];
  const isAuto = langCode === 'auto';

  const result = [];
  for (const name of ordered) {
    const adapter = registry[kind] ? registry[kind].get(name) : undefined;
    if (!adapter) continue;
    if (!adapter.isConfigured()) continue;
    if (isAuto && kind === 'stt' && !adapter.autoDetect && name !== 'browser') continue;
    if (langCode && langCode !== 'auto' && !adapter.supports(langCode)) continue;
    if (!result.includes(name)) result.push(name);
  }

  // Always append "browser" for stt/tts
  if ((kind === 'stt' || kind === 'tts') && !result.includes('browser')) {
    result.push('browser');
  }

  return result;
}

function getConfig() {
  const cfg = loadConfig();
  return {
    stt: { primary: cfg.stt.primary, fallbacks: cfg.stt.fallbacks },
    tts: { primary: cfg.tts.primary, fallbacks: cfg.tts.fallbacks },
    translate: { primary: cfg.translate.primary, fallbacks: cfg.translate.fallbacks },
  };
}

function setConfig(patch) {
  const cfg = loadConfig();
  for (const kind of ['stt', 'tts', 'translate']) {
    if (patch[kind]) {
      if (patch[kind].primary !== undefined) cfg[kind].primary = patch[kind].primary;
      if (patch[kind].fallbacks !== undefined) cfg[kind].fallbacks = patch[kind].fallbacks;
    }
  }
  _config = cfg;
  saveConfig(cfg);
}

function capabilities() {
  const result = { stt: {}, tts: {}, translate: {} };

  for (const kind of Object.keys(result)) {
    const map = registry[kind];
    if (!map) continue;
    for (const [name, adapter] of map) {
      const entry = {
        configured: adapter.isConfigured(),
      };
      if (kind === 'stt') {
        entry.autoDetect = !!adapter.autoDetect;
        entry.languages = adapter.languages || [];
      }
      if (kind === 'tts') {
        entry.languages = adapter.languages || [];
      }
      if (kind === 'translate') {
        entry.languages = adapter.languages || [];
      }
      result[kind][name] = entry;
    }
  }

  return result;
}

module.exports = { registerAdapter, getAdapter, getChain, getConfig, setConfig, capabilities };
