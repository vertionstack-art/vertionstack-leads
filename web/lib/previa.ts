/**
 * A prévia automática do site: o tema (cores e frases) de cada ramo e os
 * serviços típicos usados quando o briefing do lead ainda está vazio.
 *
 * É uma prévia para mostrar ao dono do comércio "como o site dele poderia
 * ficar" — o rodapé avisa que textos e serviços são ilustrativos. O que é
 * dado de verdade (nome, nota, avaliações, horário, endereço, telefone) vem
 * do Google; o que a pessoa preencheu no briefing tem prioridade sobre o
 * texto genérico do ramo.
 */

import { ramoDaCategoria, type Ramo } from './catalogo';

export interface Tema {
  fundo: string;
  texto: string;
  suave: string;
  destaque: string;
  textoDestaque: string;
  cartao: string;
  frase: string;
  chamada: string;
  servicos: string[];
  porque: string[];
}

const TEMAS: Record<Ramo | 'geral', Tema> = {
  beleza: {
    fundo: '#faf7f4', texto: '#1c1917', suave: '#78716c', destaque: '#b07a4f', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Cuidado com você, do jeito que você gosta.',
    chamada: 'Agendar horário',
    servicos: ['Corte', 'Barba e acabamento', 'Coloração', 'Tratamentos', 'Sobrancelha', 'Pacotes e combos'],
    porque: ['Profissionais experientes', 'Ambiente confortável', 'Horário marcado, sem espera'],
  },
  alimentacao: {
    fundo: '#fff8f1', texto: '#3b1d0f', suave: '#8a5a44', destaque: '#d9480f', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Feito na hora, com aquele sabor que faz voltar.',
    chamada: 'Fazer pedido',
    servicos: ['Cardápio do dia', 'Pratos da casa', 'Bebidas', 'Sobremesas', 'Delivery', 'Encomendas'],
    porque: ['Ingredientes frescos', 'Atendimento rápido', 'Peça pelo WhatsApp'],
  },
  saude: {
    fundo: '#f3f8fb', texto: '#0b2a3d', suave: '#4f6b7d', destaque: '#0e7490', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Atendimento atencioso, perto de você.',
    chamada: 'Agendar consulta',
    servicos: ['Consultas', 'Avaliação inicial', 'Exames', 'Tratamentos', 'Retornos', 'Convênios e particular'],
    porque: ['Equipe qualificada', 'Atendimento humanizado', 'Agendamento fácil'],
  },
  fitness: {
    fundo: '#0e0f12', texto: '#f4f4f5', suave: '#a1a1aa', destaque: '#a3e635', textoDestaque: '#0e0f12', cartao: '#17181d',
    frase: 'Seu próximo nível começa aqui.',
    chamada: 'Agendar aula experimental',
    servicos: ['Musculação', 'Aulas coletivas', 'Treino funcional', 'Acompanhamento', 'Avaliação física', 'Planos mensais'],
    porque: ['Equipamentos completos', 'Professores presentes', 'Horários flexíveis'],
  },
  imobiliario: {
    fundo: '#f6f7f3', texto: '#1b2a1b', suave: '#5f6f5f', destaque: '#3f6212', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'O imóvel certo para o seu próximo capítulo.',
    chamada: 'Falar com um corretor',
    servicos: ['Venda', 'Locação', 'Lançamentos', 'Avaliação de imóvel', 'Financiamento', 'Documentação'],
    porque: ['Conhecimento da região', 'Atendimento personalizado', 'Negociação segura'],
  },
  servicos: {
    fundo: '#f5f6f8', texto: '#111827', suave: '#5b6474', destaque: '#d97706', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Serviço bem feito, com prazo e preço justos.',
    chamada: 'Pedir orçamento',
    servicos: ['Orçamento sem compromisso', 'Atendimento no local', 'Manutenção', 'Instalação', 'Reparos', 'Garantia do serviço'],
    porque: ['Experiência comprovada', 'Preço justo', 'Resposta rápida'],
  },
  varejo: {
    fundo: '#fbf8ff', texto: '#24113f', suave: '#6b5b84', destaque: '#7e22ce', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'O que você procura, com atendimento de verdade.',
    chamada: 'Ver produtos',
    servicos: ['Novidades', 'Mais vendidos', 'Promoções', 'Encomendas', 'Entrega', 'Formas de pagamento'],
    porque: ['Variedade', 'Atendimento próximo', 'Pague como preferir'],
  },
  turismo: {
    fundo: '#f1faf8', texto: '#0f3633', suave: '#4c6f6b', destaque: '#0f766e', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Descanso e boas histórias para contar.',
    chamada: 'Consultar disponibilidade',
    servicos: ['Hospedagem', 'Pacotes', 'Passeios', 'Café da manhã', 'Reservas', 'Grupos e eventos'],
    porque: ['Localização privilegiada', 'Atendimento acolhedor', 'Reserva direta, sem taxa'],
  },
  geral: {
    fundo: '#f6f5fb', texto: '#15131f', suave: '#625d73', destaque: '#5b21b6', textoDestaque: '#ffffff', cartao: '#ffffff',
    frase: 'Atendimento de confiança, perto de você.',
    chamada: 'Falar no WhatsApp',
    servicos: ['Atendimento personalizado', 'Orçamento', 'Produtos e serviços', 'Entrega', 'Pós-venda', 'Formas de pagamento'],
    porque: ['Experiência no ramo', 'Atendimento próximo', 'Resposta rápida'],
  },
};

export function temaDoLead(categoria: string | null): Tema {
  const ramo = ramoDaCategoria(categoria);
  return TEMAS[ramo || 'geral'];
}

/** "segunda-feira: 08:00–18:00 · terça-feira: ..." em linhas de dia e horário */
export function horarioEmLinhas(hours: string | null): { dia: string; horas: string }[] {
  if (!hours) return [];
  return hours
    .split(' · ')
    .map((p) => {
      const i = p.indexOf(':');
      return i > 0 ? { dia: p.slice(0, i).trim(), horas: p.slice(i + 1).trim() } : null;
    })
    .filter((x): x is { dia: string; horas: string } => !!x && !!x.dia)
    .map((x) => ({ dia: x.dia.charAt(0).toUpperCase() + x.dia.slice(1), horas: /fechado|closed/i.test(x.horas) ? 'Fechado' : x.horas }));
}
