const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const animals = {};

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

app.listen(3000, () => console.log('API running on port 3000'));
