/** Vertion Leads — popup */

const CATEGORIAS_PADRAO = [
  'Barbearia',
  'Clínica',
  'Restaurante',
  'Academia',
  'Imobiliária',
  'Oficina mecânica',
  'Serralheria',
  'Pizzaria',
  'Hamburgueria',
  'Cafeteria',
  'Padaria',
  'Salão de beleza',
  'Ótica',
  'Loja de imóveis',
  'Agência de viagens'
];

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let selecionadas = new Set();
let extras = [];

// ------------------------------------------------------ categorias

function renderCategorias() {
  const box = $('categorias');
  box.innerHTML = '';
  for (const nome of [...CATEGORIAS_PADRAO, ...extras]) {
    const chip = document.createElement('label');
    chip.className = 'chip' + (selecionadas.has(nome) ? ' ativo' : '');
    chip.textContent = nome;
    chip.addEventListener('click', () => {
      if (selecionadas.has(nome)) selecionadas.delete(nome);
      else selecionadas.add(nome);
      salvarPreferencias();
      renderCategorias();
    });
    box.appendChild(chip);
  }
  atualizarEstimativa();
}

/**
 * Estimativa honesta de tempo.
 *
 * A lista do Maps já entrega nome, telefone e o botão de site quando ele
 * existe. A verificação só abre a ficha de quem ficou em dúvida — sem site
 * aparente ou sem telefone —, o que na prática é perto de metade. Cada
 * ficha custa uma navegação de verdade, uns 6 segundos.
 */
function atualizarEstimativa() {
  const nTipos = selecionadas.size;
  const limite = Number($('limite').value) || 40;
  const verifica = $('detalhado').checked;
  const el = $('estimativa');

  if (!nTipos) {
    el.textContent = 'Escolha ao menos um tipo de comércio.';
    return;
  }

  const total = nTipos * limite;
  const porTermo = 25;
  const segundos = nTipos * porTermo + (verifica ? total * 0.55 * 6 : 0);
  const min = Math.round(segundos / 60);

  const tempo = min < 1 ? 'menos de 1 minuto'
    : min < 60 ? `cerca de ${min} minutos`
    : `cerca de ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

  el.innerHTML = verifica
    ? `Até <b>${total}</b> comércios, ${tempo}. A aba do Maps vai trocar de página sozinha — deixe rodando e vá fazer outra coisa.`
    : `Até <b>${total}</b> comércios, ${tempo}. Mais rápido, mas quem o Maps não mostrar o site na lista vai entrar como <b>“sem site” sem confirmação</b>.`;
}

async function salvarPreferencias() {
  await chrome.storage.local.set({
    prefs: {
      selecionadas: Array.from(selecionadas),
      extras,
      cidade: $('cidade').value,
      limite: Number($('limite').value) || 40,
      detalhado: $('detalhado').checked
    }
  });
}

async function carregarPreferencias() {
  const { prefs } = await chrome.storage.local.get('prefs');
  if (!prefs) {
    selecionadas = new Set(CATEGORIAS_PADRAO);
    $('detalhado').checked = true;
    return;
  }
  selecionadas = new Set(prefs.selecionadas || CATEGORIAS_PADRAO);
  extras = prefs.extras || [];
  $('cidade').value = prefs.cidade || '';
  $('limite').value = prefs.limite || 40;
  $('detalhado').checked = prefs.detalhado !== false;
}

// -------------------------------------------------------- estado

const TEXTO_FASE = {
  idle: 'Pronto para começar.',
  abrindo: 'Abrindo o Google Maps…',
  buscando: 'Iniciando busca…',
  searching: (e) => `Buscando "${e.term}"…`,
  scrolling: (e) => `Carregando lista de "${e.term}" — ${e.listed || 0} na tela…`,
  reading: (e) => `Lendo ${e.listed || 0} resultados de "${e.term}"…`,
  details: (e) => `Abrindo fichas de "${e.term}"…`,
  'term-done': (e) => `"${e.term}" concluído.`,
  warn: (e) => e.message || 'Sem resultados para esse termo.',
  concluido: 'Coleta concluída.',
  parado: 'Coleta interrompida.',
  erro: 'Deu problema na coleta.'
};

function pintarEstado(estado) {
  const rodando = !!estado.running;

  $('painel-progresso').classList.toggle('oculto', estado.phase === 'idle' && !rodando);
  $('btn-iniciar').classList.toggle('oculto', rodando);
  $('btn-parar').classList.toggle('oculto', !rodando);

  const texto = TEXTO_FASE[estado.phase];
  $('status-texto').textContent = typeof texto === 'function' ? texto(estado) : (texto || 'Trabalhando…');

  const pct = estado.termTotal ? Math.round(((estado.termIndex + (rodando ? 0.5 : 1)) / estado.termTotal) * 100) : 0;
  $('barra-fill').style.width = Math.min(100, pct) + '%';

  const s = estado.stats || {};
  const quentes = (s.none || 0) + (s.social || 0) + (s.marketplace || 0) + (s.weak || 0);

  $('n-encontrados').textContent = estado.found || 0;
  $('n-leads').textContent = quentes;
  $('n-enviados').textContent = estado.sent || 0;

  const erro = $('erro');
  if (estado.lastError) {
    erro.textContent = estado.lastError;
    erro.classList.remove('oculto');
  } else {
    erro.classList.add('oculto');
  }
}

async function atualizar() {
  const r = await send({ type: 'GET_STATE' });
  if (!r) return;
  pintarEstado(r.estado);
  $('aviso-api').classList.toggle('oculto', !!(r.config && r.config.apiUrl));
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATE') pintarEstado(msg.estado);
});

// --------------------------------------------------------- CSV

function paraCSV(leads) {
  const cols = [
    ['name', 'Nome'], ['category', 'Categoria'], ['websiteLabel', 'Situação do site'],
    ['website', 'Site'], ['phone', 'Telefone'], ['address', 'Endereço'],
    ['city', 'Cidade'], ['rating', 'Nota'], ['reviews', 'Avaliações'],
    ['searchTerm', 'Termo buscado'], ['mapsUrl', 'Link do Maps']
  ];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const linhas = [cols.map((c) => c[1]).join(';')];
  for (const l of leads) linhas.push(cols.map((c) => esc(l[c[0]])).join(';'));
  return '﻿' + linhas.join('\r\n'); // BOM para o Excel abrir com acento certo
}

async function baixarCSV() {
  const { leads } = await send({ type: 'GET_LOCAL' });
  if (!leads || !leads.length) {
    alert('Nenhum lead coletado ainda.');
    return;
  }
  const blob = new Blob([paraCSV(leads)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const hoje = new Date().toISOString().slice(0, 10);
  await chrome.downloads.download({ url, filename: `vertion-leads-${hoje}.csv`, saveAs: true })
    .catch(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `vertion-leads-${hoje}.csv`;
      a.click();
    });
}

// -------------------------------------------------------- eventos

$('marcar-todos').addEventListener('click', () => {
  selecionadas = new Set([...CATEGORIAS_PADRAO, ...extras]);
  salvarPreferencias(); renderCategorias();
});

$('limpar-todos').addEventListener('click', () => {
  selecionadas.clear(); salvarPreferencias(); renderCategorias();
});

$('add-custom').addEventListener('click', () => {
  const v = $('custom').value.trim();
  if (!v) return;
  if (![...CATEGORIAS_PADRAO, ...extras].includes(v)) extras.push(v);
  selecionadas.add(v);
  $('custom').value = '';
  salvarPreferencias(); renderCategorias();
});

$('custom').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('add-custom').click();
});

for (const id of ['cidade', 'limite', 'detalhado']) {
  $(id).addEventListener('change', () => { salvarPreferencias(); atualizarEstimativa(); });
}
$('limite').addEventListener('input', atualizarEstimativa);

$('btn-iniciar').addEventListener('click', async () => {
  const terms = Array.from(selecionadas);
  if (!terms.length) { alert('Escolha pelo menos um tipo de comércio.'); return; }

  const cidade = $('cidade').value.trim();
  if (!cidade && !confirm('Sem cidade, o Maps busca só onde o mapa está agora. Continuar assim?')) return;

  await salvarPreferencias();
  $('erro').classList.add('oculto');

  const r = await send({
    type: 'START',
    config: {
      terms,
      location: cidade,
      maxPerTerm: Number($('limite').value) || 60,
      detailed: $('detalhado').checked
    }
  });

  if (r && r.ok === false) atualizar();
});

$('btn-parar').addEventListener('click', () => send({ type: 'STOP' }));
$('btn-csv').addEventListener('click', baixarCSV);
$('btn-config').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('link-config').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('btn-painel').addEventListener('click', async () => {
  const r = await send({ type: 'GET_STATE' });
  const url = r && r.config && r.config.apiUrl;
  if (url) chrome.tabs.create({ url });
  else chrome.runtime.openOptionsPage();
});

$('btn-limpar').addEventListener('click', async () => {
  if (!confirm('Apagar os leads guardados nesta extensão? O que já foi enviado ao painel continua lá.')) return;
  await send({ type: 'CLEAR_LOCAL' });
  atualizar();
});

// ---------------------------------------------------------- boot

(async () => {
  await carregarPreferencias();
  renderCategorias();
  await atualizar();
  setInterval(atualizar, 1500);
})();
