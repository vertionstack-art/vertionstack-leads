import Link from 'next/link';
import type { Metadata } from 'next';
import { DocumentoLegal, Lista, Secao } from '../documento-legal';
import { DATA_TERMOS, responsavel } from '@/lib/legal';

export const metadata: Metadata = { title: 'Política de privacidade — Vertion Leads' };

export default function Privacidade() {
  const r = responsavel();
  const email = (
    <a href={`mailto:${r.email}`} className="font-semibold text-roxo-700 underline underline-offset-2">
      {r.email}
    </a>
  );

  return (
    <DocumentoLegal titulo="Política de privacidade" atualizado={DATA_TERMOS}>
      <p>
        Esta política explica quais dados o <b>Vertion Leads</b> coleta, para quê, com quem compartilha e quais são os
        seus direitos pela Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). O controlador dos dados é{' '}
        <b>{r.nome}</b>
        {r.documento && <> (CNPJ/CPF {r.documento})</>}. Fale com a gente sobre privacidade pelo e-mail {email}.
      </p>

      <Secao n={1} titulo="Dados que coletamos sobre você">
        <Lista
          itens={[
            <>
              <b>Cadastro:</b> nome e e-mail. A senha é guardada pelo serviço de login em formato embaralhado; nem nós
              conseguimos lê-la.
            </>,
            <>
              <b>Perfil (opcional):</b> foto, como você aparece no painel e os dados da sua empresa que vão nas propostas
              (nome, WhatsApp, e-mail, site, cidade, CNPJ ou CPF e meta de vendas).
            </>,
            <>
              <b>Uso da ferramenta:</b> os leads que você guarda, anotações, propostas, etapas do CRM, as buscas que fez
              (nicho e lugar) e a contagem de buscas e leads do seu plano.
            </>,
            <>
              <b>Pagamento:</b> plano, validade, forma de pagamento (cartão ou Pix) e o histórico de valores e datas. Os
              dados do cartão ficam com a Stripe; nós não os recebemos.
            </>,
            <>
              <b>Segurança:</b> endereço IP, cidade e país aproximados, navegador e data e hora de logins e acessos. Servem
              para barrar invasões e abusos e são guardados por 6 meses, como exige o art. 15 do Marco Civil da Internet
              (Lei 12.965/2014), e depois apagados.
            </>,
          ]}
        />
      </Secao>

      <Secao n={2} titulo="Dados dos comércios (leads)">
        <p>
          A busca traz dados que os próprios comércios publicam: nome, telefone, endereço, site, nota e avaliações no
          Google e links públicos (como Linktree ou WhatsApp divulgado). Esses dados são tratados com base no{' '}
          <b>legítimo interesse</b> de oferecer serviços ao comércio, ficam visíveis só para a conta que os buscou e não
          são vendidos nem publicados.
        </p>
        <p>
          Se você é dono de um comércio e não quer que seus dados apareçam na ferramenta, escreva para {email} e
          removemos.
        </p>
        <p>
          Quando um cliente abre o link de uma proposta, registramos a data, a hora e quantas vezes ela foi aberta, para
          quem enviou saber que ela foi vista.
        </p>
      </Secao>

      <Secao n={3} titulo="Para que usamos">
        <Lista
          itens={[
            'fazer a ferramenta funcionar e guardar o seu trabalho (execução do contrato — art. 7º, V, da LGPD);',
            'cobrar o plano e emitir o histórico de pagamentos (execução do contrato e obrigações legais — art. 7º, II e V, da LGPD);',
            'proteger a sua conta e a ferramenta contra invasão, fraude e abuso do teste grátis (legítimo interesse e prevenção à fraude — arts. 7º, IX, e 11, II, g, da LGPD);',
            'mandar e-mails sobre a conta, como confirmação de cadastro e troca de senha.',
          ]}
        />
        <p>Não vendemos dados, não usamos publicidade e não seguimos você por outros sites.</p>
      </Secao>

      <Secao n={4} titulo="Teste grátis e prevenção de abuso">
        <p>
          Para o teste grátis ser um por pessoa, guardamos <b>códigos embaralhados</b> (que não permitem recuperar o dado
          original) do navegador, do computador, da internet usada junto com o navegador e do e-mail. Eles continuam
          guardados mesmo depois que a conta é excluída, para impedir que o teste seja usado de novo criando outra conta.
        </p>
      </Secao>

      <Secao n={5} titulo="Cookies e armazenamento no navegador">
        <Lista
          itens={[
            <>
              <b>Sessão de login:</b> mantém você conectado. Sem ele a ferramenta não funciona.
            </>,
            <>
              <b>Identificador do navegador (vl_disp):</b> um código aleatório, válido por 2 anos, usado só para a
              prevenção de abuso do teste grátis.
            </>,
            <>
              <b>Preferências da tela:</b> nichos e cidade da última busca ficam guardados no seu próprio navegador, para
              você não digitar de novo.
            </>,
          ]}
        />
        <p>Não usamos cookies de publicidade nem de análise de terceiros.</p>
      </Secao>

      <Secao n={6} titulo="Com quem compartilhamos">
        <p>Só com os serviços que fazem a ferramenta funcionar, cada um com o mínimo necessário:</p>
        <Lista
          itens={[
            <>
              <b>Supabase</b>: banco de dados e login (servidores em São Paulo).
            </>,
            <>
              <b>Vercel</b>: hospedagem do site.
            </>,
            <>
              <b>Stripe</b>: pagamentos com cartão e Pix.
            </>,
            <>
              <b>Resend</b>: envio dos e-mails de cadastro e senha.
            </>,
            <>
              <b>Google</b>: busca de comércios. Enviamos o nicho e o lugar da busca, não os seus dados.
            </>,
            <>
              <b>Cloudflare</b>: endereço do domínio (DNS).
            </>,
          ]}
        />
        <p>
          Alguns desses serviços têm servidores fora do Brasil; nesses casos a transferência segue as regras da LGPD.
          Também podemos fornecer dados quando a lei, uma ordem judicial ou a requisição de autoridade competente exigir (arts. 10 e 22 do Marco Civil da Internet).
        </p>
      </Secao>

      <Secao n={7} titulo="Por quanto tempo guardamos">
        <Lista
          itens={[
            'Dados da conta, leads, propostas e CRM: enquanto a conta existir.',
            'Registros de acesso (IP, data e hora): 6 meses, por obrigação do Marco Civil da Internet (art. 15 da Lei 12.965/2014).',
            'Códigos embaralhados contra abuso do teste: mesmo depois de excluir a conta (seção 4).',
            'Registros de pagamento: a Stripe mantém pelo prazo que a lei exige.',
          ]}
        />
        <p>
          Ao excluir a conta em <Link href="/perfil" className="font-semibold text-roxo-700 underline underline-offset-2">Meu perfil</Link>,
          o login, os leads, as propostas e o CRM são apagados e a assinatura no cartão é cancelada.
        </p>
      </Secao>

      <Secao n={8} titulo="Seus direitos">
        <p>Pela LGPD (art. 18), você pode a qualquer momento:</p>
        <Lista
          itens={[
            'saber se tratamos seus dados e ter acesso a eles;',
            'corrigir dados (a maioria você mesmo corrige em Meu perfil);',
            'levar seus dados com você (a lista de leads sai em CSV no painel);',
            'pedir a exclusão (você mesmo exclui a conta em Meu perfil);',
            'saber com quem compartilhamos e se opor a algum tratamento.',
          ]}
        />
        <p>Para qualquer pedido, escreva para {email}. Respondemos em até 15 dias (art. 19, II, da LGPD). Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      </Secao>

      <Secao n={9} titulo="Segurança">
        <p>
          Os dados ficam em banco com acesso bloqueado ao navegador, toda consulta é limitada à sua própria conta, as
          conexões são criptografadas (HTTPS) e há limite de tentativas no login e nas ações da ferramenta. Nenhum sistema
          é invulnerável; se acontecer um incidente que possa trazer risco ou dano relevante a você, avisaremos você e a ANPD (art. 48 da LGPD).
        </p>
      </Secao>

      <Secao n={10} titulo="Menores de idade">
        <p>A ferramenta é para uso profissional e não se destina a menores de 18 anos.</p>
      </Secao>

      <Secao n={11} titulo="Mudanças nesta política">
        <p>
          Podemos atualizar esta política. A data no topo mostra a versão em vigor, e mudanças importantes são avisadas
          dentro da ferramenta antes de valer.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
