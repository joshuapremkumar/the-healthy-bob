/* global io, BobLang, BobSpeech, BobPrefs */
'use strict';

(function () {
  // ── query params ──────────────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var consultId = params.get('id');
  if (!consultId) { window.location.href = '/dashboard.html'; return; }

  // ── state ─────────────────────────────────────────────────────────────────
  var me = null;
  var consultation = null;
  var doctorUser = null;
  var patientUser = null;
  var myLang = 'en';
  var otherLang = 'en';
  var providerConfig = {};
  var providerCaps = {};
  var autoAvailable = false;
  var renderedMessageIds = {};

  var speakPref   = 'auto';
  var listenPref  = 'original';
  var autoPlay    = true;

  var recorder      = null;
  var isRecording   = false;
  var sttLanguage   = null;
  var sttConfidence = null;
  var sttProvider   = null;
  var autoSendTimer = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var messagesEl      = document.getElementById('messages');
  var statusEl        = document.getElementById('status');
  var micBtn          = document.getElementById('mic-btn');
  var textInput       = document.getElementById('text-input');
  var sendBtn         = document.getElementById('send-btn');
  var exportBtn       = document.getElementById('export-btn');
  var levelFill       = document.getElementById('level-fill');
  var autoPlayChk     = document.getElementById('autoplay-checkbox');
  var speakSel        = document.getElementById('speak-selector');
  var listenSel       = document.getElementById('listen-selector');
  var consultCodeBadge = document.getElementById('consult-code-badge');
  var providerBadges  = document.getElementById('provider-badges');
  var doctorBadge     = document.getElementById('doctor-badge');
  var patientBadge    = document.getElementById('patient-badge');
  var waitingNotice   = document.getElementById('waiting-notice');
  var shareCode       = document.getElementById('share-code');
  var voiceUnsupported = document.getElementById('voice-unsupported');
  var logoutBtn       = document.getElementById('logout-btn');

  var api = BobPrefs.api;

  // ── helpers ───────────────────────────────────────────────────────────────
  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function langName(code) {
    if (typeof BobLang !== 'undefined' && BobLang.name) return BobLang.name(code) || code;
    return code;
  }

  function formatTime(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function isRtl(code) {
    return code === 'ar' || code === 'ur';
  }

  // debounce
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // ── preference save (debounced) ───────────────────────────────────────────
  var savePrefs = debounce(function () {
    api('/api/auth/me', {
      method: 'PATCH',
      body: { preferences: { speakIn: speakPref, listenIn: listenPref, autoPlay: autoPlay } }
    }).catch(function (e) { console.warn('Failed to save prefs', e); });
  }, 500);

  // ── render selectors ──────────────────────────────────────────────────────
  function renderSelectors() {
    BobPrefs.renderSpeakSelector(speakSel, {
      myLang: myLang, otherLang: otherLang, value: speakPref,
      autoAvailable: autoAvailable,
      onChange: function (v) {
        speakPref = v;
        savePrefs();
      }
    });
    BobPrefs.renderListenSelector(listenSel, {
      myLang: myLang, value: listenPref,
      onChange: function (v) {
        listenPref = v;
        reRenderAllMessages();
        savePrefs();
      }
    });
  }

  // ── provider badges ───────────────────────────────────────────────────────
  function renderProviderBadges() {
    var cfg = providerConfig;
    var parts = [];
    if (cfg.stt)       parts.push('STT: ' + cfg.stt.primary);
    if (cfg.translate) parts.push('Translate: ' + cfg.translate.primary);
    if (cfg.tts)       parts.push('TTS: ' + cfg.tts.primary);
    providerBadges.textContent = parts.join(' · ');
  }

  // ── participants header ───────────────────────────────────────────────────
  function renderParticipants() {
    if (!consultation) return;
    consultCodeBadge.textContent = 'Code: ' + consultation.code;
    shareCode.textContent = consultation.code;

    if (doctorUser) {
      doctorBadge.textContent = 'Dr. ' + doctorUser.name + ' [' + langName(doctorUser.nativeLanguage) + ']';
    }
    if (patientUser) {
      patientBadge.textContent = patientUser.name + ' [' + langName(patientUser.nativeLanguage) + ']';
      waitingNotice.style.display = 'none';
    } else {
      patientBadge.textContent = 'Patient: (not yet joined)';
      waitingNotice.style.display = '';
    }
  }

  // ── message rendering ─────────────────────────────────────────────────────
  function renderMessage(msg, prepend) {
    if (renderedMessageIds[msg.id]) {
      // update existing message text in place
      var existingEl = document.getElementById('msg-' + msg.id);
      if (existingEl) updateMessageText(existingEl, msg);
      return;
    }
    renderedMessageIds[msg.id] = true;

    var isMine = msg.senderId === (me && me.id);
    var div = document.createElement('div');
    div.className = 'msg ' + (isMine ? 'msg-mine' : 'msg-theirs');
    div.id = 'msg-' + msg.id;
    div.dataset.msgId = msg.id;
    if (isRtl(msg.detectedLang)) div.classList.add('rtl');

    // Header: sender + time
    var header = document.createElement('div');
    header.className = 'msg-meta';
    var senderName = isMine
      ? (me ? me.name : 'You')
      : (msg.senderRole === 'doctor'
          ? (doctorUser ? doctorUser.name : 'Doctor')
          : (patientUser ? patientUser.name : 'Patient'));

    var pct = msg.detectConfidence != null
      ? Math.round(msg.detectConfidence * 100) + '%'
      : '—';
    var method = (msg.providers && msg.providers.stt) ? msg.providers.stt : (msg.detectMethod || '—');
    var translateProv = (msg.providers && msg.providers.translate) ? msg.providers.translate : '—';

    var metaSpan = document.createElement('span');
    metaSpan.textContent =
      senderName + ' · ' + formatTime(msg.createdAt) + ' · ' +
      (msg.inputMode === 'voice' ? '🎙 voice' : '⌨ text') +
      ' · detected ' + langName(msg.detectedLang) + ' (' + pct + ') via ' + method +
      ' · translated by ' + translateProv;
    header.appendChild(metaSpan);
    div.appendChild(header);

    // Main text
    var textDiv = document.createElement('div');
    textDiv.className = 'msg-text';
    updateMessageText(div, msg, textDiv);
    div.appendChild(textDiv);

    // Version tabs
    var tabsDiv = document.createElement('div');
    tabsDiv.className = 'msg-versions';
    buildVersionTabs(tabsDiv, msg);
    div.appendChild(tabsDiv);

    if (prepend) {
      messagesEl.insertBefore(div, messagesEl.firstChild);
    } else {
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function updateMessageText(msgEl, msg, textDivArg) {
    var textDiv = textDivArg || msgEl.querySelector('.msg-text');
    if (!textDiv) return;
    var langCode = BobPrefs.resolveListenLang(listenPref, msg, myLang);
    var text = (msg.translations && msg.translations[langCode]) || msg.originalText;
    textDiv.textContent = text;
    if (isRtl(langCode)) {
      textDiv.setAttribute('dir', 'rtl');
    } else {
      textDiv.removeAttribute('dir');
    }
  }

  function buildVersionTabs(tabsDiv, msg) {
    tabsDiv.innerHTML = '';
    var translations = msg.translations || {};

    // Collect unique version tabs
    var tabs = [];
    var seen = {};

    function addTab(code, label) {
      if (seen[code]) return;
      if (translations[code] === undefined && code !== msg.detectedLang) return;
      seen[code] = true;
      tabs.push({ code: code, label: label });
    }

    addTab(msg.detectedLang, 'Original (' + langName(msg.detectedLang) + ')');
    addTab('en', 'English');
    if (patientUser) addTab(patientUser.nativeLanguage, langName(patientUser.nativeLanguage));
    if (doctorUser)  addTab(doctorUser.nativeLanguage,  langName(doctorUser.nativeLanguage));

    var activeCode = BobPrefs.resolveListenLang(listenPref, msg, myLang);

    tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'version-tab' + (tab.code === activeCode ? ' active' : '');
      btn.textContent = tab.label;

      // Speak button
      var speakBtnEl = document.createElement('button');
      speakBtnEl.type = 'button';
      speakBtnEl.className = 'btn btn-secondary';
      speakBtnEl.style.padding = '0 0.3rem';
      speakBtnEl.textContent = '🔊';
      speakBtnEl.title = 'Speak in ' + langName(tab.code);
      speakBtnEl.addEventListener('click', function (e) {
        e.stopPropagation();
        var text = translations[tab.code] || msg.originalText;
        if (typeof BobSpeech !== 'undefined') {
          BobSpeech.speak(text, tab.code).then(function (result) {
            setStatus('Playing via ' + (result && result.provider ? result.provider : 'TTS') + '…');
            setTimeout(function () { setStatus(''); }, 2000);
          }).catch(function (err) {
            setStatus('TTS error: ' + err.message);
          });
        }
      });

      btn.addEventListener('click', function () {
        // switch displayed text
        var textDiv = btn.closest('.msg').querySelector('.msg-text');
        if (textDiv) {
          textDiv.textContent = translations[tab.code] || msg.originalText;
          if (isRtl(tab.code)) textDiv.setAttribute('dir', 'rtl');
          else textDiv.removeAttribute('dir');
        }
        tabsDiv.querySelectorAll('.version-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });

      var wrapper = document.createElement('span');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '2px';
      wrapper.appendChild(btn);
      wrapper.appendChild(speakBtnEl);
      tabsDiv.appendChild(wrapper);
    });
  }

  function reRenderAllMessages() {
    var allMsgEls = messagesEl.querySelectorAll('.msg');
    // We need the original messages; look them up from stored consultation data
    if (!consultation) return;
    var msgMap = {};
    consultation.messages.forEach(function (m) { msgMap[m.id] = m; });

    allMsgEls.forEach(function (el) {
      var id = el.dataset.msgId;
      if (id && msgMap[id]) {
        updateMessageText(el, msgMap[id]);
      }
    });
  }

  // ── mic ───────────────────────────────────────────────────────────────────
  function setupMic() {
    var support = typeof BobSpeech !== 'undefined'
      ? BobSpeech.isSupported()
      : { record: false, browserStt: false, browserTts: false };

    if (!support.record && !support.browserStt) {
      micBtn.style.display = 'none';
      voiceUnsupported.style.display = '';
      return;
    }

    if (typeof BobSpeech !== 'undefined') {
      recorder = BobSpeech.createRecorder({
        onLevel: function (level) {
          levelFill.style.width = Math.min(100, Math.round(level * 100)) + '%';
        }
      });
    }

    micBtn.addEventListener('click', function () {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  function startRecording() {
    if (!recorder) return;
    BobSpeech.stopSpeaking();
    clearAutoSend();
    isRecording = true;
    micBtn.classList.add('recording');
    sttLanguage = null; sttConfidence = null; sttProvider = null;

    var speakLang = BobPrefs.resolveSpeakLang(speakPref, myLang, otherLang);
    var langLabel = speakLang === 'auto' ? 'Auto-detect' : langName(speakLang);
    setStatus('Listening… (' + langLabel + ')');

    recorder.start().catch(function (e) {
      isRecording = false;
      micBtn.classList.remove('recording');
      setStatus('Microphone error: ' + e.message);
    });
  }

  function stopRecording() {
    if (!recorder || !isRecording) return;
    isRecording = false;
    micBtn.classList.remove('recording');
    levelFill.style.width = '0%';
    setStatus('Transcribing…');

    recorder.stop().then(function (blob) {
      var speakLang = BobPrefs.resolveSpeakLang(speakPref, myLang, otherLang);
      return BobSpeech.transcribe(blob, speakLang).then(function (result) {
        sttLanguage   = result.language   || null;
        sttConfidence = result.confidence != null ? result.confidence : null;
        sttProvider   = result.provider   || null;
        textInput.value = result.text || '';
        setStatus('Got transcript – sending in 1.5 s… (type to cancel)');
        scheduleAutoSend();
      });
    }).catch(function (err) {
      if (err && err.code === 'USE_BROWSER') {
        setStatus('Using browser STT – please speak again…');
        var speakLang = BobPrefs.resolveSpeakLang(speakPref, myLang, otherLang);
        var locale = typeof BobLang !== 'undefined'
          ? BobLang.locale(speakLang === 'auto' ? myLang : speakLang)
          : (speakLang === 'auto' ? myLang : speakLang);
        BobSpeech.browserListen(
          locale,
          function (finalText) {
            textInput.value = finalText;
            setStatus('Got transcript – sending in 1.5 s… (type to cancel)');
            scheduleAutoSend();
          },
          function (interim) { setStatus('Hearing: ' + interim); },
          function (e)       { setStatus('Browser STT error: ' + e.message); },
          function ()        { /* ended */ }
        );
      } else {
        setStatus('Transcription failed: ' + (err && err.message ? err.message : 'unknown error'));
      }
    });
  }

  function scheduleAutoSend() {
    clearAutoSend();
    autoSendTimer = setTimeout(function () {
      if (textInput.value.trim()) send('voice');
    }, 1500);
  }

  function clearAutoSend() {
    if (autoSendTimer) { clearTimeout(autoSendTimer); autoSendTimer = null; }
  }

  // ── send ──────────────────────────────────────────────────────────────────
  function send(inputMode) {
    var text = textInput.value.trim();
    if (!text) return;

    var speakLang = BobPrefs.resolveSpeakLang(speakPref, myLang, otherLang);
    var spokenLang = speakLang === 'auto'
      ? (sttLanguage || myLang)
      : speakLang;

    var body = {
      text: text,
      spokenLang: spokenLang,
      inputMode: inputMode || 'text',
    };
    if (sttLanguage)   body.sttLanguage   = sttLanguage;
    if (sttConfidence != null) body.sttConfidence = sttConfidence;
    if (sttProvider)   body.sttProvider   = sttProvider;

    textInput.value = '';
    sttLanguage = null; sttConfidence = null; sttProvider = null;

    // disable composer
    setComposerEnabled(false);
    setStatus('Translating…');

    api('/api/consultations/' + consultId + '/messages', { method: 'POST', body: body })
      .then(function () {
        setStatus('');
        // message will arrive via socket
      })
      .catch(function (e) {
        setStatus('Send failed: ' + e.message);
      })
      .finally(function () {
        setComposerEnabled(true);
      });
  }

  function setComposerEnabled(enabled) {
    textInput.disabled  = !enabled;
    sendBtn.disabled    = !enabled;
    micBtn.disabled     = !enabled;
  }

  // ── socket ────────────────────────────────────────────────────────────────
  function setupSocket() {
    var socket = io();

    socket.on('connect', function () {
      socket.emit('join', { consultationId: consultId });
    });

    socket.on('message:new', function (msg) {
      // Store on consultation
      if (consultation) {
        var exists = consultation.messages.some(function (m) { return m.id === msg.id; });
        if (!exists) consultation.messages.push(msg);
      }
      var isMine = msg.senderId === (me && me.id);
      renderMessage(msg);
      if (!isMine && autoPlay && typeof BobSpeech !== 'undefined') {
        var langCode = BobPrefs.resolveListenLang(listenPref, msg, myLang);
        var text = (msg.translations && msg.translations[langCode]) || msg.originalText;
        BobSpeech.speak(text, langCode).catch(function () {});
      }
    });

    socket.on('participant:joined', function (data) {
      if (data && data.patient) {
        patientUser = data.patient;
        otherLang = me && me.role === 'patient' ? (doctorUser ? doctorUser.nativeLanguage : 'en') : patientUser.nativeLanguage;
        renderParticipants();
        renderSelectors();
      }
    });

    socket.on('profile:updated', function (data) {
      if (!data) return;
      // update local copies
      if (doctorUser  && doctorUser.id  === data.userId) doctorUser.nativeLanguage  = data.nativeLanguage;
      if (patientUser && patientUser.id === data.userId) patientUser.nativeLanguage = data.nativeLanguage;

      if (me && me.id === data.userId) {
        myLang = data.nativeLanguage;
        setStatus('We detected you speak ' + langName(data.nativeLanguage) + ' – your profile was updated');
        setTimeout(function () { setStatus(''); }, 4000);
      } else {
        otherLang = data.nativeLanguage;
      }
      renderParticipants();
      renderSelectors();
    });

    socket.on('providers:updated', function () {
      api('/api/config/providers').then(function (data) {
        providerConfig = data.config || {};
        providerCaps   = data.capabilities || {};
        autoAvailable  = computeAutoAvailable();
        renderProviderBadges();
        renderSelectors();
      }).catch(function () {});
    });
  }

  function computeAutoAvailable() {
    var stt = providerCaps && providerCaps.stt;
    if (!stt) return false;
    return Object.keys(stt).some(function (name) {
      return stt[name].configured && stt[name].autoDetect;
    });
  }

  // ── export ────────────────────────────────────────────────────────────────
  function exportTranscript() {
    if (!consultation || !consultation.messages.length) {
      setStatus('No messages to export.');
      return;
    }
    var lines = ['BobHealth Transcript – ' + consultation.code + '\n'];
    consultation.messages.forEach(function (msg) {
      var senderName = msg.senderRole === 'doctor'
        ? (doctorUser ? doctorUser.name : 'Doctor')
        : (patientUser ? patientUser.name : 'Patient');

      lines.push('---');
      lines.push('[' + formatTime(msg.createdAt) + '] ' + senderName + ' (' + msg.senderRole + ')');
      lines.push('Original (' + langName(msg.detectedLang) + '): ' + msg.originalText);
      lines.push('English: ' + ((msg.translations && msg.translations['en']) || '—'));
      if (doctorUser)  lines.push(langName(doctorUser.nativeLanguage)  + ': ' + ((msg.translations && msg.translations[doctorUser.nativeLanguage])  || '—'));
      if (patientUser) lines.push(langName(patientUser.nativeLanguage) + ': ' + ((msg.translations && msg.translations[patientUser.nativeLanguage]) || '—'));
      lines.push('Providers – STT: ' + ((msg.providers && msg.providers.stt) || '—') + '  Translate: ' + ((msg.providers && msg.providers.translate) || '—'));
    });

    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'bobhealth-' + consultation.code + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── init ──────────────────────────────────────────────────────────────────
  function init() {
    Promise.all([
      api('/api/auth/me'),
      api('/api/consultations/' + consultId),
      api('/api/config/providers'),
    ]).then(function (results) {
      var meData      = results[0];
      var consultData = results[1];
      var provData    = results[2];

      me           = meData.user;
      consultation = consultData.consultation;
      doctorUser   = consultData.doctor;
      patientUser  = consultData.patient;
      providerConfig = provData.config       || {};
      providerCaps   = provData.capabilities || {};
      autoAvailable  = computeAutoAvailable();

      myLang = me.nativeLanguage || 'en';
      if (me.role === 'doctor') {
        otherLang = patientUser ? patientUser.nativeLanguage : 'en';
      } else {
        otherLang = doctorUser ? doctorUser.nativeLanguage : 'en';
      }

      // Load saved prefs
      var savedPrefs = (me.preferences || {});
      speakPref = savedPrefs.speakIn  || 'auto';
      listenPref = savedPrefs.listenIn || 'original';
      autoPlay   = savedPrefs.autoPlay !== undefined ? savedPrefs.autoPlay : true;
      autoPlayChk.checked = autoPlay;

      renderParticipants();
      renderProviderBadges();
      renderSelectors();
      setupMic();
      setupSocket();

      // Render existing messages
      (consultation.messages || []).forEach(function (msg) { renderMessage(msg); });

    }).catch(function (e) {
      if (e && e.status === 403) {
        window.location.href = '/dashboard.html';
      } else {
        setStatus('Failed to load consultation: ' + (e && e.message ? e.message : 'unknown error'));
      }
    });
  }

  // ── event listeners ───────────────────────────────────────────────────────
  sendBtn.addEventListener('click', function () { clearAutoSend(); send('text'); });

  textInput.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'Enter') { clearAutoSend(); send('text'); }
  });

  textInput.addEventListener('input', function () {
    clearAutoSend(); // typing cancels auto-send
  });

  textInput.addEventListener('focus', function () {
    clearAutoSend();
  });

  autoPlayChk.addEventListener('change', function () {
    autoPlay = autoPlayChk.checked;
    savePrefs();
  });

  exportBtn.addEventListener('click', exportTranscript);

  logoutBtn.addEventListener('click', function () {
    api('/api/auth/logout', { method: 'POST' }).finally(function () {
      window.location.href = '/login.html';
    });
  });

  // ── kick off ──────────────────────────────────────────────────────────────
  init();

})();
