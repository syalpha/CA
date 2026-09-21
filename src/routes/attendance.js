const express = require('express');
const router = express.Router();
const data = require('../data');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/', async (req, res) => {
  const all = await data.getAll();
  const user = req.session.user;

  const sections = all.Sections.map((s) => ({ ...s, id: Number(s.id) }));
  const activitesActives = all.Activites.filter((a) => data.truthy(a.actif));

  let sectionId = user.role === 'admin' ? Number(req.query.sectionId) || (sections[0] && sections[0].id) : Number(user.sectionId);
  const date = req.query.date || todayISO();
  const activiteId = Number(req.query.activiteId) || (activitesActives[0] && Number(activitesActives[0].id));

  const membres = all.Membres.filter((m) => Number(m.sectionId) === sectionId);
  const existing = {};
  all.Presences.forEach((p) => {
    if (String(p.date) === String(date) && Number(p.activiteId) === Number(activiteId)) {
      existing[Number(p.membreId)] = p;
    }
  });

  res.render('attendance/mark', {
    isAdmin: user.role === 'admin',
    sections,
    sectionId,
    date,
    activiteId,
    activitesActives,
    membres,
    existing,
  });
});

router.post('/', async (req, res) => {
  const user = req.session.user;
  const { date, activiteId } = req.body;
  const sectionId = user.role === 'admin' ? Number(req.body.sectionId) : Number(user.sectionId);

  const all = await data.getAll();
  const membres = all.Membres.filter((m) => Number(m.sectionId) === sectionId);

  const entries = membres.map((m) => ({
    date,
    activiteId,
    membreId: m.id,
    present: req.body[`present_${m.id}`] === 'on',
    remarque: req.body[`remarque_${m.id}`] || '',
  }));

  await data.upsertPresences(entries, user.username);
  req.flash('success', 'Presences enregistrees avec succes.');
  res.redirect(`/presence?date=${encodeURIComponent(date)}&activiteId=${activiteId}&sectionId=${sectionId}`);
});

router.get('/historique', async (req, res) => {
  const user = req.session.user;
  const all = await data.getAll();

  const sectionId = user.role === 'admin' ? Number(req.query.sectionId) || '' : Number(user.sectionId);

  const membresById = Object.fromEntries(all.Membres.map((m) => [Number(m.id), m]));
  const activitesById = Object.fromEntries(all.Activites.map((a) => [Number(a.id), a]));

  let rows = all.Presences.filter((p) => {
    const m = membresById[Number(p.membreId)];
    if (!m) return false;
    if (sectionId && Number(m.sectionId) !== Number(sectionId)) return false;
    return true;
  });

  rows = rows
    .map((p) => ({
      ...p,
      membreNom: membresById[Number(p.membreId)] ? membresById[Number(p.membreId)].nom : '?',
      activiteNom: activitesById[Number(p.activiteId)] ? activitesById[Number(p.activiteId)].nom : '?',
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  res.render('attendance/historique', {
    isAdmin: user.role === 'admin',
    sections: all.Sections,
    sectionId,
    rows,
  });
});

module.exports = router;
