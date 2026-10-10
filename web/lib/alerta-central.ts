/**
 * Alerta por e-mail para o administrador quando alguém mexe na central:
 *
 * - alguém sem ser o administrador abriu o endereço secreto (o endereço vazou);
 * - um link de liberação de aparelho errado foi usado;
 * - errou o código do Google Authenticator;
 * - entrou na central (se não foi você, é para agir na hora);
 * - errou a senha ou o código ao apagar um usuário.
 *
 * No máximo um e-mail por tipo a cada 10 minutos (tabela alertas_central),
 * com a contagem do que aconteceu no meio — uma tentativa em série não lota
 * a caixa de entrada. Nunca derruba a requisição: erro só vai para o log.
 */

import { db } from './sql';
import { enviarEmail, emailLigado } from './email';

export type TipoAlerta = 'endereco_por_outro' | 'liberacao_errada' | 'codigo_errado' | 'entrou' | 'apagar_errado';

const TEXTO: Record<TipoAlerta, { assunto: string; titulo: string; explicacao: string; urgente: boolean }> = {
  endereco_por_outro: {
    assunto: 'Alerta: alguém abriu o endereço secreto da central',
    titulo: 'Alguém abriu o endereço da central.',
    explicacao: 'Uma pessoa que não é o administrador abriu o endereço secreto da central. Ela viu "não encontrado" e não entrou, mas isso indica que o endereço pode ter vazado.',
    urgente: true,
  },
  liberacao_errada: {
    assunto: 'Alerta: tentativa com link de liberação errado',
    titulo: 'Tentaram liberar um aparelho com um link errado.',
    explicacao: 'Alguém logado com o e-mail de administrador usou um link de liberação inválido. A central não abriu.',
    urgente: true,
  },
  codigo_errado: {
    assunto: 'Alerta: código errado na central',
    titulo: 'Erraram o código do Google Authenticator.',
    explicacao: 'Alguém já logado com a sua senha errou o código de 6 números da central. Depois de 6 erros o acesso trava por 15 minutos.',
    urgente: true,
  },
  entrou: {
    assunto: 'Acesso à central do Vertion Leads',
    titulo: 'Alguém entrou na central agora.',
    explicacao: 'A central foi aberta com a sua senha e o código do Authenticator. Se foi você, pode ignorar este e-mail.',
    urgente: false,
  },
  apagar_errado: {
    assunto: 'Alerta: tentativa de apagar usuário recusada',
    titulo: 'Tentaram apagar um usuário e erraram a senha ou o código.',
    explicacao: 'Na central, alguém tentou apagar uma conta e a confirmação falhou. Nada foi apagado.',
    urgente: true,
  },
};

function destinatarios(): string[] {
  return (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
}

export async function alertarCentral(tipo: TipoAlerta, origem: { headers: Headers } | null, detalhe?: string): Promise<void> {
  try {
    if (!emailLigado() || !destinatarios().length) return;
    const sql = db();
    // só passa um por tipo a cada 10 minutos; o resto vira contagem
    const [r] = await sql`
      insert into alertas_central (tipo, enviado_em, repeticoes) values (${tipo}, now(), 0)
      on conflict (tipo) do update set
        enviado_em  = case when alertas_central.enviado_em < now() - interval '10 minutes' then now() else alertas_central.enviado_em end,
        repeticoes  = case when alertas_central.enviado_em < now() - interval '10 minutes' then 0 else alertas_central.repeticoes + 1 end
      returning (repeticoes = 0) as enviar, enviado_em
    `;
    if (!r?.enviar) return;

    const h = origem?.headers;
    const ip = h?.get('x-forwarded-for')?.split(',')[0]?.trim() || h?.get('x-real-ip') || 'desconhecido';
    const cidade = [h?.get('x-vercel-ip-city'), h?.get('x-vercel-ip-country-region'), h?.get('x-vercel-ip-country')]
      .filter(Boolean)
      .map((x) => decodeURIComponent(x!))
      .join(', ');
    const navegador = (h?.get('user-agent') || 'desconhecido').slice(0, 160);
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const t = TEXTO[tipo];

    const paragrafos = [
      t.explicacao,
      `**Quando:** ${quando} (horário de Brasília)`,
      `**De onde:** IP ${ip}${cidade ? ` · ${cidade}` : ''}`,
      `**Navegador:** ${navegador}`,
      ...(detalhe ? [`**Detalhe:** ${detalhe}`] : []),
      t.urgente
        ? 'Se não foi você: troque a sua senha agora e peça para trocar a chave de liberação (ADMIN_CHAVE) e o endereço da central (ADMIN_CAMINHO) na Vercel. Se repetir nos próximos minutos, este aviso não chega de novo antes de 10 minutos.'
        : 'Se não foi você: troque a sua senha agora e peça para trocar a chave de liberação (ADMIN_CHAVE) na Vercel.',
    ];
    for (const para of destinatarios()) {
      await enviarEmail(para, t.assunto, { previa: t.titulo, titulo: t.titulo, paragrafos });
    }
  } catch (e) {
    console.error('[alerta central]', tipo, e);
  }
}
