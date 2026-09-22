/**
 * O que não pode faltar no site, conforme o tipo de comércio.
 *
 * Fica em arquivo próprio porque serve às duas fases: o prompt que desenha
 * a prévia no Claude Design e o prompt que transforma essa prévia em site
 * publicado. A exigência do ramo não muda entre uma e outra — o que muda é
 * a ferramenta.
 */

export function focoDoRamo(categoria: string | null): string {
  const c = (categoria || '').toLowerCase();

  if (/barbearia|barbear|cabelei|salão|salao|beleza|estética|estetica|manicure/.test(c))
    return [
      '- Agendar é a ação principal: botão de horário em tudo quanto é dobra.',
      '- Galeria de cortes ou trabalhos feitos vale mais que texto — o cliente compra pelo olho.',
      '- Tabela de serviços com preço; esconder preço afasta neste ramo.',
      '- Equipe com foto e nome: as pessoas escolhem o profissional, não só o lugar.',
    ].join('\n');

  if (/pizza|hamburgu|lanche|restaurante|bar |comida|food|cafeteria|café|cafe|padaria|doceria|açaí|acai/.test(c))
    return [
      '- Cardápio com foto e preço é o coração da página. Sem foto de comida, não vende.',
      '- Pedir pelo WhatsApp em um toque, com mensagem já escrita.',
      '- Horário de funcionamento visível sem rolar a página, e se entrega ou não.',
      '- Área de entrega e tempo médio, se houver.',
    ].join('\n');

  if (/clínica|clinica|odonto|dentist|médic|medic|saúde|saude|psic|fisio|veterin|pet/.test(c))
    return [
      '- Confiança acima de tudo: especialidades, formação, registro profissional.',
      '- Convênios aceitos, se houver — é a primeira pergunta do paciente.',
      '- Agendamento de consulta em destaque, e telefone bem visível.',
      '- Tom sóbrio. Nada de promessa de resultado, que é vedado em saúde.',
    ].join('\n');

  if (/academia|fitness|crossfit|pilates|yoga|luta|jiu|muay|natação|natacao/.test(c))
    return [
      '- Modalidades e horários das turmas.',
      '- Planos e valores, ou ao menos "a partir de".',
      '- Fotos do espaço real: quem procura academia quer ver a estrutura.',
      '- Chamada para aula experimental gratuita.',
    ].join('\n');

  if (/imobiliá|imobilia|imóve|imove|corretor|constru/.test(c))
    return [
      '- Vitrine de imóveis com foto, bairro, metragem e valor.',
      '- Busca ou filtro simples por tipo e faixa de preço.',
      '- Formulário de "quero anunciar meu imóvel" além do de compra.',
      '- CRECI visível — é exigência da profissão.',
    ].join('\n');

  if (/oficina|mecânic|mecanic|auto|funilar|borracha|serralh|marcenar|elétric|eletric|encanad|reforma/.test(c))
    return [
      '- Lista clara dos serviços prestados; o cliente chega pesquisando o problema dele.',
      '- Orçamento pelo WhatsApp com foto do serviço — é assim que esse ramo negocia.',
      '- Tempo de mercado e trabalhos feitos passam a confiança que falta.',
      '- Endereço com mapa: esse cliente vai presencialmente.',
    ].join('\n');

  if (/ótica|otica|loja|boutique|roupa|calçad|calcad|joalher|papelar|presente/.test(c))
    return [
      '- Vitrine dos produtos com foto boa.',
      '- Marcas trabalhadas, que é o que o cliente procura pelo nome.',
      '- WhatsApp para consulta de disponibilidade e preço.',
      '- Endereço e horário bem visíveis.',
    ].join('\n');

  if (/viage|turis|hotel|pousada|passeio/.test(c))
    return [
      '- Destinos e pacotes com foto grande.',
      '- Formulário de cotação, que é como esse ramo capta.',
      '- Selo de cadastro no Ministério do Turismo, se houver.',
    ].join('\n');

  return [
    '- Deixe claro em cinco segundos o que o negócio faz e para quem.',
    '- Lista de serviços com uma frase de benefício em cada.',
    '- Contato por WhatsApp em destaque, em mais de um ponto da página.',
    '- Endereço, horário e mapa.',
  ].join('\n');
}
