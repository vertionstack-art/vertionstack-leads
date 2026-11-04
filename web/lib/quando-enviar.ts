/**
 * Quando o e-mail aprovado do exterior sai. "janela" é o padrão (9h às
 * 11h30 de lá, dia útil: e-mail que chega de madrugada fica soterrado). As
 * outras foram pedidas pelo Lucas para mandar na hora ou em sequência
 * espaçada. Sem nada de servidor aqui: a tela também importa.
 */
export const QUANDO_ENVIAR = {
  janela: 'No horário comercial de lá',
  agora: 'Agora',
  '5min': 'Daqui a 5 minutos',
  '5em5': 'De 5 em 5 minutos',
  '10em10': 'De 10 em 10 minutos',
} as const;

export type QuandoEnviar = keyof typeof QUANDO_ENVIAR;

export const quandoValido = (q: unknown): q is QuandoEnviar => typeof q === 'string' && q in QUANDO_ENVIAR;
