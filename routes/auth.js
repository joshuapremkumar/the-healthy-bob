'use strict';

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const store = require('../store');

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, nativeLanguage, languageSource } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    if (store.users.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = store.users.create({ name, email, passwordHash, role, nativeLanguage, languageSource });
    req.session.userId = user.id;
    res.status(201).json({ user: store.users.toPublic(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = store.users.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    res.json({ user: store.users.toPublic(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = store.users.findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json({ user: store.users.toPublic(user) });
});

// PATCH /api/users/me  (mounted on /api/auth but accessible as /api/users/me via server.js)
router.patch('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const updated = store.users.update(req.session.userId, req.body);
  res.json({ user: store.users.toPublic(updated) });
});

module.exports = router;
