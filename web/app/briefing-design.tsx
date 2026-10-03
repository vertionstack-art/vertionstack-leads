'use client';

/**
 * O formulário que transforma um lead do Maps numa prévia que parece feita
 * para ele.
 *
 * Fica dentro da janela do botão DESIGN, acima do prompt. Cada campo aqui
 * é uma informação que o Google Maps não tem e que o assistente inventaria
 * sozinho se ninguém dissesse — a cor da fachada, o serviço que puxa o
 * faturamento, o concorrente que não pode aparecer.
 *
 * Tudo é opcional. Preencher três campos já muda o resultado; exigir oito
 * faria você não preencher nenhum.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { ESTILOS, TOTAL_DE_CAMPOS, preenchidos, type Briefing, type Estilo } from '@/lib/briefing';

const CAIXA =
  'w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-roxo-500';

function Campo({
  titulo,
  dica,
  children,
}: {
  titulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11.5px] font-semibold text-zinc-700">{titulo}</label>
      {dica && <p className="mb-1 text-[11px] leading-snug text-zinc-500">{dica}</p>}
      {children}
    </div>
  );
}

export default function BriefingDesign({
  briefing,
  aoMudar,
}: {
  briefing: Briefing;
  aoMudar: (b: Briefing) => void;
}) {
  const [novaRef, setNovaRef] = useState('');
  const mudar = <K extends keyof Briefing>(campo: K, valor: Briefing[K]) =>
    aoMudar({ ...briefing, [campo]: valor });

  function adicionarReferencia() {
    const url = novaRef.trim();
    if (!url) return;
    // aceita o endereço colado sem protocolo, que é como a pessoa copia
    const completo = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    if (briefing.referencias.includes(completo)) {
      setNovaRef('');
      return;
    }
    mudar('referencias', [...briefing.referencias, completo]);
    setNovaRef('');
  }

  const feitos = preenchidos(briefing);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] leading-snug text-zinc-600">
          O que você souber deste comércio entra no prompt e manda no desenho. Tudo é opcional —
          três campos preenchidos já mudam muito o resultado.
        </p>
        <span className="shrink-0 text-[11.5px] tabular-nums text-zinc-500">
          {feitos} de {TOTAL_DE_CAMPOS}
        </span>
      </div>

      {/* ------------------------------------------------------- estilo */}
      <Campo titulo="Direção visual" dica="Como a página deve parecer à primeira vista.">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ESTILOS.map((e) => {
            const ativo = briefing.estilo === e.valor;
            return (
              <button
                key={e.valor}
                type="button"
                onClick={() => mudar('estilo', (ativo ? '' : e.valor) as Estilo)}
                title={e.dica}
                className={`min-h-[44px] rounded-full border px-2.5 py-1.5 text-left text-[12px] leading-tight transition ${
                  ativo
                    ? 'border-roxo-500 bg-roxo-50 font-semibold text-roxo-800'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-roxo-300'
                }`}
              >
                {e.rotulo}
              </button>
            );
          })}
        </div>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo titulo="Cores da marca" dica="Do jeito que ele fala: “vermelho e preto”, “o verde da fachada”.">
          <input
            value={briefing.cores}
            onChange={(e) => mudar('cores', e.target.value)}
            placeholder="verde escuro e dourado"
            className={CAIXA}
          />
        </Campo>

        <Campo titulo="O que precisa aparecer primeiro" dica="A coisa que faz o cliente dele ligar.">
          <input
            value={briefing.destaque}
            onChange={(e) => mudar('destaque', e.target.value)}
            placeholder="o rodízio de sexta"
            className={CAIXA}
          />
        </Campo>
      </div>

      <Campo
        titulo="Serviços e produtos reais"
        dica="Um por linha. Sem isso o assistente inventa uma lista genérica — e o dono percebe."
      >
        <textarea
          value={briefing.servicos}
          onChange={(e) => mudar('servicos', e.target.value)}
          rows={4}
          placeholder={'Corte masculino\nBarba\nPigmentação\nCombo corte + barba'}
          className={CAIXA + ' resize-y font-mono text-[12px]'}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo titulo="Diferenciais" dica="Tempo de mercado, prêmio, o que só ele tem.">
          <textarea
            value={briefing.diferenciais}
            onChange={(e) => mudar('diferenciais', e.target.value)}
            rows={3}
            placeholder="18 anos no mesmo ponto, única da cidade com barbeiro especializado em barba"
            className={CAIXA + ' resize-y'}
          />
        </Campo>

        <Campo titulo="O que NÃO fazer" dica="Cor que ele odeia, assunto proibido, concorrente.">
          <textarea
            value={briefing.evitar}
            onChange={(e) => mudar('evitar', e.target.value)}
            rows={3}
            placeholder="nada de azul (é a cor do concorrente da esquina)"
            className={CAIXA + ' resize-y'}
          />
        </Campo>
      </div>

      {/* -------------------------------------------------- referências */}
      <Campo
        titulo="Referências visuais"
        dica="Endereços de sites que você gosta. Entram no prompt para o assistente abrir e olhar."
      >
        <div className="flex gap-2">
          <input
            value={novaRef}
            onChange={(e) => setNovaRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarReferencia();
              }
            }}
            placeholder="barbearia-que-eu-gosto.com.br"
            className={CAIXA + ' flex-1'}
          />
          <button
            type="button"
            onClick={adicionarReferencia}
            disabled={!novaRef.trim()}
            className="shrink-0 rounded-full bg-tinta px-4 text-[12.5px] font-semibold text-white transition hover:brightness-150 disabled:bg-zinc-300"
          >
            Adicionar
          </button>
        </div>

        {briefing.referencias.length > 0 && (
          <ul className="mt-2 space-y-1">
            {briefing.referencias.map((r) => (
              <li
                key={r}
                className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-3 py-1.5 text-[12px]"
              >
                <a
                  href={r}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-roxo-700 hover:underline"
                >
                  {r.replace(/^https?:\/\//, '')}
                </a>
                <button
                  type="button"
                  onClick={() => mudar('referencias', briefing.referencias.filter((x) => x !== r))}
                  aria-label={`Tirar ${r}`}
                  className="shrink-0 px-1 text-[15px] leading-none text-zinc-400 hover:text-red-600"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Campo>

      {/*
        Print e foto não passam por aqui: não existe jeito de mandar arquivo
        junto do prompt por link. A caixa avisa o assistente de que as
        imagens vêm anexadas na conversa, para ele olhar antes de decidir.
      */}
      <label className="flex cursor-pointer items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
        <input
          type="checkbox"
          checked={briefing.anexaImagens}
          onChange={(e) => mudar('anexaImagens', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
        />
        <span>
          <strong>Vou anexar imagens no Claude.</strong> Print, foto da fachada, logo — arraste
          direto lá na conversa. Marcando aqui, o prompt manda ele olhar as imagens antes de
          desenhar qualquer coisa.
        </span>
      </label>

      <Campo titulo="Outras observações">
        <textarea
          value={briefing.observacoes}
          onChange={(e) => mudar('observacoes', e.target.value)}
          rows={2}
          placeholder="o filho cuida do Instagram e vai ser quem decide"
          className={CAIXA + ' resize-y'}
        />
      </Campo>
    </div>
  );
}
