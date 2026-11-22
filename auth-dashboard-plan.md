# Plan: BobHealth Dev 2 — Auth, Dashboard, Provider Settings & Shared Styles

## Top-Level Overview

**Goal:** Create the 7 missing front-end files for the BobHealth web app:
`public/js/languages.js`, `public/login.html`, `public/register.html`, `public/js/auth.js`,
`public/dashboard.html`, `public/js/dashboard.js`, and `public/css/styles.css`.

**Scope:** Pure front-end authoring. The two server-side files (`routes/auth.js`, `middleware/auth.js`)
already exist and comply with the shared contract — they are not touched.

**Approach:** Work file-by-file from foundational to dependent. `languages.js` is the shared base
(loaded on every page), then CSS, then auth pages, then dashboard. Each sub-task is independent
except where noted in Relevant Context.

---

## Sub-Tasks

---

### Sub-Task 1 — `public/js/languages.js`

**Intent:** Provide the `BOB_LANGUAGES` array and `BobLang` helpers that every other page script
and the contract depend on. Must be created first because `auth.js` and `dashboard.js` both rely on
`BobLang.guessFromBrowser()` and `BobLang.locale()`.

**Expected Outcomes:**
- `window.BOB_LANGUAGES` is an array of 15 language objects each with `{code, name, nativeName, speechLocale, rtl}`.
- `window.BobLang` exposes: `byCode(code)`, `name(code)`, `locale(code)`, `guessFromBrowser()`.
- `guessFromBrowser()` checks `navigator.languages` (full locale first, then 2-letter prefix) and defaults to `"en"`.
- `rtl: true` is set for `ur` and `ar` only.

**Todo List:**
1. Create `public/js/languages.js` as an IIFE that sets `window.BOB_LANGUAGES` and `window.BobLang`.
2. Add all 15 contract languages: `en, hi, bn, ta, te, mr, gu, kn, ml, pa, ur, es, fr, ar, zh`
   with correct `nativeName` and `speechLocale` (e.g. `hi-IN`, `en-US`, `es-ES`, `fr-FR`, `ar-SA`, `zh-CN`).
3. Implement `BobLang.byCode`, `BobLang.name`, `BobLang.locale`, and `BobLang.guessFromBrowser`.

**Relevant Context:**
- Contract spec: `BOB_LANGUAGES [{code,name,nativeName,speechLocale,rtl}]` and `BobLang {byCode,name,locale,guessFromBrowser}`.
- `speech.js` already calls `window.BobLang.locale(lang)` at line 334 — `locale()` must accept a 2-letter code and return the full `speechLocale`.

**Status:** [x] done

---

### Sub-Task 2 — `public/css/styles.css`

**Intent:** Provide the full shared stylesheet that every HTML page loads. Must exist before
any HTML page is opened in the browser.

**Expected Outcomes:**
- CSS variables defined: patient teal `#0f766e`, doctor indigo `#4338ca`, danger red, neutral greys.
- System font stack applied globally.
- All contract CSS classes implemented: `.container`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`,
  `.btn-danger`, `.form-group`, `.badge`, `.badge-lang`, `.badge-provider`, `.topbar`, `.mic-btn`,
  `.recording`, `.segmented`, `.msg`, `.msg-mine`, `.msg-theirs`, `.msg-meta`, `.msg-text`,
  `.msg-versions`, `.version-tab`, `.active`, `.status-bar`, `.rtl`, `.level-meter`.
- `.mic-btn` is a 72 px circle; `.recording` adds a red pulse animation.
- `@media (prefers-reduced-motion: reduce)` suppresses the pulse animation.
- Responsive breakpoint at 768 px.
- Visible focus outlines on interactive elements.

**Todo List:**
1. Create `public/css/styles.css`.
2. Define `:root` CSS variables for the colour palette.
3. Add global reset, body, and font rules.
4. Implement layout helpers: `.container`, `.card`, `.form-group`.
5. Implement button variants: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`.
6. Implement `.topbar` fixed/sticky top bar.
7. Implement `.segmented` pill toggle group.
8. Implement badge variants: `.badge`, `.badge-lang`, `.badge-provider`.
9. Implement chat bubbles: `.msg`, `.msg-mine`, `.msg-theirs`, `.msg-meta`, `.msg-text`.
10. Implement `.msg-versions` and `.version-tab` with `.active` state.
11. Implement `.mic-btn` circle and `.recording` pulse (with reduced-motion override).
12. Implement `.level-meter` horizontal bar.
13. Implement `.status-bar` fixed bottom bar.
14. Implement `.rtl` direction rule.
15. Add 768 px responsive overrides and focus-visible outlines.

**Relevant Context:**
- Contract lists exact class names at the bottom of the shared contract section.
- `speech.js` does not reference CSS — no JS dependency on specific class names except `.recording` and `.mic-btn` (used in `consult.js` owned by Dev 5).

**Status:** [x] done

---

### Sub-Task 3 — `public/login.html` + `public/register.html` + `public/js/auth.js`

**Intent:** Provide the authentication pages. Both HTML files are static shells that load shared
scripts and `auth.js`. All logic lives in `auth.js`.

**Expected Outcomes:**
- Both HTML files load scripts in contract order: `/css/styles.css`, `/js/languages.js`, `/js/speech.js`, `/js/prefs.js`, then `/js/auth.js`.
- Login page: email + password fields in a centred `.card`, inline error display, calls `POST /api/auth/login`.
- Register page: name, email, password, role `.segmented` (Patient / Doctor), language `<select>` showing `"Name (nativeName)"`, pre-selected via `BobLang.guessFromBrowser()`, hint text "Detected from your browser – change if needed".
- On register, sends `languageSource: "browser"` if language was not changed, `"manual"` if changed.
- Inline validation errors (email format, password ≥ 6 chars, role required, language required).
- On success (or if `GET /api/auth/me` returns a user on page load), redirect to `/dashboard.html`.
- `textContent` used for all user-supplied data (no `innerHTML` with user data).

**Todo List:**
1. Create `public/login.html` with centred `.card` form (email, password, submit, error div, link to register).
2. Create `public/register.html` with centred `.card` form (name, email, password, role `.segmented`, language select, hint, submit, error div, link to login).
3. Create `public/js/auth.js` as an IIFE.
4. On DOMContentLoaded: call `GET /api/auth/me`; if logged in, redirect to `/dashboard.html`.
5. Detect which page is active and wire up the appropriate form submit handler.
6. Login handler: validate inputs, POST, handle 401 with inline error, redirect on success.
7. Register handler: validate inputs, populate language select from `BOB_LANGUAGES`, track if language was changed from default, POST with correct `languageSource`, handle 409/400 errors, redirect on success.

**Relevant Context:**
- `routes/auth.js` lines 10–26 (register) and 29–41 (login) define the exact request/response shapes.
- `store.js` lines 56–75: `create()` applies default preferences `{speakIn:"auto", listenIn:"original", autoPlay:true}` — no need to send preferences from register form.
- Contract note: "default preferences `{speakIn:'native', listenIn:'native', autoPlay:true}`" differs from store default; the register route should send these explicitly OR they can be patched from the dashboard. For now, omit from register and rely on store defaults to keep it simple — if the contract is strict, send them in the POST body.
- `BobLang.guessFromBrowser()` will be available from Sub-Task 1.

**Status:** [x] done

---

### Sub-Task 4 — `public/dashboard.html` + `public/js/dashboard.js`

**Intent:** Provide the main post-login screen for both doctors and patients, including the
consultation workflow, preferences card, and provider settings card.

**Expected Outcomes:**
- Page redirects to `/login.html` if `GET /api/auth/me` returns 401.
- `.topbar` shows app name, logged-in user name, role badge (`.badge`), language badge (`.badge-lang`), and logout button.
- **Doctor view:** "Start new consultation" button → POST `/api/consultations` → shows generated code (large, copyable) + "Open consultation" link to `/consult.html?id=<id>`.
- **Patient view:** 6-char code input → POST `/api/consultations/join` → redirect to `/consult.html?id=<id>`.
- **Both:** `GET /api/consultations` → list sorted newest-first showing date, other participant name + language, status, message count, Open link.
- **Preferences card:** language select (pre-filled), speak-in `.segmented` (Auto-detect only shown when `capabilities` has an STT with `autoDetect: true`), listen-in `.segmented`, autoplay checkbox; Save → PATCH `/api/users/me`; `languageSource` text shown below language select.
- **Provider settings card:** fetched from `GET /api/config/providers`; for each of STT, Translation, TTS: a primary `<select>` and fallback checkboxes with configured ✓/✗ and language count badge (`.badge-provider`); doctors can Save → PATCH `/api/config/providers`; patients see it read-only.
- Uses `BobPrefs.api` if defined, else a local `fetch` wrapper with the same behaviour (credentials: 'same-origin', Content-Type: application/json).
- All user-supplied text set via `textContent`.

**Todo List:**
1. Create `public/dashboard.html` with: topbar placeholder, doctor section, patient section, consultations list section, preferences card, provider settings card, all hidden by default (JS shows them).
2. Create `public/js/dashboard.js` as an IIFE.
3. On load: call `GET /api/auth/me`; on 401 redirect to login; on success store `user` and render topbar.
4. Render topbar: name, role badge with appropriate colour class, language badge, logout handler.
5. Show doctor or patient section based on `user.role`.
6. Doctor: wire "Start consultation" button; on success render code display + copy + open link.
7. Patient: wire join form; on success redirect.
8. Load and render consultation list: `GET /api/consultations`, sort by `createdAt` descending, populate table/list.
9. Render preferences card: populate language select from `BOB_LANGUAGES`, pre-select `user.nativeLanguage`; show `languageSource` hint; call `GET /api/config/providers` for capabilities; conditionally show Auto-detect option; wire Save.
10. Render provider settings card: call `GET /api/config/providers`; build primary selects and fallback checkboxes; disable inputs if patient; wire Save for doctors.

**Relevant Context:**
- `server.js` lines 56–60: routes are `/api/auth`, `/api/config`, `/api/consultations`.
- `routes/auth.js` line 57: `PATCH /me` is on the auth router, served as `/api/auth/me`; but the contract says `PATCH /api/users/me`. Check `server.js` for a `/api/users` mount — if absent, use `/api/auth/me` for the patch call.
- `store.js` `consultations.listForUser` returns raw consultation objects; the GET route (Dev 1's `routes/consultations.js`) shapes the response — use the contract's response format `{consultations:[{id,code,status,createdAt,doctor:{name,nativeLanguage},patient|null,messageCount}]}`.
- `BobPrefs` global (from `prefs.js`, owned by Dev 5) may or may not be loaded; use `BobPrefs.api` if `typeof BobPrefs !== 'undefined' && BobPrefs.api`, else fall back to local fetch wrapper.

**Status:** [x] done

---

## Notes

- `/api/users/me` PATCH: Use `/api/users/me` (Dev 1 will add the mount point). Dashboard.js calls `PATCH /api/users/me`.
- Register default preferences: Send contract defaults `{speakIn:"native", listenIn:"native", autoPlay:true}` explicitly in the register POST body to override store defaults.
- Files must NOT contain hard-coded secrets; all API calls use relative URLs and session cookies.
