import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Download, KeyRound, MapPin, Puzzle } from 'lucide-react';
import BotaoCopiar from './copiar';
import { sessaoAtual } from '@/lib/conta';
import { LIMITES } from '@/lib/planos';
import info from '@/lib/extensao-info.json';

export const dynamic = 'force-dynamic';

interface InfoExtensao {
  disponivel: boolean;
  versao?: string;
  nomeArquivo?: string;
  tamanhoBytes?: number;
  arquivos?: number;
  geradoEm?: string;
}

const dados = info as InfoExtensao;

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-[20px] bg-zinc-50 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta text-[14px] font-extrabold text-white tabular-nums">
        {n}
      </span>
      <div>
        <h3 className="text-[14.5px] font-extrabold leading-snug">{titulo}</h3>
        <div className="mt-1 text-[13.5px] leading-relaxed text-zinc-600">{children}</div>
      </div>
    </li>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-white px-1.5 py-0.5 text-[12.5px] font-semibold text-tinta ring-1 ring-inset ring-zinc-200">
      {children}
    </code>
  );
}

/** o endereço público do painel, lido do cabeçalho da própria requisição */
async function origemDoPainel() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const protocolo = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocolo}://${host}`;
}

export default async function PaginaExtensao() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');

  const origem = await origemDoPainel();
  const aparelhos = LIMITES[sessao.plano].aparelhos;
  const tamanho = dados.tamanhoBytes ? `${Math.round(dados.tamanhoBytes / 1024)} KB` : null;

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1080px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Extensão</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">Instale uma vez e colete os comércios direto do Google Maps</p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>

        {/* --------------------------------------------------- download */}
        <section className="mt-9 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-6 rounded-[24px] bg-tinta p-7 text-white">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Puzzle aria-hidden className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">Extensão do Google Maps</h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-white/70">
                É ela que varre o Maps e manda os comércios para o seu painel. Instala em um minuto e não precisa da
                Chrome Web Store.
              </p>
            </div>
            {dados.disponivel ? (
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={`/${dados.nomeArquivo}`}
                  download
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ceu px-6 text-[14px] font-extrabold text-tinta transition-colors hover:bg-white"
                >
                  <Download aria-hidden className="h-4 w-4" strokeWidth={2.4} />
                  Baixar extensão
                </a>
                <p className="text-[12px] font-medium text-white/55">
                  versão {dados.versao}
                  {tamanho && ` · ${tamanho}`}
                </p>
              </div>
            ) : (
              <p className="rounded-2xl bg-white/10 px-4 py-3 text-[13px] leading-relaxed text-white/80">
                O arquivo não foi gerado neste deploy. Fale com o suporte para receber a extensão.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[24px] bg-ceu p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tinta/60">Endereço do painel</p>
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                <code className="truncate text-[13px] font-semibold">{origem}</code>
                <BotaoCopiar texto={origem} />
              </div>
            </div>
            <div className="flex-1 rounded-[24px] bg-lavanda p-6">
              <div className="flex items-center gap-2">
                <KeyRound aria-hidden className="h-4 w-4" />
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tinta/60">Chave de acesso</p>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-700">
                É só sua e vale em até {aparelhos} computadores. Gere a chave, copie e cole na engrenagem da extensão.
              </p>
              <Link
                href="/conta"
                className="mt-4 inline-flex min-h-[40px] items-center rounded-full bg-tinta px-4 text-[13px] font-bold text-white transition-colors hover:bg-tinta-70"
              >
                Gerar minha chave
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- instalação */}
        <section className="mt-10">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Como instalar</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            <Passo n={1} titulo="Descompacte o arquivo baixado">
              Clique com o botão direito no <Tecla>vertion-leads-extensao.zip</Tecla> e escolha <em>Extrair tudo</em>.
              Guarde a pasta num lugar definitivo: se apagar ou mover depois, o Chrome desativa a extensão.
            </Passo>
            <Passo n={2} titulo="Abra a página de extensões do Chrome">
              Copie <Tecla>chrome://extensions</Tecla> e cole na barra de endereço.
            </Passo>
            <Passo n={3} titulo="Ligue o Modo do desenvolvedor">
              É o botãozinho no canto superior direito da página. Sem ele o Chrome não deixa instalar por pasta.
            </Passo>
            <Passo n={4} titulo="Clique em “Carregar sem compactação”">
              Aparece no canto superior esquerdo depois que o modo desenvolvedor liga. Escolha a pasta{' '}
              <Tecla>vertion-leads-extensao</Tecla> que você descompactou.
            </Passo>
            <Passo n={5} titulo="Ligue a extensão ao seu painel">
              Clique no ícone roxo na barra do Chrome e depois na engrenagem. Cole o endereço do painel e a sua chave de
              acesso, os dois aqui em cima.
            </Passo>
            <Passo n={6} titulo="Teste a conexão">
              Ainda na engrenagem, clique em <em>Testar conexão</em>. Se aparecer <em>“Conectado”</em> com o seu nome, está
              pronto.
            </Passo>
          </ol>
        </section>

        {/* ---------------------------------------------------- usando */}
        <section className="mt-10 rounded-[24px] border border-zinc-200 p-6 md:p-7">
          <div className="flex items-center gap-2.5">
            <MapPin aria-hidden className="h-5 w-5" />
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Depois de instalar</h2>
          </div>
          <div className="mt-4 grid gap-x-8 gap-y-3.5 text-[13.5px] leading-relaxed text-zinc-600 md:grid-cols-2">
            <p>
              Abra o Google Maps numa aba, clique no ícone da extensão, escreva onde procurar e escolha os tipos de comércio.
              Clique em <em>Iniciar coleta</em> e vá fazer outra coisa.
            </p>
            <p>
              <b className="text-tinta">Prefira bairro a cidade inteira.</b> O Maps entrega no máximo algumas dezenas de
              resultados por busca, então varrer “Savassi BH” e depois “Funcionários BH” rende bem mais que “Belo Horizonte”
              de uma vez só.
            </p>
            <p>
              A aba do Maps troca de página sozinha enquanto trabalha: é a extensão abrindo a ficha de quem parece não ter
              site, para confirmar antes de você gastar uma ligação. Não mexa nessa aba; o resto do navegador pode usar
              normalmente.
            </p>
            <p>
              Rodar de novo no mesmo bairro <b className="text-tinta">não apaga</b> seus status nem suas anotações. Só
              atualiza o que veio do Google.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
