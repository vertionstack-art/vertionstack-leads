'use client';

import { useState } from 'react';
import { CreditCard, QrCode } from 'lucide-react';

async function ir(rota: string, corpo: Record<string, string>): Promise<string | null> {
  const r = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const d = await r.json().catch(() => ({}));
  if (d.ok && d.url) {
    window.location.assign(d.url);
    return null;
  }
  return d.erro || 'Não consegui abrir o pagamento.';
}

/** os dois jeitos de assinar um plano: cartão (renova sozinho) ou Pix (um mês) */
export function BotoesAssinar({ plano, nome, escuro }: { plano: 'basic' | 'pro'; nome: string; escuro: boolean }) {
  const [ocupado, setOcupado] = useState<'cartao' | 'pix' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function pagar(forma: 'cartao' | 'pix') {
    setOcupado(forma);
    setErro(null);
    const e = await ir('/api/pagamento/checkout', { plano, forma });
    if (e) {
      setErro(e);
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => pagar('cartao')}
        disabled={ocupado !== null}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-[13.5px] font-bold transition-colors disabled:opacity-60 ${
          escuro ? 'bg-ceu text-tinta hover:bg-white' : 'bg-tinta text-white hover:bg-tinta-70'
        }`}
      >
        <CreditCard aria-hidden className="h-4 w-4" />
        {ocupado === 'cartao' ? 'Abrindo…' : `Assinar o ${nome} no cartão`}
      </button>
      <button
        onClick={() => pagar('pix')}
        disabled={ocupado !== null}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border text-[13.5px] font-bold transition-colors disabled:opacity-60 ${
          escuro ? 'border-white/30 text-white hover:border-white' : 'border-zinc-300 bg-white text-tinta hover:border-zinc-500'
        }`}
      >
        <QrCode aria-hidden className="h-4 w-4" />
        {ocupado === 'pix' ? 'Abrindo…' : 'Pagar 1 mês no Pix'}
      </button>
      {erro && (
        <p role="alert" className={`text-center text-[12.5px] font-semibold ${escuro ? 'text-white' : 'text-red-700'}`}>
          {erro}
        </p>
      )}
    </div>
  );
}

/** para quem já assina no cartão: trocar cartão, ver faturas, cancelar */
export function BotaoGerenciar({ escuro }: { escuro?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={async () => {
          setOcupado(true);
          setErro(null);
          const e = await ir('/api/pagamento/portal', {});
          if (e) {
            setErro(e);
            setOcupado(false);
          }
        }}
        disabled={ocupado}
        className={`flex min-h-[44px] w-full items-center justify-center rounded-full border text-[13.5px] font-bold transition-colors disabled:opacity-60 ${
          escuro ? 'border-white/30 text-white hover:border-white' : 'border-zinc-300 bg-white text-tinta hover:border-zinc-500'
        }`}
      >
        {ocupado ? 'Abrindo…' : 'Gerenciar assinatura'}
      </button>
      {erro && <p role="alert" className="mt-2 text-center text-[12.5px] font-semibold text-red-700">{erro}</p>}
    </div>
  );
}
