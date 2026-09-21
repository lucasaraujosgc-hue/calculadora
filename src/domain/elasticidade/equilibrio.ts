/**
 * Elasticidade de equilíbrio: quanto o volume teria que reagir para um corte de
 * preço se pagar sozinho.
 *
 * É a pergunta que antecede "quanto vou ganhar", e tem uma vantagem decisiva
 * sobre ela: sai de preço, custo e deduções — dados que o sistema tem de todos
 * os produtos, sempre. Não depende de histórico de notas, então vale também
 * para quem acabou de chegar.
 *
 * A conta
 * -------
 * Baixar o preço reduz a margem de contribuição unitária MUITO mais rápido que
 * o preço, porque o custo não acompanha o desconto. Com preço p, custo c e
 * deduções d, a margem de contribuição vale `p(1-d) - c`. O equilíbrio exige
 * que o volume extra reponha exatamente o que a margem perdeu:
 *
 *     MC_novo × Q_novo = MC_atual × Q_atual,  com  Q_novo = Q_atual · (p_novo/p_atual)^b
 *
 * Isolando b:
 *
 *     b* = ln(MC_atual / MC_novo) / ln(p_novo / p_atual)
 *
 * A lei que sai disso
 * -------------------
 * Para cortes pequenos, o resultado converge para `-(1-d)/m`, o inverso da
 * margem. Verificado numericamente com erro abaixo de 0,05 entre margens de 10%
 * e 60%. A consequência é dura e vale dizer com todas as letras: o quanto se
 * pode cortar depende do NÍVEL da margem, quase nada do TAMANHO do corte. Numa
 * margem de 20%, cortar 1 ponto já exige elasticidade de -4,3 — fora do que o
 * varejo entrega. Numa margem de 50%, exige -1,7, que é plausível.
 *
 * Isso não condena o preço de atração. Condena a ideia de que ele se paga no
 * próprio item: o que paga um item de atração é a cesta que o cliente leva
 * junto, e isso este módulo não mede nem tenta medir.
 */

/** Teto generoso do que o varejo costuma entregar de elasticidade. */
export const ELASTICIDADE_REFERENCIA_VAREJO = -3;

export interface ItemEquilibrio {
  /** Preço em vigor hoje. */
  precoAtual: number;
  /** Preço que passaria a valer. */
  precoNovo: number;
  cmv: number;
  /** Impostos, taxas e demais despesas variáveis, em pontos percentuais. */
  deducoesPercent: number;
  /** Volume atual, usado para ponderar no agregado. */
  quantidade: number;
}

export type MotivoSemEquilibrio =
  | 'sem-corte'        // o preço não cai; a pergunta não se aplica
  | 'sem-margem'       // o preço novo não cobre nem o custo variável
  | 'sem-dados';       // faltam preço ou volume

export interface ResultadoEquilibrio {
  /** Elasticidade necessária. Negativa. `null` quando a pergunta não se aplica. */
  elasticidade: number | null;
  motivo: MotivoSemEquilibrio | null;
  /** Variação de preço proposta, em %. Negativa num desconto. */
  variacaoPrecoPercent: number;
  /** Variação da margem de contribuição unitária, em %. É a alavanca invisível. */
  variacaoMargemContribuicaoPercent: number;
  /** Aumento de volume necessário para empatar, em %. */
  aumentoVolumeNecessarioPercent: number | null;
}

const margemContribuicao = (preco: number, cmv: number, deducoesPercent: number) =>
  preco * (1 - deducoesPercent / 100) - cmv;

/** Elasticidade de equilíbrio de um único produto. */
export function elasticidadeDeEquilibrio(item: ItemEquilibrio): ResultadoEquilibrio {
  const vazio = (motivo: MotivoSemEquilibrio): ResultadoEquilibrio => ({
    elasticidade: null,
    motivo,
    variacaoPrecoPercent: 0,
    variacaoMargemContribuicaoPercent: 0,
    aumentoVolumeNecessarioPercent: null,
  });

  if (item.precoAtual <= 0 || item.precoNovo <= 0) return vazio('sem-dados');

  const variacaoPrecoPercent = ((item.precoNovo - item.precoAtual) / item.precoAtual) * 100;
  if (item.precoNovo >= item.precoAtual) return { ...vazio('sem-corte'), variacaoPrecoPercent };

  const mcAtual = margemContribuicao(item.precoAtual, item.cmv, item.deducoesPercent);
  const mcNovo = margemContribuicao(item.precoNovo, item.cmv, item.deducoesPercent);

  if (mcAtual <= 0) return { ...vazio('sem-dados'), variacaoPrecoPercent };

  const variacaoMargemContribuicaoPercent = ((mcNovo - mcAtual) / mcAtual) * 100;

  // Abaixo do custo variável, cada unidade a mais aumenta o prejuízo. Não existe
  // volume que salve, e devolver um número aqui seria mentir por omissão.
  if (mcNovo <= 0) {
    return {
      elasticidade: null,
      motivo: 'sem-margem',
      variacaoPrecoPercent,
      variacaoMargemContribuicaoPercent,
      aumentoVolumeNecessarioPercent: null,
    };
  }

  return {
    elasticidade: Math.log(mcAtual / mcNovo) / Math.log(item.precoNovo / item.precoAtual),
    motivo: null,
    variacaoPrecoPercent,
    variacaoMargemContribuicaoPercent,
    aumentoVolumeNecessarioPercent: (mcAtual / mcNovo - 1) * 100,
  };
}

/**
 * A lei aproximada, para explicar o número: `-(1-d)/m`.
 *
 * Serve para a tela dizer por que a conta deu no que deu — "com margem de 20%,
 * qualquer desconto precisa de elasticidade perto de -4" — sem depender de uma
 * simulação específica.
 */
export function elasticidadeDeEquilibrioMarginal(margemPercent: number, deducoesPercent: number): number | null {
  if (margemPercent <= 0) return null;
  return -((100 - deducoesPercent) / margemPercent);
}

/**
 * Elasticidade de equilíbrio de um conjunto de produtos que mudam de preço ao
 * mesmo tempo.
 *
 * Cada produto tem a sua variação de preço, então não há fórmula fechada: a
 * margem de contribuição total depois da mudança é uma soma de potências com o
 * mesmo expoente, e o expoente é encontrado por busca. A função é monótona em
 * b, o que torna a bisseção segura.
 */
export function elasticidadeDeEquilibrioDoMix(itens: ItemEquilibrio[]): ResultadoEquilibrio {
  const validos = itens.filter(i =>
    i.precoAtual > 0 && i.precoNovo > 0 && i.quantidade > 0 && i.precoNovo < i.precoAtual
  );

  const vazio = (motivo: MotivoSemEquilibrio): ResultadoEquilibrio => ({
    elasticidade: null,
    motivo,
    variacaoPrecoPercent: 0,
    variacaoMargemContribuicaoPercent: 0,
    aumentoVolumeNecessarioPercent: null,
  });

  if (validos.length === 0) return vazio(itens.length === 0 ? 'sem-dados' : 'sem-corte');

  const receitaAtual = validos.reduce((s, i) => s + i.precoAtual * i.quantidade, 0);
  const receitaNova = validos.reduce((s, i) => s + i.precoNovo * i.quantidade, 0);
  const mcAtual = validos.reduce((s, i) => s + margemContribuicao(i.precoAtual, i.cmv, i.deducoesPercent) * i.quantidade, 0);
  const mcNovaSemReacao = validos.reduce((s, i) => s + margemContribuicao(i.precoNovo, i.cmv, i.deducoesPercent) * i.quantidade, 0);

  const variacaoPrecoPercent = receitaAtual > 0 ? ((receitaNova - receitaAtual) / receitaAtual) * 100 : 0;
  const variacaoMargemContribuicaoPercent = mcAtual > 0 ? ((mcNovaSemReacao - mcAtual) / mcAtual) * 100 : 0;

  if (mcAtual <= 0) return { ...vazio('sem-dados'), variacaoPrecoPercent };
  if (mcNovaSemReacao <= 0) {
    return {
      elasticidade: null,
      motivo: 'sem-margem',
      variacaoPrecoPercent,
      variacaoMargemContribuicaoPercent,
      aumentoVolumeNecessarioPercent: null,
    };
  }

  const mcCom = (b: number) => validos.reduce((soma, i) => {
    const fator = Math.pow(i.precoNovo / i.precoAtual, b);
    return soma + margemContribuicao(i.precoNovo, i.cmv, i.deducoesPercent) * i.quantidade * fator;
  }, 0);

  // b menos negativo -> menos volume extra -> menos margem. A busca anda para o
  // lado negativo até a margem alcançar a de hoje.
  let alto = 0;
  let baixo = -50;
  if (mcCom(baixo) < mcAtual) {
    // Nem com elasticidade absurda o corte se paga (margem nova perto de zero).
    return {
      elasticidade: baixo,
      motivo: null,
      variacaoPrecoPercent,
      variacaoMargemContribuicaoPercent,
      aumentoVolumeNecessarioPercent: (mcAtual / mcNovaSemReacao - 1) * 100,
    };
  }

  for (let i = 0; i < 200; i += 1) {
    const meio = (alto + baixo) / 2;
    if (mcCom(meio) < mcAtual) alto = meio; else baixo = meio;
  }

  return {
    elasticidade: baixo,
    motivo: null,
    variacaoPrecoPercent,
    variacaoMargemContribuicaoPercent,
    aumentoVolumeNecessarioPercent: (mcAtual / mcNovaSemReacao - 1) * 100,
  };
}

export type Veredito = 'improvavel' | 'plausivel' | 'nao-se-aplica';

/**
 * Compara o necessário com o que existe de evidência.
 *
 * Sem elasticidade medida, a referência é o teto do que o varejo costuma
 * entregar. É uma régua grosseira, e a tela diz que é.
 */
export function vereditoDoCorte(
  equilibrio: ResultadoEquilibrio,
  elasticidadeMedida?: number | null
): Veredito {
  if (equilibrio.motivo === 'sem-corte' || equilibrio.motivo === 'sem-dados') return 'nao-se-aplica';
  if (equilibrio.motivo === 'sem-margem') return 'improvavel';
  if (equilibrio.elasticidade === null) return 'nao-se-aplica';

  const referencia = elasticidadeMedida ?? ELASTICIDADE_REFERENCIA_VAREJO;
  return equilibrio.elasticidade <= referencia ? 'improvavel' : 'plausivel';
}
