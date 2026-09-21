/**
 * Curva ABC do mix.
 *
 * Classificação de Pareto: ordena os produtos pelo que eles representam e corta
 * onde o acumulado passa de 80% (classe A) e de 95% (classe B). O resto é C.
 *
 * Serve para responder a pergunta que antecede o preço: *quais* produtos
 * merecem atenção. Poucos itens costumam responder pela maior parte do
 * faturamento — são eles que o cliente conhece de cor e compara de loja em
 * loja; a cauda longa é onde a margem passa despercebida.
 */

export type ClasseABC = 'A' | 'B' | 'C';

/** Sobre o que a curva é apurada. */
export type CriterioABC = 'faturamento' | 'margem' | 'quantidade';

export const CRITERIOS: { id: CriterioABC; label: string; descricao: string }[] = [
  {
    id: 'faturamento',
    label: 'Faturamento',
    descricao: 'Quanto cada produto traz de receita. É a leitura clássica: mostra quem move o caixa.',
  },
  {
    id: 'margem',
    label: 'Margem de contribuição',
    descricao: 'Quanto cada produto deixa depois dos custos variáveis. Mostra quem realmente paga as contas.',
  },
  {
    id: 'quantidade',
    label: 'Unidades vendidas',
    descricao: 'Quantas peças saem. Mostra quem traz gente para dentro da loja, mesmo com pouca receita.',
  },
];

/** Corte padrão de Pareto. A até 80% do acumulado, B até 95%, C o resto. */
export const CORTE_A = 80;
export const CORTE_B = 95;

export interface ItemABC {
  id: string;
  /** Valor no critério escolhido. Negativos entram como 0 — ver `classificarABC`. */
  valor: number;
}

export interface ResultadoItemABC {
  id: string;
  classe: ClasseABC;
  valor: number;
  /** Quanto este item representa do total, em %. */
  participacao: number;
  /** Participação acumulada até este item, em %, na ordem da curva. */
  acumulado: number;
  /** Posição na curva, 1 = maior. */
  posicao: number;
}

export interface ResumoClasseABC {
  classe: ClasseABC;
  quantidade: number;
  valor: number;
  /** Fatia do total que a classe representa, em %. */
  participacao: number;
}

export interface ResultadoABC {
  itens: ResultadoItemABC[];
  porId: Record<string, ResultadoItemABC>;
  resumo: ResumoClasseABC[];
  total: number;
}

/**
 * Classifica os itens em A, B e C pelo acumulado de Pareto.
 *
 * Detalhes que importam na prática:
 *
 * - Produto com valor negativo (margem de contribuição no vermelho) entra como
 *   zero na ordenação. Sem isso ele apareceria no fim da fila junto com os
 *   itens irrelevantes, quando na verdade é um problema a resolver — o Mix já
 *   o sinaliza em vermelho por conta própria.
 * - O corte é feito pelo acumulado ANTES de somar o item: quem cruza a linha
 *   dos 80% ainda é A, senão o primeiro produto de uma loja de produto único
 *   cairia em C.
 * - Empates seguem a ordem original, para a classificação não dançar entre
 *   dois cálculos com os mesmos dados.
 */
export function classificarABC(itens: ItemABC[]): ResultadoABC {
  const normalizados = itens.map((item, ordem) => ({
    id: item.id,
    valor: Math.max(0, Number(item.valor) || 0),
    ordem,
  }));

  const total = normalizados.reduce((soma, i) => soma + i.valor, 0);

  const ordenados = [...normalizados].sort((a, b) =>
    b.valor - a.valor || a.ordem - b.ordem
  );

  const resultado: ResultadoItemABC[] = [];
  let acumuladoAntes = 0;

  ordenados.forEach((item, indice) => {
    const participacao = total > 0 ? (item.valor / total) * 100 : 0;
    const acumulado = acumuladoAntes + participacao;

    // Sem faturamento nenhum não há curva: todo mundo é C, e a tela avisa que
    // faltam dados em vez de inventar uma classificação.
    let classe: ClasseABC;
    if (total <= 0) {
      classe = 'C';
    } else if (acumuladoAntes < CORTE_A) {
      classe = 'A';
    } else if (acumuladoAntes < CORTE_B) {
      classe = 'B';
    } else {
      classe = 'C';
    }

    resultado.push({
      id: item.id,
      classe,
      valor: item.valor,
      participacao,
      acumulado,
      posicao: indice + 1,
    });
    acumuladoAntes = acumulado;
  });

  const porId: Record<string, ResultadoItemABC> = {};
  resultado.forEach(r => { porId[r.id] = r; });

  const resumo: ResumoClasseABC[] = (['A', 'B', 'C'] as ClasseABC[]).map(classe => {
    const daClasse = resultado.filter(r => r.classe === classe);
    const valor = daClasse.reduce((s, r) => s + r.valor, 0);
    return {
      classe,
      quantidade: daClasse.length,
      valor,
      participacao: total > 0 ? (valor / total) * 100 : 0,
    };
  });

  return { itens: resultado, porId, resumo, total };
}

export interface EstrategiaParaMapear {
  id: string;
  nome: string;
  margem: number;
}

export type MapeamentoABC = Record<ClasseABC, string | null>;

/**
 * Sugere qual faixa de margem cabe a cada classe.
 *
 * A lógica do varejo: os itens de classe A são os que o cliente conhece e
 * compara, então levam a MENOR margem — eles existem para trazer gente. A
 * cauda C, que ninguém confere, leva a MAIOR. B fica no meio.
 *
 * Faixas de 0% ficam de fora da sugestão automática. Elas existem para o caso
 * deliberado de vender a preço de custo; sugerir margem zero para os produtos
 * que mais faturam seria exatamente o tipo de estrago que esta tela deveria
 * evitar. O usuário ainda pode escolhê-las à mão.
 */
export function sugerirMapeamento(estrategias: EstrategiaParaMapear[]): MapeamentoABC {
  const candidatas = estrategias
    .filter(e => e.margem > 0)
    .sort((a, b) => a.margem - b.margem);

  if (candidatas.length === 0) return { A: null, B: null, C: null };
  if (candidatas.length === 1) {
    const unica = candidatas[0].id;
    return { A: unica, B: unica, C: unica };
  }

  const menor = candidatas[0];
  const maior = candidatas[candidatas.length - 1];
  // Com só duas faixas, B acompanha a maior: é mais seguro errar para cima do
  // que jogar metade do catálogo na margem de atração.
  const meio = candidatas.length === 2
    ? maior
    : candidatas[Math.floor((candidatas.length - 1) / 2)];

  return { A: menor.id, B: meio.id, C: maior.id };
}
