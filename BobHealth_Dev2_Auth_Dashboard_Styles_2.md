# BobHealth Hackathon – Dev 2 – Auth, dashboard, provider settings, shared styles

**Repository:** https://github.com/joshuapremkumar/the-healthy-bob
**Your branch:** `feature/auth-dashboard`
**Files you own:** routes/auth.js, middleware/auth.js, public/login.html, public/register.html, public/dashboard.html, public/js/auth.js, public/js/dashboard.js, public/js/languages.js, public/css/styles.css

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
git checkout -b feature/auth-dashboard

# 3. Install and configure (get the .env values from Dev 1 privately – never commit .env)
npm install
cp .env.example .env

# 4. Open this folder in IBM Bob and paste the prompt below as ONE message.

# 5. Test locally
npm start                   # http://localhost:3000

# 6. Commit ONLY your files and push
git add routes/auth.js middleware/auth.js public/login.html public/register.html public/dashboard.html public/js/auth.js public/js/dashboard.js public/js/languages.js public/css/styles.css
git status                  # .env and data/ must NOT appear
git commit -m "feat: Auth, dashboard, provider settings, shared styles"
git push -u origin feature/auth-dashboard

# 7. Open a Pull Request into main (GitHub UI, or):
gh pr create --base main --head feature/auth-dashboard --title "Dev 2: Auth, dashboard, provider settings, shared styles" --body "Implements Dev 2 files per shared contract v3."

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

MY TASK (Dev 2 – Auth & dashboard). Create these files:

1. middleware/auth.js: requireAuth (401 {error:"Not logged in"} if no req.session.userId, else attach req.user from store.users.findById; 401 if user missing) and requireRole(role) (403 otherwise). CommonJS.
2. routes/auth.js (Express Router): register/login/logout/me and PATCH /users/me per contract. Validate email format, password >= 6 chars, role patient|doctor, nativeLanguage 2-letter code; 409 on duplicate email; bcryptjs 10 rounds; generic "Invalid email or password"; req.session.regenerate before setting userId; default preferences {speakIn:"native", listenIn:"native", autoPlay:true}. PATCH allows name, nativeLanguage (sets languageSource "manual"), preferences (validate enums incl. speakIn "auto"). Always return store.users.toPublic(user).
3. public/js/languages.js: BOB_LANGUAGES for the 15 contract languages (with nativeName, speechLocale e.g. hi-IN, ta-IN, en-US, es-ES, fr-FR, ar-SA, zh-CN; rtl true for ur and ar) and BobLang helpers; guessFromBrowser() checks navigator.languages (full locale, then 2-letter prefix), default "en".
4. public/login.html, public/register.html, public/js/auth.js: centered .card forms. Register: name, email, password, role as .segmented (Patient / Doctor), language select showing "Name (nativeName)", PRE-SELECTED with BobLang.guessFromBrowser() and hint "Detected from your browser – change if needed"; send languageSource "browser" if unchanged, "manual" if changed. Inline errors; redirect to /dashboard.html on success or if already logged in.
5. public/dashboard.html, public/js/dashboard.js: .topbar (app name, user name, role badge, language .badge-lang, logout).
   - Doctor: "Start new consultation" -> POST /api/consultations -> show code large + copy button + "Open consultation" link to /consult.html?id=<id>.
   - Patient: join by 6-char code -> POST /api/consultations/join -> redirect to consult page.
   - Both: list of my consultations (date, other person + language, status, message count, Open link), newest first.
   - "My language & preferences" card: language select, speak-in default (.segmented: Auto-detect [only if capabilities show a configured STT with autoDetect] / My language / English / Their language), listen-in default (Original / My language / English), autoplay checkbox; Save -> PATCH /api/users/me. Show languageSource text: "set by you" / "from your browser" / "auto-detected from your speech".
   - "Speech & translation providers" card from GET /api/config/providers: for STT, Translation and TTS show a primary select and ordered fallback checkboxes; each option shows configured ✓/✗ and number of supported languages (.badge-provider). Doctors can Save (PATCH /api/config/providers); patients see it read-only.
   Use BobPrefs.api if defined, else a local fetch wrapper with the same behaviour. textContent for all user data.
6. public/css/styles.css: clean medical theme with CSS variables (patient teal #0f766e, doctor indigo #4338ca, danger red, neutral greys), system font stack, every shared class in the contract; .mic-btn 72px circle with .recording red pulse (respect prefers-reduced-motion); .level-meter horizontal bar; .segmented pill toggle buttons; .msg-mine right / .msg-theirs left bubbles; .version-tab tabs with .active; .rtl {direction:rtl;text-align:right}; fixed bottom .status-bar; responsive at 768px; visible focus outlines.
```

## Done when
- `npm start` runs with no errors after your files are in place.
- Your PR into `main` is open and contains only your files.
