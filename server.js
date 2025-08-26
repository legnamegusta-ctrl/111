const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const animals = {};
const pesagens = [];
const tratamentos = [];
const lotes = {};
const despesas = [];
const receitas = [];

app.post('/animals/register', (req, res) => {
  const { tag, birthDate, breed, status } = req.body;
  const id = tag || uuidv4();
  const animal = { id, birthDate, breed, status };
  animals[id] = animal;
  res.status(201).json(animal);
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
  res.json(animal);
});

app.post('/pesagens', (req, res) => {
  const { animalId, peso, data, operador } = req.body;
  const animal = animals[animalId];
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  const pesagem = { id: uuidv4(), animalId, peso, data, operador };
  pesagens.push(pesagem);
  animal.peso = peso;
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

app.listen(3000, () => console.log('API running on port 3000'));
