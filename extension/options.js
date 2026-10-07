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
  $('apiUrl').value = c.apiUrl || 'https://leads.vertionstack.com';
  $('apiKey').value = c.apiKey || '';
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
    const c = r.corpo || {};
    const cota = c.cota || {};
    const plano = cota.ilimitado
      ? 'Coleta sem limite.'
      : cota.teste
        ? cota.testeNegado || (cota.usados ?? 0) >= (cota.limite ?? 30)
          ? 'Teste grátis encerrado. Assine um plano no painel para coletar leads.'
          : `Teste grátis: ${cota.usados ?? 0} de ${cota.limite ?? 30} leads usados.`
        : `Plano ${({ gratis: "Teste", basic: "Basic", pro: "Pro" })[c.plano] || "Teste"}: ${cota.usados ?? 0} de ${cota.limite ?? 30} leads novos usados nesta semana.`;
    mostrar(`Conectado como ${c.nome || 'você'}. ${plano}`, true);
  } else {
    const erro = (r && ((r.corpo && r.corpo.erro) || r.erro || ('O painel respondeu ' + r.status))) || 'sem resposta';
    mostrar('Não conectou: ' + erro, false);
  }
});

carregar();
