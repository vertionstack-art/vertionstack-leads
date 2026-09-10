/**
 * Vertion Leads — service worker
 *
 * Guarda o estado da coleta (o popup fecha, isto continua vivo),
 * acumula os leads e envia para o painel. Se o envio falhar, o lote
 * fica numa fila local e e reenviado na proxima tentativa — nada se perde.
 */

const ESTADO_PADRAO = {
  running: false,
  startedAt: null,
  finishedAt: null,
  phase: 'idle',
  message: '',
  term: '',
  termIndex: 0,
  termTotal: 0,
  listed: 0,
  found: 0,
  sent: 0,
  queued: 0,
  lastError: null,
  stats: { none: 0, social: 0, marketplace: 0, weak: 0, site: 0 }
};

async function getEstado() {
  const { estado } = await chrome.storage.local.get('estado');
  return { ...ESTADO_PADRAO, ...(estado || {}) };
}

async function setEstado(patch) {
  const atual = await getEstado();
  const novo = { ...atual, ...patch };
  await chrome.storage.local.set({ estado: novo });
  chrome.runtime.sendMessage({ type: 'STATE', estado: novo }).catch(() => {});
  return novo;
}

async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return {
    apiUrl: '',
    apiKey: '',
    ...(config || {})
  };
}

// --------------------------------------------------------------- fila

async function getFila() {
  const { fila } = await chrome.storage.local.get('fila');
  return fila || [];
}

async function setFila(fila) {
  await chrome.storage.local.set({ fila });
  await setEstado({ queued: fila.reduce((n, lote) => n + lote.leads.length, 0) });
}

/** guarda tudo localmente tambem, para o popup poder exportar CSV offline */
async function guardarLocal(leads) {
  const { leadsLocais } = await chrome.storage.local.get('leadsLocais');
  const mapa = new Map((leadsLocais || []).map((l) => [l.placeKey, l]));
  for (const l of leads) mapa.set(l.placeKey, { ...(mapa.get(l.placeKey) || {}), ...l });
  const lista = Array.from(mapa.values());
  await chrome.storage.local.set({ leadsLocais: lista });
  return lista.length;
}

async function enviarLote(lote) {
  const { apiUrl, apiKey } = await getConfig();
  if (!apiUrl) return { ok: false, motivo: 'sem-api' };

  const alvo = apiUrl.replace(/\/+$/, '') + '/api/leads';
  const resp = await fetch(alvo, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || ''
    },
    body: JSON.stringify({
      source: 'chrome-extension',
      searchTerm: lote.term,
      city: lote.location,
      leads: lote.leads
    })
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} — ${texto.slice(0, 200)}`);
  }
  return resp.json().catch(() => ({ ok: true }));
}

/** tenta esvaziar a fila; o que falhar continua guardado */
async function processarFila() {
  const fila = await getFila();
  if (!fila.length) return;

  const restantes = [];
  let enviados = 0;

  for (const lote of fila) {
    try {
      const r = await enviarLote(lote);
      if (r && r.ok === false && r.motivo === 'sem-api') {
        restantes.push(lote);
        continue;
      }
      enviados += lote.leads.length;
    } catch (err) {
      lote.tentativas = (lote.tentativas || 0) + 1;
      restantes.push(lote);
      await setEstado({ lastError: String(err.message || err) });
    }
  }

  await setFila(restantes);
  if (enviados) {
    const e = await getEstado();
    await setEstado({ sent: e.sent + enviados, lastError: restantes.length ? e.lastError : null });
  }
}

// ------------------------------------------------------------ coleta

async function garantirAbaDoMaps() {
  const abas = await chrome.tabs.query({ url: ['https://www.google.com/maps/*', 'https://www.google.com.br/maps/*'] });
  if (abas.length) {
    await chrome.tabs.update(abas[0].id, { active: true });
    return abas[0];
  }
  return chrome.tabs.create({ url: 'https://www.google.com/maps', active: true });
}

/** espera o content script responder ao PING (a aba pode ainda estar carregando) */
async function esperarContentScript(tabId, timeout = 25000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    try {
      const r = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (r && r.ok) return true;
    } catch {
      // ainda nao carregou
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function iniciar(config) {
  await chrome.storage.local.set({ estado: { ...ESTADO_PADRAO, running: true, startedAt: Date.now(), phase: 'abrindo' } });

  const aba = await garantirAbaDoMaps();
  const pronto = await esperarContentScript(aba.id);

  if (!pronto) {
    // a aba pode ter sido aberta antes da extensao existir: injeta na marra
    try {
      await chrome.scripting.executeScript({
        target: { tabId: aba.id },
        files: ['lib/classify.js', 'content.js']
      });
      await esperarContentScript(aba.id, 8000);
    } catch (err) {
      await setEstado({
        running: false,
        phase: 'erro',
        lastError: 'Não consegui rodar dentro do Google Maps. Recarregue a aba do Maps (F5) e tente de novo.'
      });
      return { ok: false };
    }
  }

  await chrome.tabs.sendMessage(aba.id, { type: 'RUN', config });
  await setEstado({ phase: 'buscando', termTotal: config.terms.length });
  return { ok: true, tabId: aba.id };
}

async function abortar() {
  const abas = await chrome.tabs.query({ url: ['https://www.google.com/maps/*', 'https://www.google.com.br/maps/*'] });
  for (const aba of abas) {
    chrome.tabs.sendMessage(aba.id, { type: 'ABORT' }).catch(() => {});
  }
  await setEstado({ running: false, phase: 'parado', finishedAt: Date.now() });
}

// -------------------------------------------------------- mensageria

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'START':
        sendResponse(await iniciar(msg.config));
        break;

      case 'STOP':
        await abortar();
        sendResponse({ ok: true });
        break;

      case 'GET_STATE':
        sendResponse({ estado: await getEstado(), config: await getConfig() });
        break;

      case 'PROGRESS': {
        const p = msg.payload || {};
        await setEstado({
          phase: p.phase || 'trabalhando',
          term: p.term || '',
          termIndex: p.termIndex ?? 0,
          termTotal: p.termTotal ?? 0,
          listed: p.listed ?? 0,
          found: p.found ?? 0,
          message: p.message || ''
        });
        sendResponse({ ok: true });
        break;
      }

      case 'BATCH': {
        const leads = msg.leads || [];
        if (leads.length) {
          const estado = await getEstado();
          const stats = { ...estado.stats };
          for (const l of leads) stats[l.websiteKind] = (stats[l.websiteKind] || 0) + 1;
          await guardarLocal(leads);
          const fila = await getFila();
          fila.push({ leads, term: msg.term, location: msg.location, tentativas: 0 });
          await setFila(fila);
          await setEstado({ stats });
          await processarFila();
        }
        sendResponse({ ok: true });
        break;
      }

      case 'DONE':
        await processarFila();
        await setEstado({ running: false, phase: 'concluido', finishedAt: Date.now() });
        sendResponse({ ok: true });
        break;

      case 'ERROR':
        await setEstado({ running: false, phase: 'erro', lastError: msg.message });
        sendResponse({ ok: true });
        break;

      case 'RETRY_QUEUE':
        await processarFila();
        sendResponse({ ok: true, estado: await getEstado() });
        break;

      case 'GET_LOCAL': {
        const { leadsLocais } = await chrome.storage.local.get('leadsLocais');
        sendResponse({ leads: leadsLocais || [] });
        break;
      }

      case 'CLEAR_LOCAL':
        await chrome.storage.local.set({ leadsLocais: [], fila: [] });
        await setEstado({ ...ESTADO_PADRAO });
        sendResponse({ ok: true });
        break;

      case 'TEST_API': {
        try {
          const { apiUrl, apiKey } = await getConfig();
          if (!apiUrl) { sendResponse({ ok: false, erro: 'Endereço do painel está vazio.' }); break; }
          const alvo = apiUrl.replace(/\/+$/, '') + '/api/health';
          const r = await fetch(alvo, { headers: { 'x-api-key': apiKey || '' } });
          const corpo = await r.json().catch(() => ({}));
          sendResponse({ ok: r.ok && corpo.ok !== false, status: r.status, corpo });
        } catch (err) {
          sendResponse({ ok: false, erro: String(err.message || err) });
        }
        break;
      }

      default:
        sendResponse({ ok: false, erro: 'mensagem desconhecida' });
    }
  })();
  return true; // resposta assincrona
});

chrome.runtime.onInstalled.addListener(async () => {
  const atual = await getConfig();
  if (!atual.apiKey) {
    // gera uma chave inicial para o usuario copiar no painel
    const chave = 'vl_' + crypto.randomUUID().replace(/-/g, '');
    await chrome.storage.local.set({ config: { ...atual, apiKey: chave } });
  }
});
