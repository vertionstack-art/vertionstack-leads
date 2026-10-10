'use client';

import { AlertTriangle, Check, MapPin, MessageCircle, Phone } from 'lucide-react';
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
  tipo: { rotulo: string; classe: string; barra?: string };
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

  const inicial = (lead.name.match(/[\p{L}\p{N}]/u)?.[0] || '•').toUpperCase();

  return (
    <article className="rounded-[22px] border border-zinc-100 bg-white p-4 shadow-[0_2px_10px_rgba(11,11,15,0.04)]">
      {/* nome e situação */}
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tinta text-[16px] font-extrabold text-white">
          {inicial}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-extrabold leading-snug tracking-[-0.01em]">{lead.name}</h3>
          <p className="mt-0.5 text-[12.5px] font-medium text-zinc-500">
            {[lead.category, lead.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {lead.rating && (
          <div className="shrink-0 text-right">
            <div className="text-[15px] font-extrabold tabular-nums">{lead.rating.toFixed(1)}</div>
            <div className="text-[11px] font-medium text-zinc-500">{lead.reviews ?? 0} aval.</div>
          </div>
        )}
      </div>

      {/* presença digital */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[temp.nivel]}`}>
          {temp.rotulo} · {temp.pontos}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-inset ${tipo.classe}`}>
          {tipo.barra && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tipo.barra}`} />}
          {tipo.rotulo}
        </span>
        {siteStatus && (
          <span className={`inline-flex items-center gap-1 text-[11.5px] ${siteStatus.classe}`}>
            {!siteStatus.bom && <AlertTriangle aria-hidden className="h-3.5 w-3.5" />}
            {siteStatus.rotulo}
          </span>
        )}
        {lead.responsavel && (
          <span
            className={`text-[11.5px] ${
              lead.responsavel === usuario ? 'font-bold text-roxo-700' : 'font-semibold text-amber-800'
            }`}
          >
            {lead.responsavel === usuario ? 'com você' : `com ${lead.responsavel}`}
          </span>
        )}
      </div>

      {temp.motivos[0] && (
        <p className="mt-2.5 text-[12.5px] leading-snug text-zinc-700">
          <span className="font-bold">Por quê: </span>
          {temp.motivos[0]}
        </p>
      )}
      {temp.freios[0] && (
        <p className="mt-1 flex items-start gap-1 text-[12.5px] leading-snug text-amber-800">
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {temp.freios[0]}
        </p>
      )}

      {lead.address && <p className="mt-2 text-[12.5px] leading-snug text-zinc-600">{lead.address}</p>}

      {/* contato: os dois botões que importam na hora de abordar */}
      {lead.phone || linkWhatsApp ? (
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {lead.phone ? (
            <a
              href={`tel:${telLimpo}`}
              className={`flex ${TOQUE} items-center justify-center gap-2 rounded-full bg-tinta px-3 text-[14px] font-bold text-white active:bg-tinta-70`}
            >
              <Phone aria-hidden className="h-4 w-4" />
              Ligar
            </a>
          ) : (
            <span className={`flex ${TOQUE} items-center justify-center rounded-full bg-zinc-100 text-[13px] font-semibold text-zinc-500`}>sem telefone</span>
          )}
          {linkWhatsApp ? (
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex ${TOQUE} items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-[14px] font-bold text-tinta active:bg-zinc-50`}
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              WhatsApp
            </a>
          ) : (
            <span className={`flex ${TOQUE} items-center justify-center rounded-full bg-zinc-100 text-[13px] font-semibold text-zinc-500`}>
              {lead.telefoneTipo === 'fixo' ? 'fixo, sem WhatsApp' : 'sem WhatsApp'}
            </span>
          )}
          <p className="col-span-2 text-center text-[12.5px] font-semibold tabular-nums text-zinc-500">
            {lead.phone}
            {lead.whatsappFonte === 'link' && <span className="text-emerald-700"> · WhatsApp confirmado no link da empresa</span>}
          </p>
        </div>
      ) : (
        <p className="mt-3.5 rounded-full bg-zinc-50 py-2.5 text-center text-[12.5px] font-semibold text-zinc-500">
          Sem telefone cadastrado
        </p>
      )}

      {/* ações */}
      {gringa && (
        <button
          onClick={onPromptGringa}
          className={`mt-2 w-full ${TOQUE} rounded-full bg-zinc-100 text-[12.5px] font-bold text-tinta active:bg-zinc-200`}
        >
          COPY GRINGA — e-mail
        </button>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          onClick={onPrompt}
          className={`${TOQUE} rounded-full bg-zinc-100 text-[12.5px] font-bold text-tinta active:bg-zinc-200`}
        >
          COPY
        </button>
        <button
          onClick={onPromptDesign}
          className={`flex ${TOQUE} items-center justify-center gap-1 rounded-full text-[12.5px] font-bold ${
            lead.previaUrl ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta'
          }`}
        >
          {lead.previaUrl && <Check aria-hidden className="h-3.5 w-3.5" />}
          DESIGN
        </button>
        <button
          onClick={onProposta}
          className={`flex ${TOQUE} items-center justify-center gap-1 rounded-full text-[12.5px] font-bold ${
            lead.proposta ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta'
          }`}
        >
          {Boolean(lead.proposta) && <Check aria-hidden className="h-3.5 w-3.5" />}
          {lead.proposta ? 'PROP.' : 'PROPOSTA'}
        </button>
      </div>

      {lead.previaUrl && (
        <button
          onClick={onPromptSite}
          className={`mt-2 w-full ${TOQUE} rounded-full bg-zinc-100 text-[12.5px] font-bold text-zinc-700 active:bg-zinc-200`}
        >
          ENTREGA — publicar o site vendido
        </button>
      )}

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select
          value={lead.status}
          onChange={(e) => onStatus(e.target.value as Status)}
          aria-label={`Status de ${lead.name}`}
          className={`${TOQUE} rounded-full border border-zinc-200 bg-white px-4 text-[13.5px] font-semibold`}
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
          className={`flex ${TOQUE} items-center gap-1 rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700`}
        >
          Nota
          {lead.notes && <Check aria-hidden className="h-3.5 w-3.5" />}
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
            className="w-full rounded-2xl border border-roxo-300 px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-roxo-100"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={onSalvarNota}
              className={`${TOQUE} rounded-full bg-tinta text-[13px] font-bold text-white`}
            >
              Salvar nota
            </button>
            <button
              onClick={onCancelarNota}
              className={`${TOQUE} rounded-full border border-zinc-200 text-[13px] font-semibold text-zinc-700`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        lead.notes && (
          <p className="mt-2 rounded-2xl bg-lavanda px-3.5 py-2.5 text-[12.5px] leading-snug text-roxo-950">
            “{lead.notes}”
          </p>
        )
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        {lead.mapsUrl ? (
          <a
            href={lead.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex ${TOQUE} flex-1 items-center justify-center gap-1 text-[12.5px] font-semibold text-zinc-500`}
          >
            <MapPin aria-hidden className="h-3.5 w-3.5" />
            Ver no Google Maps
          </a>
        ) : (
          <span className="flex-1" />
        )}
        {/* discreto de propósito: apagar é irreversível e o dedo erra fácil */}
        <button
          onClick={onApagar}
          aria-label={`Apagar ${lead.name}`}
          className={`flex ${TOQUE} shrink-0 items-center justify-center px-4 text-[12.5px] font-semibold text-zinc-400 active:text-red-700`}
        >
          apagar
        </button>
      </div>
    </article>
  );
}
