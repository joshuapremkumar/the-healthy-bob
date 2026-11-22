(function () {
  'use strict';

  var BOB_LANGUAGES = [
    { code: 'en', name: 'English',    nativeName: 'English',    speechLocale: 'en-US', rtl: false },
    { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       speechLocale: 'hi-IN', rtl: false },
    { code: 'bn', name: 'Bengali',    nativeName: 'বাংলা',        speechLocale: 'bn-IN', rtl: false },
    { code: 'ta', name: 'Tamil',      nativeName: 'தமிழ்',        speechLocale: 'ta-IN', rtl: false },
    { code: 'te', name: 'Telugu',     nativeName: 'తెలుగు',       speechLocale: 'te-IN', rtl: false },
    { code: 'mr', name: 'Marathi',    nativeName: 'मराठी',        speechLocale: 'mr-IN', rtl: false },
    { code: 'gu', name: 'Gujarati',   nativeName: 'ગુજરાતી',      speechLocale: 'gu-IN', rtl: false },
    { code: 'kn', name: 'Kannada',    nativeName: 'ಕನ್ನಡ',        speechLocale: 'kn-IN', rtl: false },
    { code: 'ml', name: 'Malayalam',  nativeName: 'മലയാളം',       speechLocale: 'ml-IN', rtl: false },
    { code: 'pa', name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',       speechLocale: 'pa-IN', rtl: false },
    { code: 'ur', name: 'Urdu',       nativeName: 'اردو',         speechLocale: 'ur-PK', rtl: true  },
    { code: 'es', name: 'Spanish',    nativeName: 'Español',     speechLocale: 'es-ES', rtl: false },
    { code: 'fr', name: 'French',     nativeName: 'Français',    speechLocale: 'fr-FR', rtl: false },
    { code: 'ar', name: 'Arabic',     nativeName: 'العربية',      speechLocale: 'ar-SA', rtl: true  },
    { code: 'zh', name: 'Chinese',    nativeName: '中文',          speechLocale: 'zh-CN', rtl: false },
  ];

  // ── BobLang helpers ──────────────────────────────────────────────────────────

  var _byCode = {};
  BOB_LANGUAGES.forEach(function (lang) {
    _byCode[lang.code] = lang;
  });

  var BobLang = {
    /** Return the language object for a 2-letter code, or undefined. */
    byCode: function (code) {
      return _byCode[code];
    },

    /** Return the English display name for a code, or the code itself. */
    name: function (code) {
      var lang = _byCode[code];
      return lang ? lang.name : code;
    },

    /** Return the BCP-47 speech locale for a 2-letter code (e.g. "hi" → "hi-IN").
     *  Falls back to the code itself if unknown.
     */
    locale: function (code) {
      var lang = _byCode[code];
      return lang ? lang.speechLocale : code;
    },

    /**
     * Guess the user's language from navigator.languages.
     * Checks full locale (e.g. "hi-IN") then 2-letter prefix (e.g. "hi").
     * Falls back to "en".
     */
    guessFromBrowser: function () {
      var langs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : (navigator.language ? [navigator.language] : []);

      for (var i = 0; i < langs.length; i++) {
        var full = langs[i].toLowerCase();          // e.g. "hi-in"
        var short = full.split('-')[0];             // e.g. "hi"

        // Try full locale match (e.g. "zh-cn" → "zh")
        for (var j = 0; j < BOB_LANGUAGES.length; j++) {
          var l = BOB_LANGUAGES[j];
          if (l.speechLocale.toLowerCase() === full) return l.code;
        }

        // Try 2-letter prefix match
        if (_byCode[short]) return short;
      }

      return 'en';
    },
  };

  // ── Expose globals ───────────────────────────────────────────────────────────
  window.BOB_LANGUAGES = BOB_LANGUAGES;
  window.BobLang = BobLang;

}());
