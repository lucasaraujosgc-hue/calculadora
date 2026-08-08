/**
 * Pricing Engine
 * Fórmulas independentes da interface para cálculos financeiros
 */

export interface PricingParams {
  costPrice: number;
  salePrice: number;
  projectedSales?: number;
  fixedCosts?: number; // Total de custos fixos da empresa
  unitFixedCost?: number; // Custo fixo unitário (opcional)
  taxesPercent?: number; // Ex: 0.15 para 15%
  feesPercent?: number; // Ex: 0.05 para 5%
  comissionPercent?: number; // Ex: 0.02 para 2%
}

/**
 * Calcula o Markup
 * Markup = (Preço de Venda - Custo) / Custo * 100
 */
export function calculateMarkup(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0;
  return ((salePrice - costPrice) / costPrice) * 100;
}

/**
 * Calcula a Margem de Contribuição (Valor Monetário)
 * MC = Preço de Venda - Custo Variável - Impostos Variáveis - Taxas - Comissões
 */
export function calculateContributionMargin(params: PricingParams): number {
  const taxes = params.salePrice * (params.taxesPercent || 0);
  const fees = params.salePrice * (params.feesPercent || 0);
  const comission = params.salePrice * (params.comissionPercent || 0);
  
  return params.salePrice - params.costPrice - taxes - fees - comission;
}

/**
 * Calcula a Margem de Contribuição (Percentual)
 */
export function calculateContributionMarginPercent(params: PricingParams): number {
  if (params.salePrice <= 0) return 0;
  const margin = calculateContributionMargin(params);
  return (margin / params.salePrice) * 100;
}

/**
 * Calcula o Ponto de Equilíbrio de um único produto (em unidades)
 * PE = Custos Fixos / Margem de Contribuição Unitária
 */
export function calculateBreakEven(params: PricingParams): number {
  const margin = calculateContributionMargin(params);
  if (margin <= 0) return Infinity; // Se a margem for zero ou negativa, nunca alcança o ponto de equilíbrio
  const fixed = params.fixedCosts || 0;
  return fixed / margin;
}

/**
 * Calcula o Ponto de Equilíbrio da Empresa (em faturamento) baseado no Mix
 * Recebe a lista de produtos, seus volumes e os custos fixos totais.
 */
export function calculateMixBreakEven(
  products: (PricingParams & { projectedSales: number })[],
  totalFixedCosts: number
): number {
  let totalRevenue = 0;
  let totalContributionMargin = 0;

  for (const p of products) {
    const revenue = p.salePrice * p.projectedSales;
    const margin = calculateContributionMargin(p) * p.projectedSales;
    totalRevenue += revenue;
    totalContributionMargin += margin;
  }

  if (totalRevenue === 0) return 0;
  
  const weightedMarginPercent = totalContributionMargin / totalRevenue;
  
  if (weightedMarginPercent <= 0) return Infinity;

  return totalFixedCosts / weightedMarginPercent;
}

/**
 * Calcula o Resultado Operacional (Lucro/Prejuízo)
 */
export function calculateOperatingResult(
  products: (PricingParams & { projectedSales: number })[],
  totalFixedCosts: number
): number {
  let totalContributionMargin = 0;

  for (const p of products) {
    const margin = calculateContributionMargin(p) * p.projectedSales;
    totalContributionMargin += margin;
  }

  return totalContributionMargin - totalFixedCosts;
}

/**
 * Calcula o Preço de Venda ideal baseado em uma margem desejada
 * Preço = Custo / (1 - (Impostos + Taxas + Comissões + Margem Desejada))
 */
export function calculateSellingPrice(
  unitFixedCost: number,
  costPrice: number,
  taxesPercent: number,
  feesPercent: number,
  comissionPercent: number,
  desiredMarginPercent: number
): number {
  const totalDeductions = taxesPercent + feesPercent + comissionPercent + desiredMarginPercent;
  if (totalDeductions >= 1) return 0; // Inválido, as deduções consomem 100% ou mais do preço
  
  return (costPrice + unitFixedCost) / (1 - totalDeductions);
}
