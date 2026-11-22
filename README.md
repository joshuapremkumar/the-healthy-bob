# BobHealth

**BobHealth** is a multilingual doctor–patient consultation web app. Doctors and patients can communicate in their native languages; every spoken or typed message is automatically translated so both parties can read it in their preferred language.

> ⚠️ **Prototype – not for clinical use; use test data only.**

---

## Architecture

```
Browser (Chrome)
  │
  ├── /login.html  /register.html  /dashboard.html  /consult.html
  │   JS: auth.js  dashboard.js  speech.js  prefs.js  consult.js  languages.js
  │
  │   WebSocket (socket.io)
  │   REST (fetch / cookie session)
  │
  └── server.js  (Express + socket.io, Node 18+)
        │
        ├── routes/auth.js          → session / bcrypt
        ├── routes/config.js        → provider registry read/write
        ├── routes/translate.js     → POST /api/translate, /api/detect
        ├── routes/speech.js        → POST /api/speech/transcribe, /synthesize
        ├── routes/consultations.js → CRUD + Socket.IO room "consult:<id>"
        │
        ├── config/providers.js     → adapter registry + chain resolution
        ├── store.js                → JSON file store  (data/db.json)
        │
        ├── services/stt/watson.js  elevenlabs.js
        ├── services/tts/watson.js  elevenlabs.js
        ├── services/translate.js   (providers[] + translateMany)
        └── services/detect.js      (detectLanguage)
```

---

## Provider table

| Kind      | Name        | Env vars needed                                      | Notes                        |
|-----------|-------------|------------------------------------------------------|------------------------------|
| STT       | watson      | `WATSON_STT_APIKEY`, `WATSON_STT_URL`                | HTTP Basic auth              |
| STT       | elevenlabs  | `ELEVENLABS_API_KEY`, `ELEVENLABS_STT_MODEL`         | autoDetect = true            |
| STT       | browser     | —                                                    | Built-in; always available   |
| TTS       | watson      | `WATSON_TTS_APIKEY`, `WATSON_TTS_URL`                | HTTP Basic auth              |
| TTS       | elevenlabs  | `ELEVENLABS_API_KEY`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_VOICE_ID` | |
| TTS       | browser     | —                                                    | Built-in; always available   |
| Translate | watsonx     | `WATSONX_APIKEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL`, `WATSONX_MODEL_ID` | |
| Translate | mymemory    | `MYMEMORY_EMAIL` (optional)                          | Free tier                    |

### How to switch providers

**Via `.env`** (restart required):
```
STT_PROVIDER=elevenlabs
STT_FALLBACKS=browser
```

**At runtime via the dashboard Settings card** (`PATCH /api/config/providers`, doctor only):
```json
{ "stt": { "primary": "watson", "fallbacks": ["elevenlabs", "browser"] } }
```

---

## Setup

```bash
# 1. Clone
git clone https://github.com/joshuapremkumar/the-healthy-bob.git
cd the-healthy-bob

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env – fill in your API keys

# 4. Run
npm start
# → http://localhost:3000

# Development (auto-restart on save):
npm run dev
```

---

## File ownership

| Developer | Files owned                                                                                     |
|-----------|-------------------------------------------------------------------------------------------------|
| **Dev 1** | package.json, server.js, store.js, config/providers.js, routes/config.js, routes/consultations.js, README.md, .env.example, .gitignore |
| **Dev 2** | routes/auth.js, middleware/auth.js, public/login.html, register.html, dashboard.html, public/js/auth.js, dashboard.js, languages.js, css/styles.css |
| **Dev 3** | services/translate.js, services/detect.js, services/tts/watson.js, services/tts/elevenlabs.js, routes/translate.js |
| **Dev 4** | services/stt/watson.js, services/stt/elevenlabs.js, routes/speech.js, public/js/speech.js |
| **Dev 5** | public/js/prefs.js, public/consult.html, public/js/consult.js |

---

## Git workflow

```bash
# Each developer works on their own branch
git checkout -b feature/<role>   # e.g. feature/auth, feature/translate

# Push and open a PR into main
git push -u origin feature/<role>

# PR merge order (Dev 1 lead merges in this sequence):
#   Dev3 → Dev2 → Dev4 → Dev5

# Integration fixes go on:
git checkout -b feature/lead-integration
```

---

## Two-browser test

1. Open **Chrome tab A** – register as a **doctor** (`role: doctor`).
2. Open **Chrome tab B** (Incognito) – register as a **patient** (`role: patient`).
3. In tab A, click **New Consultation** – note the 6-character code.
4. In tab B, click **Join** and enter the code.
5. Send messages from both tabs; verify translations appear in both languages.
6. Check the browser console for socket events (`message:new`, `participant:joined`).

---

## API summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Register user |
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | ✓ | Logout |
| GET | /api/auth/me | ✓ | Current user |
| PATCH | /api/users/me | ✓ | Update profile |
| GET | /api/config/providers | ✓ | Provider config + capabilities |
| PATCH | /api/config/providers | doctor | Update provider config |
| POST | /api/translate | ✓ | Translate text |
| POST | /api/detect | ✓ | Detect language |
| POST | /api/speech/transcribe | ✓ | STT (multipart audio) |
| POST | /api/speech/synthesize | ✓ | TTS → audio bytes |
| POST | /api/consultations | doctor | Create consultation |
| POST | /api/consultations/join | ✓ | Join by code |
| GET | /api/consultations | ✓ | List consultations |
| GET | /api/consultations/:id | participant | Get consultation |
| POST | /api/consultations/:id/messages | participant | Post message |
| GET | /api/health | — | Health check |

---

*Prototype – not for clinical use; use test data only.*
