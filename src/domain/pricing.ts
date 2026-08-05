/**
 * ATENÇÃO: módulo legado/simplificado.
 *
 * Existe um motor de precificação mais completo em `src/domain/pricing/index.ts`
 * (aceita impostos, taxas, comissão e cálculo de mix de produtos). As duas
 * versões coexistem porque nenhuma delas está atualmente conectada às páginas
 * — cada tela (FormacaoPreco, MixPreco, MixPrecoLote, CustoFixo...) reimplementa
 * a própria matemática inline. Antes de usar este arquivo em código novo,
 * prefira `src/domain/pricing/index.ts`; e ao alterar uma fórmula aqui, verifique
 * se a mesma correção não é necessária lá (e nas páginas, que hoje duplicam tudo
 * de novo). Unificar isso — fazendo as páginas consumirem um único módulo — é
 * um refactor pendente, não incluído neste patch por risco de regressão sem
 * testes de UI.
 */
export function calculateSellingPrice(cost: number, desiredMarginPercentage: number): number {
  if (desiredMarginPercentage >= 100) throw new Error("A margem deve ser menor que 100%");
  return cost / (1 - desiredMarginPercentage / 100);
}

export function calculateMarkup(cost: number, price: number): number {
  if (cost === 0) return 0;
  return ((price - cost) / cost) * 100;
}

export function calculateContributionMargin(price: number, cost: number): number {
  return price - cost;
}

export function calculateBreakEven(fixedCosts: number, avgContributionMargin: number): number {
  if (avgContributionMargin <= 0) return 0;
  return fixedCosts / avgContributionMargin;
}
