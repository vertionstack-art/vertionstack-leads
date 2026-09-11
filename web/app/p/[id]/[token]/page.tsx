import { notFound } from 'next/navigation';
import { buscarLead } from '@/lib/db';
import { tokenConfere } from '@/lib/token-proposta';
import { montarPropostas, moeda, type Marcacoes } from '@/lib/proposta';
import type { Formalizacao, Porte } from '@/lib/catalogo';
import BotaoImprimir from './imprimir';
import './proposta.css';

export const dynamic = 'force-dynamic';

/**
 * O título vira o nome do arquivo quando o cliente salva em PDF —
 * "Proposta - Barbearia do Rapha.pdf" chega bem melhor no WhatsApp do
 * que "Vertion Leads.pdf".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  const idLimpo = decodeURIComponent(id);
  if (!tokenConfere(idLimpo, token)) return { title: 'Proposta' };

  const lead = await buscarLead(idLimpo);
  return {
    title: lead ? `Proposta - ${lead.name}` : 'Proposta',
    description: lead ? `Proposta comercial para ${lead.name}.` : undefined,
    robots: { index: false, follow: false },
  };
}

const EMPRESA = {
  nome: process.env.EMPRESA_NOME || 'Vertion Stack',
  telefone: process.env.EMPRESA_TELEFONE || '',
  email: process.env.EMPRESA_EMAIL || '',
  site: process.env.EMPRESA_SITE || '',
};

/** a proposta vale por 7 dias — prazo curto ajuda a decisão a acontecer */
const DIAS_DE_VALIDADE = 7;

function dataLonga(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * A frase de abertura muda conforme o que foi encontrado no comércio.
 * Uma proposta que começa dizendo exatamente qual é o problema dele vale
 * mais que qualquer texto bonito sobre "soluções digitais".
 */
function aberturaPara(kind: string, siteStatus: string | null): string {
  if (siteStatus === 'fora_do_ar')
    return 'Hoje quem procura vocês no Google e clica no site cai numa página que não abre. Esta proposta resolve isso e aproveita para colocar de pé algo que traga cliente.';
  if (siteStatus === 'certificado_vencido')
    return 'O site de vocês está no ar, mas o navegador avisa que não é seguro antes de deixar entrar — e boa parte das pessoas desiste aí. Esta proposta corrige isso.';
  if (siteStatus === 'em_construcao')
    return 'O endereço que aparece no Google abre uma página sem conteúdo. Quem chega tem a impressão de negócio parado. Esta proposta muda essa primeira impressão.';
  if (kind === 'social')
    return 'Hoje a presença de vocês na internet é a rede social. Ela funciona, mas some do Google e depende de uma plataforma que não é de vocês. Esta proposta é sobre ter um endereço próprio.';
  if (kind === 'marketplace')
    return 'Hoje quem traz cliente para vocês é uma plataforma que cobra comissão e fica com o contato. Esta proposta é sobre ter um canal direto, sem intermediário.';
  return 'Quem procura esse tipo de serviço na região hoje encontra os concorrentes que têm site. Esta proposta é sobre vocês aparecerem nessa hora.';
}

export default async function PaginaProposta({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  const idLimpo = decodeURIComponent(id);

  if (!tokenConfere(idLimpo, token)) notFound();

  const lead = await buscarLead(idLimpo);
  if (!lead || !lead.proposta) notFound();

  const cfg = lead.proposta as {
    marcacoes?: Marcacoes;
    porte?: Porte;
    formalizacao?: Formalizacao;
    desconto?: number;
    ignorarTeto?: boolean;
  };

  const planos = montarPropostas({
    marcacoes: cfg.marcacoes || {},
    porte: cfg.porte || 'micro',
    formalizacao: cfg.formalizacao || 'desconhecido',
    desconto: cfg.desconto,
    ignorarTeto: cfg.ignorarTeto,
  }).filter((p) => p.itens.length > 0);

  if (!planos.length) notFound();

  const hoje = new Date();
  const validade = new Date(hoje.getTime() + DIAS_DE_VALIDADE * 86400000);
  const abertura = aberturaPara(lead.websiteKind, lead.siteStatus);

  return (
    <div className="folha">
      <BotaoImprimir />

      <article className="doc">
        {/* ------------------------------------------------- cabeçalho */}
        <header className="topo">
          <div className="marca">
            <span className="marca-ponto" aria-hidden="true" />
            <span className="marca-nome">{EMPRESA.nome}</span>
          </div>
          <div className="topo-meta">
            <div>{dataLonga(hoje)}</div>
            <div className="fraco">válida até {dataLonga(validade)}</div>
          </div>
        </header>

        {/* ----------------------------------------------------- abertura */}
        <section className="abre">
          <p className="sobrescrito">Proposta comercial</p>
          <h1 className="titulo">{lead.name}</h1>
          {(lead.address || lead.city) && (
            <p className="endereco">{[lead.address, lead.city].filter(Boolean).join(' — ')}</p>
          )}
          <p className="lead">{abertura}</p>
        </section>

        {/* ------------------------------------------------------- planos */}
        <section className="planos" style={{ '--n': planos.length } as React.CSSProperties}>
          {planos.map((p, i) => (
            <div key={p.nivel} className={`plano ${i === 1 ? 'plano--destaque' : ''}`}>
              {i === 1 && <span className="selo">mais escolhido</span>}

              <h2 className="plano-nome">{p.rotulo}</h2>

              <div className="preco">
                <span className="preco-valor">{moeda(p.entrada)}</span>
                {p.mensalidade > 0 && (
                  <span className="preco-mensal">
                    depois {moeda(p.mensalidade)} por mês
                  </span>
                )}
              </div>

              <ul className="itens">
                {p.itens
                  .filter((it) => !it.mensal)
                  .map((it) => (
                    <li key={it.id}>
                      <strong>{it.nome}</strong>
                      <span>{it.beneficio}</span>
                    </li>
                  ))}
              </ul>

              {p.itens.some((it) => it.mensal) && (
                <>
                  <p className="itens-titulo">Todo mês</p>
                  <ul className="itens itens--mensal">
                    {p.itens
                      .filter((it) => it.mensal)
                      .map((it) => (
                        <li key={it.id}>
                          <strong>{it.nome}</strong>
                          <span>{it.beneficio}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </section>

        {/* --------------------------------------------------- condições */}
        <section className="condicoes">
          <h2 className="secao-titulo">Como funciona</h2>
          <dl className="grade">
            <div>
              <dt>Prazo</dt>
              <dd>De 7 a 15 dias úteis a partir da aprovação e do envio do material.</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>Metade na aprovação, metade na entrega. Pix, cartão ou boleto.</dd>
            </div>
            <div>
              <dt>Domínio e hospedagem</dt>
              <dd>Inclusos no primeiro ano, sem custo adicional.</dd>
            </div>
            <div>
              <dt>Ajustes</dt>
              <dd>Duas rodadas de alteração inclusas antes da publicação.</dd>
            </div>
          </dl>
        </section>

        {/* ----------------------------------------------------- rodapé */}
        <footer className="rodape">
          <div>
            <p className="rodape-nome">{EMPRESA.nome}</p>
            <p className="fraco">
              {[EMPRESA.telefone, EMPRESA.email, EMPRESA.site].filter(Boolean).join(' · ') ||
                'Qualquer dúvida, é só responder esta mensagem.'}
            </p>
          </div>
          <p className="fraco assinatura">
            Proposta gerada em {dataLonga(hoje)} para {lead.name}.
          </p>
        </footer>
      </article>
    </div>
  );
}
