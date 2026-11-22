/* global BobLang */
'use strict';

(function () {
  // ── api helper ─────────────────────────────────────────────────────────────
  function api(path, opts) {
    opts = opts || {};
    var fetchOpts = {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: {},
    };
    if (opts.body !== undefined) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.body);
    }
    return fetch(path, fetchOpts).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/login.html';
        return Promise.reject(new Error('Not logged in'));
      }
      return res.json().then(function (json) {
        if (!res.ok) {
          var err = new Error(json.error || 'Request failed');
          err.status = res.status;
          throw err;
        }
        return json;
      });
    });
  }

  // ── renderSpeakSelector ────────────────────────────────────────────────────
  // Shows "🗣 Speak in:" segmented radio group.
  // opts: { myLang, otherLang, value, autoAvailable, onChange }
  function renderSpeakSelector(el, opts) {
    var myLang    = opts.myLang    || 'en';
    var otherLang = opts.otherLang || 'en';
    var value     = opts.value     || 'auto';
    var onChange  = opts.onChange  || function () {};

    var myName    = langName(myLang);
    var otherName = langName(otherLang);

    // Build options, deduplicating when languages coincide
    var options = [];
    if (opts.autoAvailable) {
      options.push({ key: 'auto',    label: 'Auto-detect' });
    }
    options.push({ key: 'english', label: 'English' });
    // "My language" – skip if same as English
    if (myLang !== 'en') {
      options.push({ key: 'native', label: 'My language (' + myName + ')' });
    }
    // "Their language" – skip if same as my or english
    if (otherLang !== 'en' && otherLang !== myLang) {
      options.push({ key: 'other', label: 'Their language (' + otherName + ')' });
    }

    el.innerHTML = '';
    var label = document.createElement('div');
    label.className = 'form-group';
    label.textContent = '🗣 Speak in:';
    el.appendChild(label);

    var group = document.createElement('div');
    group.className = 'segmented';

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary' + (opt.key === value ? ' active' : '');
      btn.textContent = opt.label;
      btn.dataset.value = opt.key;
      btn.addEventListener('click', function () {
        group.querySelectorAll('.btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        onChange(opt.key);
      });
      group.appendChild(btn);
    });

    el.appendChild(group);
  }

  // ── renderListenSelector ───────────────────────────────────────────────────
  // Shows "🔊 Listen in:" segmented radio group.
  // opts: { myLang, value, onChange }
  function renderListenSelector(el, opts) {
    var myLang   = opts.myLang  || 'en';
    var value    = opts.value   || 'original';
    var onChange = opts.onChange || function () {};

    var myName = langName(myLang);

    var options = [
      { key: 'original', label: 'Original' },
    ];
    if (myLang !== 'en') {
      options.push({ key: 'native', label: 'My language (' + myName + ')' });
    }
    options.push({ key: 'english', label: 'English' });

    el.innerHTML = '';
    var label = document.createElement('div');
    label.className = 'form-group';
    label.textContent = '🔊 Listen in:';
    el.appendChild(label);

    var group = document.createElement('div');
    group.className = 'segmented';

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary' + (opt.key === value ? ' active' : '');
      btn.textContent = opt.label;
      btn.dataset.value = opt.key;
      btn.addEventListener('click', function () {
        group.querySelectorAll('.btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        onChange(opt.key);
      });
      group.appendChild(btn);
    });

    el.appendChild(group);
  }

  // ── resolveSpeakLang ───────────────────────────────────────────────────────
  // Returns a language code or "auto".
  function resolveSpeakLang(pref, myLang, otherLang) {
    if (pref === 'auto')    return 'auto';
    if (pref === 'english') return 'en';
    if (pref === 'native')  return myLang || 'en';
    if (pref === 'other')   return otherLang || 'en';
    return 'auto';
  }

  // ── resolveListenLang ──────────────────────────────────────────────────────
  // Returns a language code to display for a given message.
  function resolveListenLang(pref, message, myLang) {
    var translations = message.translations || {};
    var original = message.detectedLang || 'en';

    function bestOf(codes) {
      for (var i = 0; i < codes.length; i++) {
        if (translations[codes[i]] !== undefined) return codes[i];
      }
      return original;
    }

    if (pref === 'original') return original;
    if (pref === 'native')   return bestOf([myLang, 'en', original]);
    if (pref === 'english')  return bestOf(['en', original]);
    return original;
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function langName(code) {
    if (typeof BobLang !== 'undefined' && BobLang.name) {
      return BobLang.name(code) || code;
    }
    return code;
  }

  // ── export ─────────────────────────────────────────────────────────────────
  window.BobPrefs = {
    renderSpeakSelector: renderSpeakSelector,
    renderListenSelector: renderListenSelector,
    resolveSpeakLang: resolveSpeakLang,
    resolveListenLang: resolveListenLang,
    api: api,
  };
})();
