/**
 * Motor de precificação — fonte única da verdade.
 *
 * Antes deste módulo, a fórmula da margem de contribuição estava reimplementada
 * à mão no Dashboard (duas vezes), na Formação de Preço e no Mix de Preços. Foi
 * assim que o export do Excel passou a divergir da tela: quatro cópias da mesma
 * conta, e só três foram corrigidas. Agora as telas chamam `calcularProduto` e
 * `calcularMix`, e ninguém repete a conta.
 *
 * Convenção: tudo que termina em `Percent` está em pontos percentuais (15 = 15%).
 */

/** Percentuais das despesas variáveis que o próprio usuário cadastrou, por id. */
export type DespesasVariaveisValores = Record<string, number>;

/** Uma despesa variável criada pelo usuário (ex.: "Frete", "Embalagem"). */
export interface DespesaVariavelDef {
  id: string;
  nome: string;
}

export interface ProdutoCalculo {
  id: string;
  nome?: string;
  cmv: number;
  vendasProjetadas?: number;
  /** Fatia do custo fixo da empresa que as vendas deste produto devem cobrir. */
  percentualRateio?: number;
  imposto?: number;
  taxaCartao?: number;
  /** Comissão de vendedor/representante. */
  comissao?: number;
  /** Percentuais das despesas variáveis personalizadas, por id da despesa. */
  despesasVariaveis?: DespesasVariaveisValores;
  margem?: number;
  modoPrecificacao?: 'margem' | 'preco';
  precoFixo?: number;
}

/**
 * Soma os percentuais das despesas personalizadas de um produto.
 *
 * Só conta as despesas que ainda existem na lista do usuário: apagar uma
 * despesa tem que tirá-la do preço na hora, mesmo que o valor continue gravado
 * no produto — é o que permite desfazer a exclusão sem perder os percentuais.
 */
export function somarDespesasPersonalizadas(
  valores: DespesasVariaveisValores | undefined,
  definicoes: DespesaVariavelDef[]
): number {
  if (!valores) return 0;
  return definicoes.reduce((total, def) => total + (Number(valores[def.id]) || 0), 0);
}

/**
 * Preço de venda que entrega a margem desejada.
 *
 * Preço = (CMV + custo fixo unitário) / (1 - deduções), com todas as deduções
 * expressas como fração do PREÇO — que é o que as torna somáveis entre si.
 * Por isso a margem aqui é margem sobre o preço, não markup sobre o custo.
 *
 * Todos os parâmetros são frações (0,15 = 15%), não pontos percentuais.
 */
export function calculateSellingPrice(
  costPrice: number,
  unitFixedCost: number,
  taxesPercent: number,
  feesPercent: number,
  comissionPercent: number,
  desiredMarginPercent: number
): number {
  const totalDeductions = taxesPercent + feesPercent + comissionPercent + desiredMarginPercent;
  // As deduções consomem o preço inteiro: não existe preço finito que feche a conta.
  if (totalDeductions >= 1) return 0;

  return (costPrice + unitFixedCost) / (1 - totalDeductions);
}

export interface ResultadoProduto {
  /** Rateio em reais que este produto recebeu do custo fixo da empresa. */
  valorRateadoCF: number;
  /**
   * Custo fixo embutido em cada unidade. Vale 0 quando não há vendas
   * projetadas — e é aí que mora o vazamento que `calcularMix` denuncia.
   */
  custoFixoUnitario: number;
  /** Imposto, em pontos percentuais. Fatia "Impostos" da composição do preço. */
  impostoPercent: number;
  /** Taxa de cartão + comissão + personalizadas. Fatia "Taxas & Despesas". */
  despesasPercent: number;
  /** Tudo que é descontado do preço, sem a margem. */
  deducoesPercent: number;
  /** Preço que entregaria a margem desejada, sempre calculado. */
  precoSugerido: number;
  /** Lucro por unidade no preço sugerido. */
  valorMargemSugerido: number;
  /** Preço em vigor: o sugerido, ou o fixado à mão no modo 'preco'. */
  preco: number;
  /** Margem que o preço em vigor realmente entrega. */
  margemReal: number;
  valorImposto: number;
  valorDespesas: number;
  valorMargem: number;
  margemContribuicao: number;
  /** Unidades necessárias para pagar a cota de custo fixo deste produto. */
  peUnidades: number;
  /** A margem de contribuição é positiva — o produto ajuda a pagar as contas. */
  isValidMargem: boolean;
  /** Tem rateio, mas nenhuma venda projetada: a cota dele some do preço. */
  rateioOcioso: boolean;
}

/**
 * Calcula um produto isolado dentro do contexto de custo fixo da empresa.
 *
 * `definicoes` é a lista de despesas variáveis do usuário; sem ela, as despesas
 * personalizadas não entram na conta.
 */
export function calcularProduto(
  p: ProdutoCalculo,
  custoFixoTotal: number,
  definicoes: DespesaVariavelDef[] = []
): ResultadoProduto {
  const imposto = p.imposto || 0;
  const taxaCartao = p.taxaCartao || 0;
  const comissao = p.comissao || 0;
  const personalizadas = somarDespesasPersonalizadas(p.despesasVariaveis, definicoes);
  const margem = p.margem || 0;
  const vendas = p.vendasProjetadas || 0;
  const rateio = p.percentualRateio || 0;

  const valorRateadoCF = (rateio / 100) * custoFixoTotal;
  const custoFixoUnitario = vendas > 0 ? valorRateadoCF / vendas : 0;

  const impostoPercent = imposto;
  const despesasPercent = taxaCartao + comissao + personalizadas;
  const deducoesPercent = impostoPercent + despesasPercent;

  const precoSugerido = calculateSellingPrice(
    p.cmv,
    custoFixoUnitario,
    impostoPercent / 100,
    despesasPercent / 100,
    0,
    margem / 100
  );
  const valorMargemSugerido = precoSugerido * (margem / 100);

  let preco = precoSugerido;
  let margemReal = margem;

  if (p.modoPrecificacao === 'preco') {
    preco = p.precoFixo || 0;
    const custoTotal = p.cmv + custoFixoUnitario;
    const lucroReais = preco - custoTotal - preco * (deducoesPercent / 100);
    margemReal = preco > 0 ? (lucroReais / preco) * 100 : 0;
  }

  const valorImposto = preco * (impostoPercent / 100);
  const valorDespesas = preco * (despesasPercent / 100);
  const valorMargem = preco * (margemReal / 100);
  const margemContribuicao = preco - p.cmv - valorImposto - valorDespesas;

  const isValidMargem = margemContribuicao > 0;

  return {
    valorRateadoCF,
    custoFixoUnitario,
    impostoPercent,
    despesasPercent,
    deducoesPercent,
    precoSugerido,
    valorMargemSugerido,
    preco,
    margemReal,
    valorImposto,
    valorDespesas,
    valorMargem,
    margemContribuicao,
    peUnidades: isValidMargem ? valorRateadoCF / margemContribuicao : Infinity,
    isValidMargem,
    rateioOcioso: rateio > 0 && vendas <= 0,
  };
}

export interface ResultadoMix<T extends ProdutoCalculo = ProdutoCalculo> {
  produtos: (T & ResultadoProduto)[];
  receitaTotal: number;
  vendasTotais: number;
  margemContribuicaoTotal: number;
  custosVariaveisTotais: number;
  impostoValorTotal: number;
  despesasValorTotal: number;
  /** Margem de contribuição total menos o custo fixo INTEIRO da empresa. */
  lucroLiquidoTotal: number;
  percMargemContribuicao: number;
  percLucroLiquido: number;
  pontoEquilibrioFaturamento: number;
  /** Soma dos percentuais de rateio. Deveria fechar em 100. */
  totalRateio: number;
  /**
   * Custo fixo que nenhum preço cobre, porque ninguém o rateou (rateio < 100%).
   */
  custoFixoNaoRateado: number;
  /**
   * Custo fixo rateado para produtos SEM vendas projetadas.
   *
   * O custo fixo unitário é a cota dividida pelas vendas; sem vendas, a divisão
   * não acontece e a cota simplesmente não entra em preço nenhum. O rateio fecha
   * 100%, a tela fica verde, todo produto aparece "no alvo" — e o dinheiro
   * sumiu. É o motivo de o Mix e o Dashboard poderem discordar.
   */
  custoFixoNaoAbsorvido: number;
  /** Produtos que seguram esse rateio ocioso. */
  produtosComRateioOcioso: (T & ResultadoProduto)[];
  /** O custo fixo que os preços de fato embutem. */
  custoFixoAbsorvido: number;
  /** Custo fixo que nenhum preço cobre, pelos dois motivos somados. */
  custoFixoDescoberto: number;
}

/**
 * Calcula o mix inteiro: cada produto e os totais da empresa.
 *
 * O lucro do mix usa o custo fixo TOTAL, não o rateado — é o resultado de
 * verdade. A diferença entre ele e a soma das margens "no alvo" de cada produto
 * é exatamente `custoFixoDescoberto`, e é isso que as telas precisam mostrar em
 * vez de deixar o usuário descobrir no extrato bancário.
 */
export function calcularMix<T extends ProdutoCalculo>(
  produtos: T[],
  custoFixoTotal: number,
  definicoes: DespesaVariavelDef[] = []
): ResultadoMix<T> {
  const calculados = produtos.map(p => ({ ...p, ...calcularProduto(p, custoFixoTotal, definicoes) }));

  let receitaTotal = 0;
  let vendasTotais = 0;
  let margemContribuicaoTotal = 0;
  let custosVariaveisTotais = 0;
  let impostoValorTotal = 0;
  let despesasValorTotal = 0;
  let custoFixoAbsorvido = 0;
  let totalRateio = 0;

  for (const p of calculados) {
    const vendas = p.vendasProjetadas || 0;
    receitaTotal += p.preco * vendas;
    vendasTotais += vendas;
    margemContribuicaoTotal += p.margemContribuicao * vendas;
    custosVariaveisTotais += p.cmv * vendas;
    impostoValorTotal += p.valorImposto * vendas;
    despesasValorTotal += p.valorDespesas * vendas;
    custoFixoAbsorvido += p.custoFixoUnitario * vendas;
    totalRateio += p.percentualRateio || 0;
  }

  const lucroLiquidoTotal = margemContribuicaoTotal - custoFixoTotal;
  const percMargemContribuicao = receitaTotal > 0 ? (margemContribuicaoTotal / receitaTotal) * 100 : 0;

  const custoFixoRateado = (totalRateio / 100) * custoFixoTotal;
  // Diferenças de centavo no rateio não são vazamento — só ruído de arredondamento.
  const arredondar = (v: number) => (Math.abs(v) < 0.005 ? 0 : v);

  return {
    produtos: calculados,
    receitaTotal,
    vendasTotais,
    margemContribuicaoTotal,
    custosVariaveisTotais,
    impostoValorTotal,
    despesasValorTotal,
    lucroLiquidoTotal,
    percMargemContribuicao,
    percLucroLiquido: receitaTotal > 0 ? (lucroLiquidoTotal / receitaTotal) * 100 : 0,
    pontoEquilibrioFaturamento:
      percMargemContribuicao > 0 ? custoFixoTotal / (percMargemContribuicao / 100) : 0,
    totalRateio,
    custoFixoNaoRateado: arredondar(custoFixoTotal - custoFixoRateado),
    custoFixoNaoAbsorvido: arredondar(custoFixoRateado - custoFixoAbsorvido),
    produtosComRateioOcioso: calculados.filter(p => p.rateioOcioso),
    custoFixoAbsorvido,
    custoFixoDescoberto: arredondar(custoFixoTotal - custoFixoAbsorvido),
  };
}
