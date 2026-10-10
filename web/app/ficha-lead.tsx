'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bell, BellOff, Check, Eye, FileText, Flag, History, Mail, MessageCircle, MoveRight, PencilLine, Phone, Save, Sparkles, Trash2, X,
} from 'lucide-react';
import { aplicarModelo, linkComTexto, MARCADORES, mensagemPronta, virarModelo, type Remetente } from '@/lib/mensagem';

/**
 * A ficha do lead: a mensagem do WhatsApp já escrita, o lembrete ("ligar dia
 * 12") e o histórico de tudo que aconteceu com ele. Abre do painel (tabela e
 * card do celular) e do CRM.
 *
 * O WhatsApp abre com o texto preenchido, mas quem aperta enviar é a pessoa,
 * no WhatsApp dela. Aqui só fica anotado que a conversa começou.
 */

type Aba = 'whatsapp' | 'lembrete' | 'historico';

interface LeadFicha {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  websiteKind: string;
  siteStatus: string | null;
  rating: number | null;
  reviews: number | null;
  instagram: string | null;
  previaUrl: string | null;
  status: string;
  lembreteEm: string | null;
  lembreteTexto: string | null;
  contatadoEm: string | null;
  email: string | null;
}

interface Modelo {
  id: string;
  nome: string;
  texto: string;
}

interface Evento {
  id: string;
  tipo: string;
  detalhe: string | null;
  quem: string | null;
  em: string;
}

interface Dados {
  lead: LeadFicha;
  eventos: Evento[];
  numero: string | null;
  modelos: Modelo[];
  remetente: Remetente;
}

const ICONE: Record<string, typeof Bell> = {
  criado: Sparkles,
  status: Flag,
  nota: PencilLine,
  whatsapp: MessageCircle,
  proposta: FileText,
  proposta_fechada: Check,
  proposta_aberta: Eye,
  previa: Sparkles,
  etapa: MoveRight,
  lembrete: Bell,
  lembrete_feito: BellOff,
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "2026-10-12T10:00" no fuso de quem está usando, para o <input type=datetime-local> */
function paraCampo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function atalho(dias: number, hora = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

export default function FichaLead({
  leadId,
  abaInicial = 'whatsapp',
  aoFechar,
  aoMudar,
}: {
  leadId: string;
  abaInicial?: Aba;
  aoFechar: () => void;
  /** algo mudou (status, lembrete): quem abriu a ficha recarrega a lista */
  aoMudar?: () => void;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [quandoLembrar, setQuandoLembrar] = useState('');
  const [notaLembrete, setNotaLembrete] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // 'auto' = a mensagem montada pela ferramenta; senão, o id do modelo salvo
  const [modelo, setModelo] = useState('auto');
  const [nomeModelo, setNomeModelo] = useState<string | null>(null);
  const [emailRascunho, setEmailRascunho] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(leadId)}/ficha`, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'Não consegui abrir a ficha.');
      setDados(j as Dados);
      return j as Dados;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a ficha.');
      return null;
    }
  }, [leadId]);

  useEffect(() => {
    carregar().then((d) => {
      if (!d) return;
      setTexto(mensagemPronta({ ...d.lead, nome: d.lead.name }, d.remetente));
      setQuandoLembrar(paraCampo(d.lead.lembreteEm ? new Date(d.lead.lembreteEm) : atalho(1)));
      setNotaLembrete(d.lead.lembreteTexto || '');
    });
  }, [carregar]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  async function abrirWhatsApp() {
    if (!dados?.numero) return;
    // abre já, no clique (pop-up depois de um await é bloqueado pelo navegador)
    window.open(linkComTexto(dados.numero, texto), '_blank', 'noopener,noreferrer');
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      setAviso(dados.lead.status === 'novo' ? 'Anotado no histórico. O lead passou para "Contatado".' : 'Anotado no histórico.');
      await carregar();
      aoMudar?.();
    } catch {
      setAviso('O WhatsApp abriu, mas não consegui anotar no histórico.');
    }
  }

  const dadosMsg = (d: Dados) => ({ ...d.lead, nome: d.lead.name });

  function escolherModelo(id: string) {
    if (!dados) return;
    setModelo(id);
    const m = dados.modelos.find((x) => x.id === id);
    setTexto(m ? aplicarModelo(m.texto, dadosMsg(dados), dados.remetente) : mensagemPronta(dadosMsg(dados), dados.remetente));
  }

  async function salvarModelo() {
    if (!dados || !nomeModelo?.trim()) return;
    setSalvando(true);
    try {
      const r = await fetch('/api/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeModelo.trim(), texto: virarModelo(texto, dadosMsg(dados), dados.remetente) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setDados({ ...dados, modelos: [...dados.modelos, j.modelo] });
      setModelo(j.modelo.id);
      setNomeModelo(null);
      setAviso(`Modelo "${j.modelo.nome}" salvo. Ele aparece aqui em todos os leads, já com os dados de cada um.`);
    } catch (e) {
      setAviso(e instanceof Error && e.message ? e.message : 'Não consegui salvar o modelo.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagarModeloAtual() {
    if (!dados || modelo === 'auto') return;
    const m = dados.modelos.find((x) => x.id === modelo);
    if (!m || !window.confirm(`Apagar o modelo "${m.nome}"?`)) return;
    await fetch(`/api/modelos?id=${m.id}`, { method: 'DELETE' }).catch(() => {});
    setDados({ ...dados, modelos: dados.modelos.filter((x) => x.id !== m.id) });
    setModelo('auto');
    setTexto(mensagemPronta(dadosMsg(dados), dados.remetente));
  }

  async function salvarEmail() {
    if (emailRascunho === null) return;
    setSalvando(true);
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRascunho.trim() || null }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setEmailRascunho(null);
      await carregar();
      aoMudar?.();
    } catch (e) {
      setAviso(e instanceof Error && e.message ? e.message : 'Não consegui salvar o e-mail.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarLembrete(em: Date | null) {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(leadId)}/lembrete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ em: em ? em.toISOString() : null, texto: notaLembrete }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setAviso(em ? 'Lembrete marcado. Ele aparece em "Para hoje" no CRM no dia.' : 'Lembrete concluído.');
      if (!em) setNotaLembrete('');
      await carregar();
      aoMudar?.();
    } catch (e) {
      setAviso(e instanceof Error && e.message ? e.message : 'Não consegui salvar o lembrete.');
    } finally {
      setSalvando(false);
    }
  }

  const lead = dados?.lead;
  const abaBotao = (a: Aba, rotulo: string, Icone: typeof Bell) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === a}
      onClick={() => { setAba(a); setAviso(null); }}
      className={`inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold transition-colors sm:px-4 ${
        aba === a ? 'bg-tinta text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-tinta'
      }`}
    >
      <Icone aria-hidden className="h-4 w-4" />
      {rotulo}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lead ? `Ficha de ${lead.name}` : 'Ficha do lead'}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.25)] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-extrabold tracking-[-0.02em]">{lead?.name || 'Carregando…'}</h2>
            {lead && (
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-zinc-500">
                {[lead.category, lead.city].filter(Boolean).join(' · ')}
                {lead.phone && <> · {lead.phone}</>}
              </p>
            )}
            {lead && emailRascunho === null && (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-600">
                <Mail aria-hidden className="h-3.5 w-3.5 shrink-0" />
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="truncate text-roxo-700 underline underline-offset-2">{lead.email}</a>
                ) : (
                  <span className="text-zinc-500">sem e-mail</span>
                )}
                <button type="button" onClick={() => setEmailRascunho(lead.email || '')} className="ml-1 font-bold text-zinc-500 hover:text-tinta">
                  {lead.email ? 'editar' : 'adicionar'}
                </button>
              </p>
            )}
            {lead && emailRascunho !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  autoFocus
                  value={emailRascunho}
                  onChange={(e) => setEmailRascunho(e.target.value.slice(0, 120))}
                  onKeyDown={(e) => e.key === 'Enter' && salvarEmail()}
                  placeholder="contato@comercio.com.br"
                  aria-label="E-mail do comércio"
                  className="min-h-[36px] w-[240px] max-w-full rounded-full border border-zinc-300 px-3.5 text-[13px] outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
                />
                <button type="button" disabled={salvando} onClick={salvarEmail} className="min-h-[36px] rounded-full bg-tinta px-3.5 text-[12.5px] font-bold text-white hover:bg-tinta-70">
                  Salvar
                </button>
                <button type="button" onClick={() => setEmailRascunho(null)} className="text-[12.5px] font-bold text-zinc-500 hover:text-tinta">
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-tinta">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div role="tablist" className="flex gap-1 border-b border-zinc-200 px-5 pb-3">
          {abaBotao('whatsapp', 'WhatsApp', MessageCircle)}
          {abaBotao('lembrete', lead?.lembreteEm ? 'Lembrete (1)' : 'Lembrete', Bell)}
          {abaBotao('historico', 'Histórico', History)}
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {erro && <p role="alert" className="text-[13.5px] font-semibold text-red-700">{erro}</p>}
          {!dados && !erro && <p className="text-[13.5px] text-zinc-500">Carregando…</p>}

          {dados && aba === 'whatsapp' && (
            <div>
              {dados.numero ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label htmlFor="msg-modelo" className="text-[13px] font-bold">Mensagem</label>
                    <select
                      id="msg-modelo"
                      value={modelo}
                      onChange={(e) => escolherModelo(e.target.value)}
                      className="min-h-[36px] max-w-[260px] cursor-pointer rounded-full border border-zinc-300 bg-white px-3.5 text-[13px] font-semibold outline-none focus:border-roxo-500"
                    >
                      <option value="auto">Automática (pelo motivo do lead)</option>
                      {dados.modelos.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                    {modelo !== 'auto' && (
                      <button type="button" onClick={apagarModeloAtual} title="Apagar este modelo" className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-700">
                        <Trash2 aria-hidden className="h-4 w-4" />
                        <span className="sr-only">Apagar este modelo</span>
                      </button>
                    )}
                  </div>
                  <label htmlFor="msg-zap" className="block text-[12.5px] font-medium text-zinc-500">
                    Edite à vontade antes de abrir
                  </label>
                  <textarea
                    id="msg-zap"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value.slice(0, 1500))}
                    rows={9}
                    className="mt-2 w-full resize-y rounded-2xl border border-zinc-300 px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={abrirWhatsApp}
                      disabled={!texto.trim()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300"
                    >
                      <MessageCircle aria-hidden className="h-4 w-4" />
                      Abrir no WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => escolherModelo(modelo)}
                      className="text-[12.5px] font-bold text-zinc-500 underline-offset-2 hover:text-tinta hover:underline"
                    >
                      Voltar ao texto original
                    </button>
                    {nomeModelo === null && (
                      <button
                        type="button"
                        onClick={() => setNomeModelo('')}
                        className="inline-flex items-center gap-1 text-[12.5px] font-bold text-zinc-500 underline-offset-2 hover:text-tinta hover:underline"
                      >
                        <Save aria-hidden className="h-3.5 w-3.5" /> Salvar como modelo
                      </button>
                    )}
                  </div>
                  {nomeModelo !== null && (
                    <div className="mt-3 rounded-2xl bg-zinc-100 p-3.5">
                      <label htmlFor="nome-modelo" className="block text-[12.5px] font-bold">Nome do modelo</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          id="nome-modelo"
                          autoFocus
                          value={nomeModelo}
                          onChange={(e) => setNomeModelo(e.target.value.slice(0, 60))}
                          onKeyDown={(e) => e.key === 'Enter' && salvarModelo()}
                          placeholder="Ex.: Site fora do ar, curto"
                          className="min-h-[38px] min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-3.5 text-[13px] outline-none focus:border-roxo-500"
                        />
                        <button type="button" disabled={salvando || !nomeModelo.trim()} onClick={salvarModelo} className="min-h-[38px] rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white hover:bg-tinta-70 disabled:bg-zinc-300">
                          Salvar
                        </button>
                        <button type="button" onClick={() => setNomeModelo(null)} className="text-[12.5px] font-bold text-zinc-500 hover:text-tinta">
                          Cancelar
                        </button>
                      </div>
                      <p className="mt-2 text-[11.5px] leading-snug text-zinc-600">
                        O nome deste comércio, a cidade, o ramo e o seu nome viram marcadores sozinhos: o modelo sai certo em qualquer lead.
                        Marcadores que você pode digitar: {MARCADORES.map((m) => m.chave).join(' ')}.
                      </p>
                    </div>
                  )}
                  <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
                    O WhatsApp abre com o texto preenchido e você aperta enviar. Fica anotado no histórico
                    {dados.lead.status === 'novo' ? ' e o lead passa para "Contatado"' : ''}.
                    {!dados.remetente.empresa && ' Dica: preencha o nome da sua empresa em Meu perfil para ele aparecer na mensagem.'}
                  </p>
                </>
              ) : (
                <p className="flex items-start gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-[13.5px] font-medium">
                  <Phone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {dados.lead.phone
                    ? `${dados.lead.phone} é telefone fixo: não dá para abrir no WhatsApp. Ligue, ou procure o WhatsApp no Instagram do comércio.`
                    : 'Este comércio não tem telefone cadastrado no Google.'}
                </p>
              )}
            </div>
          )}

          {dados && aba === 'lembrete' && (
            <div>
              {dados.lead.lembreteEm && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-100 px-4 py-3">
                  <p className="text-[13.5px] font-semibold">
                    <Bell aria-hidden className="mr-1.5 inline h-4 w-4" />
                    {quando(dados.lead.lembreteEm)}
                    {dados.lead.lembreteTexto && <span className="font-medium text-zinc-600"> · {dados.lead.lembreteTexto}</span>}
                  </p>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => salvarLembrete(null)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white hover:bg-tinta-70"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" /> Feito
                  </button>
                </div>
              )}
              <p className="text-[13px] font-bold">{dados.lead.lembreteEm ? 'Mudar para' : 'Lembrar de voltar a este lead'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['Amanhã', 1],
                  ['Em 3 dias', 3],
                  ['Em 1 semana', 7],
                ].map(([r, d]) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuandoLembrar(paraCampo(atalho(d as number)))}
                    className="min-h-[36px] rounded-full bg-white px-3.5 text-[12.5px] font-bold ring-1 ring-inset ring-zinc-300 hover:ring-tinta"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <label htmlFor="lembrete-quando" className="mt-4 block text-[13px] font-bold">Dia e hora</label>
              <input
                id="lembrete-quando"
                type="datetime-local"
                value={quandoLembrar}
                onChange={(e) => setQuandoLembrar(e.target.value)}
                className="mt-2 min-h-[44px] w-full rounded-full border border-zinc-300 px-4 text-[14px] outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
              />
              <label htmlFor="lembrete-texto" className="mt-4 block text-[13px] font-bold">
                O quê <span className="font-medium text-zinc-500">· opcional</span>
              </label>
              <input
                id="lembrete-texto"
                value={notaLembrete}
                onChange={(e) => setNotaLembrete(e.target.value.slice(0, 200))}
                placeholder="Ex.: ligar para falar da prévia"
                className="mt-2 min-h-[44px] w-full rounded-full border border-zinc-300 px-4 text-[14px] outline-none placeholder:text-zinc-500 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
              />
              <button
                type="button"
                disabled={salvando || !quandoLembrar}
                onClick={() => salvarLembrete(new Date(quandoLembrar))}
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300"
              >
                <Bell aria-hidden className="h-4 w-4" />
                {salvando ? 'Salvando…' : dados.lead.lembreteEm ? 'Mudar lembrete' : 'Marcar lembrete'}
              </button>
            </div>
          )}

          {dados && aba === 'historico' && (
            <ol className="relative">
              <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-zinc-200" />
              {dados.eventos.map((e) => {
                const Icone = ICONE[e.tipo] || Flag;
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        e.tipo === 'proposta_aberta' || e.tipo === 'proposta_fechada' ? 'bg-menta text-emerald-950' : 'bg-zinc-100 text-tinta'
                      }`}
                    >
                      <Icone aria-hidden className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-[13.5px] font-semibold leading-snug">{e.detalhe}</p>
                      <p className="mt-0.5 text-[11.5px] font-medium text-zinc-500">
                        {quando(e.em)}
                        {e.quem && <> · {e.quem}</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {aviso && (
            <p role="status" className="mt-4 rounded-2xl bg-menta px-4 py-2.5 text-[13px] font-semibold text-emerald-950">
              {aviso}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
