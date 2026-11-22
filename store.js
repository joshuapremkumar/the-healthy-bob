'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], consultations: [] };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

// 6-char code from A-Z2-9 excluding ambiguous chars O, 0, I, 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

function uniqueCode(existingCodes) {
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 1000) throw new Error('Could not generate unique code');
  } while (existingCodes.has(code));
  return code;
}

// ── users ─────────────────────────────────────────────────────────────────────

const users = {
  create(data) {
    const db = readDb();
    const user = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      nativeLanguage: data.nativeLanguage || 'en',
      languageSource: data.languageSource || 'manual',
      preferences: Object.assign(
        { speakIn: 'auto', listenIn: 'original', autoPlay: true },
        data.preferences || {}
      ),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    writeDb(db);
    return user;
  },

  findByEmail(email) {
    return readDb().users.find(u => u.email === email) || null;
  },

  findById(id) {
    return readDb().users.find(u => u.id === id) || null;
  },

  update(id, patch) {
    const db = readDb();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    Object.assign(db.users[idx], patch);
    writeDb(db);
    return db.users[idx];
  },

  toPublic(user) {
    if (!user) return null;
    const { passwordHash, ...pub } = user;
    return pub;
  },
};

// ── consultations ─────────────────────────────────────────────────────────────

const consultations = {
  create(data) {
    const db = readDb();
    const existingCodes = new Set(db.consultations.map(c => c.code));
    const consultation = {
      id: crypto.randomUUID(),
      code: uniqueCode(existingCodes),
      doctorId: data.doctorId,
      patientId: data.patientId || null,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    db.consultations.push(consultation);
    writeDb(db);
    return consultation;
  },

  findByCode(code) {
    return readDb().consultations.find(c => c.code === code) || null;
  },

  findById(id) {
    return readDb().consultations.find(c => c.id === id) || null;
  },

  listForUser(userId) {
    return readDb().consultations.filter(
      c => c.doctorId === userId || c.patientId === userId
    );
  },

  setPatient(id, patientId) {
    return consultations._update(id, c => {
      c.patientId = patientId;
      c.status = 'active';
    });
  },

  addMessage(id, message) {
    return consultations._update(id, c => {
      c.messages.push(message);
    });
  },

  _update(id, fn) {
    const db = readDb();
    const idx = db.consultations.findIndex(c => c.id === id);
    if (idx === -1) return null;
    fn(db.consultations[idx]);
    writeDb(db);
    return db.consultations[idx];
  },
};

module.exports = { users, consultations };
