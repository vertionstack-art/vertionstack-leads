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
      className="shrink-0 rounded-full bg-tinta px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-tinta-70"
    >
      {copiado ? 'Copiado!' : 'Copiar'}
    </button>
  );
}
