/**
 * Vertion Leads — content script
 *
 * POR QUE ISTO É UMA MÁQUINA DE ESTADOS E NÃO UM LAÇO SIMPLES
 *
 * A pergunta que a ferramenta responde — "esse comércio tem site próprio?" —
 * não pode ser respondida pela lista de resultados. Testado no Maps real:
 * o link que aparece no card costuma ser o botão "Agendar on-line"
 * (source=google_reserved), não o site. O site de verdade só existe na
 * ficha do lugar, no elemento a[data-item-id="authority"].
 *
 * E a ficha não abre com clique programático: nem .click(), nem uma
 * sequência completa de PointerEvent/MouseEvent. O Maps ignora eventos
 * sintéticos. O único jeito confiável é navegar para a URL da ficha.
 *
 * Navegar recarrega a página e mata este script. Por isso o trabalho vive
 * em chrome.storage.local: a cada carregamento o script lê onde parou e
 * continua de lá. Cada fase termina salvando o estado antes de navegar.
 *
 * Pelo mesmo motivo a busca também é feita por URL, e não digitando na
 * caixa: a partir de uma ficha aberta, digitar troca o título da página
 * mas nunca monta a lista — travaria o segundo termo em diante.
 *
 * Fases:
 *   buscar  -> navega para /maps/search/<termo>
 *   lista   -> rola o feed e coleta os cards; monta a fila de fichas
 *   detalhe -> visita uma ficha por carregamento, extrai e vai para a próxima
 */

(() => {
  if (window.__vertionLeadsLoaded) return;
  window.__vertionLeadsLoaded = true;

  const classify =
    (window.VertionClassify && window.VertionClassify.classifyWebsite) ||
    ((u) => ({ kind: u ? 'site' : 'none', label: u ? 'Tem site' : 'Sem site', isLead: !u, host: '', url: u || null }));

  const CHAVE = 'job';

  /** o Parar precisa valer na hora, não só no próximo carregamento */
  let ABORTADO = false;

  async function deveParar(job) {
    if (ABORTADO) return true;
    const atual = await lerJob();
    if (!atual || !atual.ativo) { ABORTADO = true; return true; }
    return false;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => Math.floor(min + Math.random() * (max - min));
  const pausaHumana = (base = 700) => sleep(rand(base, base * 1.8));
  const textOf = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  const log = (...a) => console.log('%c[Vertion]', 'color:#7c3aed;font-weight:bold', ...a);

  // -------------------------------------------------------- o estado

  async function lerJob() {
    const r = await chrome.storage.local.get(CHAVE);
    return r[CHAVE] || null;
  }

  async function salvarJob(job) {
    await chrome.storage.local.set({ [CHAVE]: job });
  }

  async function encerrarJob(job, motivo) {
    if (job) { job.ativo = false; await salvarJob(job); }
    chrome.runtime.sendMessage({ type: 'DONE', total: (job && job.totalColetado) || 0, motivo }).catch(() => {});
    log('encerrado:', motivo);
  }

  function avisar(job, extra) {
    chrome.runtime
      .sendMessage({
        type: 'PROGRESS',
        payload: {
          phase: job.fase,
          term: job.terms[job.termIndex],
          termIndex: job.termIndex,
          termTotal: job.terms.length,
          found: job.totalColetado || 0,
          ...extra,
        },
      })
      .catch(() => {});
  }

  // ----------------------------------------------------------- DOM

  async function esperar(seletor, timeout = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const el = document.querySelector(seletor);
      if (el) return el;
      await sleep(200);
    }
    return null;
  }

  /** a URL de busca do Maps — mais confiável que mexer na caixa de texto */
  function urlDeBusca(query) {
    return 'https://www.google.com/maps/search/' + encodeURIComponent(query) + '?hl=pt-BR';
  }

  function feed() {
    return (
      document.querySelector('div[role="feed"]') ||
      document.querySelector('div[aria-label^="Resultados"]') ||
      document.querySelector('div[aria-label^="Results"]')
    );
  }

  function estouNumaFicha() {
    return !!document.querySelector('[data-item-id="address"], a[data-item-id="authority"], button[data-item-id^="phone:tel:"]');
  }

  const FIM_DA_LISTA = /chegou ao final da lista|reached the end of the list/i;

  /**
   * Rola a lista até o Maps parar de carregar mais.
   *
   * Atenção ao scroll: el.scrollTo({behavior:'smooth'}) NÃO move este
   * contêiner — testado no Maps real, o scrollTop continuava zero e a
   * coleta parava nos primeiros resultados. A atribuição direta funciona.
   */
  async function rolarFeed(el, limite, aoRolar) {
    let semCrescer = 0;
    let anterior = 0;

    for (let volta = 0; volta < 60; volta++) {
      if (ABORTADO) break;

      const total = el.querySelectorAll('a[href*="/maps/place/"]').length;
      aoRolar && aoRolar(total);

      if (limite && total >= limite) break;
      if (FIM_DA_LISTA.test(el.textContent || '')) break;

      if (total === anterior) {
        if (++semCrescer >= 5) break;
      } else {
        semCrescer = 0;
        anterior = total;
      }

      el.scrollTop = el.scrollHeight;
      await pausaHumana(1100);
    }
  }

  // ------------------------------------------------ leitura do card

  const RE_TELEFONE = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/;

  /** sobe do link até o container que representa um card só */
  function cardDe(anchor) {
    let el = anchor;
    for (let i = 0; i < 6 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      if (el.querySelectorAll('a[href*="/maps/place/"]').length === 1 && textOf(el).length > 12) return el;
    }
    return anchor.parentElement || anchor;
  }

  function lerNota(card) {
    const img = card.querySelector('span[role="img"][aria-label]');
    const label = img ? img.getAttribute('aria-label') || '' : '';
    const nota = label.match(/([\d.,]+)\s*(?:estrela|star)/i);
    // no Maps em português o rótulo diz "comentários", não "avaliações"
    const avals = label.match(/([\d.,]+)\s*(?:avalia|review|coment|opini)/i);

    let reviews = avals ? parseInt(avals[1].replace(/[.,]/g, ''), 10) : null;
    if (!Number.isFinite(reviews)) {
      const m = textOf(card).match(/\(([\d.]+)\)/);
      reviews = m ? parseInt(m[1].replace(/\./g, ''), 10) : null;
    }
    return {
      rating: nota ? parseFloat(nota[1].replace(',', '.')) : null,
      reviews: Number.isFinite(reviews) ? reviews : null,
    };
  }

  /** o endereço no card vem grudado no horário: "Rua X, 476 - Lj 01Aberto" */
  const COLA_HORARIO = /(Aberto|Fechado|Fecha\b|Abre\b|Temporariamente|Permanentemente|24 horas|Atendimento)/;

  function limparEndereco(txt) {
    if (!txt) return null;
    const corte = txt.search(COLA_HORARIO);
    const limpo = (corte > 3 ? txt.slice(0, corte) : txt).replace(/[\s·⋅-]+$/, '').trim();
    return limpo.length > 3 ? limpo : null;
  }

  function lerCategoriaEndereco(card, nome) {
    const linhas = Array.from(card.querySelectorAll('div,span'))
      .map(textOf)
      .filter((t) => t.includes('·') && t.length < 180);

    for (const linha of linhas) {
      const partes = linha.split('·').map((p) => p.trim()).filter(Boolean);
      if (partes.length >= 2) {
        const cat = partes[0] && partes[0] !== nome && partes[0].length < 60 ? partes[0] : null;
        const end = limparEndereco(partes[1]);
        if (cat || end) return { categoria: cat, endereco: end };
      }
    }

    const m = textOf(card).match(/((?:R\.|Rua|Av\.|Avenida|Trav\.|Al\.|Alameda|Praça|Rod\.|Estr\.)[^·]{4,90})/i);
    return { categoria: null, endereco: m ? limparEndereco(m[1]) : null };
  }

  /**
   * O link de site dentro do card.
   *
   * Só vale o que o Maps marcou como data-value="Website". Nada de varrer
   * links soltos: no card de barbearia o único link externo é o botão
   * "Agendar on-line" (sites.appbarber.com.br?source=google_reserved), que
   * não é o site do comércio — contá-lo transformaria um lead quente em
   * "já tem site" e faria você perder a venda.
   */
  function lerSiteDoCard(card) {
    const seletores = [
      'a[data-value="Website"]',
      'a[data-value="Site"]',
      'a[aria-label^="Acessar o site"]',
      'a[aria-label^="Visitar o site"]',
      'a[aria-label^="Visit site"]',
    ];
    for (const sel of seletores) {
      const a = card.querySelector(sel);
      if (a && a.href && !/google\.[a-z.]+\/maps/.test(a.href)) return a.href;
    }
    return null;
  }

  /** o telefone aparece no card numa marcação própria; regex é o plano B */
  function lerTelefoneDoCard(card) {
    const alvo = card.querySelector('span.UsdlK') || card.querySelector('[class*="UsdlK"]');
    if (alvo) {
      const m = textOf(alvo).match(RE_TELEFONE);
      if (m) return m[0].trim();
    }
    const m = textOf(card).match(RE_TELEFONE);
    return m ? m[0].trim() : null;
  }

  function lerIdentidade(href) {
    const hex = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    const coords = href.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
    return {
      placeKey: hex ? hex[1] : null,
      lat: coords ? parseFloat(coords[1]) : null,
      lng: coords ? parseFloat(coords[2]) : null,
    };
  }

  function lerCard(anchor, contexto) {
    const nome = (anchor.getAttribute('aria-label') || '').trim();
    if (!nome) return null;

    const card = cardDe(anchor);
    const href = anchor.href || '';
    const { placeKey, lat, lng } = lerIdentidade(href);
    const { rating, reviews } = lerNota(card);
    const { categoria, endereco } = lerCategoriaEndereco(card, nome);
    const veredito = classify(lerSiteDoCard(card));

    return {
      placeKey: placeKey || `${nome}|${endereco || ''}`.toLowerCase(),
      name: nome,
      category: categoria,
      searchTerm: contexto.term,
      city: contexto.location,
      phone: lerTelefoneDoCard(card),
      address: endereco,
      website: veredito.url,
      websiteKind: veredito.kind,
      websiteLabel: veredito.label,
      isLead: veredito.isLead,
      detalhado: false,
      rating,
      reviews,
      mapsUrl: href,
      lat,
      lng,
      collectedAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------------- leitura da ficha

  function lerFicha() {
    const nome = textOf(document.querySelector('h1'));

    const linkSite = document.querySelector('a[data-item-id="authority"]');
    const site = linkSite ? linkSite.href : null;

    // o aria-label traz o telefone formatado; o data-item-id vem sem máscara
    const btnTel = document.querySelector('button[data-item-id^="phone:tel:"]');
    let telefone = null;
    if (btnTel) {
      const aria = btnTel.getAttribute('aria-label') || '';
      const m = aria.match(/Telefone:\s*(.+)/i) || aria.match(/Phone:\s*(.+)/i);
      telefone = m ? m[1].trim() : (btnTel.getAttribute('data-item-id') || '').replace('phone:tel:', '').trim();
    }

    const btnEnd = document.querySelector('button[data-item-id="address"]');
    const endereco = btnEnd
      ? (btnEnd.getAttribute('aria-label') || textOf(btnEnd)).replace(/^Endereço:\s*/i, '').replace(/^Address:\s*/i, '').trim()
      : null;

    const categoria = textOf(document.querySelector('button[jsaction*="category"]'));

    const imgNota = document.querySelector('div[role="main"] span[role="img"][aria-label*="estrela"]');
    const labelNota = imgNota ? imgNota.getAttribute('aria-label') || '' : '';
    const mNota = labelNota.match(/([\d.,]+)\s*estrela/i);

    return {
      nome: nome || null,
      website: site,
      phone: telefone,
      address: endereco || null,
      category: categoria || null,
      rating: mNota ? parseFloat(mNota[1].replace(',', '.')) : null,
    };
  }

  /** quando a busca cai direto numa ficha única, aproveitamos esse lugar */
  function fichaComoLead(job) {
    const f = lerFicha();
    const veredito = classify(f.website);
    const { placeKey, lat, lng } = lerIdentidade(location.href);

    return {
      placeKey: placeKey || `${f.nome || ''}|${f.address || ''}`.toLowerCase(),
      name: f.nome || '(sem nome)',
      category: f.category,
      searchTerm: job.terms[job.termIndex],
      city: job.location,
      phone: f.phone,
      address: f.address,
      website: veredito.url,
      websiteKind: veredito.kind,
      websiteLabel: veredito.label,
      isLead: veredito.isLead,
      detalhado: true,
      rating: f.rating,
      reviews: null,
      mapsUrl: location.href,
      lat,
      lng,
      collectedAt: new Date().toISOString(),
    };
  }

  // ------------------------------------------------------- as fases

  /**
   * Navega para a URL de busca em vez de digitar na caixa.
   *
   * Testado no Maps real: digitar na caixa a partir de uma ficha aberta
   * troca o título da página mas nunca monta a lista de resultados — o que
   * travaria a coleta do segundo termo em diante. A URL resolve sempre.
   */
  async function faseBuscar(job) {
    const term = job.terms[job.termIndex];
    const query = job.location ? `${term} em ${job.location}` : term;

    avisar(job, { phase: 'searching' });

    if (await deveParar(job)) return;

    job.fase = 'lista';
    await salvarJob(job);
    await pausaHumana(800);

    if (await deveParar(job)) return;
    location.href = urlDeBusca(query);
  }

  async function esperarFeed(timeout = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const el = feed();
      if (el && el.querySelectorAll('a[href*="/maps/place/"]').length) return el;
      await sleep(300);
    }
    return null;
  }

  async function faseLista(job) {
    const term = job.terms[job.termIndex];
    const el = feed() || (await esperarFeed());

    if (!el) {
      // pode ser um termo sem resultado, ou o Maps abriu direto uma ficha única
      if (estouNumaFicha()) {
        job.fila = [fichaComoLead(job)];
        job.indice = 0;
        return enviarEAvancar(job);
      }
      chrome.runtime
        .sendMessage({ type: 'PROGRESS', payload: { phase: 'warn', term, message: `Sem resultados para "${term}".` } })
        .catch(() => {});
      return proximoTermo(job);
    }

    avisar(job, { phase: 'scrolling' });

    await rolarFeed(el, job.maxPerTerm, (n) => avisar(job, { phase: 'scrolling', listed: n }));

    const anchors = Array.from(el.querySelectorAll('a[href*="/maps/place/"]')).slice(0, job.maxPerTerm || undefined);
    avisar(job, { phase: 'reading', listed: anchors.length });

    const vistos = new Set();
    const fila = [];
    for (const a of anchors) {
      try {
        const lead = lerCard(a, { term, location: job.location });
        if (!lead || vistos.has(lead.placeKey)) continue;
        vistos.add(lead.placeKey);
        fila.push(lead);
      } catch (e) {
        console.warn('[Vertion] card ilegível:', e);
      }
    }

    job.fila = fila;
    job.urlBusca = location.href;

    /*
     * Só abrimos a ficha de quem ainda deixa dúvida: sem site no card ou
     * sem telefone. Quem já mostrou o botão "Website" está respondido, e
     * pular esses corta a maior parte do tempo de coleta.
     */
    job.detalhar = job.detailed
      ? fila.map((l, i) => i).filter((i) => fila[i].isLead || !fila[i].phone)
      : [];
    job.indice = 0;

    if (!job.detalhar.length) {
      return enviarEAvancar(job);
    }

    job.fase = 'detalhe';
    await salvarJob(job);
    avisar(job, { phase: 'details', detailIndex: 1, detailTotal: job.detalhar.length });
    await pausaHumana(800);

    if (await deveParar(job)) return;
    location.href = fila[job.detalhar[0]].mapsUrl;
  }

  async function faseDetalhe(job) {
    const alvos = job.detalhar || [];
    const lead = job.fila[alvos[job.indice]];
    if (!lead) return enviarEAvancar(job);

    // a ficha demora a montar; se não vier, seguimos com o que temos
    const chegou = await esperar('[data-item-id="address"], a[data-item-id="authority"], button[data-item-id^="phone:tel:"]', 9000);

    if (chegou || estouNumaFicha()) {
      const f = lerFicha();
      const veredito = classify(f.website);

      lead.phone = f.phone || lead.phone;
      lead.address = f.address || lead.address;
      lead.category = f.category || lead.category;
      lead.rating = f.rating ?? lead.rating;
      lead.website = veredito.url;
      lead.websiteKind = veredito.kind;
      lead.websiteLabel = veredito.label;
      lead.isLead = veredito.isLead;
      lead.detalhado = true;
    } else {
      // sem ficha: o lead vale pelo que veio da lista, marcado como não confirmado
      lead.websiteLabel = 'Não confirmado';
      lead.detalhado = false;
    }

    job.indice++;
    avisar(job, { phase: 'details', detailIndex: job.indice + 1, detailTotal: alvos.length });

    if (job.indice < alvos.length) {
      await salvarJob(job);
      await pausaHumana(700);
      if (await deveParar(job)) return enviarEAvancar(job, true);
      location.href = job.fila[alvos[job.indice]].mapsUrl;
      return;
    }

    return enviarEAvancar(job);
  }

  /** manda o lote do termo atual e passa para o próximo */
  async function enviarEAvancar(job, parando) {
    const lote = job.fila || [];
    if (lote.length) {
      job.totalColetado = (job.totalColetado || 0) + lote.length;
      chrome.runtime
        .sendMessage({ type: 'BATCH', leads: lote, term: job.terms[job.termIndex], location: job.location })
        .catch(() => {});
    }
    if (parando) return encerrarJob(job, 'parado pelo usuário');
    return proximoTermo(job);
  }

  async function proximoTermo(job) {
    if (await deveParar(job)) return;

    job.termIndex++;
    job.fila = [];
    job.detalhar = [];
    job.indice = 0;

    if (job.termIndex >= job.terms.length) {
      return encerrarJob(job, 'fim');
    }

    job.fase = 'buscar';
    await salvarJob(job);
    await pausaHumana(1200);

    // a partir de uma ficha ainda dá para usar a caixa de busca; se não der,
    // faseBuscar manda para a home do Maps sozinha
    return faseBuscar(job);
  }

  // ------------------------------------------------------ retomada

  async function retomar() {
    const job = await lerJob();
    if (!job || !job.ativo) return;

    log('retomando na fase', job.fase, `(termo ${job.termIndex + 1}/${job.terms.length})`);
    await sleep(1200); // deixa o Maps montar a tela

    try {
      if (job.fase === 'detalhe') return await faseDetalhe(job);
      if (job.fase === 'lista') return await faseLista(job);
      return await faseBuscar(job);
    } catch (err) {
      console.error('[Vertion]', err);
      chrome.runtime.sendMessage({ type: 'ERROR', message: String((err && err.message) || err) }).catch(() => {});
      await encerrarJob(job, 'erro');
    }
  }

  // ---------------------------------------------------- mensageria

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'ABORT') {
      ABORTADO = true;
      lerJob().then((job) => {
        if (job) { job.ativo = false; salvarJob(job); }
      });
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'RUN') {
      ABORTADO = false;
      const c = msg.config;
      const job = {
        ativo: true,
        terms: c.terms,
        location: c.location,
        maxPerTerm: c.maxPerTerm,
        detailed: c.detailed !== false,
        termIndex: 0,
        fase: 'buscar',
        fila: [],
        detalhar: [],
        indice: 0,
        totalColetado: 0,
        iniciadoEm: Date.now(),
      };
      salvarJob(job).then(() => faseBuscar(job));
      sendResponse({ ok: true, started: true });
      return true;
    }

    return false;
  });

  retomar();
  log('pronto — extensão ativa no Maps');
})();
