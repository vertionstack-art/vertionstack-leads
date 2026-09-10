/** Vertion Leads — pagina de configuracoes */

const $ = (id) => document.getElementById(id);

function mostrar(texto, ok) {
  const el = $('resultado');
  el.textContent = texto;
  el.className = 'resultado ' + (ok ? 'ok' : 'falha');
  el.classList.remove('oculto');
}

async function carregar() {
  const { config } = await chrome.storage.local.get('config');
  const c = config || {};
  $('apiUrl').value = c.apiUrl || '';
  $('apiKey').value = c.apiKey || ('vl_' + crypto.randomUUID().replace(/-/g, ''));
}

async function salvar() {
  const apiUrl = $('apiUrl').value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey').value.trim();

  if (apiUrl && !/^https?:\/\//i.test(apiUrl)) {
    mostrar('O endereço precisa começar com https:// (ou http:// no localhost).', false);
    return false;
  }

  await chrome.storage.local.set({ config: { apiUrl, apiKey } });
  mostrar('Salvo.', true);
  return true;
}

$('salvar').addEventListener('click', salvar);

$('testar').addEventListener('click', async () => {
  if (!(await salvar())) return;
  mostrar('Testando…', true);

  const r = await chrome.runtime.sendMessage({ type: 'TEST_API' });

  if (r && r.ok) {
    const banco = r.corpo && r.corpo.database;
    mostrar(
      'Conectado. ' + (banco === 'postgres'
        ? 'O painel está gravando no banco de dados.'
        : 'Atenção: o painel está sem banco configurado — os dados não vão persistir.'),
      banco === 'postgres'
    );
  } else {
    mostrar('Não conectou: ' + ((r && (r.erro || ('HTTP ' + r.status))) || 'sem resposta'), false);
  }
});

carregar();
