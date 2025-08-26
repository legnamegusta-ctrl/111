(function(){
  // Helpers de persistência
  function load(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e){ return fallback; }
  }
  function save(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
  }

  // Estado inicial
  const state = {
    rebanho: load('gado.rebanho', []),
    pesagens: load('gado.pesagens', []),
    custos: load('gado.custos', []),
    vendas: load('gado.vendas', []),
    tratamentos: load('gado.tratamentos', [])
  };
  let dirtyAnimals = load('gado.dirtyAnimals', []);
  let lastSync = load('gado.lastSync', 0);
  let forecast = { predictions: [], custoPorKg: 0 };

  const syncStatusEl = document.getElementById('syncStatus');
  function setSyncStatus(msg, loading=false){
    if(syncStatusEl){
      syncStatusEl.textContent = msg;
      syncStatusEl.classList.toggle('loading', loading);
    }
  }
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }

  // Dados de teste se base vazia
  if(!state.rebanho.length && !state.pesagens.length && !state.custos.length && !state.vendas.length && !state.tratamentos.length){
    state.rebanho = [
      {id: crypto.randomUUID(), nascimento:'2022-01-01', raca:'Nelore', status:'ativo', brinco:'A-001', peso:200, fornecedor:'Leilão X', preco:2200, pesoEntrada:190},
      {id: crypto.randomUUID(), nascimento:'2022-02-15', raca:'Angus', status:'ativo', brinco:'B-010', peso:280, fornecedor:'Fazenda Y', preco:2700, pesoEntrada:270}
    ];
    save('gado.rebanho', state.rebanho);
    save('gado.pesagens', state.pesagens);
    save('gado.custos', state.custos);
    save('gado.vendas', state.vendas);
    save('gado.tratamentos', state.tratamentos);
  }

  // Tabs
  const tabs = document.querySelectorAll('nav.tabs button');
  const sections = {
    rebanho: document.getElementById('tab-rebanho'),
    pesagens: document.getElementById('tab-pesagens'),
    custos: document.getElementById('tab-custos'),
    vendas: document.getElementById('tab-vendas'),
    saude: document.getElementById('tab-saude'),
    relatorios: document.getElementById('tab-relatorios'),
    planejamento: document.getElementById('tab-planejamento'),
    alertas: document.getElementById('tab-alertas')
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      Object.values(sections).forEach(sec => sec.classList.add('hidden'));
      tabs.forEach(b => b.setAttribute('aria-selected', b===btn));
      sections[tab].classList.remove('hidden');
    });
  });

  // Rebanho
  const formRebanho = document.getElementById('form-rebanho');
  const tbodyRebanho = document.querySelector('#rebanho-list tbody');
  const idInput = document.getElementById('animalId');
  const nascInput = document.getElementById('nascimento');
  const racaInput = document.getElementById('raca');
  const statusSelect = document.getElementById('status');
  const submitRebanhoBtn = formRebanho.querySelector('button[type="submit"]');
  const brincoInput = document.getElementById('brinco');
  const pesoInput = document.getElementById('peso');
  const scanBtn = document.getElementById('scanTag');
  const searchRebanho = document.getElementById('searchRebanho');
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      try {
        const code = await scanTag();
        if (code) idInput.value = code;
      } catch (e) {
        console.error(e);
      }
    });
  }

  const tbodyPlanejamento = document.querySelector('#planejamento-list tbody');
  const tbodyAlertas = document.querySelector('#alertas-list tbody');
  const alertaCusto = document.getElementById('alerta-custo');

  function filterRebanho(texto){
    const q = texto.trim().toLowerCase();
    if(!q) return state.rebanho;
    return state.rebanho.filter(a =>
      (a.brinco && a.brinco.toLowerCase().includes(q)) ||
      (a.id && a.id.toLowerCase().includes(q))
    );
  }

  function markDirtyAnimal(animal){
    const idx = dirtyAnimals.findIndex(a => a.id === animal.id);
    if(idx >= 0) dirtyAnimals[idx] = animal; else dirtyAnimals.push(animal);
    save('gado.dirtyAnimals', dirtyAnimals);
  }
  function markDeletedAnimal(id){
    const record = { id, deleted: true, updatedAt: Date.now() };
    const idx = dirtyAnimals.findIndex(a => a.id === id);
    if(idx >= 0) dirtyAnimals[idx] = record; else dirtyAnimals.push(record);
    save('gado.dirtyAnimals', dirtyAnimals);
  }


  async function loadFromFirestore(){
    if(!window.db) return;
    setSyncStatus('Sincronizando...', true);
    try{
      const snap = await window.db.collection("animals").get();
      const animals = snap.docs.map(d => d.data());
      if(animals.length){
        state.rebanho = animals;
        save("gado.rebanho", state.rebanho);
        renderAll();
      }
      setSyncStatus('Atualizado');
    }catch(err){
      console.error("Firebase fetch failed", err);
      setSyncStatus('Falha');
      alert('Falha ao carregar dados');
    }
  }

  formRebanho.addEventListener('submit', e => {
    e.preventDefault();
    const idVal = idInput.value.trim() || crypto.randomUUID();
    const nascimento = nascInput.value;
    const raca = racaInput.value.trim();
    const status = statusSelect.value;
    const brinco = brincoInput.value.trim();
    const peso = Number(pesoInput.value);
    const fornecedor = document.getElementById('fornecedor').value.trim();
    const precoVal = document.getElementById('preco').value;
    const preco = precoVal ? Number(precoVal) : undefined;
    const pesoEntradaVal = document.getElementById('pesoEntrada').value;
    const pesoEntrada = pesoEntradaVal ? Number(pesoEntradaVal) : peso;
    if(!brinco){
      brincoInput.setCustomValidity('Informe o brinco');
      brincoInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else brincoInput.setCustomValidity('');
    if(!peso){
      pesoInput.setCustomValidity('Informe o peso');
      pesoInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else pesoInput.setCustomValidity('');
    const animal = {id: idVal, nascimento, raca, status, brinco, peso, fornecedor, preco, pesoEntrada, updatedAt: Date.now()};
    const idx = state.rebanho.findIndex(a => a.id === idVal);
    if(idx >= 0){
      state.rebanho[idx] = animal;
    }else{
      state.rebanho = [...state.rebanho, animal];
    }
    save('gado.rebanho', state.rebanho);
    markDirtyAnimal(animal);
    if(window.db){
      window.db.collection("animals").doc(idVal).set(animal).catch(err => console.error("Firebase save failed", err));
    }
    try{
      formRebanho.reset();
      statusSelect.value = 'ativo';
      submitRebanhoBtn.textContent = 'Salvar';
      renderAll();
      alert('Animal salvo com sucesso');
    }catch(err){
      alert('Erro ao salvar animal');
    }
  });

  function removeAnimal(id){
    state.rebanho = state.rebanho.filter(a => a.id !== id);
    state.tratamentos = state.tratamentos.filter(t => t.animalId !== id);
    save('gado.rebanho', state.rebanho);
    save('gado.tratamentos', state.tratamentos);
    markDeletedAnimal(id);
    renderAll();
  }

  function editAnimal(id){
    const a = state.rebanho.find(an => an.id === id);
    if(!a) return;
    idInput.value = a.id;
    nascInput.value = a.nascimento || '';
    racaInput.value = a.raca || '';
    statusSelect.value = a.status || 'ativo';
    document.getElementById('brinco').value = a.brinco || '';
    document.getElementById('peso').value = a.peso || '';
    document.getElementById('fornecedor').value = a.fornecedor || '';
    document.getElementById('preco').value = a.preco ?? '';
    document.getElementById('pesoEntrada').value = a.pesoEntrada ?? '';
    submitRebanhoBtn.textContent = 'Atualizar';
  }

    function renderRebanho(){
      tbodyRebanho.innerHTML = '';
      const lista = filterRebanho(searchRebanho ? searchRebanho.value : '');
      lista.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${a.id}</td><td>${a.nascimento || ''}</td><td>${a.raca || ''}</td><td>${a.status || ''}</td><td>${a.brinco}</td><td>${a.peso}</td><td>${a.fornecedor || ''}</td><td>${a.preco ?? ''}</td><td>${a.pesoEntrada ?? ''}</td><td><button data-action="edit" data-id="${a.id}">Editar</button><button data-action="remove" data-id="${a.id}">Remover</button></td>`;
        tbodyRebanho.appendChild(tr);
      });
      tbodyRebanho.querySelectorAll('button[data-action="remove"]').forEach(btn => {
        btn.addEventListener('click', () => removeAnimal(btn.dataset.id));
      });
      tbodyRebanho.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => editAnimal(btn.dataset.id));
      });
    }

    if (searchRebanho) {
      searchRebanho.addEventListener('input', renderRebanho);
    }

  // Pesagens
  const formPesagem = document.getElementById('form-pesagem');
  const selectAnimal = document.getElementById('pesagemAnimalId');
  const tbodyPesagens = document.querySelector('#pesagens-list tbody');
  const operadorInput = document.getElementById('operadorPesagem');
  const pesoPesagemInput = document.getElementById('pesoPesagem');
  const dataPesagemInput = document.getElementById('dataPesagem');
  const pesoCtx = document.getElementById('pesosChart').getContext('2d');
  let pesoChart;

  formPesagem.addEventListener('submit', e => {
    e.preventDefault();
    const animalId = selectAnimal.value;
    const peso = Number(pesoPesagemInput.value);
    const data = dataPesagemInput.value;
    const operador = operadorInput.value.trim();
    if(!animalId){
      selectAnimal.setCustomValidity('Selecione um animal');
      selectAnimal.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else selectAnimal.setCustomValidity('');
    if(!peso){
      pesoPesagemInput.setCustomValidity('Informe o peso');
      pesoPesagemInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else pesoPesagemInput.setCustomValidity('');
    if(!data){
      dataPesagemInput.setCustomValidity('Informe a data');
      dataPesagemInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else dataPesagemInput.setCustomValidity('');
    if(!operador){
      operadorInput.setCustomValidity('Informe o operador');
      operadorInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else operadorInput.setCustomValidity('');
    try{
      const pesagem = {id: crypto.randomUUID(), animalId, data, peso, operador};
      state.pesagens = [...state.pesagens, pesagem];
      state.rebanho = state.rebanho.map(a => a.id === animalId ? {...a, peso} : a);
      save('gado.pesagens', state.pesagens);
      save('gado.rebanho', state.rebanho);
      formPesagem.reset();
      dataPesagemInput.value = new Date().toISOString().split('T')[0];
      renderAll();
      updatePesoChart(animalId);
      alert('Pesagem salva com sucesso');
    }catch(err){
      alert('Erro ao salvar pesagem');
    }
  });

  function renderPesagens(){
    selectAnimal.innerHTML = state.rebanho.map(a => `<option value="${a.id}">${a.brinco}</option>`).join('');
    tbodyPesagens.innerHTML = '';
    state.pesagens.forEach(p => {
      const animal = state.rebanho.find(a => a.id === p.animalId) || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.data}</td><td>${animal.brinco || ''}</td><td>${p.peso}</td><td>${p.operador || ''}</td>`;
      tbodyPesagens.appendChild(tr);
    });
    selectAnimal.onchange = () => updatePesoChart(selectAnimal.value);
    if (selectAnimal.value) updatePesoChart(selectAnimal.value);
  }

  function updatePesoChart(animalId){
    if(!pesoChart){
      pesoChart = new Chart(pesoCtx, {
        type: 'line',
        data: {labels: [], datasets: [{label: 'Peso', data: []}]},
        options: {}
      });
    }
    const dados = state.pesagens.filter(p => p.animalId === animalId).sort((a,b) => a.data.localeCompare(b.data));
    pesoChart.data.labels = dados.map(p => p.data);
    pesoChart.data.datasets[0].data = dados.map(p => p.peso);
    pesoChart.update();
  }

  // Custos
  const formCusto = document.getElementById('form-custo');
  const tbodyCustos = document.querySelector('#custos-list tbody');
  const custosTotal = document.getElementById('custos-total');
  const custoDescInput = document.getElementById('custoDesc');
  const custoValorInput = document.getElementById('custoValor');

  formCusto.addEventListener('submit', e => {
    e.preventDefault();
    const desc = custoDescInput.value.trim();
    const valor = Number(custoValorInput.value);
    if(!desc){
      custoDescInput.setCustomValidity('Informe a descrição');
      custoDescInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else custoDescInput.setCustomValidity('');
    if(!valor){
      custoValorInput.setCustomValidity('Informe o valor');
      custoValorInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else custoValorInput.setCustomValidity('');
    try{
      const custo = {id: crypto.randomUUID(), desc, valor};
      state.custos = [...state.custos, custo];
      save('gado.custos', state.custos);
      formCusto.reset();
      renderAll();
      alert('Custo salvo com sucesso');
    }catch(err){
      alert('Erro ao salvar custo');
    }
  });

  function renderCustos(){
    tbodyCustos.innerHTML = '';
    state.custos.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.desc}</td><td>${c.valor.toFixed(2)}</td>`;
      tbodyCustos.appendChild(tr);
    });
    const total = state.custos.reduce((s, c) => s + c.valor, 0);
    custosTotal.textContent = total.toFixed(2);
  }

  // Vendas
  const formVenda = document.getElementById('form-venda');
  const vendasAnimais = document.getElementById('vendaAnimais');
  const tbodyVendas = document.querySelector('#vendas-list tbody');
  const precoArrobaInput = document.getElementById('precoArroba');

  formVenda.addEventListener('submit', e => {
    e.preventDefault();
    const precoArroba = Number(precoArrobaInput.value);
    const selecionados = [...vendasAnimais.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    if(!precoArroba){
      precoArrobaInput.setCustomValidity('Informe o preço');
      precoArrobaInput.reportValidity();
      alert('Preencha os campos obrigatórios');
      return;
    } else precoArrobaInput.setCustomValidity('');
    if(!selecionados.length){
      alert('Selecione ao menos um animal');
      return;
    }
    try{
      const venda = {id: crypto.randomUUID(), data: new Date().toISOString().split('T')[0], animalIds: selecionados, precoArroba};
      state.vendas = [...state.vendas, venda];
      state.rebanho = state.rebanho.filter(a => !selecionados.includes(a.id));
      save('gado.vendas', state.vendas);
      save('gado.rebanho', state.rebanho);
      formVenda.reset();
      renderAll();
      alert('Venda salva com sucesso');
    }catch(err){
      alert('Erro ao salvar venda');
    }
  });

  function renderVendas(){
    vendasAnimais.innerHTML = state.rebanho.map(a => `<label><input type="checkbox" value="${a.id}">${a.brinco}</label>`).join(' ');
    tbodyVendas.innerHTML = '';
    state.vendas.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${v.data}</td><td>${v.animalIds.length}</td><td>${v.precoArroba}</td>`;
      tbodyVendas.appendChild(tr);
    });
  }

  // Saúde
  const formTratamento = document.getElementById('form-tratamento');
  const selectTratAnimal = document.getElementById('tratAnimalId');
  const tbodyTratamentos = document.querySelector('#tratamentos-list tbody');
  const remindersUl = document.getElementById('tratamentos-reminders');
  const tratTipoInput = document.getElementById('tratTipo');
  const tratDataInput = document.getElementById('tratData');

  if(formTratamento){
    formTratamento.addEventListener('submit', async e => {
      e.preventDefault();
      const animalId = selectTratAnimal.value;
      const tipo = tratTipoInput.value.trim();
      const descricao = document.getElementById('tratDesc').value.trim();
      const dataAplicacao = tratDataInput.value;
      const proximaDose = document.getElementById('tratProx').value;
      if(!animalId){
        selectTratAnimal.setCustomValidity('Selecione um animal');
        selectTratAnimal.reportValidity();
        alert('Preencha os campos obrigatórios');
        return;
      } else selectTratAnimal.setCustomValidity('');
      if(!tipo){
        tratTipoInput.setCustomValidity('Informe o tipo');
        tratTipoInput.reportValidity();
        alert('Preencha os campos obrigatórios');
        return;
      } else tratTipoInput.setCustomValidity('');
      if(!dataAplicacao){
        tratDataInput.setCustomValidity('Informe a data');
        tratDataInput.reportValidity();
        alert('Preencha os campos obrigatórios');
        return;
      } else tratDataInput.setCustomValidity('');
      try{
        const docsInput = document.getElementById('tratDocs');
        const documentos = await Promise.all([...docsInput.files].map(f => new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res({nome: f.name, conteudo: reader.result});
          reader.readAsDataURL(f);
        })));
        const tratamento = {id: crypto.randomUUID(), animalId, tipo, descricao, dataAplicacao, proximaDose, documentos};
        state.tratamentos = [...state.tratamentos, tratamento];
        save('gado.tratamentos', state.tratamentos);
        formTratamento.reset();
        renderAll();
        alert('Tratamento salvo com sucesso');
      }catch(err){
        alert('Erro ao salvar tratamento');
      }
    });
  }

  function renderTratamentos(){
    if(!selectTratAnimal) return;
    selectTratAnimal.innerHTML = state.rebanho.map(a => `<option value="${a.id}">${a.brinco}</option>`).join('');
    tbodyTratamentos.innerHTML = '';
    state.tratamentos.forEach(t => {
      const animal = state.rebanho.find(a => a.id === t.animalId) || {};
      const docs = (t.documentos || []).map(d => `<a href="${d.conteudo}" download="${d.nome}">${d.nome}</a>`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${animal.brinco || ''}</td><td>${t.tipo || ''}</td><td>${t.dataAplicacao || ''}</td><td>${t.proximaDose || ''}</td><td>${docs}</td>`;
      tbodyTratamentos.appendChild(tr);
    });
    renderReminders();
  }

  function renderReminders(){
    if(!remindersUl) return;
    remindersUl.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    state.tratamentos
      .filter(t => t.proximaDose && t.proximaDose >= today)
      .sort((a,b) => a.proximaDose.localeCompare(b.proximaDose))
      .forEach(t => {
        const animal = state.rebanho.find(a => a.id === t.animalId) || {};
        const li = document.createElement('li');
        li.textContent = `${animal.brinco || ''}: ${t.tipo} em ${t.proximaDose}`;
        remindersUl.appendChild(li);
        if(Notification.permission === 'granted'){
          const target = new Date(t.proximaDose).getTime();
          const diff = target - now;
          const notify = () => new Notification(`Lembrete ${animal.brinco || ''}`, {body: `${t.tipo} hoje`});
          if(diff <= 0){
            notify();
          } else if(diff <= 86400000){
            setTimeout(notify, diff);
          }
        }
      });
  }

  // Relatórios
  function renderRelatorios(){
    const cabecas = state.rebanho.length;
    const pesoTotal = state.rebanho.reduce((s, a) => s + a.peso, 0);
    const pesoMedio = cabecas ? (pesoTotal / cabecas) : 0;
    const arrobasTotais = pesoTotal / 15;
    const compras = state.rebanho.reduce((s, a) => s + (a.preco || 0), 0);
    const custos = state.custos.reduce((s, c) => s + c.valor, 0);
    const breakEven = (compras + custos) / Math.max(1, arrobasTotais);
    document.getElementById('kpi-cabecas').textContent = cabecas;
    document.getElementById('kpi-peso-medio').textContent = pesoMedio.toFixed(1);
    document.getElementById('kpi-peso-total').textContent = pesoTotal.toFixed(1);
    document.getElementById('kpi-arrobas').textContent = arrobasTotais.toFixed(2);
    document.getElementById('kpi-break-even').textContent = breakEven.toFixed(2);
  }

  async function updateForecast(){
    setSyncStatus('Sincronizando...', true);
    try {
      const res = await fetch('/forecast');
      forecast = await res.json();
      renderPlanejamento();
      renderAlertas();
      setSyncStatus('Atualizado');
    } catch(err){
      console.error('Forecast failed', err);
      setSyncStatus('Falha');
      alert('Falha ao atualizar previsão');
    }
  }

  function renderPlanejamento(){
    if(!tbodyPlanejamento) return;
    tbodyPlanejamento.innerHTML = '';
    forecast.predictions.forEach(p => {
      const animal = state.rebanho.find(a => a.id === p.animalId);
      if(!animal) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${animal.brinco || ''}</td><td>${p.currentWeight.toFixed(1)}</td><td>${p.predictedWeight.toFixed(1)}</td><td>${p.dailyGain.toFixed(2)}</td>`;
      tbodyPlanejamento.appendChild(tr);
    });
  }

  function renderAlertas(){
    if(!tbodyAlertas) return;
    tbodyAlertas.innerHTML = '';
    const low = forecast.predictions.filter(p => p.dailyGain < 0.5);
    low.forEach(p => {
      const animal = state.rebanho.find(a => a.id === p.animalId);
      if(!animal) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${animal.brinco || ''}</td><td>${p.dailyGain.toFixed(2)}</td>`;
      tbodyAlertas.appendChild(tr);
    });
    if(alertaCusto) alertaCusto.textContent = `Custo por kg projetado: R$ ${forecast.custoPorKg.toFixed(2)}`;
  }

  document.getElementById('exportCsv').addEventListener('click', () => {
    const cabecas = state.rebanho.length;
    const pesoTotal = state.rebanho.reduce((s, a) => s + a.peso, 0);
    const pesoMedio = cabecas ? (pesoTotal / cabecas) : 0;
    const arrobasTotais = pesoTotal / 15;
    const compras = state.rebanho.reduce((s, a) => s + (a.preco || 0), 0);
    const custos = state.custos.reduce((s, c) => s + c.valor, 0);
    const breakEven = (compras + custos) / Math.max(1, arrobasTotais);
    const csv = `Cabecas,Peso Medio,Peso Total,Arrobas Totais,Break-even\n${cabecas},${pesoMedio.toFixed(1)},${pesoTotal.toFixed(1)},${arrobasTotais.toFixed(2)},${breakEven.toFixed(2)}\n`;
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('exportPdf').addEventListener('click', () => {
    const cabecas = state.rebanho.length;
    const pesoTotal = state.rebanho.reduce((s, a) => s + a.peso, 0);
    const pesoMedio = cabecas ? (pesoTotal / cabecas) : 0;
    const arrobasTotais = pesoTotal / 15;
    const compras = state.rebanho.reduce((s, a) => s + (a.preco || 0), 0);
    const custos = state.custos.reduce((s, c) => s + c.valor, 0);
    const breakEven = (compras + custos) / Math.max(1, arrobasTotais);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Relatório', 10, 10);
    let y = 20;
    doc.text(`Cabeças: ${cabecas}`, 10, y); y += 10;
    doc.text(`Peso médio (kg): ${pesoMedio.toFixed(1)}`, 10, y); y += 10;
    doc.text(`Peso total (kg): ${pesoTotal.toFixed(1)}`, 10, y); y += 10;
    doc.text(`Arrobas totais: ${arrobasTotais.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Break-even (R$/@): ${breakEven.toFixed(2)}`, 10, y);
    doc.save('relatorio.pdf');
  });

  async function sync(){
    if(!navigator.onLine) return;
    setSyncStatus('Sincronizando...', true);
    try{
      const payload = { since: lastSync, animals: dirtyAnimals, pesagens: [] };
      const res = await fetch('/sync', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      lastSync = data.timestamp;
      save('gado.lastSync', lastSync);
      dirtyAnimals = [];
      save('gado.dirtyAnimals', dirtyAnimals);
      data.animals.forEach(a => {
        const idx = state.rebanho.findIndex(r => r.id === a.id);
        if(a.deleted){
          if(idx >= 0) state.rebanho.splice(idx,1);
        } else if(idx >= 0){
          const local = state.rebanho[idx];
          if(!local.updatedAt || a.updatedAt > local.updatedAt){
            state.rebanho[idx] = { ...local, ...a };
          }
        } else {
          state.rebanho.push(a);
        }
      });
      save('gado.rebanho', state.rebanho);
      renderAll();
      setSyncStatus('Atualizado');
    }catch(err){
      console.error('Sync failed', err);
      setSyncStatus('Falha');
      alert('Falha ao sincronizar');
    }
  }

  function renderAll(){
    renderRebanho();
    renderPesagens();
    renderCustos();
    renderVendas();
    renderTratamentos();
    renderRelatorios();
    renderPlanejamento();
    renderAlertas();
    updateForecast();
  }

  // Inicializa
  document.getElementById('dataPesagem').value = new Date().toISOString().split('T')[0];
  renderAll();
  loadFromFirestore();
  if(navigator.onLine) sync();
  window.addEventListener('online', sync);
})();
