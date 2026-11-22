(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

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

  function setError(elId, msg) {
    var el = document.getElementById(elId);
    if (el) el.textContent = msg || '';
  }

  function clearErrors() {
    ['login-error', 'register-error', 'role-error'].forEach(function (id) {
      setError(id, '');
    });
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }

  // ── Check if already logged in ───────────────────────────────────────────────

  function checkSession() {
    api('/api/auth/me').then(function (data) {
      if (data && data.user) {
        window.location.replace('/dashboard.html');
      }
    }).catch(function () {
      // Not logged in — stay on the page
    });
  }

  // ── Login page ───────────────────────────────────────────────────────────────

  function initLogin() {
    var form = document.getElementById('login-form');
    if (!form) return;

    var btn = document.getElementById('login-btn');
    btn.dataset.label = btn.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      var email    = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('login-error', 'Please enter a valid email address.');
        return;
      }
      if (!password) {
        setError('login-error', 'Please enter your password.');
        return;
      }

      setLoading(btn, true);

      api('/api/auth/login', { method: 'POST', body: { email: email, password: password } })
        .then(function () {
          window.location.replace('/dashboard.html');
        })
        .catch(function (err) {
          setError('login-error', err.message || 'Invalid email or password.');
          setLoading(btn, false);
        });
    });
  }

  // ── Register page ────────────────────────────────────────────────────────────

  function initRegister() {
    var form = document.getElementById('register-form');
    if (!form) return;

    var btn = document.getElementById('register-btn');
    btn.dataset.label = btn.textContent;

    // Populate language select
    var langSelect = document.getElementById('language');
    var guessed = (window.BobLang && window.BobLang.guessFromBrowser)
      ? window.BobLang.guessFromBrowser()
      : 'en';
    var langs = window.BOB_LANGUAGES || [];

    langs.forEach(function (l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.name + ' (' + l.nativeName + ')';
      if (l.code === guessed) opt.selected = true;
      langSelect.appendChild(opt);
    });

    // Track whether user manually changed the language
    var languageChanged = false;
    langSelect.addEventListener('change', function () {
      languageChanged = true;
      document.getElementById('lang-hint').textContent = '';
    });

    // Role segmented control
    var selectedRole = null;
    var roleButtons = form.querySelectorAll('#role-toggle button');
    roleButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedRole = btn.dataset.role;
        roleButtons.forEach(function (b) {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        setError('role-error', '');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      var name     = document.getElementById('name').value.trim();
      var email    = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var lang     = langSelect.value;

      var valid = true;

      if (!name) {
        setError('register-error', 'Please enter your full name.');
        valid = false;
      } else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('register-error', 'Please enter a valid email address.');
        valid = false;
      } else if (!password || password.length < 6) {
        setError('register-error', 'Password must be at least 6 characters.');
        valid = false;
      } else if (!selectedRole) {
        setError('role-error', 'Please select Patient or Doctor.');
        valid = false;
      } else if (!lang) {
        setError('register-error', 'Please select your language.');
        valid = false;
      }

      if (!valid) return;

      setLoading(btn, true);

      var payload = {
        name: name,
        email: email,
        password: password,
        role: selectedRole,
        nativeLanguage: lang,
        languageSource: languageChanged ? 'manual' : 'browser',
        preferences: { speakIn: 'native', listenIn: 'native', autoPlay: true },
      };

      api('/api/auth/register', { method: 'POST', body: payload })
        .then(function () {
          window.location.replace('/dashboard.html');
        })
        .catch(function (err) {
          if (err.status === 409) {
            setError('register-error', 'An account with this email already exists.');
          } else {
            setError('register-error', err.message || 'Registration failed. Please try again.');
          }
          setLoading(btn, false);
        });
    });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    checkSession();
    initLogin();
    initRegister();
  });

}());
