import { describe, it, expect } from 'vitest';
import {
  calculateMarkup,
  calculateContributionMargin,
  calculateContributionMarginPercent,
  calculateBreakEven,
  calculateMixBreakEven,
  calculateOperatingResult,
  calculateSellingPrice
} from '../index';

describe('Pricing Engine', () => {
  it('calculateMarkup', () => {
    expect(calculateMarkup(100, 150)).toBe(50);
    expect(calculateMarkup(50, 100)).toBe(100);
    expect(calculateMarkup(0, 100)).toBe(0); // Zero cost
  });

  it('calculateContributionMargin', () => {
    const margin = calculateContributionMargin({
      costPrice: 50,
      salePrice: 100,
      taxesPercent: 0.1, // 10
      feesPercent: 0.05, // 5
      comissionPercent: 0.05, // 5
    });
    expect(margin).toBe(30); // 100 - 50 - 10 - 5 - 5 = 30
  });

  it('calculateContributionMarginPercent', () => {
    const marginPercent = calculateContributionMarginPercent({
      costPrice: 50,
      salePrice: 100,
      taxesPercent: 0.1,
      feesPercent: 0.05,
      comissionPercent: 0.05,
    });
    expect(marginPercent).toBe(30);
    
    // Zero division check
    expect(calculateContributionMarginPercent({
      costPrice: 50,
      salePrice: 0
    })).toBe(0);
  });

  it('calculateBreakEven', () => {
    // MC = 30
    const breakEven = calculateBreakEven({
      costPrice: 50,
      salePrice: 100,
      taxesPercent: 0.1,
      feesPercent: 0.05,
      comissionPercent: 0.05,
      fixedCosts: 3000,
    });
    expect(breakEven).toBe(100); // 3000 / 30 = 100
  });

  it('calculateMixBreakEven', () => {
    const products = [
      {
        costPrice: 50, salePrice: 100, projectedSales: 100, // Revenue: 10000, MC: 50 * 100 = 5000
      },
      {
        costPrice: 200, salePrice: 500, projectedSales: 20, // Revenue: 10000, MC: 300 * 20 = 6000
      }
    ];
    // Total Revenue: 20000
    // Total MC: 11000
    // Weighted MC %: 11000 / 20000 = 0.55
    // Fixed Costs: 5500
    // BE = 5500 / 0.55 = 10000
    
    const be = calculateMixBreakEven(products, 5500);
    expect(be).toBe(10000);
  });

  it('calculateOperatingResult', () => {
    const products = [
      { costPrice: 50, salePrice: 100, projectedSales: 100 }, // MC = 50 * 100 = 5000
      { costPrice: 200, salePrice: 500, projectedSales: 20 }  // MC = 300 * 20 = 6000
    ];
    // Total MC = 11000
    // Fixed Costs = 5500
    // Result = 5500
    
    const result = calculateOperatingResult(products, 5500);
    expect(result).toBe(5500);
    
    // Loss check
    expect(calculateOperatingResult(products, 15000)).toBe(-4000);
  });

  it('calculateSellingPrice - complete scenario', () => {
    // custo = 100
    // imposto = 10%
    // taxa = 5%
    // comissão = 2%
    // margem = 20%
    // Deductions = 0.10 + 0.05 + 0.02 + 0.20 = 0.37
    // Selling Price = 100 / (1 - 0.37) = 100 / 0.63 = 158.730158...
    const sp = calculateSellingPrice(100, 0, 0.10, 0.05, 0.02, 0.20);
    expect(sp).toBeCloseTo(158.73, 2);
  });

  it('calculateSellingPrice', () => {
    // Cost: 50
    // Desired Margin: 30% (0.3)
    // Deductions: 10% (0.1) taxes, 5% (0.05) fees, 5% (0.05) comissions
    // Total Deductions: 0.3 + 0.1 + 0.05 + 0.05 = 0.5
    // Selling Price = 50 / (1 - 0.5) = 100
    
    const sp = calculateSellingPrice(50, 0, 0.1, 0.05, 0.05, 0.3);
    expect(sp).toBe(100);
    
    // Invalid deductions (>= 100%)
    expect(calculateSellingPrice(50, 0, 0.5, 0.5, 0.1, 0.1)).toBe(0);
  });
});
