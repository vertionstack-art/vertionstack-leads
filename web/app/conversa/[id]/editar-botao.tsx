'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine } from 'lucide-react';
import EditarLeadModal from '@/app/editar-lead-modal';

/** "Editar lead" no topo da conversa: corrigir o WhatsApp que não funcionou sem sair daqui */
export default function EditarBotao({ leadId }: { leadId: string }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
      >
        <PencilLine aria-hidden className="h-4 w-4" /> Editar lead
      </button>
      {aberto && <EditarLeadModal leadId={leadId} aoFechar={() => setAberto(false)} aoSalvar={() => router.refresh()} />}
    </>
  );
}
