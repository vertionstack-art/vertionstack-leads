import Link from 'next/link';
import type { Metadata } from 'next';
import { DocumentoLegal, Lista, Secao } from '../documento-legal';
import { DATA_TERMOS, responsavel } from '@/lib/legal';
import { LIMITES, PLANOS_A_VENDA, reais } from '@/lib/planos';

export const metadata: Metadata = { title: 'Termos de uso — Vertion Leads' };

const ligar = 'font-semibold text-roxo-700 underline underline-offset-2';

export default function Termos() {
  const r = responsavel();
  const pagos = PLANOS_A_VENDA.filter((p) => p.precoCentavos > 0);
  const email = <a href={`mailto:${r.email}`} className={ligar}>{r.email}</a>;
  const privacidade = <Link href="/privacidade" className={ligar}>Política de privacidade</Link>;
  const foro = process.env.LEGAL_FORO;

  return (
    <DocumentoLegal titulo="Termos de uso" atualizado={DATA_TERMOS}>
      <p>
        Estes Termos de uso (&quot;Termos&quot;) regulam o acesso e o uso do <b>Vertion Leads</b>, disponível em
        leads.vertionstack.com (&quot;Ferramenta&quot;), fornecido por <b>{r.nome}</b>
        {r.documento && <> (CNPJ/CPF {r.documento})</>} (&quot;Vertion&quot;, &quot;nós&quot;). Eles formam, junto com a{' '}
        {privacidade}, o contrato entre a Vertion e a pessoa que cria uma conta (&quot;Usuário&quot;, &quot;você&quot;).
      </p>
      <p>
        <b>Leia com atenção.</b> Ao marcar &quot;Li e aceito&quot; no cadastro ou ao usar a Ferramenta, você declara que leu,
        entendeu e concorda com estes Termos. O aceite eletrônico tem validade jurídica (art. 107 do Código Civil e art. 10,
        § 2º, da Medida Provisória 2.200-2/2001), e a Ferramenta registra a versão aceita e o momento do aceite. Se não
        concordar, não use a Ferramenta.
      </p>

      <Secao n={1} titulo="Definições">
        <Lista
          itens={[
            <><b>Lead:</b> comércio ou empresa exibido pela Ferramenta, com dados obtidos de fontes públicas.</>,
            <><b>Conta:</b> o acesso individual do Usuário, protegido por e-mail e senha.</>,
            <><b>Plano:</b> a modalidade de uso contratada (teste grátis, 7 dias, Basic ou Pro), com os limites descritos na seção 6.</>,
            <><b>Conteúdo do Usuário:</b> anotações, propostas, etapas de CRM, dados da empresa e demais informações que o Usuário insere.</>,
          ]}
        />
      </Secao>

      <Secao n={2} titulo="O que a Ferramenta é — e o que ela não é">
        <p>
          A Ferramenta é um software, oferecido como serviço pela internet, que ajuda profissionais a encontrar comércios sem
          site próprio e a organizar a venda: busca em fontes públicas (como o Google), classificação, temperatura, textos de
          abordagem, proposta comercial, CRM e acompanhamento financeiro.
        </p>
        <Lista
          itens={[
            'A Vertion fornece a tecnologia. Não intermedeia, não participa e não responde pelas negociações, contratos, pagamentos ou serviços entre o Usuário e os comércios que ele aborda.',
            'Os dados dos Leads vêm de fontes públicas e de terceiros (como o Google) e podem estar incompletos, desatualizados ou errados. A Vertion não garante sua exatidão, nem que um Lead tenha ou não site, nem que o número tenha WhatsApp.',
            'Classificações, temperatura, textos sugeridos e valores de proposta são estimativas automáticas de apoio, não aconselhamento comercial, jurídico ou financeiro. A decisão e a revisão são sempre do Usuário.',
            'A Ferramenta não promete resultado: quantidade de respostas, vendas, faturamento ou lucro dependem exclusivamente do trabalho do Usuário.',
          ]}
        />
      </Secao>

      <Secao n={3} titulo="Quem pode usar">
        <Lista
          itens={[
            'Pessoas maiores de 18 anos e plenamente capazes (art. 5º do Código Civil), ou empresas representadas por quem tem poderes para contratar.',
            'A Ferramenta é destinada ao uso profissional, como apoio à atividade comercial do Usuário. Ao usá-la para essa finalidade, o Usuário declara que a contrata como insumo da sua atividade econômica.',
            'Os dados do cadastro precisam ser verdadeiros e mantidos atualizados. O e-mail precisa ser do próprio Usuário.',
          ]}
        />
      </Secao>

      <Secao n={4} titulo="Conta e senha">
        <Lista
          itens={[
            'Cada Conta é pessoal e intransferível: é de uma pessoa só e não pode ser compartilhada, emprestada, vendida ou alugada.',
            'O Usuário é o único responsável pela guarda da senha e por todos os atos praticados com a sua Conta. Suspeita de acesso indevido deve ser comunicada imediatamente pelo e-mail de contato, junto com a troca da senha.',
            'A Vertion nunca pede a senha por e-mail, telefone ou mensagem.',
          ]}
        />
      </Secao>

      <Secao n={5} titulo="Teste grátis">
        <p>
          A Conta nova recebe um teste grátis de {LIMITES.gratis.semana} leads e {LIMITES.gratis.buscas} buscas, sem prazo e
          sem cartão, uma única vez por pessoa. É proibido criar mais de uma Conta para obter novos testes. Para impedir esse
          abuso, a Ferramenta usa os mecanismos descritos na {privacidade} e pode negar o teste, suspender ou encerrar Contas
          ligadas ao mesmo computador, navegador, rede ou e-mail. O teste pode ser alterado ou encerrado a qualquer momento,
          sem afetar o que o Usuário já guardou.
        </p>
      </Secao>

      <Secao n={6} titulo="Planos, preços e pagamento">
        <p>Planos à venda nesta data (preços em reais, com tributos incluídos):</p>
        <Lista
          itens={pagos.map((p) => (
            <>
              <b>{p.nome}</b>: {reais(p.precoCentavos)}
              {p.periodo} — até {LIMITES[p.plano].semana} leads novos por semana, {LIMITES[p.plano].buscas} buscas no Google
              {p.plano === 'semanal' ? ' nos 7 dias' : ' por mês'} e até {LIMITES[p.plano].guardados.toLocaleString('pt-BR')} leads guardados.
            </>
          ))}
        />
        <Lista
          itens={[
            <><b>Cartão de crédito:</b> Basic e Pro são assinaturas mensais de <b>renovação automática</b>, cobradas na mesma data de cada mês até o cancelamento. Ao assinar, o Usuário autoriza essas cobranças recorrentes.</>,
            <><b>Pix:</b> cada pagamento libera 31 dias e <b>não renova sozinho</b>. O plano de 7 dias é pago uma única vez (cartão ou Pix), libera 7 dias e também não renova.</>,
            'O plano é liberado somente depois que o processador de pagamentos confirma o pagamento. Os pagamentos são processados pela Stripe; a Vertion não recebe nem armazena os dados do cartão.',
            'Os limites de cada plano existem para manter o serviço sustentável. Ao atingi-los, a busca de leads novos para até o próximo período ou até a troca de plano; nada do que já foi guardado é perdido.',
            'Quando o plano vence sem renovação, a Conta volta à condição de teste: leads, CRM e propostas continuam acessíveis, mas a busca de leads novos fica bloqueada.',
            'Os preços e limites podem mudar para novas contratações. Para quem já assina no cartão, mudanças no valor da renovação são avisadas com pelo menos 30 dias de antecedência, e o Usuário pode cancelar antes de passarem a valer.',
          ]}
        />
      </Secao>

      <Secao n={7} titulo="Cancelamento, arrependimento e reembolso">
        <Lista
          itens={[
            'A assinatura pode ser cancelada a qualquer momento em Planos → Gerenciar assinatura, sem multa. O plano continua valendo até o fim do período já pago e não há nova cobrança.',
            <>Quando a contratação estiver sujeita ao Código de Defesa do Consumidor (Lei 8.078/1990), o Usuário pode desistir da <b>primeira contratação</b> em até 7 dias contados do pagamento, com devolução integral do valor (art. 49), pedindo pelo e-mail {email}.</>,
            'Fora dessa hipótese, períodos já pagos não são reembolsados, total ou proporcionalmente, inclusive em caso de cancelamento no meio do período, de não utilização ou de suspensão por violação destes Termos.',
            'Abrir contestação de cobrança (chargeback) de um pagamento regular, sem antes pedir o cancelamento ou o reembolso pelos canais da Vertion, autoriza a suspensão imediata da Conta até a regularização.',
          ]}
        />
      </Secao>

      <Secao n={8} titulo="Uso permitido e condutas proibidas">
        <p>O Usuário se compromete a usar a Ferramenta de forma lícita e de boa-fé (arts. 113 e 422 do Código Civil). É proibido:</p>
        <Lista
          itens={[
            'enviar mensagens em massa ou automatizadas (spam) aos Leads, ou insistir no contato com quem pediu para não ser contatado;',
            'usar os dados dos Leads para finalidade diferente de oferecer os próprios serviços, ou vender, alugar, publicar, compartilhar ou repassar as listas a terceiros;',
            'usar a Ferramenta para fraude, golpe, assédio, discriminação, propaganda enganosa ou qualquer atividade ilegal;',
            'inserir nas propostas ou mensagens conteúdo ilícito, ofensivo, enganoso ou que viole direitos de terceiros;',
            'acessar a Ferramenta por robôs, scripts ou programas que não sejam a própria Ferramenta, copiar seus dados em massa ou sobrecarregar os servidores;',
            'tentar burlar limites de plano, o teste grátis, a cobrança, a autenticação ou qualquer medida de segurança;',
            'copiar, modificar, descompilar, fazer engenharia reversa, revender ou criar produto concorrente a partir da Ferramenta;',
            'invadir ou tentar invadir contas, sistemas ou dados alheios, conduta que também pode configurar crime (art. 154-A do Código Penal, incluído pela Lei 12.737/2012).',
          ]}
        />
      </Secao>

      <Secao n={9} titulo="Os dados dos Leads e a responsabilidade do Usuário (LGPD)">
        <p>
          Ao escolher quais Leads abordar, como e por qual canal, o Usuário decide sozinho a finalidade e a forma desse uso e
          atua, nessa atividade, como <b>controlador</b> dos dados pessoais eventualmente envolvidos (art. 5º, VI, da Lei
          Geral de Proteção de Dados — Lei 13.709/2018). Por isso, o Usuário é o único responsável por:
        </p>
        <Lista
          itens={[
            'ter base legal para o contato (como o legítimo interesse, art. 7º, IX, e art. 10 da LGPD) e respeitar os direitos dos titulares (art. 18), inclusive o pedido de não ser mais contatado;',
            'cumprir o Código de Defesa do Consumidor, as regras de publicidade e as políticas de uso do WhatsApp, do e-mail e de qualquer canal que utilizar;',
            'responder por reclamações, denúncias, bloqueios, banimentos ou processos decorrentes das abordagens que fizer.',
          ]}
        />
        <p>
          Quanto aos dados pessoais do próprio Usuário, a Vertion é controladora e os trata conforme a {privacidade}.
        </p>
      </Secao>

      <Secao n={10} titulo="Ressarcimento (indenidade)">
        <p>
          O Usuário se obriga a ressarcir a Vertion de qualquer prejuízo, condenação, multa, acordo, custas e honorários de
          advogado que ela venha a sofrer em razão de: (a) violação destes Termos ou da lei pelo Usuário; (b) abordagens,
          mensagens, propostas e contratos do Usuário com terceiros; (c) Conteúdo do Usuário; ou (d) reclamação de terceiro
          relacionada ao uso que o Usuário fez da Ferramenta. A Vertion poderá exercer seu direito de regresso (art. 934 do
          Código Civil) e chamar o Usuário a integrar eventual processo.
        </p>
      </Secao>

      <Secao n={11} titulo="Propriedade intelectual">
        <Lista
          itens={[
            'A Ferramenta, seu código, banco de dados, textos, prompts, marcas, logotipos e layout pertencem à Vertion e são protegidos pela Lei 9.609/1998 (software), pela Lei 9.610/1998 (direitos autorais) e pela Lei 9.279/1996 (propriedade industrial).',
            'O Usuário recebe uma licença de uso pessoal, limitada, não exclusiva, intransferível e revogável, válida enquanto a Conta estiver ativa e de acordo com estes Termos. Nenhum direito de propriedade é transferido.',
            'O Conteúdo do Usuário continua sendo do Usuário. Ele autoriza a Vertion a armazená-lo e processá-lo apenas para prestar o serviço.',
          ]}
        />
      </Secao>

      <Secao n={12} titulo="Disponibilidade, mudanças e serviços de terceiros">
        <Lista
          itens={[
            'A Ferramenta é oferecida no estado em que se encontra e conforme disponível. A Vertion trabalha para mantê-la no ar, mas não garante funcionamento ininterrupto ou livre de erros.',
            'A Ferramenta depende de serviços de terceiros (hospedagem, banco de dados, Google, Stripe, provedores de e-mail e de internet). Falhas, mudanças de regras ou de preço, bloqueios e interrupções desses serviços estão fora do controle da Vertion.',
            'A Vertion pode alterar, incluir ou retirar funcionalidades para melhorar o serviço, por exigência legal ou técnica, ou por mudança nos serviços de terceiros, preservando o que o Usuário já guardou sempre que possível.',
            'Manutenções podem deixar a Ferramenta temporariamente indisponível.',
          ]}
        />
      </Secao>

      <Secao n={13} titulo="Limitação de responsabilidade">
        <p>Na máxima extensão permitida pela lei:</p>
        <Lista
          itens={[
            'a Vertion não responde por lucros cessantes, perda de oportunidade, negócios não fechados, danos indiretos, perda de dados causada pelo Usuário ou por terceiros, nem por decisões tomadas com base nas informações da Ferramenta;',
            'a Vertion não responde por atos, mensagens, propostas e contratos do Usuário, nem por conteúdo e dados fornecidos por terceiros (art. 19 da Lei 12.965/2014 — Marco Civil da Internet);',
            'a Vertion não responde por casos fortuitos ou de força maior (art. 393 do Código Civil), como falhas de energia, de internet ou de serviços de terceiros, ataques, decisões de autoridades e desastres;',
            'quando houver responsabilidade da Vertion, a indenização fica limitada ao valor efetivamente pago pelo Usuário nos 12 meses anteriores ao fato.',
          ]}
        />
        <p>
          Nada nestes Termos exclui ou limita direitos que não possam ser afastados por contrato, inclusive os garantidos pelo
          Código de Defesa do Consumidor quando ele for aplicável (art. 51).
        </p>
      </Secao>

      <Secao n={14} titulo="Suspensão e encerramento">
        <Lista
          itens={[
            'A Vertion pode suspender ou encerrar a Conta, sem aviso prévio e sem reembolso, em caso de violação destes Termos ou da lei, fraude, contestação de pagamento indevida, risco à segurança ou ordem de autoridade.',
            'O Usuário pode encerrar a Conta a qualquer momento em Meu perfil. O encerramento apaga a Conta e cancela a assinatura no cartão; os dados seguem os prazos da Política de privacidade.',
            'Antes de encerrar, o Usuário pode baixar a sua lista de leads em CSV. Depois de apagados, os dados não podem ser recuperados.',
          ]}
        />
      </Secao>

      <Secao n={15} titulo="Registros de acesso e pedidos de autoridades">
        <p>
          Em cumprimento ao art. 15 da Lei 12.965/2014 (Marco Civil da Internet), a Vertion guarda os registros de acesso à
          Ferramenta (endereço IP, data e hora) pelo prazo mínimo de 6 meses, em sigilo e em ambiente controlado. Esses
          registros e outros dados só são fornecidos a terceiros mediante ordem judicial ou requisição de autoridade
          competente, nos termos da lei (arts. 10 e 22 do Marco Civil).
        </p>
      </Secao>

      <Secao n={16} titulo="Comunicações">
        <p>
          As comunicações da Vertion ao Usuário são feitas pelo e-mail cadastrado ou por avisos dentro da Ferramenta e são
          consideradas recebidas a partir do envio ou da publicação. O Usuário fala com a Vertion pelo e-mail {email}, canal
          de atendimento previsto no Decreto 7.962/2013 (comércio eletrônico).
        </p>
      </Secao>

      <Secao n={17} titulo="Mudanças nestes Termos">
        <p>
          A Vertion pode atualizar estes Termos. A data no topo indica a versão em vigor. Mudanças relevantes são avisadas
          dentro da Ferramenta ou por e-mail antes de valer; continuar usando a Ferramenta depois disso significa concordar
          com a nova versão. Quem não concordar pode cancelar e encerrar a Conta.
        </p>
      </Secao>

      <Secao n={18} titulo="Disposições gerais">
        <Lista
          itens={[
            'Se alguma cláusula for considerada inválida, as demais continuam valendo (art. 184 do Código Civil).',
            'A tolerância da Vertion com o descumprimento de alguma regra não significa renúncia ao direito de exigi-la depois.',
            'O Usuário não pode transferir sua Conta ou estes Termos. A Vertion pode transferi-los em caso de reorganização, venda ou incorporação do negócio, mantidas as condições aqui previstas.',
            'Estes Termos e a Política de privacidade são o acordo completo entre as partes sobre o uso da Ferramenta.',
          ]}
        />
      </Secao>

      <Secao n={19} titulo="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca{' '}
          {foro ? <>de <b>{foro}</b></> : 'da sede da Vertion'} para resolver qualquer controvérsia, com renúncia a qualquer
          outro, por mais privilegiado que seja — ressalvado, quando o Usuário for consumidor, o direito de propor a ação no
          foro do seu domicílio (art. 101, I, do Código de Defesa do Consumidor). Antes de qualquer medida judicial, as partes
          se comprometem a tentar resolver a questão de forma amigável pelo e-mail {email}.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
