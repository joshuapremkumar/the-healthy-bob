(function () {
  'use strict';

  // ─── Shared state ────────────────────────────────────────────────────────────
  let _audioEl = null;    // reusable Audio element for server TTS
  let _currentObjURL = null;

  // ─── isSupported ─────────────────────────────────────────────────────────────
  function isSupported() {
    const record = !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (typeof MediaRecorder !== 'undefined')
    );
    const browserStt = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const browserTts = !!(window.speechSynthesis);
    return { record, browserStt, browserTts };
  }

  // ─── createRecorder ──────────────────────────────────────────────────────────
  function createRecorder({ onLevel } = {}) {
    let mediaStream = null;
    let mediaRecorder = null;
    let audioCtx = null;
    let analyser = null;
    let levelRaf = null;
    let resolveStop = null;
    let rejectStop = null;
    let chunks = [];
    let cancelled = false;
    let hardStopTimer = null;
    let silenceTimer = null;
    let speechDetected = false;
    const SILENCE_THRESHOLD = 0.01;
    const SILENCE_AFTER_SPEECH_MS = 1800;
    const HARD_STOP_MS = 60000;
    const LEVEL_FPS = 15;

    function computeRMS(dataArray) {
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / dataArray.length);
    }

    function startLevelLoop() {
      if (!analyser || !onLevel) return;
      const data = new Uint8Array(analyser.fftSize);
      let last = Date.now();

      function loop() {
        levelRaf = requestAnimationFrame(loop);
        const now = Date.now();
        if (now - last < 1000 / LEVEL_FPS) return;
        last = now;

        analyser.getByteTimeDomainData(data);
        const rms = computeRMS(data);
        if (typeof onLevel === 'function') onLevel(Math.min(1, rms * 6));

        // Silence detection
        if (rms > SILENCE_THRESHOLD) {
          speechDetected = true;
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
        } else if (speechDetected && !silenceTimer) {
          silenceTimer = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, SILENCE_AFTER_SPEECH_MS);
        }
      }

      loop();
    }

    function cleanup() {
      if (levelRaf) { cancelAnimationFrame(levelRaf); levelRaf = null; }
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      if (hardStopTimer) { clearTimeout(hardStopTimer); hardStopTimer = null; }
      if (audioCtx) { try { audioCtx.close(); } catch (_) {} audioCtx = null; }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
    }

    function start() {
      return navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      }).then(function (stream) {
        mediaStream = stream;
        chunks = [];
        cancelled = false;
        speechDetected = false;

        // Set up analyser
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        // Pick mime type
        const preferredMime = 'audio/webm;codecs=opus';
        const mime = MediaRecorder.isTypeSupported(preferredMime) ? preferredMime : '';

        const options = mime ? { mimeType: mime } : {};
        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = function () {
          cleanup();
          if (cancelled) {
            if (rejectStop) rejectStop(new Error('Recording cancelled'));
          } else {
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            if (resolveStop) resolveStop(blob);
          }
        };

        mediaRecorder.onerror = function (e) {
          cleanup();
          if (rejectStop) rejectStop(e.error || new Error('MediaRecorder error'));
        };

        mediaRecorder.start(100); // collect in 100 ms chunks
        startLevelLoop();

        // Hard stop after 60 s
        hardStopTimer = setTimeout(function () {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, HARD_STOP_MS);

        return undefined;
      }).catch(function (err) {
        cleanup();
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          const friendly = new Error('Microphone access was denied. Please allow microphone permission in your browser settings and try again.');
          friendly.name = 'MicPermissionDenied';
          throw friendly;
        }
        throw err;
      });
    }

    function stop() {
      return new Promise(function (resolve, reject) {
        resolveStop = resolve;
        rejectStop = reject;
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          cleanup();
          resolve(new Blob(chunks, { type: 'audio/webm' }));
          return;
        }
        mediaRecorder.stop(); // triggers onstop -> cleanup -> resolve
      });
    }

    function cancel() {
      cancelled = true;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      } else {
        cleanup();
      }
    }

    return { start: start, stop: stop, cancel: cancel };
  }

  // ─── transcribe ──────────────────────────────────────────────────────────────
  function transcribe(blob, lang) {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    form.append('lang', lang || 'auto');

    return fetch('/api/speech/transcribe', {
      method: 'POST',
      credentials: 'same-origin',
      body: form
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          const msg = body.error || ('Transcription failed (' + res.status + ')');
          throw new Error(msg);
        });
      }
      return res.json();
    }).then(function (data) {
      if (data.provider === 'browser') {
        const err = new Error('Server requested browser speech recognition');
        err.code = 'USE_BROWSER';
        throw err;
      }
      return data;
    });
  }

  // ─── browserListen ────────────────────────────────────────────────────────────
  function browserListen(locale, onFinal, onInterim, onError, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (onError) onError('Speech recognition is not supported in this browser.');
      if (onEnd) onEnd();
      return function () {};
    }

    const rec = new SR();
    rec.lang = locale || 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let silenceTimer = null;
    const SILENCE_MS = 2500;
    let stopped = false;

    function resetSilence() {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(function () {
        if (!stopped) rec.stop();
      }, SILENCE_MS);
    }

    rec.onstart = function () {
      resetSilence();
    };

    rec.onresult = function (e) {
      resetSilence();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          if (onFinal) onFinal(text);
        } else {
          if (onInterim) onInterim(text);
        }
      }
    };

    rec.onerror = function (e) {
      if (silenceTimer) clearTimeout(silenceTimer);
      const FRIENDLY = {
        'not-allowed': 'Microphone access was denied. Please allow microphone permission and try again.',
        'no-speech': 'No speech was detected. Please try speaking again.',
        'network': 'A network error occurred during speech recognition.',
        'language-not-supported': 'This language is not supported for speech recognition in your browser.'
      };
      const msg = FRIENDLY[e.error] || ('Speech recognition error: ' + e.error);
      if (onError) onError(msg);
    };

    rec.onend = function () {
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (onEnd) onEnd();
    };

    try {
      rec.start();
    } catch (err) {
      if (onError) onError('Could not start speech recognition: ' + err.message);
    }

    // Idempotent stop
    return function () {
      if (!stopped) {
        stopped = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        try { rec.stop(); } catch (_) {}
      }
    };
  }

  // ─── speak ───────────────────────────────────────────────────────────────────
  function _ensureAudioEl() {
    if (!_audioEl) {
      _audioEl = new Audio();
    }
    return _audioEl;
  }

  function _revokeObjURL() {
    if (_currentObjURL) {
      URL.revokeObjectURL(_currentObjURL);
      _currentObjURL = null;
    }
  }

  function _splitSentences(text) {
    // Split on sentence-ending punctuation, keeping short chunks
    const MAX = 200;
    if (text.length <= MAX) return [text];
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks = [];
    let current = '';
    for (const part of parts) {
      if ((current + part).length > MAX && current.length > 0) {
        chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
  }

  function _browserSpeak(text, lang) {
    return new Promise(function (resolve) {
      const utter = function (text, lang) {
        const chunks = _splitSentences(text);

        function speakChunk(i) {
          if (i >= chunks.length) { resolve({ provider: 'browser' }); return; }
          const u = new SpeechSynthesisUtterance(chunks[i]);

          // Find best voice
          const voices = window.speechSynthesis.getVoices();
          const locale = (window.BobLang && window.BobLang.locale)
            ? window.BobLang.locale(lang)
            : lang;
          const best = voices.find(v => v.lang === locale) ||
                       voices.find(v => v.lang.startsWith(lang)) ||
                       null;
          if (best) u.voice = best;
          u.lang = locale || lang;

          u.onend = function () { speakChunk(i + 1); };
          u.onerror = function () { speakChunk(i + 1); }; // skip on error
          window.speechSynthesis.speak(u);
        }

        speakChunk(0);
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        utter(text, lang);
      } else {
        // Wait up to 1 s for voices to load
        let resolved = false;
        const t = setTimeout(function () {
          if (!resolved) { resolved = true; utter(text, lang); }
        }, 1000);
        window.speechSynthesis.onvoiceschanged = function () {
          if (!resolved) {
            resolved = true;
            clearTimeout(t);
            utter(text, lang);
          }
        };
      }
    });
  }

  function speak(text, lang) {
    return fetch('/api/speech/synthesize', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, lang: lang })
    }).then(function (res) {
      const contentType = res.headers.get('Content-Type') || '';
      const provider = res.headers.get('X-Provider') || 'server';

      if (res.ok && contentType.startsWith('audio/')) {
        return res.arrayBuffer().then(function (ab) {
          _revokeObjURL();
          const blob = new Blob([ab], { type: contentType });
          _currentObjURL = URL.createObjectURL(blob);
          const el = _ensureAudioEl();
          el.src = _currentObjURL;
          return new Promise(function (resolve) {
            el.onended = function () {
              _revokeObjURL();
              resolve({ provider: provider });
            };
            el.onerror = function () {
              _revokeObjURL();
              // Fall back to browser TTS
              _browserSpeak(text, lang).then(resolve);
            };
            el.play().catch(function () {
              _revokeObjURL();
              _browserSpeak(text, lang).then(resolve);
            });
          });
        });
      }

      // JSON response (provider:"browser") or non-audio
      return res.json().catch(function () { return {}; }).then(function () {
        return _browserSpeak(text, lang);
      });
    }).catch(function () {
      // Network error or any failure -> browser TTS
      return _browserSpeak(text, lang);
    });
  }

  // ─── stopSpeaking ─────────────────────────────────────────────────────────────
  function stopSpeaking() {
    if (_audioEl) {
      _audioEl.pause();
      _audioEl.src = '';
    }
    _revokeObjURL();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // ─── Expose global ───────────────────────────────────────────────────────────
  window.BobSpeech = {
    isSupported: isSupported,
    createRecorder: createRecorder,
    transcribe: transcribe,
    browserListen: browserListen,
    speak: speak,
    stopSpeaking: stopSpeaking
  };

}());
