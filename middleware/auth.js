'use strict';

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    const store = require('../store');
    const user = store.users.findById(req.session.userId);
    if (!user || user.role !== role) {
      return res.status(403).json({ error: `Requires role: ${role}` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
