const store = require('./store');
const bcrypt = require('bcryptjs');

function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
}

async function getAll() {
  return store.readAll();
}

async function findUserByUsername(username) {
  const data = await store.readAll();
  return data.Utilisateurs.find((u) => u.username === username);
}

async function addSection(nom) {
  return store.withLock(async () => {
    const data = await store.readAll();
    const id = store.nextId(data.Sections);
    data.Sections.push({ id, nom });
    await store.save(data);
    return id;
  });
}

async function deleteSection(id) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    data.Sections = data.Sections.filter((s) => Number(s.id) !== id);
    data.Membres = data.Membres.filter((m) => Number(m.sectionId) !== id);
    data.Utilisateurs = data.Utilisateurs.filter((u) => Number(u.sectionId) !== id || u.role === 'admin');
    await store.save(data);
  });
}

async function addMembre(sectionId, nom) {
  return store.withLock(async () => {
    const data = await store.readAll();
    const id = store.nextId(data.Membres);
    data.Membres.push({ id, sectionId: Number(sectionId), nom });
    await store.save(data);
    return id;
  });
}

async function editMembre(id, sectionId, nom) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    const m = data.Membres.find((x) => Number(x.id) === id);
    if (m) {
      m.sectionId = Number(sectionId);
      m.nom = nom;
    }
    await store.save(data);
  });
}

async function deleteMembre(id) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    data.Membres = data.Membres.filter((m) => Number(m.id) !== id);
    data.Presences = data.Presences.filter((p) => Number(p.membreId) !== id);
    await store.save(data);
  });
}

async function addActivite(nom, jour, heure, actif) {
  return store.withLock(async () => {
    const data = await store.readAll();
    const id = store.nextId(data.Activites);
    data.Activites.push({ id, nom, jour, heure, actif: truthy(actif) });
    await store.save(data);
    return id;
  });
}

async function editActivite(id, nom, jour, heure, actif) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    const a = data.Activites.find((x) => Number(x.id) === id);
    if (a) {
      a.nom = nom;
      a.jour = jour;
      a.heure = heure;
      a.actif = truthy(actif);
    }
    await store.save(data);
  });
}

async function deleteActivite(id) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    data.Activites = data.Activites.filter((a) => Number(a.id) !== id);
    data.Presences = data.Presences.filter((p) => Number(p.activiteId) !== id);
    await store.save(data);
  });
}

async function addUtilisateur({ username, password, role, sectionId, nomAffichage }) {
  return store.withLock(async () => {
    const data = await store.readAll();
    if (data.Utilisateurs.some((u) => u.username === username)) {
      throw new Error('Ce nom d\'utilisateur existe deja');
    }
    const id = store.nextId(data.Utilisateurs);
    data.Utilisateurs.push({
      id,
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
      sectionId: role === 'admin' ? '' : Number(sectionId),
      nomAffichage,
    });
    await store.save(data);
    return id;
  });
}

async function resetPassword(id, newPassword) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    const u = data.Utilisateurs.find((x) => Number(x.id) === id);
    if (u) u.passwordHash = bcrypt.hashSync(newPassword, 10);
    await store.save(data);
  });
}

async function deleteUtilisateur(id) {
  id = Number(id);
  return store.withLock(async () => {
    const data = await store.readAll();
    data.Utilisateurs = data.Utilisateurs.filter((u) => Number(u.id) !== id);
    await store.save(data);
  });
}

async function upsertPresences(entries, saisiPar) {
  // entries: [{date, activiteId, membreId, present, remarque}]
  return store.withLock(async () => {
    const data = await store.readAll();
    const now = new Date().toISOString();
    for (const e of entries) {
      const existing = data.Presences.find(
        (p) =>
          String(p.date) === String(e.date) &&
          Number(p.activiteId) === Number(e.activiteId) &&
          Number(p.membreId) === Number(e.membreId)
      );
      if (existing) {
        existing.present = truthy(e.present);
        existing.remarque = e.remarque || '';
        existing.saisiPar = saisiPar;
        existing.saisiLe = now;
      } else {
        const id = store.nextId(data.Presences);
        data.Presences.push({
          id,
          date: e.date,
          activiteId: Number(e.activiteId),
          membreId: Number(e.membreId),
          present: truthy(e.present),
          remarque: e.remarque || '',
          saisiPar,
          saisiLe: now,
        });
      }
    }
    await store.save(data);
  });
}

module.exports = {
  getAll,
  findUserByUsername,
  addSection,
  deleteSection,
  addMembre,
  editMembre,
  deleteMembre,
  addActivite,
  editActivite,
  deleteActivite,
  addUtilisateur,
  resetPassword,
  deleteUtilisateur,
  upsertPresences,
  truthy,
};
