const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { generateForecast } = require('./mlPipeline');

const app = express();
app.use(express.json());

const db = new sqlite3.Database('data.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS animals (
    id TEXT PRIMARY KEY,
    birthDate TEXT,
    breed TEXT,
    status TEXT,
    peso REAL,
    updatedAt INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pesagens (
    id TEXT PRIMARY KEY,
    animalId TEXT,
    peso REAL,
    data TEXT,
    operador TEXT,
    updatedAt INTEGER
  )`);
});

const animals = {};
const pesagens = [];
const tratamentos = [];
const lotes = {};
const despesas = [];
const receitas = [];

db.all('SELECT * FROM animals', (err, rows) => {
  if (err) return;
  rows.forEach(r => {
    animals[r.id] = { id: r.id, birthDate: r.birthDate, breed: r.breed, status: r.status, peso: r.peso, updatedAt: r.updatedAt };
  });
});
db.all('SELECT * FROM pesagens', (err, rows) => {
  if (err) return;
  rows.forEach(r => {
    const p = { id: r.id, animalId: r.animalId, peso: r.peso, data: r.data, operador: r.operador, updatedAt: r.updatedAt };
    pesagens.push(p);
    const a = animals[r.animalId];
    if (a && (!a.updatedAt || r.updatedAt > a.updatedAt)) {
      a.peso = r.peso;
      a.updatedAt = r.updatedAt;
    }
  });
});

app.post('/animals/register', (req, res) => {
  const { tag, birthDate, breed, status } = req.body;
  const id = tag || uuidv4();
  const animal = { id, birthDate, breed, status, updatedAt: Date.now() };
  animals[id] = animal;
  db.run('INSERT OR REPLACE INTO animals (id, birthDate, breed, status, peso, updatedAt) VALUES (?,?,?,?,?,?)',
    [id, birthDate, breed, status, animal.peso || null, animal.updatedAt],
    () => res.status(201).json(animal)
  );
});

app.get('/animals/:id', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(animal);
});

app.put('/animals/:id', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  const { birthDate, breed, status } = req.body;
  if (birthDate !== undefined) animal.birthDate = birthDate;
  if (breed !== undefined) animal.breed = breed;
  if (status !== undefined) animal.status = status;
  animal.updatedAt = Date.now();
  db.run('UPDATE animals SET birthDate=?, breed=?, status=?, peso=?, updatedAt=? WHERE id=?',
    [animal.birthDate, animal.breed, animal.status, animal.peso || null, animal.updatedAt, animal.id],
    () => res.json(animal)
  );
});

app.post('/pesagens', (req, res) => {
  const { animalId, peso, data, operador } = req.body;
  const animal = animals[animalId];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  const pesagem = { id: uuidv4(), animalId, peso, data, operador, updatedAt: Date.now() };
  pesagens.push(pesagem);
  animal.peso = peso;
  animal.updatedAt = pesagem.updatedAt;
  db.serialize(() => {
    db.run('INSERT OR REPLACE INTO pesagens (id, animalId, peso, data, operador, updatedAt) VALUES (?,?,?,?,?,?)',
      [pesagem.id, animalId, peso, data, operador, pesagem.updatedAt]);
    db.run('UPDATE animals SET peso=?, updatedAt=? WHERE id=?', [peso, animal.updatedAt, animalId]);
  });
  res.status(201).json(pesagem);
});

app.get('/animals/:id/pesagens', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(pesagens.filter(p => p.animalId === animal.id));
});

// Lotes
app.post('/lotes', (req, res) => {
  const { nome } = req.body;
  const id = uuidv4();
  lotes[id] = { id, nome, animalIds: [] };
  res.status(201).json(lotes[id]);
});

app.post('/lotes/:id/animals', (req, res) => {
  const lote = lotes[req.params.id];
  if (!lote) return res.status(404).json({ error: 'Lote not found' });
  const { animalId } = req.body;
  if (!animals[animalId]) return res.status(404).json({ error: 'Animal not found' });
  if (!lote.animalIds.includes(animalId)) lote.animalIds.push(animalId);
  res.json(lote);
});

app.get('/lotes/:id', (req, res) => {
  const lote = lotes[req.params.id];
  if (!lote) return res.status(404).json({ error: 'Lote not found' });
  res.json(lote);
});

app.post('/animals/:id/tratamentos', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  const { tipo, descricao, dataAplicacao, proximaDose, documentos } = req.body;
  const tratamento = {
    id: uuidv4(),
    animalId: animal.id,
    tipo,
    descricao,
    dataAplicacao,
    proximaDose,
    documentos: documentos || []
  };
  tratamentos.push(tratamento);
  animal.tratamentos = animal.tratamentos || [];
  animal.tratamentos.push(tratamento);
  res.status(201).json(tratamento);
});

app.get('/animals/:id/tratamentos', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(animal.tratamentos || []);
});

app.post('/animals/:animalId/tratamentos/:tratamentoId/documentos', (req, res) => {
  const animal = animals[req.params.animalId];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  const tratamento = (animal.tratamentos || []).find(t => t.id === req.params.tratamentoId);
  if (!tratamento) return res.status(404).json({ error: 'Tratamento not found' });
  const { nome, conteudo } = req.body;
  const documento = { id: uuidv4(), nome, conteudo };
  tratamento.documentos = tratamento.documentos || [];
  tratamento.documentos.push(documento);
  res.status(201).json(documento);
});

function upcoming(list) {
  const now = new Date();
  return list.filter(t => t.proximaDose && new Date(t.proximaDose) > now);
}

app.get('/reminders', (req, res) => {
  const all = [];
  Object.values(animals).forEach(animal => {
    (animal.tratamentos || []).forEach(t => {
      if (t.proximaDose && new Date(t.proximaDose) > new Date()) {
        all.push({ animalId: animal.id, ...t });
      }
    });
  });
  res.json(all);
});

app.get('/animals/:id/reminders', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(upcoming(animal.tratamentos || []));
});

// Despesas
app.post('/despesas', (req, res) => {
  const { descricao, valor, data, animalId, loteId } = req.body;
  if (!animalId && !loteId) {
    return res.status(400).json({ error: 'animalId or loteId required' });
  }
  if (animalId && !animals[animalId]) {
    return res.status(404).json({ error: 'Animal not found' });
  }
  if (loteId && !lotes[loteId]) {
    return res.status(404).json({ error: 'Lote not found' });
  }
  const despesa = { id: uuidv4(), descricao, valor, data, animalId, loteId };
  despesas.push(despesa);
  res.status(201).json(despesa);
});

app.get('/animals/:id/despesas', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(despesas.filter(d => d.animalId === animal.id));
});

app.get('/lotes/:id/despesas', (req, res) => {
  const lote = lotes[req.params.id];
  if (!lote) return res.status(404).json({ error: 'Lote not found' });
  res.json(despesas.filter(d => d.loteId === lote.id));
});

// Receitas
app.post('/receitas', (req, res) => {
  const { descricao, valor, data, animalId, loteId } = req.body;
  if (!animalId && !loteId) {
    return res.status(400).json({ error: 'animalId or loteId required' });
  }
  if (animalId && !animals[animalId]) {
    return res.status(404).json({ error: 'Animal not found' });
  }
  if (loteId && !lotes[loteId]) {
    return res.status(404).json({ error: 'Lote not found' });
  }
  const receita = { id: uuidv4(), descricao, valor, data, animalId, loteId };
  receitas.push(receita);
  res.status(201).json(receita);
});

app.get('/animals/:id/receitas', (req, res) => {
  const animal = animals[req.params.id];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(receitas.filter(r => r.animalId === animal.id));
});

app.get('/lotes/:id/receitas', (req, res) => {
  const lote = lotes[req.params.id];
  if (!lote) return res.status(404).json({ error: 'Lote not found' });
  res.json(receitas.filter(r => r.loteId === lote.id));
});

function totalWeightGain() {
  return Object.values(animals).reduce((total, animal) => {
    const list = pesagens
      .filter(p => p.animalId === animal.id)
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    if (list.length > 1) {
      const ganho = list[list.length - 1].peso - list[0].peso;
      if (ganho > 0) total += ganho;
    }
    return total;
  }, 0);
}

function calculateKPIs({ start, end, loteId, categoria }) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  let selectedAnimals = Object.values(animals);
  if (categoria) selectedAnimals = selectedAnimals.filter(a => a.breed === categoria);
  if (loteId) {
    const lote = lotes[loteId];
    if (lote) {
      const ids = new Set(lote.animalIds);
      selectedAnimals = selectedAnimals.filter(a => ids.has(a.id));
    } else {
      selectedAnimals = [];
    }
  }
  const lotacao = selectedAnimals.length;

  const msPerDay = 1000 * 60 * 60 * 24;
  let totalGain = 0;
  let totalDailyGain = 0;
  let animalsWithData = 0;
  const animalIdSet = new Set(selectedAnimals.map(a => a.id));

  selectedAnimals.forEach(animal => {
    const list = pesagens
      .filter(p => p.animalId === animal.id)
      .filter(p => (!startDate || new Date(p.data) >= startDate) && (!endDate || new Date(p.data) <= endDate))
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    if (list.length > 1) {
      const first = list[0];
      const last = list[list.length - 1];
      const gain = last.peso - first.peso;
      const days = (new Date(last.data) - new Date(first.data)) / msPerDay;
      if (gain > 0 && days > 0) {
        totalGain += gain;
        totalDailyGain += gain / days;
        animalsWithData++;
      }
    }
  });
  const ganhoMedioDiario = animalsWithData ? totalDailyGain / animalsWithData : 0;

  const despesasFiltradas = despesas.filter(d => {
    if (startDate && new Date(d.data) < startDate) return false;
    if (endDate && new Date(d.data) > endDate) return false;
    if (d.animalId) return animalIdSet.has(d.animalId);
    if (d.loteId) return !loteId || d.loteId === loteId;
    return true;
  });
  const totalDespesas = despesasFiltradas.reduce((s, d) => s + d.valor, 0);
  const custoPorKg = totalGain > 0 ? totalDespesas / totalGain : 0;

  return { lotacao, ganhoMedioDiario, custoPorKg };
}

app.post('/sync', (req, res) => {
  const { since = 0, animals: incomingAnimals = [], pesagens: incomingPesagens = [] } = req.body;
  db.serialize(() => {
    incomingAnimals.forEach(a => {
      if (a.deleted) {
        db.run('DELETE FROM animals WHERE id=?', [a.id]);
        delete animals[a.id];
        return;
      }
      db.get('SELECT updatedAt FROM animals WHERE id=?', [a.id], (err, row) => {
        if (!row || a.updatedAt > row.updatedAt) {
          db.run('INSERT OR REPLACE INTO animals (id, birthDate, breed, status, peso, updatedAt) VALUES (?,?,?,?,?,?)',
            [a.id, a.birthDate, a.breed, a.status, a.peso || null, a.updatedAt]);
          animals[a.id] = { id: a.id, birthDate: a.birthDate, breed: a.breed, status: a.status, peso: a.peso, updatedAt: a.updatedAt };
        }
      });
    });
    incomingPesagens.forEach(p => {
      db.get('SELECT updatedAt FROM pesagens WHERE id=?', [p.id], (err, row) => {
        if (!row || p.updatedAt > row.updatedAt) {
          db.run('INSERT OR REPLACE INTO pesagens (id, animalId, peso, data, operador, updatedAt) VALUES (?,?,?,?,?,?)',
            [p.id, p.animalId, p.peso, p.data, p.operador, p.updatedAt]);
          const animal = animals[p.animalId];
          if (animal && (!animal.updatedAt || p.updatedAt > animal.updatedAt)) {
            animal.peso = p.peso;
            animal.updatedAt = p.updatedAt;
            db.run('UPDATE animals SET peso=?, updatedAt=? WHERE id=?', [animal.peso, animal.updatedAt, animal.id]);
          }
          const idx = pesagens.findIndex(x => x.id === p.id);
          if (idx >= 0) pesagens[idx] = p; else pesagens.push(p);
        }
      });
    });
    db.all('SELECT * FROM animals WHERE updatedAt > ?', [since], (err, animalsRows) => {
      db.all('SELECT * FROM pesagens WHERE updatedAt > ?', [since], (err2, pesagensRows) => {
        res.json({ animals: animalsRows, pesagens: pesagensRows, timestamp: Date.now() });
      });
    });
  });
});

app.get('/kpis', (req, res) => {
  const { start, end, loteId, categoria } = req.query;
  const kpis = calculateKPIs({ start, end, loteId, categoria });
  res.json(kpis);
});

app.get('/kpis/export', async (req, res) => {
  const { start, end, loteId, categoria, format } = req.query;
  const kpis = calculateKPIs({ start, end, loteId, categoria });
  if (format === 'pdf') {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="kpis.pdf"');
      res.send(buffer);
    });
    doc.text('KPIs');
    Object.entries(kpis).forEach(([k, v]) => doc.text(`${k}: ${v}`));
    doc.end();
    return;
  }
  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('KPIs');
    ws.addRow(['KPI', 'Valor']);
    Object.entries(kpis).forEach(([k, v]) => ws.addRow([k, v]));
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="kpis.xlsx"');
    res.send(buffer);
    return;
  }
  if (format === 'image') {
    const entries = Object.entries(kpis);
    const svgHeight = (entries.length + 1) * 20 + 10;
    const lines = entries
      .map(([k, v], i) => `<text x="10" y="${(i + 2) * 20}">${k}: ${v}</text>`)
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${svgHeight}"><style>text{font-size:16px;}</style><text x="10" y="20">KPIs</text>${lines}</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="kpis.svg"');
    res.send(svg);
    return;
  }
  res.status(400).json({ error: 'Invalid format' });
});

app.get('/dashboard', (req, res) => {
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const lucro = totalReceitas - totalDespesas;
  const numAnimais = Object.keys(animals).length;
  const custoMedioPorAnimal = numAnimais ? totalDespesas / numAnimais : 0;
  const ganhoTotal = totalWeightGain();
  const custoPorKgGanho = ganhoTotal > 0 ? totalDespesas / ganhoTotal : 0;
  res.json({
    totalDespesas,
    totalReceitas,
    lucro,
    custoMedioPorAnimal,
    custoPorKgGanho
  });
});

app.get('/forecast', (req, res) => {
  const result = generateForecast(animals, pesagens, despesas);
  res.json(result);
});

app.listen(3000, () => console.log('API running on port 3000'));
