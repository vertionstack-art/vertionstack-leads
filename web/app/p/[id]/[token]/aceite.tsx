'use client';

import { useState } from 'react';

/**
 * O aceite online no fim da proposta: nome de quem aceita e "li e aceito".
 * Fica registrado com data, hora e de onde veio (app/api/p/aceite); o lead
 * passa para "Fechado" no CRM e no Financeiro de quem mandou a proposta.
 */
export default function AceiteProposta({ segmento, token, empresa }: { segmento: string; token: string; empresa: string }) {
  const [nome, setNome] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aceito, setAceito] = useState<string | null>(null);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 3) return setErro('Escreva o seu nome completo.');
    if (!concordo) return setErro('Marque que leu e aceita a proposta.');
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/p/aceite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, token, nome: nome.trim() }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setAceito(j.em);
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Não consegui registrar o aceite. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (aceito) {
    return (
      <section className="aceite aceite--feito">
        <h2 className="secao-titulo">Proposta aceita</h2>
        <p>
          Obrigado, {nome.trim().split(/\s+/)[0]}! O aceite foi registrado em{' '}
          {new Date(aceito).toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.{' '}
          {empresa} já foi avisado e vai falar com você para os próximos passos.
        </p>
      </section>
    );
  }

  return (
    <section className="aceite">
      <h2 className="secao-titulo">Aceitar a proposta</h2>
      <form onSubmit={aceitar} noValidate>
        <label htmlFor="aceite-nome" className="aceite-rotulo">Seu nome completo</label>
        <input
          id="aceite-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value.slice(0, 80))}
          autoComplete="name"
          className="aceite-campo"
        />
        <label className="aceite-concordo">
          <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} />
          <span>Li e aceito esta proposta: o valor, o que está incluso e as condições acima.</span>
        </label>
        {erro && <p role="alert" className="aceite-erro">{erro}</p>}
        <button type="submit" disabled={enviando} className="aceite-botao">
          {enviando ? 'Registrando…' : 'Aceitar proposta'}
        </button>
        <p className="aceite-nota">O aceite fica registrado com a data e a hora. Nenhum pagamento é feito aqui.</p>
      </form>
    </section>
  );
}
