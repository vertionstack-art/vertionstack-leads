'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';

const LADO = 256;

/**
 * Reduz a foto no próprio navegador: recorta o quadrado do centro e encolhe
 * para 256×256. Uma foto de celular de 4 MB vira uns 15 KB — o servidor
 * nunca recebe o arquivo original.
 */
function reduzir(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const x = (img.naturalWidth - lado) / 2;
      const y = (img.naturalHeight - lado) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = LADO;
      canvas.height = LADO;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('sem canvas'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, lado, lado, 0, 0, LADO, LADO);
      URL.revokeObjectURL(url);
      // WebP onde o navegador sabe gerar; senão JPEG
      const webp = canvas.toDataURL('image/webp', 0.86);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}

export default function FotoDePerfil({ inicial, fotoInicial }: { inicial: string; fotoInicial: string | null }) {
  const [foto, setFoto] = useState<string | null>(fotoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function enviar(corpo: { foto: string } | null) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/perfil/foto', {
        method: corpo ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const d = await r.json();
      if (!d.ok) setErro(d.erro || 'Não consegui salvar a foto.');
      else setFoto(d.foto);
    } catch {
      setErro('Falha de rede.');
    } finally {
      setOcupado(false);
    }
  }

  async function escolheu(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(arquivo.type) && !/\.(jpe?g|png|webp|heic)$/i.test(arquivo.name)) {
      setErro('Escolha uma foto JPG ou PNG.');
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      setErro('Essa foto é grande demais (máximo 15 MB).');
      return;
    }
    try {
      await enviar({ foto: await reduzir(arquivo) });
    } catch {
      setErro('Não consegui abrir essa imagem. Tente outra foto.');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <button
        type="button"
        onClick={() => campo.current?.click()}
        disabled={ocupado}
        aria-label="Trocar foto de perfil"
        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-[28px] bg-roxo-200 disabled:opacity-60"
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="Sua foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[36px] font-extrabold uppercase text-tinta">{inicial}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-tinta/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera aria-hidden className="h-6 w-6 text-white" />
        </span>
      </button>
      <div>
        <p className="text-[13px] font-bold">Foto de perfil</p>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">JPG ou PNG. A gente recorta em quadrado.</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => campo.current?.click()}
            disabled={ocupado}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:opacity-60"
          >
            <Camera aria-hidden className="h-4 w-4" />
            {ocupado ? 'Salvando…' : foto ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {foto && (
            <button
              type="button"
              onClick={() => enviar(null)}
              disabled={ocupado}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[12.5px] font-bold text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-60"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Remover
            </button>
          )}
        </div>
        {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{erro}</p>}
      </div>
      <input ref={campo} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={escolheu} className="sr-only" tabIndex={-1} aria-hidden />
    </div>
  );
}
