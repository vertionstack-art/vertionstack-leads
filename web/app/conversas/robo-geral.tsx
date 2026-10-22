'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, BellRing } from 'lucide-react';
import { ROTULO_AGUARDANDO, type AvisoRobo } from '@/lib/robo-tipos';

/**
 * O interruptor geral do robô de vendas e os avisos de quando ele precisa
 * de você ("Barbearia do Zé quer ver a ideia"). A lista se atualiza sozinha
 * a cada 20 segundos enquanto a aba está aberta.
 */

function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
}

export default function RoboGeral({
  pronto,
  falta,
  ativoInicial,
  avisosIniciais,
}: {
  pronto: boolean;
  /** o que falta configurar, quando não está pronto */
  falta: string | null;
  ativoInicial: boolean;
  avisosIniciais: AvisoRobo[];
}) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [avisos, setAvisos] = useState(avisosIniciais);
  const [mudando, setMudando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const conferir = async () => {
      if (document.hidden) return;
      try {
        const j = await fetch('/api/robo', { cache: 'no-store' }).then((r) => r.json());
        if (j.ok) {
          setAvisos(j.avisos);
          setAtivo(j.ativo);
        }
      } catch {
        // rede caiu: tenta na próxima volta
      }
    };
    const relogio = setInterval(conferir, 20_000);
    return () => clearInterval(relogio);
  }, []);

  async function alternar() {
    setMudando(true);
    setErro(null);
    try {
      const j = await fetch('/api/robo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ativo }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error();
      setAtivo(j.ativo);
    } catch {
      setErro('Não consegui mudar agora. Tente de novo.');
    } finally {
      setMudando(false);
    }
  }

  return (
    <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className={`flex flex-col rounded-[24px] p-5 ${ativo && pronto ? 'bg-roxo-800 text-white' : 'bg-zinc-100 text-tinta'}`}>
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${ativo && pronto ? 'bg-white text-roxo-800' : 'bg-white text-zinc-600'}`}>
            <Bot aria-hidden className="h-5 w-5" />
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={ativo}
            aria-label="Robô de vendas ligado"
            disabled={mudando || !pronto}
            onClick={alternar}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${ativo ? 'bg-white' : 'bg-zinc-300'}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full transition-[left] ${ativo ? 'left-7 bg-roxo-800' : 'left-1 bg-white'}`} />
          </button>
        </div>
        <p className="mt-4 text-[16px] font-extrabold">Robô de vendas {ativo ? 'ligado' : 'desligado'}</p>
        <p className={`mt-1 text-[12.5px] font-medium leading-snug ${ativo && pronto ? 'text-white/80' : 'text-zinc-700'}`}>
          {!pronto
            ? falta
            : ativo
              ? 'Você manda a primeira mensagem. Quando o lead responde, o robô continua a conversa e te chama quando precisar.'
              : 'Ligado, ele responde os leads que responderem às mensagens que você mandou pela ferramenta.'}
        </p>
        {erro && <p role="alert" className="mt-2 text-[12px] font-semibold text-red-700">{erro}</p>}
      </div>

      <div className="rounded-[24px] bg-manteiga p-5">
        <p className="flex items-center gap-2 text-[14px] font-extrabold">
          <BellRing aria-hidden className="h-4 w-4" />
          {avisos.length ? `O robô precisa de você (${avisos.length})` : 'Nenhum pedido do robô agora'}
        </p>
        {avisos.length === 0 ? (
          <p className="mt-1 text-[12.5px] font-medium text-amber-950/80">
            Quando um cliente quiser ver a prévia, negociar ou marcar a chamada, o pedido aparece aqui.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {avisos.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/conversa/${encodeURIComponent(a.leadId)}`}
                  className="group flex items-center gap-3 rounded-[16px] bg-white px-3.5 py-2.5 transition-shadow hover:shadow-[0_6px_18px_rgba(11,11,15,0.08)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-[13.5px] font-extrabold">{a.nome}</span>
                      <span className="text-[11.5px] font-bold text-roxo-800">{ROTULO_AGUARDANDO[a.tipo] || 'Aviso'}</span>
                      <span className="text-[11.5px] font-medium text-zinc-500">{haQuanto(a.em)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-zinc-700">{a.texto}</span>
                  </span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
