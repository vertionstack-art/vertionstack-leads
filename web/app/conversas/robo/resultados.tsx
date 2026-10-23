import { BarChart3 } from 'lucide-react';
import { ROTULO_TAREFA, type Tarefa } from '@/lib/copiloto-tipos';
import type { LinhaResultado, LinhaUso } from '@/lib/copiloto-resultados';

/**
 * "Resultados do copiloto": de onde saíram as mensagens enviadas e quantas
 * tiveram resposta, e quanto a IA trabalhou. Só leitura, sem JavaScript no
 * navegador.
 */

const POUCOS = 20;

function nomeDaOrigem(o: string): string {
  if (o === 'robo') return 'Robô do WhatsApp';
  if (o === 'manual') return 'Escrita por você ou do roteiro';
  const t = o.replace(/^copiloto:/, '') as Tarefa;
  return ROTULO_TAREFA[t] ? `Copiloto · ${ROTULO_TAREFA[t]}` : o;
}

function nomeDaTarefa(t: string): string {
  if (t === 'robo') return 'Robô do WhatsApp';
  if (t === 'sem registro') return 'Antes da medição';
  const x = t.replace(/^copiloto:/, '') as Tarefa;
  return ROTULO_TAREFA[x] ? `Copiloto · ${ROTULO_TAREFA[x]}` : t;
}

export default function ResultadosCopiloto({ envios, uso }: { envios: LinhaResultado[]; uso: LinhaUso[] }) {
  return (
    <section aria-labelledby="t-resultados" className="mt-8 rounded-[24px] bg-zinc-50 p-5 ring-1 ring-inset ring-zinc-200">
      <h2 id="t-resultados" className="flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em]">
        <BarChart3 aria-hidden className="h-4 w-4" /> Resultados do copiloto
      </h2>
      <p className="mt-1 max-w-[70ch] text-[12.5px] leading-snug text-zinc-600">
        Mensagens enviadas nos últimos 90 dias e quantas tiveram resposta do cliente em até 7 dias. Com menos de {POUCOS} envios o número ainda não diz muito, e
        resposta não prova que o texto foi melhor: o lead, o dia e o assunto também pesam. Resposta automática do WhatsApp Business conta como resposta.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-[13px] font-extrabold">De onde saiu cada mensagem</p>
          {envios.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-zinc-600">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <table className="mt-2 w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">
                  <th className="py-1 font-bold">Origem</th>
                  <th className="py-1 text-right font-bold">Enviadas</th>
                  <th className="py-1 text-right font-bold">Com resposta</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((l) => (
                  <tr key={l.origem} className="border-t border-zinc-200">
                    <td className="py-1.5 font-semibold">{nomeDaOrigem(l.origem)}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.enviadas}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {l.respondidas}
                      <span className="text-zinc-500"> ({Math.round((l.respondidas / l.enviadas) * 100)}%{l.enviadas < POUCOS ? ', poucos dados' : ''})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <p className="text-[13px] font-extrabold">Trabalho da IA nos últimos 30 dias</p>
          {uso.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-zinc-600">Nenhum pedido ainda.</p>
          ) : (
            <table className="mt-2 w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">
                  <th className="py-1 font-bold">Pedido</th>
                  <th className="py-1 text-right font-bold">Vezes</th>
                  <th className="py-1 text-right font-bold">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {uso.map((l) => (
                  <tr key={l.tarefa} className="border-t border-zinc-200">
                    <td className="py-1.5 font-semibold">{nomeDaTarefa(l.tarefa)}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.pedidos}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.segundos === null ? '—' : `${l.segundos.toString().replace('.', ',')} s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11.5px] text-zinc-500">A IA do seu PC não tem custo por pedido; o limite é o do dia, para não sobrecarregar a placa.</p>
        </div>
      </div>
    </section>
  );
}
