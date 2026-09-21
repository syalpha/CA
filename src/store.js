const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, '..', 'data', 'attendance.xlsx');

const SCHEMAS = {
  Sections: ['id', 'nom'],
  Membres: ['id', 'sectionId', 'nom'],
  Activites: ['id', 'nom', 'jour', 'heure', 'actif'],
  Utilisateurs: ['id', 'username', 'passwordHash', 'role', 'sectionId', 'nomAffichage'],
  Presences: ['id', 'date', 'activiteId', 'membreId', 'present', 'remarque', 'saisiPar', 'saisiLe'],
};

// Simple write queue so concurrent requests never corrupt the xlsx file.
let queue = Promise.resolve();
function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function seedWorkbook() {
  const admin = { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin', sectionId: '', nomAffichage: 'Super Administrateur' };

  const sections = [];
  const membres = [];
  const utilisateurs = [admin];
  let membreId = 1;
  for (let s = 1; s <= 9; s++) {
    sections.push({ id: s, nom: `Section ${s}` });
    for (let c = 1; c <= 3; c++) {
      membres.push({ id: membreId, sectionId: s, nom: `CA ${c} - Section ${s}` });
      membreId++;
    }
    utilisateurs.push({
      id: s + 1,
      username: `section${s}`,
      passwordHash: bcrypt.hashSync('section123', 10),
      role: 'section',
      sectionId: s,
      nomAffichage: `Referent Section ${s}`,
    });
  }

  const activites = [
    { id: 1, nom: 'Activite 1', jour: 'Lundi', heure: '18:00', actif: true },
    { id: 2, nom: 'Activite 2', jour: 'Mercredi', heure: '18:00', actif: true },
    { id: 3, nom: 'Activite 3', jour: 'Vendredi', heure: '18:00', actif: true },
  ];

  return {
    Sections: sections,
    Membres: membres,
    Activites: activites,
    Utilisateurs: utilisateurs,
    Presences: [],
  };
}

async function writeAllSheets(data) {
  const wb = new ExcelJS.Workbook();
  for (const [name, headers] of Object.entries(SCHEMAS)) {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const row of data[name] || []) {
      ws.addRow(headers.map((h) => row[h] === undefined || row[h] === null ? '' : row[h]));
    }
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  await wb.xlsx.writeFile(DATA_FILE);
}

async function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    await writeAllSheets(seedWorkbook());
  }
}

function normalizeRow(headers, rowValues) {
  // exceljs rowValues is 1-indexed with index 0 empty
  const obj = {};
  headers.forEach((h, i) => {
    let v = rowValues[i + 1];
    if (v === undefined || v === null) v = '';
    if (v && typeof v === 'object' && 'result' in v) v = v.result; // formula cell safety
    obj[h] = v;
  });
  return obj;
}

async function readAll() {
  await ensureFile();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DATA_FILE);
  const data = {};
  for (const [name, headers] of Object.entries(SCHEMAS)) {
    const ws = wb.getWorksheet(name);
    const rows = [];
    if (ws) {
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        rows.push(normalizeRow(headers, row.values));
      });
    }
    data[name] = rows;
  }
  return data;
}

// Note: callers are expected to already hold the lock (via withLock) before
// calling save, since mutation flows in data.js do read-modify-write under
// a single lock acquisition. Locking again here would deadlock.
async function save(data) {
  return writeAllSheets(data);
}

function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

module.exports = {
  DATA_FILE,
  SCHEMAS,
  readAll,
  save,
  nextId,
  withLock,
};
