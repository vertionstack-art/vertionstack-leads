import { Eye } from 'lucide-react';

/** "agora", "há 25 min", "há 3 h", "ontem", "há 4 dias" */
function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  const dias = Math.round(min / 1440);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * "O cliente abriu a proposta": o selo verde no lead, com a última abertura e
 * quantas vezes. Passar o mouse mostra a primeira e a última data. Não aparece
 * enquanto ninguém abriu.
 */
export default function SeloProposta({
  abertaEm,
  aberturas,
  primeiraEm,
}: {
  abertaEm: string | null;
  aberturas: number;
  primeiraEm?: string | null;
}) {
  if (!abertaEm || aberturas < 1) return null;
  return (
    <span
      title={`Primeira vez: ${quando(primeiraEm || abertaEm)} · Última vez: ${quando(abertaEm)}`}
      suppressHydrationWarning
      className="inline-flex items-center gap-1 rounded-full bg-menta px-2 py-0.5 text-[11px] font-bold text-emerald-950"
    >
      <Eye aria-hidden className="h-3 w-3" />
      Proposta aberta {haQuanto(abertaEm)}
      {aberturas > 1 && <span className="tabular-nums opacity-70">· {aberturas}×</span>}
    </span>
  );
}
