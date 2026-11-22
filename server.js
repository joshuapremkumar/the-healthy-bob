'use strict';

require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');

const providerRegistry = require('./config/providers');
const store = require('./store');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });

// ── session middleware ────────────────────────────────────────────────────────
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'bobhealth-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
});

app.use(sessionMiddleware);

// Share session with socket.io
io.engine.use(sessionMiddleware);

app.set('io', io);

// ── body parsing & static ─────────────────────────────────────────────────────
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── root redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard.html');
  }
  res.redirect('/login.html');
});

// ── API routes ────────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const configRouter = require('./routes/config');
const translateRouter = require('./routes/translate');
const speechRouter = require('./routes/speech');
const consultationsFactory = require('./routes/consultations');

app.use('/api/auth', authRouter);
app.use('/api/config', configRouter);
app.use('/api/translate', translateRouter);
app.use('/api/speech', speechRouter);
app.use('/api/consultations', consultationsFactory(io));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// JSON 404 for /api/*
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join', async ({ consultationId }) => {
    const session = socket.request.session;
    if (!session || !session.userId) return;

    const consultation = store.consultations.findById(consultationId);
    if (!consultation) return;

    const userId = session.userId;
    if (consultation.doctorId !== userId && consultation.patientId !== userId) return;

    socket.join(`consult:${consultationId}`);
  });
});

// ── adapter registration ──────────────────────────────────────────────────────
async function loadAdapters() {
  const adapters = [
    { kind: 'stt', mod: './services/stt/watson' },
    { kind: 'stt', mod: './services/stt/elevenlabs' },
    { kind: 'tts', mod: './services/tts/watson' },
    { kind: 'tts', mod: './services/tts/elevenlabs' },
  ];

  // Translate adapters (services/translate.js exports { providers: [] })
  let translateAdapters = [];
  try {
    const translateModule = require('./services/translate');
    translateAdapters = (translateModule.providers || []).map(a => ({ kind: 'translate', adapter: a }));
  } catch (e) {
    console.warn('Could not load services/translate.js:', e.message);
  }

  const rows = [];

  for (const { kind, mod } of adapters) {
    let adapter;
    try {
      adapter = require(mod);
    } catch (e) {
      console.warn(`Could not load ${mod}:`, e.message);
      continue;
    }
    providerRegistry.registerAdapter(kind, adapter);
    if (adapter.isConfigured() && typeof adapter.init === 'function') {
      try {
        await adapter.init();
      } catch (e) {
        console.warn(`init() failed for ${mod}:`, e.message);
      }
    }
    rows.push({ kind, name: adapter.name, configured: adapter.isConfigured() });
  }

  for (const { kind, adapter } of translateAdapters) {
    providerRegistry.registerAdapter(kind, adapter);
    if (adapter.isConfigured() && typeof adapter.init === 'function') {
      try {
        await adapter.init();
      } catch (e) {
        console.warn(`init() failed for translate/${adapter.name}:`, e.message);
      }
    }
    rows.push({ kind, name: adapter.name, configured: adapter.isConfigured() });
  }

  // Print provider table
  console.log('\nProvider status:');
  console.log('─'.repeat(40));
  console.log('Kind       Name            Configured');
  console.log('─'.repeat(40));
  for (const r of rows) {
    console.log(
      r.kind.padEnd(10) +
      r.name.padEnd(16) +
      (r.configured ? '✓' : '✗')
    );
  }
  console.log('─'.repeat(40) + '\n');
}

// ── start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

loadAdapters().then(() => {
  server.listen(PORT, () => {
    console.log(`BobHealth running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
