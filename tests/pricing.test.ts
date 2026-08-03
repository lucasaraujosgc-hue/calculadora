import { describe, it, expect } from 'vitest';
import { calculateSellingPrice, calculateMarkup, calculateContributionMargin, calculateBreakEven } from '../src/domain/pricing';

describe('Pricing Engine', () => {
  it('should calculate selling price correctly', () => {
    expect(calculateSellingPrice(100, 20)).toBe(125);
  });
  
  it('should calculate markup correctly', () => {
    expect(calculateMarkup(100, 150)).toBe(50);
  });
  
  it('should calculate contribution margin correctly', () => {
    expect(calculateContributionMargin(150, 100)).toBe(50);
  });
  
  it('should calculate break even point correctly', () => {
    expect(calculateBreakEven(1000, 50)).toBe(20);
  });
});
