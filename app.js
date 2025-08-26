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
    vendas: load('gado.vendas', [])
  };

  // Dados de teste se base vazia
  if(!state.rebanho.length && !state.pesagens.length && !state.custos.length && !state.vendas.length){
    state.rebanho = [
      {id: crypto.randomUUID(), brinco:'A-001', peso:200, fornecedor:'Leilão X', preco:2200, pesoEntrada:190},
      {id: crypto.randomUUID(), brinco:'B-010', peso:280, fornecedor:'Fazenda Y', preco:2700, pesoEntrada:270}
    ];
    save('gado.rebanho', state.rebanho);
    save('gado.pesagens', state.pesagens);
    save('gado.custos', state.custos);
    save('gado.vendas', state.vendas);
  }

  // Tabs
  const tabs = document.querySelectorAll('nav.tabs button');
  const sections = {
    rebanho: document.getElementById('tab-rebanho'),
    pesagens: document.getElementById('tab-pesagens'),
    custos: document.getElementById('tab-custos'),
    vendas: document.getElementById('tab-vendas'),
    relatorios: document.getElementById('tab-relatorios')
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

  formRebanho.addEventListener('submit', e => {
    e.preventDefault();
    const brinco = document.getElementById('brinco').value.trim();
    const peso = Number(document.getElementById('peso').value);
    const fornecedor = document.getElementById('fornecedor').value.trim();
    const precoVal = document.getElementById('preco').value;
    const preco = precoVal ? Number(precoVal) : undefined;
    const pesoEntradaVal = document.getElementById('pesoEntrada').value;
    const pesoEntrada = pesoEntradaVal ? Number(pesoEntradaVal) : peso;
    if(!brinco || !peso) return;
    const animal = {id: crypto.randomUUID(), brinco, peso, fornecedor, preco, pesoEntrada};
    state.rebanho = [...state.rebanho, animal];
    save('gado.rebanho', state.rebanho);
    formRebanho.reset();
    renderAll();
  });

  function removeAnimal(id){
    state.rebanho = state.rebanho.filter(a => a.id !== id);
    save('gado.rebanho', state.rebanho);
    renderAll();
  }

  function renderRebanho(){
    tbodyRebanho.innerHTML = '';
    state.rebanho.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${a.brinco}</td><td>${a.peso}</td><td>${a.fornecedor || ''}</td><td>${a.preco ?? ''}</td><td>${a.pesoEntrada ?? ''}</td><td><button data-id="${a.id}">Remover</button></td>`;
      tbodyRebanho.appendChild(tr);
    });
    tbodyRebanho.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => removeAnimal(btn.dataset.id));
    });
  }

  // Pesagens
  const formPesagem = document.getElementById('form-pesagem');
  const selectAnimal = document.getElementById('pesagemAnimalId');
  const tbodyPesagens = document.querySelector('#pesagens-list tbody');

  formPesagem.addEventListener('submit', e => {
    e.preventDefault();
    const animalId = selectAnimal.value;
    const peso = Number(document.getElementById('pesoPesagem').value);
    const data = document.getElementById('dataPesagem').value;
    if(!animalId || !peso || !data) return;
    const pesagem = {id: crypto.randomUUID(), animalId, data, peso};
    state.pesagens = [...state.pesagens, pesagem];
    state.rebanho = state.rebanho.map(a => a.id === animalId ? {...a, peso} : a);
    save('gado.pesagens', state.pesagens);
    save('gado.rebanho', state.rebanho);
    formPesagem.reset();
    document.getElementById('dataPesagem').value = new Date().toISOString().split('T')[0];
    renderAll();
  });

  function renderPesagens(){
    selectAnimal.innerHTML = state.rebanho.map(a => `<option value="${a.id}">${a.brinco}</option>`).join('');
    tbodyPesagens.innerHTML = '';
    state.pesagens.forEach(p => {
      const animal = state.rebanho.find(a => a.id === p.animalId) || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.data}</td><td>${animal.brinco || ''}</td><td>${p.peso}</td>`;
      tbodyPesagens.appendChild(tr);
    });
  }

  // Custos
  const formCusto = document.getElementById('form-custo');
  const tbodyCustos = document.querySelector('#custos-list tbody');
  const custosTotal = document.getElementById('custos-total');

  formCusto.addEventListener('submit', e => {
    e.preventDefault();
    const desc = document.getElementById('custoDesc').value.trim();
    const valor = Number(document.getElementById('custoValor').value);
    if(!desc || !valor) return;
    const custo = {id: crypto.randomUUID(), desc, valor};
    state.custos = [...state.custos, custo];
    save('gado.custos', state.custos);
    formCusto.reset();
    renderAll();
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

  formVenda.addEventListener('submit', e => {
    e.preventDefault();
    const precoArroba = Number(document.getElementById('precoArroba').value);
    const selecionados = [...vendasAnimais.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    if(!precoArroba || !selecionados.length) return;
    const venda = {id: crypto.randomUUID(), data: new Date().toISOString().split('T')[0], animalIds: selecionados, precoArroba};
    state.vendas = [...state.vendas, venda];
    state.rebanho = state.rebanho.filter(a => !selecionados.includes(a.id));
    save('gado.vendas', state.vendas);
    save('gado.rebanho', state.rebanho);
    formVenda.reset();
    renderAll();
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

  function renderAll(){
    renderRebanho();
    renderPesagens();
    renderCustos();
    renderVendas();
    renderRelatorios();
  }

  // Inicializa
  document.getElementById('dataPesagem').value = new Date().toISOString().split('T')[0];
  renderAll();
})();
