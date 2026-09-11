'use client';

/**
 * Salvar em PDF é a propria impressao do navegador: "Destino > Salvar
 * como PDF". Nao vale carregar uma biblioteca de PDF no cliente para
 * refazer, pior, o que o navegador ja faz com o CSS de impressao.
 */
export default function BotaoImprimir() {
  return (
    <>
      <div className="barra-imprimir">
        <button className="btn-imprimir" onClick={() => window.print()}>
          Baixar em PDF
        </button>
      </div>
      <p className="dica-imprimir">
        Na janela que abrir, escolha <b>Destino: Salvar como PDF</b>.
      </p>
    </>
  );
}
