'use client';

import { useState } from 'react';

/**
 * Só o botão é client component. O endereço em si vem pronto do servidor
 * (via cabeçalho Host), porque montá-lo no navegador faria o texto do HTML
 * do servidor divergir do texto do cliente e quebrar a hidratação.
 */
export default function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1400);
      }}
      className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11.5px] font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700"
    >
      {copiado ? 'copiado!' : 'copiar'}
    </button>
  );
}
