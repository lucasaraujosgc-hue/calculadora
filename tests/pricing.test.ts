import { describe, it, expect } from 'vitest';
import { calculateSellingPrice, calculateMarkup, calculateContributionMargin, calculateBreakEven } from '../src/domain/pricing';

describe('Pricing Engine', () => {
  it('should calculate selling price correctly', () => {
    // 100 / (1 - 0.20) = 125
    expect(calculateSellingPrice(100, 0, 0, 0, 0, 0.20)).toBe(125);
  });
  
  it('should calculate markup correctly', () => {
    expect(calculateMarkup(100, 150)).toBe(50);
  });
  
  it('should calculate contribution margin correctly', () => {
    expect(calculateContributionMargin({ salePrice: 150, costPrice: 100 })).toBe(50);
  });
  
  it('should calculate break even point correctly', () => {
    expect(calculateBreakEven({ salePrice: 150, costPrice: 100, fixedCosts: 1000 })).toBe(20);
  });
});
