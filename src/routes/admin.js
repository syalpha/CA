const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { requireAdmin } = require('../auth');
const data = require('../data');
const store = require('../store');

router.use(requireAdmin);

function computeStats(all, filters = {}) {
  const membresById = Object.fromEntries(all.Membres.map((m) => [Number(m.id), m]));
  const activitesById = Object.fromEntries(all.Activites.map((a) => [Number(a.id), a]));
  const sectionsById = Object.fromEntries(all.Sections.map((s) => [Number(s.id), s]));

  let presences = all.Presences.filter((p) => membresById[Number(p.membreId)]);

  if (filters.sectionId) {
    presences = presences.filter((p) => Number(membresById[Number(p.membreId)].sectionId) === Number(filters.sectionId));
  }
  if (filters.activiteId) {
    presences = presences.filter((p) => Number(p.activiteId) === Number(filters.activiteId));
  }
  if (filters.membreId) {
    presences = presences.filter((p) => Number(p.membreId) === Number(filters.membreId));
  }
  if (filters.dateFrom) {
    presences = presences.filter((p) => String(p.date) >= filters.dateFrom);
  }
  if (filters.dateTo) {
    presences = presences.filter((p) => String(p.date) <= filters.dateTo);
  }

  const total = presences.length;
  const presents = presences.filter((p) => data.truthy(p.present)).length;
  const tauxGlobal = total ? Math.round((presents / total) * 1000) / 10 : 0;

  const parSection = {};
  for (const s of all.Sections) parSection[s.id] = { nom: s.nom, total: 0, presents: 0 };
  for (const p of presences) {
    const m = membresById[Number(p.membreId)];
    if (!m) continue;
    const sid = Number(m.sectionId);
    if (!parSection[sid]) parSection[sid] = { nom: sectionsById[sid] ? sectionsById[sid].nom : `Section ${sid}`, total: 0, presents: 0 };
    parSection[sid].total++;
    if (data.truthy(p.present)) parSection[sid].presents++;
  }
  const sectionStats = Object.entries(parSection).map(([id, v]) => ({
    id: Number(id),
    nom: v.nom,
    total: v.total,
    presents: v.presents,
    taux: v.total ? Math.round((v.presents / v.total) * 1000) / 10 : 0,
  }));

  const parActivite = {};
  for (const a of all.Activites) parActivite[a.id] = { nom: a.nom, total: 0, presents: 0 };
  for (const p of presences) {
    const aid = Number(p.activiteId);
    if (!parActivite[aid]) parActivite[aid] = { nom: activitesById[aid] ? activitesById[aid].nom : `Activite ${aid}`, total: 0, presents: 0 };
    parActivite[aid].total++;
    if (data.truthy(p.present)) parActivite[aid].presents++;
  }
  const activiteStats = Object.entries(parActivite).map(([id, v]) => ({
    id: Number(id),
    nom: v.nom,
    total: v.total,
    presents: v.presents,
    taux: v.total ? Math.round((v.presents / v.total) * 1000) / 10 : 0,
  }));

  const parMembre = {};
  for (const m of all.Membres) parMembre[m.id] = { nom: m.nom, section: sectionsById[Number(m.sectionId)] ? sectionsById[Number(m.sectionId)].nom : '?', total: 0, presents: 0 };
  for (const p of presences) {
    const mid = Number(p.membreId);
    if (!parMembre[mid]) continue;
    parMembre[mid].total++;
    if (data.truthy(p.present)) parMembre[mid].presents++;
  }
  const membreStats = Object.entries(parMembre)
    .map(([id, v]) => ({
      id: Number(id),
      nom: v.nom,
      section: v.section,
      total: v.total,
      presents: v.presents,
      taux: v.total ? Math.round((v.presents / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.taux - b.taux);

  return { total, presents, tauxGlobal, sectionStats, activiteStats, membreStats, presencesDetail: presences.map((p) => ({
    ...p,
    membreNom: membresById[Number(p.membreId)] ? membresById[Number(p.membreId)].nom : '?',
    sectionNom: (() => {
      const m = membresById[Number(p.membreId)];
      const s = m ? sectionsById[Number(m.sectionId)] : null;
      return s ? s.nom : '?';
    })(),
    activiteNom: activitesById[Number(p.activiteId)] ? activitesById[Number(p.activiteId)].nom : '?',
  })).sort((a, b) => String(b.date).localeCompare(String(a.date))) };
}

router.get('/', async (req, res) => {
  const all = await data.getAll();
  const stats = computeStats(all);
  res.render('admin/dashboard', {
    nbSections: all.Sections.length,
    nbMembres: all.Membres.length,
    nbActivites: all.Activites.filter((a) => data.truthy(a.actif)).length,
    stats,
  });
});

// ---- Sections ----
router.get('/sections', async (req, res) => {
  const all = await data.getAll();
  const counts = {};
  all.Membres.forEach((m) => (counts[m.sectionId] = (counts[m.sectionId] || 0) + 1));
  res.render('admin/sections', { sections: all.Sections, counts });
});

router.post('/sections/add', async (req, res) => {
  await data.addSection(req.body.nom);
  req.flash('success', 'Section ajoutee.');
  res.redirect('/admin/sections');
});

router.post('/sections/:id/delete', async (req, res) => {
  await data.deleteSection(req.params.id);
  req.flash('success', 'Section supprimee.');
  res.redirect('/admin/sections');
});

// ---- Membres ----
router.get('/membres', async (req, res) => {
  const all = await data.getAll();
  const sectionsById = Object.fromEntries(all.Sections.map((s) => [Number(s.id), s.nom]));
  const membres = all.Membres.map((m) => ({ ...m, sectionNom: sectionsById[Number(m.sectionId)] || '?' }));
  res.render('admin/membres', { membres, sections: all.Sections });
});

router.post('/membres/add', async (req, res) => {
  await data.addMembre(req.body.sectionId, req.body.nom);
  req.flash('success', 'Membre CA ajoute.');
  res.redirect('/admin/membres');
});

router.post('/membres/:id/edit', async (req, res) => {
  await data.editMembre(req.params.id, req.body.sectionId, req.body.nom);
  req.flash('success', 'Membre CA modifie.');
  res.redirect('/admin/membres');
});

router.post('/membres/:id/delete', async (req, res) => {
  await data.deleteMembre(req.params.id);
  req.flash('success', 'Membre CA supprime.');
  res.redirect('/admin/membres');
});

// ---- Activites ----
router.get('/activites', async (req, res) => {
  const all = await data.getAll();
  res.render('admin/activites', { activites: all.Activites });
});

router.post('/activites/add', async (req, res) => {
  const { nom, jour, heure, actif } = req.body;
  await data.addActivite(nom, jour, heure, actif);
  req.flash('success', 'Activite ajoutee.');
  res.redirect('/admin/activites');
});

router.post('/activites/:id/edit', async (req, res) => {
  const { nom, jour, heure, actif } = req.body;
  await data.editActivite(req.params.id, nom, jour, heure, actif);
  req.flash('success', 'Activite modifiee.');
  res.redirect('/admin/activites');
});

router.post('/activites/:id/delete', async (req, res) => {
  await data.deleteActivite(req.params.id);
  req.flash('success', 'Activite supprimee.');
  res.redirect('/admin/activites');
});

// ---- Utilisateurs ----
router.get('/utilisateurs', async (req, res) => {
  const all = await data.getAll();
  const sectionsById = Object.fromEntries(all.Sections.map((s) => [Number(s.id), s.nom]));
  const utilisateurs = all.Utilisateurs.map((u) => ({ ...u, sectionNom: u.sectionId ? sectionsById[Number(u.sectionId)] : '-' }));
  res.render('admin/utilisateurs', { utilisateurs, sections: all.Sections });
});

router.post('/utilisateurs/add', async (req, res) => {
  try {
    const { username, password, role, sectionId, nomAffichage } = req.body;
    await data.addUtilisateur({ username, password, role, sectionId, nomAffichage });
    req.flash('success', 'Utilisateur cree.');
  } catch (e) {
    req.flash('error', e.message);
  }
  res.redirect('/admin/utilisateurs');
});

router.post('/utilisateurs/:id/reset-password', async (req, res) => {
  await data.resetPassword(req.params.id, req.body.password);
  req.flash('success', 'Mot de passe reinitialise.');
  res.redirect('/admin/utilisateurs');
});

router.post('/utilisateurs/:id/delete', async (req, res) => {
  if (Number(req.params.id) === req.session.user.id) {
    req.flash('error', 'Vous ne pouvez pas supprimer votre propre compte.');
    return res.redirect('/admin/utilisateurs');
  }
  await data.deleteUtilisateur(req.params.id);
  req.flash('success', 'Utilisateur supprime.');
  res.redirect('/admin/utilisateurs');
});

// ---- Rapport detaille (BO) ----
router.get('/rapport', async (req, res) => {
  const all = await data.getAll();
  const filters = {
    sectionId: req.query.sectionId || '',
    activiteId: req.query.activiteId || '',
    membreId: req.query.membreId || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || '',
  };
  const stats = computeStats(all, filters);
  res.render('admin/rapport', {
    sections: all.Sections,
    activites: all.Activites,
    membres: all.Membres,
    filters,
    stats,
  });
});

router.get('/rapport/export', async (req, res) => {
  const all = await data.getAll();
  const filters = {
    sectionId: req.query.sectionId || '',
    activiteId: req.query.activiteId || '',
    membreId: req.query.membreId || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || '',
  };
  const stats = computeStats(all, filters);

  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Synthese');
  summary.addRow(['Rapport de presence - Commission Administrative']);
  summary.addRow(['Genere le', new Date().toLocaleString('fr-FR')]);
  summary.addRow([]);
  summary.addRow(['Taux global (%)', stats.tauxGlobal]);
  summary.addRow(['Total saisies', stats.total]);
  summary.addRow(['Total presences', stats.presents]);
  summary.addRow([]);
  summary.addRow(['Section', 'Total', 'Presents', 'Taux (%)']);
  stats.sectionStats.forEach((s) => summary.addRow([s.nom, s.total, s.presents, s.taux]));
  summary.addRow([]);
  summary.addRow(['Activite', 'Total', 'Presents', 'Taux (%)']);
  stats.activiteStats.forEach((a) => summary.addRow([a.nom, a.total, a.presents, a.taux]));

  const membresSheet = wb.addWorksheet('Par Membre');
  membresSheet.addRow(['Membre', 'Section', 'Total', 'Presents', 'Taux (%)']);
  stats.membreStats.forEach((m) => membresSheet.addRow([m.nom, m.section, m.total, m.presents, m.taux]));

  const detailSheet = wb.addWorksheet('Detail');
  detailSheet.addRow(['Date', 'Section', 'Activite', 'Membre', 'Present', 'Remarque', 'Saisi par', 'Saisi le']);
  stats.presencesDetail.forEach((p) =>
    detailSheet.addRow([p.date, p.sectionNom, p.activiteNom, p.membreNom, p.present ? 'Oui' : 'Non', p.remarque, p.saisiPar, p.saisiLe])
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-presence-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/export', async (req, res) => {
  await store.readAll(); // ensure file exists
  res.download(store.DATA_FILE, 'attendance.xlsx');
});

module.exports = router;
