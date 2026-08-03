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
