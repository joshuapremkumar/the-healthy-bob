'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { detectLanguage } = require('../services/detect');
const { translateMany } = require('../services/translate');

module.exports = function consultationsFactory(io) {
  const router = Router();

  // POST /api/consultations  (doctor creates)
  router.post('/', requireAuth, requireRole('doctor'), (req, res) => {
    const consultation = store.consultations.create({ doctorId: req.session.userId });
    res.status(201).json({ consultation });
  });

  // POST /api/consultations/join  (patient joins)
  router.post('/join', requireAuth, (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });

    const consultation = store.consultations.findByCode(code.toUpperCase().trim());
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (consultation.patientId && consultation.patientId !== req.session.userId) {
      return res.status(409).json({ error: 'Consultation already has a patient' });
    }

    const updated = store.consultations.setPatient(consultation.id, req.session.userId);

    const patient = store.users.toPublic(store.users.findById(req.session.userId));
    io.to(`consult:${consultation.id}`).emit('participant:joined', { patient });

    res.json({ consultation: updated });
  });

  // GET /api/consultations
  router.get('/', requireAuth, (req, res) => {
    const list = store.consultations.listForUser(req.session.userId);
    const result = list.map(c => {
      const doctor = store.users.toPublic(store.users.findById(c.doctorId));
      const patient = c.patientId ? store.users.toPublic(store.users.findById(c.patientId)) : null;
      return {
        id: c.id,
        code: c.code,
        status: c.status,
        createdAt: c.createdAt,
        doctor: doctor ? { name: doctor.name, nativeLanguage: doctor.nativeLanguage } : null,
        patient: patient ? { name: patient.name, nativeLanguage: patient.nativeLanguage } : null,
        messageCount: c.messages.length,
      };
    });
    res.json({ consultations: result });
  });

  // GET /api/consultations/:id
  router.get('/:id', requireAuth, (req, res) => {
    const consultation = store.consultations.findById(req.params.id);
    if (!consultation) return res.status(404).json({ error: 'Not found' });

    const userId = req.session.userId;
    if (consultation.doctorId !== userId && consultation.patientId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const doctor = store.users.toPublic(store.users.findById(consultation.doctorId));
    const patient = consultation.patientId
      ? store.users.toPublic(store.users.findById(consultation.patientId))
      : null;

    res.json({ consultation, doctor, patient });
  });

  // POST /api/consultations/:id/messages
  router.post('/:id/messages', requireAuth, async (req, res) => {
    try {
      const consultation = store.consultations.findById(req.params.id);
      if (!consultation) return res.status(404).json({ error: 'Not found' });

      const userId = req.session.userId;
      if (consultation.doctorId !== userId && consultation.patientId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { text, spokenLang, inputMode, sttLanguage, sttConfidence, sttProvider } = req.body;

      // a) Validate text
      if (!text || typeof text !== 'string' || text.length < 1 || text.length > 1000) {
        return res.status(400).json({ error: 'text must be 1–1000 characters' });
      }

      const sender = store.users.findById(userId);
      const senderRole = consultation.doctorId === userId ? 'doctor' : 'patient';

      const doctorUser = store.users.findById(consultation.doctorId);
      const patientUser = consultation.patientId ? store.users.findById(consultation.patientId) : null;

      // b) Language detection
      let detectedLang, detectConfidence, detectMethod;

      if (sttLanguage && typeof sttConfidence === 'number' && sttConfidence >= 0.7) {
        detectedLang = sttLanguage;
        detectConfidence = sttConfidence;
        detectMethod = 'stt';
      } else {
        const hint = spokenLang === 'auto' ? sender.nativeLanguage : spokenLang;
        const det = await detectLanguage(text, hint);
        detectedLang = det.code;
        detectConfidence = det.confidence;
        detectMethod = det.method;
      }

      // c) Translate to all relevant targets
      const targets = [...new Set([
        'en',
        doctorUser ? doctorUser.nativeLanguage : null,
        patientUser ? patientUser.nativeLanguage : null,
        detectedLang,
      ].filter(Boolean))];

      const { translations, provider: translateProvider } = await translateMany(text, detectedLang, targets);
      translations[detectedLang] = text;

      // d) Store message and emit
      const message = {
        id: crypto.randomUUID(),
        senderId: userId,
        senderRole,
        inputMode: inputMode || 'text',
        spokenLang: spokenLang || null,
        detectedLang,
        detectConfidence,
        detectMethod,
        originalText: text,
        translations,
        providers: { stt: sttProvider || null, translate: translateProvider },
        createdAt: new Date().toISOString(),
      };

      store.consultations.addMessage(consultation.id, message);
      io.to(`consult:${consultation.id}`).emit('message:new', message);

      // e) AUTO-LEARN language
      let senderLanguageUpdated = false;
      const otherParticipant = senderRole === 'doctor' ? patientUser : doctorUser;

      if (
        sender.languageSource !== 'manual' &&
        detectedLang !== 'en' &&
        detectedLang !== (otherParticipant ? otherParticipant.nativeLanguage : null) &&
        detectedLang !== sender.nativeLanguage &&
        detectConfidence >= 0.8
      ) {
        store.users.update(userId, { nativeLanguage: detectedLang, languageSource: 'detected' });
        io.to(`consult:${consultation.id}`).emit('profile:updated', {
          userId,
          nativeLanguage: detectedLang,
        });
        senderLanguageUpdated = true;
      }

      res.json({ message, senderLanguageUpdated });
    } catch (err) {
      console.error('POST /consultations/:id/messages error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  return router;
};
