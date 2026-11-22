# BobHealth Hackathon – Dev 3 – Translation (watsonx.ai / MyMemory), language detection, text-to-speech (Watson / ElevenLabs)

**Repository:** https://github.com/joshuapremkumar/the-healthy-bob
**Your branch:** `feature/translation-tts`
**Files you own:** services/translate.js, services/detect.js, services/tts/watson.js, services/tts/elevenlabs.js, routes/translate.js

Note: IBM withdrew the old Watson Language Translator service in Dec 2024, so "Watson translation" here means an LLM on watsonx.ai via its chat API. ElevenLabs has no text-translation API, so the translation fallback is MyMemory.

## Rules for the hour
- You have ~50 Bob tokens: send Bob **one** message – the full prompt below (shared contract + your task). Fix small bugs by hand.
- Only edit the files you own. Need a new npm package or a contract change? Tell Dev 1 – don't edit `package.json` yourself.
- Never commit `.env`, API keys or `data/`.
- Timeline: 0–8 min Dev 1 pushes skeleton · 8–35 build · 35–45 PRs merged (Dev3 → Dev2 → Dev4 → Dev5) · 45–55 two-browser test · 55–60 demo.

## Git steps

```bash
# 1. Clone (once) and wait for Dev 1 to say "skeleton is up"
git clone https://github.com/joshuapremkumar/the-healthy-bob.git
cd the-healthy-bob
git checkout main && git pull origin main

# 2. Create your branch
git checkout -b feature/translation-tts

# 3. Install and configure (get the .env values from Dev 1 privately – never commit .env)
npm install
cp .env.example .env

# 4. Open this folder in IBM Bob and paste the prompt below as ONE message.

# 5. Test locally
npm start                   # http://localhost:3000

# 6. Commit ONLY your files and push
git add services/translate.js services/detect.js services/tts/watson.js services/tts/elevenlabs.js routes/translate.js
git status                  # .env and data/ must NOT appear
git commit -m "feat: Translation (watsonx.ai / MyMemory), language detection, text-to-speech (Watson / ElevenLabs)"
git push -u origin feature/translation-tts

# 7. Open a Pull Request into main (GitHub UI, or):
gh pr create --base main --head feature/translation-tts --title "Dev 3: Translation (watsonx.ai / MyMemory), language detection, text-to-speech (Watson / ElevenLabs)" --body "Implements Dev 3 files per shared contract v3."

# If main moved before your PR merges:
git pull --rebase origin main && git push --force-with-lease
```

## Prompt to paste into IBM Bob (copy everything inside the block)

```text
RULES FOR YOU (BOB):
- Create or overwrite ONLY the files listed in my task below, directly in this workspace at the given paths. Do not touch any other file.
- Write complete, working files (no placeholders, no "TODO"). Never hard-code secrets; read them from process.env.
- Do not run git, npm install or any other commands, and do not explain the code afterwards – just create the files and reply "Done" with the list of files.

===== SHARED CONTRACT v3 (all 5 developers use this exact contract) =====
PROJECT: BobHealth – multilingual doctor–patient consultation web app.
Repository: https://github.com/joshuapremkumar/the-healthy-bob (workspace root = repo root).
Stack: Node 18+ (built-in fetch/FormData/Blob), Express, express-session, bcryptjs, socket.io, multer, dotenv, franc-min; plain HTML/CSS/vanilla JS. JSON storage data/db.json. http://localhost:3000, Chrome. CommonJS on server.

FILES & OWNERS:
Dev1: package.json, server.js, store.js, config/providers.js, routes/config.js, routes/consultations.js, README.md, .env.example, .gitignore
Dev2: routes/auth.js, middleware/auth.js, public/login.html, register.html, dashboard.html, js/auth.js, js/dashboard.js, js/languages.js, css/styles.css
Dev3: services/translate.js, services/detect.js, services/tts/watson.js, services/tts/elevenlabs.js, routes/translate.js
Dev4: services/stt/watson.js, services/stt/elevenlabs.js, routes/speech.js, public/js/speech.js
Dev5: public/js/prefs.js, public/consult.html, public/js/consult.js
Each HTML page loads: /css/styles.css, (/socket.io/socket.io.js on consult), /js/languages.js, /js/speech.js, /js/prefs.js, then its page script.

ENV (.env): PORT, SESSION_SECRET,
STT_PROVIDER=watson, STT_FALLBACKS=elevenlabs,browser | TRANSLATE_PROVIDER=watsonx, TRANSLATE_FALLBACKS=mymemory | TTS_PROVIDER=watson, TTS_FALLBACKS=elevenlabs,browser
WATSON_STT_APIKEY, WATSON_STT_URL, WATSON_TTS_APIKEY, WATSON_TTS_URL   (Watson auth = HTTP Basic "apikey:<key>")
WATSONX_APIKEY, WATSONX_PROJECT_ID, WATSONX_URL (e.g. https://us-south.ml.cloud.ibm.com), WATSONX_MODEL_ID
ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL=scribe_v2, ELEVENLABS_TTS_MODEL=eleven_multilingual_v2, ELEVENLABS_VOICE_ID
MYMEMORY_EMAIL

PROVIDER INTERFACE (every adapter module exports):
  name, isConfigured() -> bool, async init() (optional; e.g. fetch model/voice lists), supports(langCode) -> bool, autoDetect (STT only, bool)
  STT adapters: async transcribe(buffer, mimeType, langCode|null) -> {text, language, confidence}
  TTS adapters: async synthesize(text, langCode) -> {audio: Buffer, mimeType}
config/providers.js exports: getChain(kind:"stt"|"tts"|"translate", langCode) -> [adapter names usable for lang, in order]
  ; getConfig() -> {stt:{primary,fallbacks}, tts:{...}, translate:{...}} ; setConfig(patch) (runtime override, persisted to data/providers.json)
  ; capabilities() -> {stt:{watson:{configured,autoDetect,languages:[codes]}, elevenlabs:{...}, browser:{...}}, tts:{...}, translate:{...}}
  ; registerAdapter(kind, adapter) ; getAdapter(kind, name) ; "browser" is a pseudo-provider meaning "client must handle it" (supports all langs).

DATA MODEL:
User {id,name,email,passwordHash,role:"patient"|"doctor",nativeLanguage,languageSource:"browser"|"manual"|"detected",
      preferences:{speakIn:"auto"|"native"|"english"|"other", listenIn:"original"|"native"|"english", autoPlay:true}, createdAt}
Consultation {id, code, doctorId, patientId|null, status:"waiting"|"active", createdAt, messages:[Message]}
Message {id, senderId, senderRole, inputMode:"voice"|"text", spokenLang, detectedLang, detectConfidence, detectMethod:"stt"|"script"|"franc"|"hint",
         originalText, translations:{code:text}, providers:{stt, translate}, createdAt}

store.js: users.create/findByEmail/findById/update/toPublic ; consultations.create/findByCode/findById/listForUser/setPatient/addMessage

REST API (JSON, cookie session, 401 {error} if not logged in):
Auth: POST /api/auth/register {name,email,password,role,nativeLanguage,languageSource} ; POST /api/auth/login {email,password} ; POST /api/auth/logout ; GET /api/auth/me ; PATCH /api/users/me   (all return {user} public)
Config: GET /api/config/providers -> {config, capabilities} ; PATCH /api/config/providers (doctor only) {stt?,tts?,translate?:{primary,fallbacks}}
Translate: POST /api/translate {text,source,target} -> {translatedText, provider} ; POST /api/detect {text,hint} -> {code,confidence,method}
Speech: POST /api/speech/transcribe multipart field "audio" (webm/opus <=10MB) + field "lang" (code or "auto")
          -> {text, language, confidence, provider}  OR {provider:"browser"} meaning client should use browser STT
        POST /api/speech/synthesize {text, lang} -> audio bytes (Content-Type audio/mpeg, header X-Provider) OR 200 JSON {provider:"browser"}
Consult: POST /api/consultations (doctor) -> {consultation} ; POST /api/consultations/join {code} (patient) -> {consultation}
         GET /api/consultations -> {consultations:[{id,code,status,createdAt,doctor:{name,nativeLanguage},patient|null,messageCount}]}
         GET /api/consultations/:id -> {consultation, doctor, patient|null} (participants only, else 403)
         POST /api/consultations/:id/messages {text, spokenLang, inputMode, sttLanguage?, sttConfidence?, sttProvider?} -> {message, senderLanguageUpdated}
SOCKET.IO room "consult:<id>": client emits "join" {consultationId}; server emits "message:new" Message, "participant:joined" {patient}, "profile:updated" {userId,nativeLanguage}, "providers:updated".

BROWSER GLOBALS:
BOB_LANGUAGES [{code,name,nativeName,speechLocale,rtl}] for en,hi,bn,ta,te,mr,gu,kn,ml,pa,ur,es,fr,ar,zh
BobLang {byCode,name,locale,guessFromBrowser}
BobSpeech {
  isSupported()->{record,browserStt,browserTts},
  createRecorder({onLevel}) -> {start():Promise, stop():Promise<Blob>, cancel()},
  transcribe(blob, langCodeOr"auto") -> Promise<{text,language,confidence,provider}>  (if server says browser -> rejects with err.code="USE_BROWSER"),
  browserListen(locale,onFinal,onInterim,onError,onEnd) -> stop(),
  speak(text, langCode) -> Promise<{provider}> (server audio; browser speechSynthesis fallback), stopSpeaking()
}
BobPrefs {renderSpeakSelector(el,{myLang,otherLang,value,autoAvailable,onChange}), renderListenSelector(el,{myLang,value,onChange}),
          resolveSpeakLang(pref,myLang,otherLang)->code|"auto", resolveListenLang(pref,message,myLang)->code, api(path,{method,body})}
CSS classes: .container .card .btn .btn-primary .btn-secondary .btn-danger .form-group .badge .badge-lang .badge-provider .topbar .mic-btn .recording
.segmented .msg .msg-mine .msg-theirs .msg-meta .msg-text .msg-versions .version-tab .active .status-bar .rtl .level-meter
===== END OF CONTRACT =====

MY TASK (Dev 3 – Translation, detection, TTS). Create these CommonJS files, using Node 18 built-in fetch with 10 s AbortController timeouts on every outbound call:

1. services/translate.js: translation providers "watsonx" and "mymemory" (each {name, isConfigured(), supports(lang)}); export `providers` (array), translate(text, source, target) -> {text, provider} and translateMany(text, source, targets) -> {translations:{code:text}, provider}. Order = require("../config/providers").getChain("translate", target); try each until success.
   - watsonx: IAM token from https://iam.cloud.ibm.com/identity/token (form: grant_type=urn:ibm:params:oauth:grant-type:apikey, apikey=WATSONX_APIKEY), cached until 5 min before expiry. POST {WATSONX_URL}/ml/v1/text/chat?version=2024-10-08 with {model_id: WATSONX_MODEL_ID, project_id: WATSONX_PROJECT_ID, messages:[{role:"system",content:"You are a medical interpreter. Translate the user's text from <Source> to <Target>. Preserve meaning, symptoms, numbers, medicine names and dosages exactly. Reply with the translation only."},{role:"user",content:text}], max_tokens:500, temperature:0}; read choices[0].message.content, trim, strip surrounding quotes.
   - mymemory: GET https://api.mymemory.translated.net/get?q=<encoded>&langpair=<src>|<tgt> (append &de=MYMEMORY_EMAIL if set); fail if responseStatus != 200.
   - source === target returns text unchanged; LRU cache of 300 entries keyed src|tgt|text; translateMany runs targets in parallel with Promise.allSettled; a failed target pivots via English (src->en->tgt), else "[translation unavailable]".
   - Language name map for the 15 contract languages.
2. services/detect.js: detectLanguage(text, hint) -> {code, confidence, method}. Unicode-script detection: Devanagari (hi, or mr if franc says "mar"), Bengali bn, Gurmukhi pa, Gujarati gu, Tamil ta, Telugu te, Kannada kn, Malayalam ml, Arabic script (ur vs ar via franc "urd"/"arb", else hint if ur/ar, else ar), Han zh; confidence = dominant-script share of letters (>= 0.9 -> 0.95). Latin script: franc-min (ESM – load once via dynamic import() and cache) limited to eng/spa/fra, mapped to 639-1; text < 12 chars -> hint with 0.5, method "hint"; Latin text while hint is an Indic language (romanised) -> {code: hint, confidence: 0.55, method: "hint"}. Never throws; falls back to hint or "en".
3. services/tts/watson.js (adapter per contract): auth Basic "apikey:"+WATSON_TTS_APIKEY against WATSON_TTS_URL; isConfigured() when both env vars set. init(): GET /v1/voices and build a map 2-letter language -> best voice (prefer names containing "Expressive", "Natural" or "V3"; for en prefer en-US). supports(lang) uses the map. synthesize(text, lang): POST /v1/synthesize?voice=<voice> JSON {text}, header Accept: audio/mp3 -> {audio: Buffer, mimeType: "audio/mpeg"}.
4. services/tts/elevenlabs.js (adapter): isConfigured() when ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID set; supports all 15 contract languages. synthesize: POST https://api.elevenlabs.io/v1/text-to-speech/<ELEVENLABS_VOICE_ID>?output_format=mp3_44100_128 with header xi-api-key and JSON {text, model_id: ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2"} -> {audio, mimeType:"audio/mpeg"}.
5. routes/translate.js (Express Router, requireAuth on all routes): POST /translate, POST /detect, and POST /speech/synthesize {text <= 1000 chars, lang}: iterate getChain("tts", lang); for "browser" return JSON {provider:"browser"}; on adapter success send the audio with Content-Type and X-Provider headers; on adapter error log the provider name + message (never the text) and continue. In-memory cache of the last 100 clips keyed lang|text. Return 502 {error} if everything fails.
Add brief inline comments.
```

## Done when
- `npm start` runs with no errors after your files are in place.
- Your PR into `main` is open and contains only your files.
