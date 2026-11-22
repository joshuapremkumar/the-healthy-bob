(function () {
  'use strict';

  // ── API helper ───────────────────────────────────────────────────────────────

  function api(path, opts) {
    // Use BobPrefs.api if available, otherwise local wrapper
    if (typeof BobPrefs !== 'undefined' && typeof BobPrefs.api === 'function') {
      return BobPrefs.api(path, opts);
    }
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
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  // ── State ────────────────────────────────────────────────────────────────────

  var currentUser = null;
  var providerConfig = null;
  var providerCaps = null;

  // ── Utility ──────────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function setError(elId, msg) {
    var el = $(elId);
    if (el) el.textContent = msg || '';
  }

  function showSaved(elId) {
    var el = $(elId);
    if (!el) return;
    el.style.display = 'inline';
    setTimeout(function () { el.style.display = 'none'; }, 2500);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function langName(code) {
    return (window.BobLang && window.BobLang.name) ? window.BobLang.name(code) : code;
  }

  function langSourceText(src) {
    if (src === 'manual')   return 'set by you';
    if (src === 'browser')  return 'from your browser';
    if (src === 'detected') return 'auto-detected from your speech';
    return '';
  }

  // ── Topbar ───────────────────────────────────────────────────────────────────

  function renderTopbar(user) {
    $('topbar-name').textContent = user.name;

    var roleBadge = $('topbar-role');
    roleBadge.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    roleBadge.className = 'badge badge-' + user.role;

    var langBadge = $('topbar-lang');
    langBadge.textContent = langName(user.nativeLanguage);

    $('logout-btn').addEventListener('click', function () {
      api('/api/auth/logout', { method: 'POST' }).finally(function () {
        window.location.replace('/login.html');
      });
    });
  }

  // ── Doctor: start consultation ────────────────────────────────────────────────

  function initDoctorSection() {
    $('doctor-section').hidden = false;

    $('start-consult-btn').addEventListener('click', function () {
      var btn = $('start-consult-btn');
      btn.disabled = true;
      btn.textContent = 'Creating…';

      api('/api/consultations', { method: 'POST' })
        .then(function (data) {
          var c = data.consultation;
          $('consult-code').textContent = c.code;

          var link = $('open-consult-link');
          link.href = '/consult.html?id=' + encodeURIComponent(c.id);

          $('new-consult-result').hidden = false;
          btn.textContent = '+ New consultation';
          btn.disabled = false;

          // Refresh list
          loadConsultations();
        })
        .catch(function (err) {
          alert('Could not start consultation: ' + err.message);
          btn.textContent = '+ New consultation';
          btn.disabled = false;
        });
    });

    $('copy-code-btn').addEventListener('click', function () {
      var code = $('consult-code').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () {
          $('copy-code-btn').textContent = 'Copied!';
          setTimeout(function () { $('copy-code-btn').textContent = 'Copy code'; }, 1500);
        });
      }
    });
  }

  // ── Patient: join consultation ────────────────────────────────────────────────

  function initPatientSection() {
    $('patient-section').hidden = false;

    $('join-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setError('join-error', '');

      var code = $('join-code').value.trim().toUpperCase();
      if (code.length !== 6) {
        setError('join-error', 'Please enter the 6-character consultation code.');
        return;
      }

      var btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Joining…';

      api('/api/consultations/join', { method: 'POST', body: { code: code } })
        .then(function (data) {
          var c = data.consultation;
          window.location.href = '/consult.html?id=' + encodeURIComponent(c.id);
        })
        .catch(function (err) {
          setError('join-error', err.message || 'Could not join. Check the code and try again.');
          btn.disabled = false;
          btn.textContent = 'Join';
        });
    });
  }

  // ── Consultations list ────────────────────────────────────────────────────────

  function loadConsultations() {
    api('/api/consultations').then(function (data) {
      var list = (data.consultations || []).slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      if (list.length === 0) {
        $('consult-empty').hidden = false;
        $('consult-table-wrap').hidden = true;
        return;
      }

      $('consult-empty').hidden = true;
      $('consult-table-wrap').hidden = false;

      var tbody = $('consult-tbody');
      tbody.innerHTML = '';

      list.forEach(function (c) {
        var isDoctor = currentUser && currentUser.role === 'doctor';
        var other = isDoctor ? c.patient : c.doctor;
        var otherName = other ? other.name : '—';
        var otherLang = other ? langName(other.nativeLanguage) : '';

        var tr = document.createElement('tr');

        var tdDate = document.createElement('td');
        tdDate.textContent = formatDate(c.createdAt);

        var tdOther = document.createElement('td');
        tdOther.textContent = otherName;
        if (otherLang) {
          var langSpan = document.createElement('span');
          langSpan.className = 'badge badge-lang';
          langSpan.textContent = otherLang;
          langSpan.style.marginLeft = '6px';
          tdOther.appendChild(langSpan);
        }

        var tdStatus = document.createElement('td');
        var statusBadge = document.createElement('span');
        statusBadge.className = 'badge';
        statusBadge.textContent = c.status;
        if (c.status === 'active') {
          statusBadge.style.background = 'var(--color-patient-bg)';
          statusBadge.style.color = 'var(--color-patient)';
        }
        tdStatus.appendChild(statusBadge);

        var tdMsgs = document.createElement('td');
        tdMsgs.textContent = c.messageCount != null ? c.messageCount : '—';

        var tdLink = document.createElement('td');
        var a = document.createElement('a');
        a.href = '/consult.html?id=' + encodeURIComponent(c.id);
        a.className = 'btn btn-secondary';
        a.style.padding = '4px 10px';
        a.style.fontSize = '.8rem';
        a.textContent = 'Open';
        tdLink.appendChild(a);

        tr.appendChild(tdDate);
        tr.appendChild(tdOther);
        tr.appendChild(tdStatus);
        tr.appendChild(tdMsgs);
        tr.appendChild(tdLink);
        tbody.appendChild(tr);
      });
    }).catch(function () {
      // Non-fatal — list stays empty
    });
  }

  // ── Preferences card ──────────────────────────────────────────────────────────

  function initPrefsCard(user, capabilities) {
    // Populate language select
    var langSelect = $('pref-language');
    var langs = window.BOB_LANGUAGES || [];
    langs.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.name + ' (' + l.nativeName + ')';
      if (l.code === user.nativeLanguage) opt.selected = true;
      langSelect.appendChild(opt);
    });

    // languageSource hint
    var srcHint = $('pref-lang-source');
    var srcText = langSourceText(user.languageSource);
    if (srcText) srcHint.textContent = 'Language ' + srcText;

    // Speak-in segmented: show Auto-detect only when an STT adapter with autoDetect is configured
    var hasAutoDetect = false;
    if (capabilities && capabilities.stt) {
      Object.keys(capabilities.stt).forEach(function (k) {
        if (capabilities.stt[k].configured && capabilities.stt[k].autoDetect) {
          hasAutoDetect = true;
        }
      });
    }

    var speakToggle = $('speak-in-toggle');
    var speakOptions = [];
    if (hasAutoDetect) speakOptions.push({ val: 'auto',    label: 'Auto-detect' });
    speakOptions.push({ val: 'native',  label: 'My language' });
    speakOptions.push({ val: 'english', label: 'English' });
    speakOptions.push({ val: 'other',   label: 'Their language' });

    var currentSpeak = (user.preferences && user.preferences.speakIn) || 'native';
    speakOptions.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.val = opt.val;
      btn.textContent = opt.label;
      if (opt.val === currentSpeak) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
      btn.addEventListener('click', function () {
        speakToggle.querySelectorAll('button').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      });
      speakToggle.appendChild(btn);
    });

    // Listen-in segmented
    var currentListen = (user.preferences && user.preferences.listenIn) || 'native';
    var listenToggle = $('listen-in-toggle');
    listenToggle.querySelectorAll('button').forEach(function (btn) {
      if (btn.dataset.val === currentListen) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
      btn.addEventListener('click', function () {
        listenToggle.querySelectorAll('button').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    // Autoplay
    var autoPlayCheck = $('pref-autoplay');
    autoPlayCheck.checked = !!(user.preferences && user.preferences.autoPlay);

    // Save
    $('save-prefs-btn').addEventListener('click', function () {
      setError('prefs-error', '');

      var speakActive = speakToggle.querySelector('button.active');
      var listenActive = listenToggle.querySelector('button.active');

      var newLang = langSelect.value;
      var patch = {
        nativeLanguage: newLang,
        languageSource: (newLang !== user.nativeLanguage) ? 'manual' : user.languageSource,
        preferences: {
          speakIn:  speakActive ? speakActive.dataset.val : currentSpeak,
          listenIn: listenActive ? listenActive.dataset.val : currentListen,
          autoPlay: autoPlayCheck.checked,
        },
      };

      $('save-prefs-btn').disabled = true;

      api('/api/users/me', { method: 'PATCH', body: patch })
        .then(function (data) {
          currentUser = data.user;
          user = data.user;
          srcHint.textContent = 'Language ' + langSourceText(data.user.languageSource);
          // Update topbar lang badge
          $('topbar-lang').textContent = langName(data.user.nativeLanguage);
          showSaved('prefs-saved');
          $('save-prefs-btn').disabled = false;
        })
        .catch(function (err) {
          setError('prefs-error', err.message || 'Could not save preferences.');
          $('save-prefs-btn').disabled = false;
        });
    });
  }

  // ── Provider settings card ────────────────────────────────────────────────────

  var KIND_LABELS = { stt: 'Speech-to-Text', translate: 'Translation', tts: 'Text-to-Speech' };

  function renderProviders(config, capabilities, isDoctor) {
    var wrap = $('providers-wrap');
    wrap.innerHTML = '';

    var kinds = ['stt', 'translate', 'tts'];

    kinds.forEach(function (kind) {
      var caps = (capabilities && capabilities[kind]) || {};
      var kindConfig = (config && config[kind]) || {};
      var primary = kindConfig.primary || '';
      var fallbacks = kindConfig.fallbacks || [];

      var allNames = Object.keys(caps);
      if (allNames.length === 0) return;

      var heading = document.createElement('h3');
      heading.style.cssText = 'font-size:.875rem;font-weight:700;color:var(--grey-700);margin-bottom:8px;margin-top:16px';
      heading.textContent = KIND_LABELS[kind] || kind;
      wrap.appendChild(heading);

      var row = document.createElement('div');
      row.className = 'provider-row';

      // Primary select
      var labelEl = document.createElement('div');
      labelEl.className = 'provider-label';
      labelEl.textContent = 'Primary';
      row.appendChild(labelEl);

      var rightCol = document.createElement('div');

      var sel = document.createElement('select');
      sel.id = 'primary-' + kind;
      sel.disabled = !isDoctor;
      sel.style.cssText = 'width:100%;max-width:260px;padding:7px 10px;border:1px solid var(--grey-300);border-radius:4px;font-size:.875rem';

      allNames.forEach(function (name) {
        var cap = caps[name] || {};
        var opt = document.createElement('option');
        opt.value = name;
        var confMark = cap.configured ? ' ✓' : ' ✗';
        var langCount = Array.isArray(cap.languages) ? cap.languages.length : 0;
        opt.textContent = name + confMark + (langCount ? ' · ' + langCount + ' langs' : '');
        if (name === primary) opt.selected = true;
        sel.appendChild(opt);
      });

      rightCol.appendChild(sel);

      // Fallback checkboxes
      var fbLabel = document.createElement('div');
      fbLabel.style.cssText = 'font-size:.8rem;font-weight:600;color:var(--grey-500);margin-top:10px;margin-bottom:6px';
      fbLabel.textContent = 'Fallbacks (in order)';
      rightCol.appendChild(fbLabel);

      var fbList = document.createElement('div');
      fbList.className = 'fallback-list';
      fbList.id = 'fallbacks-' + kind;

      allNames.forEach(function (name) {
        var cap = caps[name] || {};
        var label = document.createElement('label');
        label.className = 'fallback-item';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        cb.disabled = !isDoctor;
        cb.checked = fallbacks.indexOf(name) !== -1;

        var nameSpan = document.createElement('span');
        nameSpan.textContent = name;

        var confBadge = document.createElement('span');
        confBadge.className = 'badge badge-provider';
        confBadge.style.padding = '1px 6px';
        confBadge.textContent = cap.configured ? '✓ configured' : '✗ not configured';
        if (!cap.configured) {
          confBadge.style.background = 'var(--color-danger-bg)';
          confBadge.style.color = 'var(--color-danger)';
        }

        var langBadge = null;
        if (Array.isArray(cap.languages) && cap.languages.length > 0) {
          langBadge = document.createElement('span');
          langBadge.className = 'badge badge-provider';
          langBadge.style.padding = '1px 6px';
          langBadge.textContent = cap.languages.length + ' langs';
        }

        label.appendChild(cb);
        label.appendChild(nameSpan);
        label.appendChild(confBadge);
        if (langBadge) label.appendChild(langBadge);
        fbList.appendChild(label);
      });

      rightCol.appendChild(fbList);
      row.appendChild(rightCol);
      wrap.appendChild(row);
    });

    // Show save button for doctors
    if (isDoctor) {
      $('providers-actions').hidden = false;

      $('save-providers-btn').addEventListener('click', function () {
        setError('providers-error', '');
        $('save-providers-btn').disabled = true;

        var patch = {};
        kinds.forEach(function (kind) {
          var sel = $('primary-' + kind);
          if (!sel) return;
          var fbList = $('fallbacks-' + kind);
          var checked = [];
          if (fbList) {
            fbList.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
              checked.push(cb.value);
            });
          }
          patch[kind] = { primary: sel.value, fallbacks: checked };
        });

        api('/api/config/providers', { method: 'PATCH', body: patch })
          .then(function (data) {
            providerConfig = (data.config || providerConfig);
            showSaved('providers-saved');
            $('save-providers-btn').disabled = false;
          })
          .catch(function (err) {
            setError('providers-error', err.message || 'Could not save provider settings.');
            $('save-providers-btn').disabled = false;
          });
      });
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // 1. Verify session
    api('/api/auth/me')
      .then(function (data) {
        currentUser = data.user;
        renderTopbar(currentUser);

        // 2. Role-specific sections
        if (currentUser.role === 'doctor') {
          initDoctorSection();
        } else {
          initPatientSection();
        }

        // 3. Consultation list
        loadConsultations();

        // 4. Provider config (needed for prefs card auto-detect option too)
        return api('/api/config/providers');
      })
      .then(function (data) {
        providerConfig = data.config;
        providerCaps   = data.capabilities;

        // 5. Prefs card (needs capabilities for auto-detect option)
        initPrefsCard(currentUser, providerCaps);

        // 6. Provider settings card
        renderProviders(providerConfig, providerCaps, currentUser.role === 'doctor');
      })
      .catch(function (err) {
        if (err && err.status === 401) {
          window.location.replace('/login.html');
        } else {
          // Provider config failed — still render prefs without auto-detect check
          if (currentUser) {
            initPrefsCard(currentUser, null);
            renderProviders(null, null, currentUser.role === 'doctor');
          }
        }
      });
  });

}());
