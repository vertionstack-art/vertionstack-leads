import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { conferirTeste, cotaDaConta, cotaParaJson, devolverCota, reservarCota } from '@/lib/conta';
import { idsNovos, normalizarLead, salvarLeads } from '@/lib/db';
import {
  anotarBusca, buscaLigada, buscarPagina, buscasDaConta, buscasDosTestesNoMes, chamadasDeHoje, chaveDaPergunta, contarChamada,
  ErroGoogle, memoriaDaBusca, reservaDosTestes, somarLeads, tetoDiario, tetoMensal, usoDoMes,
} from '@/lib/google-places';
import { estourou } from '@/lib/limite';
import { LIMITES } from '@/lib/planos';
import { usarBuscaBonus } from '@/lib/indicacao';
import { DETALHE_ENCURTADOR, verificarSite } from '@/lib/verificar-site';
import { ehEncurtador } from '@/lib/classify';
import { avaliarSite, NOTA_SITE_FRACO, type AvaliacaoSite } from '@/lib/nota-site';
import { ehRede } from '@/lib/enriquecer';
import { db } from '@/lib/sql';
import { OFERTAS, servePara, type Oferta } from '@/lib/ofertas';
import { aplicarAvaliacao, avaliarLead, avaliarLeadExterior, type MotivoDescarte } from '@/lib/enriquecer';
import { NOTA_CONCORRENTE, paisExterior } from '@/lib/exterior';
import type { Concorrente } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// verificação (até 9 s) + nota do site (até 9 s) + o resto da busca
// fora do Brasil ainda lê as páginas de contato atrás do e-mail (até ~15 s a mais)
export const maxDuration = 60;

const erro = (msg: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, erro: msg, ...extra }, { status });

function texto(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Uma página de busca no Google: até 20 comércios de "nicho em local". A tela
 * chama de novo com o token da próxima página, e de pergunta em pergunta
 * (bairro por bairro) até juntar a quantidade pedida ou a pessoa clicar em
 * parar. Uma chamada por pedido mantém cada resposta rápida e deixa o botão
 * de parar funcionar de verdade.
 *
 * Só os comércios sem site próprio (ou com site fraco, nota até 6) são
 * guardados e contam na cota: quem já tem site bom não é lead, e a pessoa
 * não paga cota por ele.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem, plano, userId } = s.sessao;

  if (!buscaLigada()) return erro('A busca pelo Google ainda não foi ligada.', 503);
  if (await estourou('busca:' + userId, 240, 60 * 60)) return erro('Muitas buscas seguidas. Espere alguns minutos.', 429);

  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nicho = texto(c.nicho, 60);
  const local = texto(c.local, 90);
  const pagina = typeof c.pagina === 'string' && /^[A-Za-z0-9_\-=.]{1,2000}$/.test(c.pagina) ? c.pagina : null;
  const quero = Math.max(1, Math.min(200, Math.floor(Number(c.quero) || 20)));
  // padrão ligado: lead sem WhatsApp quase nunca vira conversa
  const soComWhatsapp = c.soComWhatsapp !== false;
  // padrão ligado: quem tem site no ar, mas fraco (nota até 6), também entra
  const siteFraco = c.siteFraco !== false;
  // busca fora do Brasil (lib/exterior): o Google em inglês e o filtro que procura e-mail
  const pais = paisExterior(c.pais);
  const exterior = Boolean(pais);
  // padrão desligado: quem não tem e-mail no site entra assim mesmo, e você completa à mão no cartão
  const soComEmail = c.soComEmail === true;
  const soBemAvaliados = c.soBemAvaliados !== false;
  // o que a conta vende muda o que é lead (lib/ofertas); vem do banco, não do navegador
  const [cfgOferta] = await db()`select oferta from contas where id = ${contaId}`;
  const oferta: Oferta = OFERTAS.some((o) => o.id === cfgOferta?.oferta) ? (cfgOferta.oferta as Oferta) : 'sites';
  if (nicho.length < 2 || local.length < 2) return erro('Diga o nicho e a cidade.', 400);

  // nada de gastar com o Google se a pessoa não pode guardar lead nenhum
  let cota = await cotaDaConta(contaId, plano);
  if (cota.teste) {
    const negado = await conferirTeste(contaId);
    if (negado) {
      cota = await cotaDaConta(contaId, plano);
      return erro(`O teste grátis já foi usado em outra conta ${negado}. Assine um plano para buscar leads.`, 402, { cota: cotaParaJson(cota), fim: true });
    }
  }
  if (!cota.ilimitado && cota.restantes <= 0) {
    const msg = cota.teste
      ? `Seu teste grátis de ${cota.limite} leads acabou. Assine um plano para continuar buscando.`
      : cota.guardados >= cota.tetoGuardados
        ? `Sua conta chegou ao limite de ${cota.tetoGuardados} leads guardados do plano.`
        : `Você usou os ${cota.limite} leads novos desta semana. A cota renova na segunda.`;
    return erro(msg, 402, { cota: cotaParaJson(cota), fim: true });
  }
  if ((await usoDoMes()).chamadas >= tetoMensal()) {
    return erro('A busca pelo Google chegou ao limite deste mês. Volta a funcionar no dia 1º.', 503, { fim: true });
  }
  if ((await chamadasDeHoje()) >= tetoDiario()) {
    return erro('A busca pelo Google chegou ao limite de hoje. Volta a funcionar amanhã.', 503, { fim: true });
  }

  /*
   * Não pagar por repetido: pergunta que esta conta já levou até a última
   * página não chama o Google de novo; pergunta pela metade continua da
   * página onde parou, em vez de recomeçar pelos mesmos resultados.
   */
  const pergunta = pais ? `${nicho} in ${local}` : `${nicho} em ${local}`;
  // a memória é por oferta (e por país): a mesma pergunta rende leads diferentes para quem vende outra coisa
  const marca = `${oferta === 'sites' ? '' : ` #${oferta}`}${pais ? ` #${pais.id}` : ''}`;
  const chave = chaveDaPergunta(`${pergunta}${marca}`);
  let token = pagina;
  let retomada = false;
  if (!pagina) {
    const memoria = await memoriaDaBusca(contaId, chave);
    if (memoria?.esgotada) {
      return NextResponse.json({
        ok: true, jaFeita: true, comercios: 0, comSite: 0, jaTinha: 0, novos: 0, comWhatsappLink: 0, proxima: null,
        descartados: { empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0, fora_do_perfil: 0, sem_email: 0, pouco_movimento: 0 },
        cota: cotaParaJson(cota), fim: false,
      });
    }
    if (memoria?.proxima) {
      token = memoria.proxima;
      retomada = true;
    }
  }

  /*
   * O teto de buscas do plano: é a busca no Google que custa, então cada
   * plano tem a sua cota, e o teste grátis ainda divide uma reserva do mês
   * para nunca tirar busca de quem paga (lib/planos).
   */
  const limiteBuscas = LIMITES[plano].buscas;
  const usadas = await buscasDaConta(contaId, plano, s.sessao.pagoAte);
  // a cota de buscas acabou, mas há busca de bônus por indicação: gasta uma e segue
  const buscaDoBonus = usadas >= limiteBuscas && (await usarBuscaBonus(contaId));
  if (usadas >= limiteBuscas && !buscaDoBonus) {
    const msg =
      plano === 'gratis'
        ? `Você usou as ${limiteBuscas} buscas do teste grátis. Assine o plano de 7 dias para continuar buscando.`
        : plano === 'semanal'
          ? `Você usou as ${limiteBuscas} buscas destes 7 dias. Para buscar mais, assine o Basic ou o Pro.`
          : `Você usou as ${limiteBuscas} buscas do mês. Elas voltam no dia 1º${plano === 'basic' ? ', ou passe para o Pro' : ''}.`;
    return erro(msg, 402, { cota: cotaParaJson(cota), fim: true, buscas: { usadas, limite: limiteBuscas } });
  }
  if (plano === 'gratis' && !buscaDoBonus && (await buscasDosTestesNoMes()) >= reservaDosTestes()) {
    return erro('Os testes grátis deste mês esgotaram. Assine o plano de 7 dias ou volte no dia 1º.', 402, { cota: cotaParaJson(cota), fim: true });
  }

  let resultado;
  try {
    try {
      resultado = await buscarPagina(pergunta, token, pais?.id ?? 'BR');
    } catch (e) {
      // token guardado que o Google não aceita mais: recomeça do começo
      if (!retomada || !(e instanceof ErroGoogle) || e.status !== 400) throw e;
      retomada = false;
      resultado = await buscarPagina(pergunta, null, pais?.id ?? 'BR');
    }
  } catch (e) {
    if (e instanceof ErroGoogle) return erro(e.message, e.status === 429 ? 429 : 502);
    console.error('[busca]', e);
    return erro('A busca no Google falhou. Tente de novo.', 502);
  }
  await anotarBusca(contaId, chave, resultado.proxima, !pagina && !retomada);
  // conta a chamada já, antes de qualquer coisa que possa falhar: o Google cobrou
  await contarChamada(contaId, resultado.comercios.length, 0);

  // "Centro, Gurupi, TO" vira "Gurupi, TO": cidade com a UF, sem o bairro
  const partes = local.split(',').map((p) => p.trim()).filter(Boolean);
  const cidade = pais ? `${local}, ${pais.id}` : (partes.length >= 2 && /^[A-Za-z]{2}$/.test(partes[partes.length - 1]) ? partes.slice(-2).join(', ') : partes[partes.length - 1]) || local;
  const todos = resultado.comercios
    .map((g) =>
      normalizarLead(
        {
          name: g.nome,
          placeKey: 'g:' + g.id,
          category: g.tipo || nicho,
          searchTerm: nicho,
          city: cidade,
          phone: g.telefone,
          address: g.endereco,
          website: g.site,
          rating: g.nota,
          reviews: g.avaliacoes,
          mapsUrl: g.mapsUrl,
          lat: g.lat,
          lng: g.lng,
          fotos: g.fotos,
          hours: g.horario,
          oferta,
        },
        quem,
        'google',
      ),
    )
    .filter((l): l is NonNullable<typeof l> => l !== null)
    // fora do Brasil o telefone não vira WhatsApp pela regra brasileira de celular
    .map((l) => (pais ? { ...l, whatsapp: null, whatsappFonte: null, telefoneTipo: null } : l));
  // quem vende site só quer os sem site; nas outras ofertas todos entram na conferência
  const leads = oferta === 'sites' ? todos.filter((l) => l.isLead) : [...todos];

  try {
    /*
     * Site próprio cadastrado não quer dizer site no ar. Antes, esses
     * comércios eram descartados sem ninguém abrir o site — e o lead mais
     * quente de todos é justamente o de site quebrado (lib/temperatura).
     * Agora a busca confere na hora os que ainda não estão na conta, com
     * prazo curto: o que não responder a tempo fica de fora, como antes.
     */
    const comSite = oferta === 'sites' ? todos.filter((l) => !l.isLead) : [];
    const comSiteNovos = new Set(await idsNovos(contaId, comSite.map((l) => l.id)));
    /*
     * Site que abre normal já não é descarte automático: ganha uma nota
     * (lib/nota-site) e quem tira até 6 vira lead. A nota começa assim que
     * a verificação termina, em paralelo com as outras, para a página da
     * busca não passar do tempo.
     */
    const conferencias = await Promise.all(
      comSite
        .filter((l) => comSiteNovos.has(l.id) && !ehRede(l.name))
        .map((l) =>
          Promise.race([
            verificarSite(l.website).then((v) => ({ l, v })),
            new Promise<{ l: typeof l; v: null }>((ok) => setTimeout(() => ok({ l, v: null }), 9000)),
          ])
            .catch(() => ({ l, v: null }))
            .then(async ({ l, v }) => {
              let nota: AvaliacaoSite | null = null;
              if (siteFraco && v?.status === 'ok' && l.website) {
                nota = await Promise.race([
                  avaliarSite(v.urlFinal || l.website, 8000, exterior).catch(() => null),
                  new Promise<null>((ok) => setTimeout(() => ok(null), 9000)),
                ]);
              }
              return { l, v, nota };
            }),
        ),
    );
    let sitesQuebrados = 0;
    let sitesFracos = 0;
    /*
     * No exterior, o melhor site bom desta página (mesmo nicho, mesma cidade)
     * vira o "concorrente" dos leads novos dela: o e-mail pode mostrar que o
     * vizinho já está na frente. Só quem tirou nota alta e tem avaliações.
     */
    const bons = conferencias
      .filter(({ nota }) => nota && nota.nota >= NOTA_CONCORRENTE)
      .sort((a, b) => b.nota!.nota - a.nota!.nota || (b.l.reviews ?? 0) - (a.l.reviews ?? 0));
    const concorrente: Concorrente | null =
      pais && bons[0]?.l.website ? { nome: bons[0].l.name, site: bons[0].nota!.url || bons[0].l.website, nota: bons[0].nota!.nota, avaliacoes: bons[0].l.reviews } : null;
    for (const { l, v: conferido, nota } of conferencias) {
      const agora = new Date().toISOString();
      if (nota && nota.nota <= NOTA_SITE_FRACO) {
        sitesFracos++;
        leads.push({ ...l, isLead: true, siteStatus: 'ok', siteDetalhe: `Site no ar, nota ${String(nota.nota).replace('.', ',')} de 10.`, siteVerificadoEm: agora, siteNota: nota.nota, siteAvaliacao: nota });
        continue;
      }
      // encurtador que não respondeu a tempo também não é site próprio
      const v = conferido ?? (ehEncurtador(l.website) ? { status: 'encurtador' as const, viraLead: true, detalhe: DETALHE_ENCURTADOR } : null);
      if (!v || !v.viraLead) continue;
      sitesQuebrados++;
      leads.unshift({ ...l, isLead: true, siteStatus: v.status, siteDetalhe: v.detalhe, siteVerificadoEm: agora });
    }

    const novosIds = new Set(await idsNovos(contaId, leads.map((l) => l.id)));
    const existentes = leads.filter((l) => !novosIds.has(l.id));

    // o filtro de precisão roda só nos que ainda não estão no painel (lib/enriquecer)
    const descartados: Record<MotivoDescarte, number> = { empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0, fora_do_perfil: 0, sem_email: 0, pouco_movimento: 0 };
    const candidatos = leads.filter((l) => novosIds.has(l.id));
    const avaliacoes = await Promise.all(
      candidatos.map((l) => (pais ? avaliarLeadExterior(l, { soComEmail, soBemAvaliados, tlds: pais.tlds }) : avaliarLead(l, soComWhatsapp, oferta))),
    );
    const aprovados = candidatos.flatMap((l, i) => {
      const a = avaliacoes[i];
      if (a.descarte) {
        descartados[a.descarte]++;
        return [];
      }
      const pronto = aplicarAvaliacao(l, a);
      if (!servePara(oferta, pronto)) {
        descartados.fora_do_perfil++;
        return [];
      }
      return [{ ...pronto, isLead: true, concorrente: pronto.concorrente ?? concorrente }];
    });

    const limite = cota.ilimitado ? quero : Math.min(quero, cota.restantes);
    const novos = aprovados.slice(0, limite);
    const concedidos = await reservarCota(contaId, novos.length, plano);
    const r = await salvarLeads(contaId, [...existentes, ...novos], concedidos);
    if (!cota.ilimitado) await devolverCota(contaId, concedidos - r.novos, plano);
    await somarLeads(contaId, r.novos);
    cota = await cotaDaConta(contaId, plano);

    return NextResponse.json({
      ok: true,
      comercios: resultado.comercios.length,
      comSite: todos.length - leads.length,
      sitesQuebrados,
      sitesFracos,
      retomada,
      buscas: { usadas: usadas + 1, limite: limiteBuscas },
      jaTinha: existentes.length,
      descartados,
      comWhatsappLink: novos.filter((l) => l.whatsappFonte === 'link').length,
      comEmail: novos.filter((l) => l.email).length,
      novos: r.novos,
      proxima: resultado.proxima,
      cota: cotaParaJson(cota),
      fim: !cota.ilimitado && cota.restantes <= 0,
    });
  } catch (e) {
    console.error('[busca salvar]', e);
    return erro('Falha ao guardar os leads. Tente de novo.', 500);
  }
}
