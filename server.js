const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const animals = {};
const pesagens = [];
const tratamentos = [];

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

app.listen(3000, () => console.log('API running on port 3000'));
