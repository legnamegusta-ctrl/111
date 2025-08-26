const { SimpleLinearRegression } = require('ml-regression-simple-linear');

// Treina modelos de peso para cada animal com base nas pesagens
function trainWeightModels(pesagens) {
  const byAnimal = {};
  pesagens.forEach(p => {
    if (!byAnimal[p.animalId]) byAnimal[p.animalId] = [];
    byAnimal[p.animalId].push(p);
  });
  const models = {};
  Object.entries(byAnimal).forEach(([id, list]) => {
    list.sort((a, b) => new Date(a.data) - new Date(b.data));
    if (list.length >= 2) {
      const x = [];
      const y = [];
      const start = new Date(list[0].data);
      list.forEach(p => {
        x.push((new Date(p.data) - start) / (1000 * 60 * 60 * 24));
        y.push(p.peso);
      });
      const regression = new SimpleLinearRegression(x, y);
      const lastDays = x[x.length - 1];
      models[id] = { regression, lastDays, currentWeight: y[y.length - 1] };
    }
  });
  return models;
}

function forecast(models, days) {
  return Object.entries(models).map(([animalId, m]) => {
    const predictedWeight = m.regression.predict(m.lastDays + days);
    const dailyGain = (predictedWeight - m.currentWeight) / days;
    return { animalId, currentWeight: m.currentWeight, predictedWeight, dailyGain };
  });
}

function generateForecast(animals, pesagens, despesas, days = 30) {
  const models = trainWeightModels(pesagens);
  const predictions = forecast(models, days);
  const totalGain = predictions.reduce((s, p) => s + (p.predictedWeight - p.currentWeight), 0);
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const custoPorKg = totalGain > 0 ? totalDespesas / totalGain : 0;
  return { predictions, custoPorKg };
}

module.exports = { generateForecast };
