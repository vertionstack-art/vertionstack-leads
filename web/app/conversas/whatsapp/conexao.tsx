'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, QrCode, RefreshCw, ShieldAlert, Unplug } from 'lucide-react';
import type { EstadoWhatsapp } from '@/lib/evolution';

/**
 * Conectar o WhatsApp da Vertion: pede o QR code ao servidor da Evolution,
 * mostra para ler no celular e confere a cada 3 segundos até conectar.
 */
export default function ConexaoWhatsapp({ estadoInicial }: { estadoInicial: EstadoWhatsapp }) {
  const [estado, setEstado] = useState<EstadoWhatsapp>(estadoInicial);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // enquanto o QR está na tela, confere se o celular já leu
  useEffect(() => {
    if (!qr) return;
    const relogio = setInterval(async () => {
      try {
        const j = await fetch('/api/whatsapp/conexao', { cache: 'no-store' }).then((x) => x.json());
        if (j.ok && j.estado === 'open') {
          setEstado('open');
          setQr(null);
          setCodigo(null);
        }
      } catch {
        // tenta de novo na próxima volta
      }
    }, 3000);
    return () => clearInterval(relogio);
  }, [qr]);

  async function pedir(acao: 'conectar' | 'desconectar') {
    if (acao === 'desconectar' && !confirm('Desligar o WhatsApp da ferramenta? O número continua funcionando normal no celular.')) return;
    setOcupado(true);
    setErro(null);
    try {
      const j = await fetch('/api/whatsapp/conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      }).then((x) => x.json());
      if (!j.ok) throw new Error(j.erro || 'Não deu certo.');
      setEstado(j.estado);
      setQr(j.qr || null);
      setCodigo(j.codigo || null);
      if (acao === 'conectar' && j.estado !== 'open' && !j.qr) setErro('O servidor ainda não gerou o QR code. Clique de novo em alguns segundos.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const desligada = estado === 'desligado';

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className={`rounded-[24px] p-6 ${estado === 'open' ? 'bg-menta' : 'bg-zinc-100'}`}>
        <div className="flex items-center gap-3">
          {estado === 'open' ? (
            <CircleCheck aria-hidden className="h-7 w-7 text-emerald-700" />
          ) : (
            <Unplug aria-hidden className="h-7 w-7 text-zinc-600" />
          )}
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">
            {estado === 'open' ? 'Conectado' : desligada ? 'Ainda não configurado' : 'Desconectado'}
          </h2>
        </div>

        {desligada ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-700">
            Falta o servidor da Evolution API e as chaves na Vercel (EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCIA e
            EVOLUTION_SEGREDO_WEBHOOK). Depois disso, esta tela mostra o QR code para ligar o número.
          </p>
        ) : estado === 'open' ? (
          <>
            <p className="mt-3 text-[13.5px] leading-relaxed text-emerald-950">
              Na conversa guiada aparece o botão <b>Enviar pelo WhatsApp</b>, e as respostas dos leads chegam sozinhas na aba Conversas.
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => pedir('desconectar')}
              className="mt-5 inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold hover:bg-zinc-50 disabled:opacity-50"
            >
              <Unplug aria-hidden className="h-4 w-4" /> Desligar da ferramenta
            </button>
          </>
        ) : qr ? (
          <div className="mt-4">
            <p className="text-[13.5px] leading-relaxed text-zinc-700">
              No celular do número: <b>WhatsApp → Configurações → Dispositivos conectados → Conectar um dispositivo</b>, e aponte para o código.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code para conectar o WhatsApp" className="mt-4 h-64 w-64 rounded-2xl bg-white p-2" />
            {codigo && <p className="mt-2 text-[12.5px] text-zinc-600">Ou digite o código no celular: <b className="tracking-[0.2em]">{codigo}</b></p>}
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-600">
              <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> Esperando o celular ler… O código vence em uns 40 segundos; se vencer, gere outro.
            </p>
            <button type="button" disabled={ocupado} onClick={() => pedir('conectar')} className="mt-3 text-[13px] font-bold underline underline-offset-2">
              Gerar outro QR code
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => pedir('conectar')}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            <QrCode aria-hidden className="h-4 w-4" /> {ocupado ? 'Gerando…' : 'Mostrar QR code'}
          </button>
        )}
        {erro && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800">{erro}</p>}
      </section>

      <aside className="rounded-[24px] bg-manteiga p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
          <ShieldAlert aria-hidden className="h-5 w-5" /> Como esta ligação funciona
        </h2>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-amber-950">
          <li><b>Toda mensagem sai do seu clique.</b> A ferramenta não envia sozinha, em fila nem em horário marcado.</li>
          <li><b>Só conversas com leads entram.</b> Mensagens de amigos, clientes antigos e grupos são ignoradas e não ficam salvas.</li>
          <li>
            <b>É uma ligação não oficial</b> (como um WhatsApp Web sempre aberto). O WhatsApp não permite isso nos termos de uso, então existe risco
            de bloqueio do número, maior se muita gente bloquear ou denunciar. Mensagens poucas, certeiras e personalizadas protegem o número.
          </li>
        </ul>
      </aside>
    </div>
  );
}
