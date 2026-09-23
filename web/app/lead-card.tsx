'use client';

import type { Lead, Status } from '@/lib/db';
import { origemDoLead } from '@/lib/pais';
import { temperaturaDoLead, CLASSE_NIVEL } from '@/lib/temperatura';

/**
 * O mesmo lead da tabela, no formato que funciona no celular.
 *
 * A tabela tem sete colunas e mais de mil pixels de largura: numa tela de
 * 375px ela vira rolagem lateral, que é justamente o que atrapalha quando
 * você está com o telefone na mão prestes a ligar para o comércio. Aqui
 * cada lead é um cartão, e o que importa na hora da ligação — telefone,
 * situação do site e status — fica à mão.
 *
 * Todo alvo tocável tem no mínimo 44px, que é o mínimo do WCAG 2.2 e do
 * guia da Apple; abaixo disso o dedo erra e a pessoa toca no vizinho.
 */

const TOQUE = 'min-h-[44px]';

export default function LeadCard({
  lead,
  usuario,
  statusLista,
  tipo,
  siteStatus,
  linkWhatsApp,
  onStatus,
  onPrompt,
  onPromptGringa,
  onPromptDesign,
  onPromptSite,
  onProposta,
  onNota,
  editandoNota,
  rascunho,
  setRascunho,
  onSalvarNota,
  onCancelarNota,
  onApagar,
}: {
  lead: Lead;
  usuario: string;
  statusLista: { valor: Status; rotulo: string }[];
  tipo: { rotulo: string; classe: string };
  siteStatus: { rotulo: string; classe: string; bom: boolean } | null;
  linkWhatsApp: string | null;
  onStatus: (s: Status) => void;
  onPrompt: () => void;
  onPromptGringa: () => void;
  onPromptDesign: () => void;
  onPromptSite: () => void;
  onProposta: () => void;
  onNota: () => void;
  editandoNota: boolean;
  rascunho: string;
  setRascunho: (v: string) => void;
  onSalvarNota: () => void;
  onCancelarNota: () => void;
  onApagar: () => void;
}) {
  const telLimpo = lead.phone ? lead.phone.replace(/\D/g, '') : null;
  // fora do Brasil o contato é e-mail, não WhatsApp — e o prompt é outro
  const gringa = origemDoLead(lead).estrangeiro;
  const temp = temperaturaDoLead(lead);

  return (
    <article className="border-b border-zinc-200 bg-white px-4 py-4 last:border-b-0">
      {/* nome e situação */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug">{lead.name}</h3>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">
            {[lead.category, lead.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {lead.rating && (
          <div className="shrink-0 text-right">
            <div className="text-[14px] font-semibold tabular-nums">{lead.rating.toFixed(1)}</div>
            <div className="text-[10.5px] text-zinc-500">{lead.reviews ?? 0} aval.</div>
          </div>
        )}
      </div>

      {/* presença digital */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${CLASSE_NIVEL[temp.nivel]}`}
        >
          {temp.rotulo} · {temp.pontos}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset ${tipo.classe}`}>
          {tipo.rotulo}
        </span>
        {siteStatus && (
          <span className={`text-[11.5px] ${siteStatus.classe}`}>
            {siteStatus.bom ? '' : '⚠ '}
            {siteStatus.rotulo}
          </span>
        )}
        {lead.responsavel && (
          <span
            className={`text-[11.5px] ${
              lead.responsavel === usuario ? 'font-medium text-roxo-700' : 'text-amber-700'
            }`}
          >
            {lead.responsavel === usuario ? 'com você' : `com ${lead.responsavel}`}
          </span>
        )}
      </div>

      {temp.motivos[0] && (
        <p className="mt-2 text-[12px] leading-snug text-zinc-700">
          <span className="font-medium">Por quê: </span>
          {temp.motivos[0]}
        </p>
      )}
      {temp.freios[0] && <p className="mt-1 text-[12px] leading-snug text-amber-700">⚠ {temp.freios[0]}</p>}

      {lead.address && <p className="mt-2 text-[12.5px] leading-snug text-zinc-600">{lead.address}</p>}

      {/* contato: os dois botões que importam na hora de abordar */}
      {lead.phone ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`tel:${telLimpo}`}
            className={`flex ${TOQUE} items-center justify-center rounded-xl bg-tinta px-3 text-[14px] font-semibold text-white active:brightness-150`}
          >
            Ligar
          </a>
          {linkWhatsApp ? (
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex ${TOQUE} items-center justify-center rounded-xl bg-emerald-600 px-3 text-[14px] font-semibold text-white active:brightness-110`}
            >
              WhatsApp
            </a>
          ) : (
            <span className={`flex ${TOQUE} items-center justify-center rounded-xl bg-zinc-100 text-[13px] text-zinc-400`}>
              sem WhatsApp
            </span>
          )}
          <p className="col-span-2 text-center text-[12.5px] tabular-nums text-zinc-500">{lead.phone}</p>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-zinc-50 py-2.5 text-center text-[12.5px] text-zinc-500">
          Sem telefone cadastrado
        </p>
      )}

      {/* ações */}
      {gringa && (
        <button
          onClick={onPromptGringa}
          className={`mt-3 w-full ${TOQUE} rounded-xl border border-sky-300 bg-sky-50 text-[12.5px] font-semibold text-sky-700 active:bg-sky-100`}
        >
          COPY GRINGA — e-mail
        </button>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={onPrompt}
          className={`${TOQUE} rounded-xl border border-roxo-300 bg-roxo-50 text-[12.5px] font-semibold text-roxo-700 active:bg-roxo-100`}
        >
          COPY
        </button>
        <button
          onClick={onPromptDesign}
          className={`${TOQUE} rounded-xl border text-[12.5px] font-semibold ${
            lead.previaUrl
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : 'border-zinc-300 bg-white text-zinc-700'
          }`}
        >
          DESIGN
        </button>
        <button
          onClick={onProposta}
          className={`${TOQUE} rounded-xl border text-[12.5px] font-semibold ${
            lead.proposta
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : 'border-zinc-300 bg-white text-zinc-700'
          }`}
        >
          {lead.proposta ? '✓ PROP.' : 'PROPOSTA'}
        </button>
      </div>

      {lead.previaUrl && (
        <button
          onClick={onPromptSite}
          className={`mt-2 w-full ${TOQUE} rounded-xl border border-zinc-300 bg-white text-[12.5px] font-semibold text-zinc-700 active:bg-zinc-50`}
        >
          ENTREGA — publicar o site vendido
        </button>
      )}

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select
          value={lead.status}
          onChange={(e) => onStatus(e.target.value as Status)}
          aria-label={`Status de ${lead.name}`}
          className={`${TOQUE} rounded-xl border border-zinc-300 bg-white px-3 text-[13.5px]`}
        >
          {statusLista.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <button
          onClick={onNota}
          aria-label={`Anotação de ${lead.name}`}
          className={`${TOQUE} rounded-xl border border-zinc-300 px-4 text-[13px] text-zinc-600`}
        >
          {lead.notes ? 'Nota ✓' : 'Nota'}
        </button>
      </div>

      {editandoNota ? (
        <div className="mt-2">
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={3}
            autoFocus
            placeholder="O que rolou nesse contato…"
            aria-label={`Anotação de ${lead.name}`}
            className="w-full rounded-xl border border-roxo-300 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-roxo-100"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={onSalvarNota}
              className={`${TOQUE} rounded-xl bg-roxo-600 text-[13px] font-semibold text-white`}
            >
              Salvar nota
            </button>
            <button
              onClick={onCancelarNota}
              className={`${TOQUE} rounded-xl border border-zinc-300 text-[13px] text-zinc-600`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        lead.notes && (
          <p className="mt-2 rounded-xl bg-roxo-50 px-3 py-2 text-[12.5px] leading-snug text-roxo-900">
            “{lead.notes}”
          </p>
        )
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {lead.mapsUrl ? (
          <a
            href={lead.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex ${TOQUE} flex-1 items-center justify-center text-[12.5px] text-zinc-500 underline underline-offset-2`}
          >
            Ver no Google Maps
          </a>
        ) : (
          <span className="flex-1" />
        )}
        {/* discreto de propósito: apagar é irreversível e o dedo erra fácil */}
        <button
          onClick={onApagar}
          aria-label={`Apagar ${lead.name}`}
          className={`flex ${TOQUE} shrink-0 items-center justify-center px-4 text-[12.5px] text-zinc-400 active:text-red-600`}
        >
          apagar
        </button>
      </div>
    </article>
  );
}
