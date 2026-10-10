import Link from 'next/link';
import type { Metadata } from 'next';
import { DocumentoLegal, Lista, Secao } from '../documento-legal';
import { DATA_TERMOS, responsavel } from '@/lib/legal';
import { LIMITES, PLANOS_A_VENDA, reais } from '@/lib/planos';

export const metadata: Metadata = { title: 'Termos de uso — Vertion Leads' };

export default function Termos() {
  const r = responsavel();
  const pagos = PLANOS_A_VENDA.filter((p) => p.precoCentavos > 0);

  return (
    <DocumentoLegal titulo="Termos de uso" atualizado={DATA_TERMOS}>
      <p>
        Estes termos valem para quem usa o <b>Vertion Leads</b> (leads.vertionstack.com), ferramenta mantida por{' '}
        <b>{r.nome}</b>
        {r.documento && <> (CNPJ/CPF {r.documento})</>}. Ao criar a conta, você concorda com eles e com a{' '}
        <Link href="/privacidade" className="font-semibold text-roxo-700 underline underline-offset-2">Política de privacidade</Link>.
        Dúvidas: <a href={`mailto:${r.email}`} className="font-semibold text-roxo-700 underline underline-offset-2">{r.email}</a>.
      </p>

      <Secao n={1} titulo="O que a ferramenta faz">
        <p>
          O Vertion Leads ajuda profissionais que vendem sites a encontrar comércios sem site próprio e a organizar o
          trabalho de venda: busca de comércios em fontes públicas (como o Google), classificação, temperatura do lead,
          textos de abordagem, proposta comercial, CRM e acompanhamento financeiro.
        </p>
        <p>
          As informações dos comércios vêm de fontes públicas e podem estar desatualizadas ou incompletas: telefone que
          mudou, site que voltou ao ar, comércio que fechou. A ferramenta não garante que um lead vá responder nem que a
          venda vá acontecer.
        </p>
      </Secao>

      <Secao n={2} titulo="Conta">
        <Lista
          itens={[
            'Cada conta é de uma pessoa só. Não compartilhe a sua senha.',
            'Você é responsável pelo que for feito com a sua conta. Se desconfiar que alguém entrou nela, troque a senha e nos avise.',
            'Os dados do cadastro precisam ser verdadeiros, e o e-mail precisa ser seu (ele é confirmado no cadastro).',
          ]}
        />
      </Secao>

      <Secao n={3} titulo="Teste grátis">
        <p>
          A conta nova ganha um teste grátis de {LIMITES.gratis.semana} leads e {LIMITES.gratis.buscas} buscas, sem
          prazo e sem pedir cartão. O teste é <b>um por pessoa</b>: criar várias contas para usá-lo de novo não é
          permitido, e a ferramenta pode recusar o teste quando identificar que ele já foi usado no mesmo computador,
          navegador, internet ou e-mail. Se isso acontecer por engano, fale com a gente.
        </p>
      </Secao>

      <Secao n={4} titulo="Planos e pagamento">
        <p>Os planos à venda hoje:</p>
        <Lista
          itens={pagos.map((p) => (
            <>
              <b>{p.nome}</b>: {reais(p.precoCentavos)}
              {p.periodo} — até {LIMITES[p.plano].semana} leads novos por semana e {LIMITES[p.plano].buscas} buscas no Google
              {p.plano === 'semanal' ? ' nos 7 dias' : ' por mês'}.
            </>
          ))}
        />
        <Lista
          itens={[
            <>
              <b>No cartão</b>, o Basic e o Pro são uma assinatura que renova sozinha todo mês, na mesma data, até você
              cancelar.
            </>,
            <>
              <b>No Pix</b>, cada pagamento libera 31 dias e <b>não renova sozinho</b>. O plano de 7 dias é um pagamento
              único (cartão ou Pix) que libera 7 dias e também não renova.
            </>,
            'Os pagamentos são processados pela Stripe. Nós não recebemos nem guardamos os dados do seu cartão.',
            'Quando o plano vence sem renovação, a conta volta ao teste grátis: seus leads, o CRM e as propostas continuam acessíveis, mas a busca de leads novos para.',
            'Os preços podem mudar para novas contratações. Quem já assina é avisado antes de qualquer mudança no valor da renovação.',
          ]}
        />
      </Secao>

      <Secao n={5} titulo="Cancelamento e reembolso">
        <Lista
          itens={[
            'Você pode cancelar a assinatura a qualquer momento em Planos → Gerenciar assinatura. O plano continua valendo até o fim do período já pago e não é cobrado de novo.',
            <>
              Pelo Código de Defesa do Consumidor (art. 49), você pode desistir da <b>primeira contratação</b> em até 7
              dias depois do pagamento e receber o valor de volta. Para isso, escreva para{' '}
              <a href={`mailto:${r.email}`} className="font-semibold text-roxo-700 underline underline-offset-2">{r.email}</a>.
            </>,
            'Fora desse caso, períodos já pagos e usados não são devolvidos.',
          ]}
        />
      </Secao>

      <Secao n={6} titulo="Uso permitido e responsabilidade de quem prospecta">
        <p>
          A ferramenta entrega os contatos; <b>a abordagem é sua</b>. Ao usar os leads, você se compromete a:
        </p>
        <Lista
          itens={[
            'abordar os comércios de forma individual e respeitosa, sem envio em massa automatizado (spam), e parar de contatar quem pedir;',
            'respeitar a Lei Geral de Proteção de Dados (LGPD), o Código de Defesa do Consumidor e as regras do WhatsApp, do e-mail e de qualquer outro canal que usar;',
            'usar os dados só para oferecer os seus serviços, sem revender, publicar ou repassar as listas para terceiros;',
            'não tentar burlar os limites dos planos, o teste grátis ou a segurança da ferramenta, nem acessá-la por robôs ou programas que não sejam a própria ferramenta.',
          ]}
        />
        <p>
          Quem desrespeitar estas regras pode ter a conta suspensa ou encerrada. Os textos e propostas gerados pela
          ferramenta são sugestões: revisar antes de enviar e responder pelo que for enviado é responsabilidade de quem
          envia.
        </p>
      </Secao>

      <Secao n={7} titulo="Disponibilidade e limites de responsabilidade">
        <p>
          Trabalhamos para a ferramenta ficar no ar o tempo todo, mas ela depende de serviços de terceiros (hospedagem,
          banco de dados, Google, Stripe) e pode ficar fora do ar ou mudar por motivos técnicos. Não respondemos por lucros
          que deixaram de acontecer, por negócios não fechados ou por decisões tomadas com base nas informações dos
          comércios. Isso não afasta os direitos que o Código de Defesa do Consumidor garante a você.
        </p>
      </Secao>

      <Secao n={8} titulo="Seus dados e o fim da conta">
        <p>
          Os seus leads, propostas e anotações são seus. Você pode baixar a lista em CSV quando quiser e excluir a conta
          em Meu perfil — a exclusão apaga a conta e cancela a assinatura no cartão. Como tratamos os dados está na{' '}
          <Link href="/privacidade" className="font-semibold text-roxo-700 underline underline-offset-2">Política de privacidade</Link>.
        </p>
      </Secao>

      <Secao n={9} titulo="Mudanças nestes termos">
        <p>
          Podemos atualizar estes termos. A data no topo mostra a versão em vigor, e mudanças importantes são avisadas
          dentro da ferramenta antes de valer.
        </p>
      </Secao>

      <Secao n={10} titulo="Lei e foro">
        <p>Estes termos seguem as leis do Brasil. Eventuais disputas podem ser resolvidas no foro do seu domicílio.</p>
      </Secao>
    </DocumentoLegal>
  );
}
