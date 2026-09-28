/**
 * "na Pizzaria" ou "no Restaurante" — o artigo certo para o nome do comércio.
 *
 * O gênero vem da **primeira** palavra do nome, não da última. Parece
 * óbvio escrito assim, e a primeira versão disto errou exatamente aí:
 * olhando o fim de "Pizzaria Bella Napoli" o código via "Napoli", achava
 * masculino e escrevia "do Pizzaria". Numa mensagem que o dono vai ler,
 * esse erro entrega que o texto foi montado por máquina.
 *
 * Português não dá o gênero de graça — "Pizzaria" é feminino, "Salão" é
 * masculino e "Restaurante" termina em -e sem dizer nada. Por isso são
 * duas camadas: uma lista de palavras que abrem nome de comércio, e uma
 * regra de terminação para o resto.
 *
 * A mesma regra existe em Python no disparador (`disparo/mensagem.py`),
 * onde monta a mensagem de abertura do WhatsApp.
 */

const MASCULINOS = new Set([
  'restaurante', 'bar', 'hotel', 'mercado', 'supermercado', 'acougue', 'salao',
  'atelie', 'escritorio', 'consultorio', 'laboratorio', 'centro', 'espaco',
  'studio', 'estudio', 'instituto', 'colegio', 'hospital', 'posto', 'petshop',
  'pet', 'shopping', 'buffet', 'motel', 'clube', 'cartorio', 'deposito',
  'armazem', 'comercio', 'grupo', 'ponto', 'sabor', 'templo', 'auto', 'lava',
  'hostel', 'quiosque', 'emporio', 'bistro', 'cafe', 'sushi', 'spa', 'gym',
  'box', 'point', 'recanto', 'rancho', 'sitio', 'chale', 'casarao', 'solar',
  'palacio', 'mundo', 'reino', 'cantinho', 'seu', 'meu',
]);

const FEMININOS = new Set([
  'barbearia', 'pizzaria', 'padaria', 'confeitaria', 'doceria', 'sorveteria',
  'hamburgueria', 'lanchonete', 'cafeteria', 'chocolateria', 'churrascaria',
  'pastelaria', 'clinica', 'farmacia', 'otica', 'loja', 'oficina', 'academia',
  'escola', 'creche', 'pousada', 'imobiliaria', 'corretora', 'agencia', 'casa',
  'boutique', 'joalheria', 'papelaria', 'floricultura', 'livraria', 'lavanderia',
  'serralheria', 'marcenaria', 'vidracaria', 'borracharia', 'funilaria',
  'estetica', 'esmalteria', 'unha', 'beleza', 'distribuidora', 'empresa',
  'construtora', 'transportadora', 'pizza', 'adega', 'tapiocaria', 'marmitaria',
  'cantina', 'galeria', 'arena', 'vila', 'fazenda', 'chacara', 'companhia',
  'peixaria', 'quitanda', 'advocacia', 'assessoria', 'consultoria', 'dona',
]);

const FIM_MASCULINO = /(?:o|or|l|m|r|s|u|im|om|um)$/;

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * A palavra que manda no artigo.
 *
 * Pula um "A"/"O" inicial, que já é artigo ("A Casa do Pão" → casa).
 */
function primeiraPalavra(nome: string): string {
  const limpo = semAcento(nome || '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .toLowerCase();
  const partes = limpo.split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  if (['o', 'a', 'os', 'as'].includes(partes[0]) && partes.length > 1) return partes[1];
  return partes[0];
}

/** 'f' ou 'm'. Na dúvida devolve 'f', que é o caso mais comum. */
export function generoDoNome(nome: string): 'f' | 'm' {
  const p = primeiraPalavra(nome);
  if (!p) return 'f';
  if (FEMININOS.has(p)) return 'f';
  if (MASCULINOS.has(p)) return 'm';

  // "-ção" perde o til e vira "cao" — feminino; mas "-ão" solto (Salão,
  // Portão) é quase sempre masculino em nome de comércio
  if (p.endsWith('cao') || p.endsWith('sao')) return 'f';
  if (p.endsWith('coes') || p.endsWith('soes') || p.endsWith('oes')) return 'f';
  if (p.endsWith('ao')) return 'm';
  if (p.endsWith('a')) return 'f';
  if (FIM_MASCULINO.test(p)) return 'm';
  return 'f';
}

/** "da" ou "do", já pronto para entrar na frase. */
export function artigoDe(nome: string): string {
  return generoDoNome(nome) === 'f' ? 'da' : 'do';
}

/**
 * Tira o artigo que já vem no nome.
 *
 * "A Casa do Pão" com "da" na frente viraria "da A Casa do Pão".
 */
export function nomeSemArtigo(nome: string): string {
  return (nome || '').trim().replace(/^(?:[AaOo]|[Aa]s|[Oo]s)\s+(?=\S)/, '');
}
