import Image from 'next/image';

/**
 * A logo da Vertion (as duas setas roxas, public/logo.png). Sobre fundo claro
 * vai solta; sobre o preto (trilho, cartão do login) vai dentro de um
 * quadrado branco, para o roxo não brigar com o fundo escuro.
 */
export default function Logo({ tamanho = 40, emQuadro = false }: { tamanho?: number; emQuadro?: boolean }) {
  const marca = (
    <Image src="/logo.png" alt="" width={512} height={512} priority className="h-auto" style={{ width: emQuadro ? tamanho * 0.6 : tamanho }} />
  );
  if (!emQuadro) return <span className="inline-flex shrink-0" aria-hidden>{marca}</span>;
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-2xl bg-white"
      style={{ width: tamanho, height: tamanho }}
    >
      {marca}
    </span>
  );
}
