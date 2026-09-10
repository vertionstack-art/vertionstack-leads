import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import BotaoCopiar from './copiar';
import { estaLogado, exigeChave } from '@/lib/auth';
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
    <li className="relative pl-11 pb-7 last:pb-0">
      <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-roxo-600 text-[13px] font-semibold text-white">
        {n}
      </span>
      <span className="absolute left-[13.5px] top-8 bottom-0 w-px bg-zinc-200 last:hidden" />
      <h3 className="mb-1 text-[14px] font-semibold leading-tight">{titulo}</h3>
      <div className="text-[13.5px] leading-relaxed text-zinc-600">{children}</div>
    </li>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[12.5px] font-medium text-zinc-800">
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
  if (!(await estaLogado())) redirect('/login');

  const origem = await origemDoPainel();

  const tamanho = dados.tamanhoBytes ? `${Math.round(dados.tamanhoBytes / 1024)} KB` : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-roxo-600 ring-4 ring-roxo-100" />
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Vertion Leads</h1>
              <p className="text-[11px] leading-tight text-zinc-500">instalar a extensão</p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700"
          >
            ← Voltar ao painel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-8">
        {/* --------------------------------------------------- download */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-roxo-200 bg-gradient-to-br from-white to-roxo-50">
          <div className="flex flex-wrap items-center justify-between gap-5 p-7">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight">Extensão do Google Maps</h2>
              <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-zinc-600">
                É ela que varre o Maps e manda os comércios para cá. Instala em um minuto e
                não precisa da Chrome Web Store.
              </p>
              {dados.disponivel && (
                <p className="mt-3 text-[12px] text-zinc-500">
                  versão {dados.versao}
                  {tamanho && ` · ${tamanho}`}
                  {dados.arquivos && ` · ${dados.arquivos} arquivos`}
                </p>
              )}
            </div>

            {dados.disponivel ? (
              <a
                href={`/${dados.nomeArquivo}`}
                download
                className="rounded-xl bg-roxo-600 px-6 py-3.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-roxo-700"
              >
                Baixar extensão
              </a>
            ) : (
              <div className="max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
                O arquivo não foi gerado neste deploy. Baixe o repositório pelo GitHub e use a
                pasta <code className="rounded bg-amber-100 px-1">extension</code>.
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------------- instalação */}
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-7">
          <h2 className="mb-6 text-[16px] font-semibold tracking-tight">Como instalar</h2>
          <ol className="relative">
            <Passo n={1} titulo="Descompacte o arquivo baixado">
              Clique com o botão direito no <Tecla>vertion-leads-extensao.zip</Tecla> e escolha{' '}
              <em>Extrair tudo</em>. Guarde a pasta num lugar definitivo — se você apagar ou mover
              depois, o Chrome desativa a extensão.
            </Passo>

            <Passo n={2} titulo="Abra a página de extensões do Chrome">
              Copie <Tecla>chrome://extensions</Tecla> e cole na barra de endereço.
            </Passo>

            <Passo n={3} titulo="Ligue o Modo do desenvolvedor">
              É o botãozinho no canto superior direito da página. Sem ele o Chrome não deixa
              instalar por pasta.
            </Passo>

            <Passo n={4} titulo="Clique em “Carregar sem compactação”">
              O botão aparece no canto superior esquerdo depois que você liga o modo
              desenvolvedor. Escolha a pasta <Tecla>vertion-leads-extensao</Tecla> que você
              descompactou.
            </Passo>

            <Passo n={5} titulo="Aponte a extensão para este painel">
              Clique no ícone roxo na barra do Chrome, depois na engrenagem. Preencha o endereço
              do painel e a chave de acesso — os dois estão logo abaixo.
            </Passo>

            <Passo n={6} titulo="Teste a conexão">
              Ainda nas configurações da extensão, clique em <em>Testar conexão</em>. Se aparecer{' '}
              <em>“Conectado. O painel está gravando no banco de dados.”</em>, está pronto.
            </Passo>
          </ol>
        </section>

        {/* ----------------------------------------------- configuração */}
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-7">
          <h2 className="mb-1 text-[16px] font-semibold tracking-tight">O que preencher</h2>
          <p className="mb-5 text-[13.5px] text-zinc-600">
            Estes dois campos ficam na engrenagem da extensão.
          </p>

          <dl className="space-y-4">
            <div>
              <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Endereço do painel
              </dt>
              <dd className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5">
                <code className="truncate text-[13px] text-zinc-800">{origem}</code>
                <BotaoCopiar texto={origem} />
              </dd>
            </div>

            <div>
              <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Chave de acesso
              </dt>
              <dd className="text-[13.5px] leading-relaxed text-zinc-600">
                {exigeChave ? (
                  <>
                    É o valor da variável <Tecla>INGEST_TOKEN</Tecla> que está cadastrada na Vercel.
                    Por segurança ela não pode ser exibida aqui — a Vercel guarda esse tipo de
                    valor de forma que nem o painel consegue ler de volta. Use a mesma chave que
                    você cadastrou lá.
                  </>
                ) : (
                  <span className="block rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-amber-900">
                    <b>Nenhuma chave configurada.</b> Hoje qualquer pessoa que descubra o endereço
                    do painel consegue despejar dados nele. Crie a variável{' '}
                    <Tecla>INGEST_TOKEN</Tecla> na Vercel e faça um novo deploy.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* ---------------------------------------------------- usando */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-7">
          <h2 className="mb-5 text-[16px] font-semibold tracking-tight">Depois de instalar</h2>
          <div className="space-y-3.5 text-[13.5px] leading-relaxed text-zinc-600">
            <p>
              Abra o Google Maps numa aba, clique no ícone da extensão, escreva onde procurar e
              escolha os tipos de comércio. Clique em <em>Iniciar coleta</em> e vá fazer outra coisa.
            </p>
            <p>
              <b className="text-zinc-800">Prefira bairro a cidade inteira.</b> O Maps entrega no
              máximo algumas dezenas de resultados por busca, então varrer “Savassi BH” e depois
              “Funcionários BH” rende bem mais que “Belo Horizonte” de uma vez só.
            </p>
            <p>
              A aba do Maps vai trocar de página sozinha enquanto trabalha — é a extensão abrindo a
              ficha de quem parece não ter site, para confirmar antes de você gastar uma ligação.
              Não mexa nessa aba; o resto do navegador pode usar normalmente.
            </p>
            <p>
              Rodar de novo no mesmo bairro <b className="text-zinc-800">não apaga</b> seus status
              nem suas anotações. Só atualiza o que veio do Google.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
