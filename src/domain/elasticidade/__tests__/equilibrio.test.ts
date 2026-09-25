import { describe, it, expect } from 'vitest';
import {
  elasticidadeDeEquilibrio,
  elasticidadeDeEquilibrioMarginal,
  elasticidadeDeEquilibrioDoMix,
  vereditoDoCorte,
  ELASTICIDADE_REFERENCIA_VAREJO,
  type ItemEquilibrio,
} from '../equilibrio';

/** Preço que entrega a margem pedida, sem custo fixo. */
const precoPara = (cmv: number, deducoes: number, margem: number) =>
  cmv / (1 - (deducoes + margem) / 100);

const item = (cmv: number, deducoes: number, m0: number, m1: number, quantidade = 100): ItemEquilibrio => ({
  precoAtual: precoPara(cmv, deducoes, m0),
  precoNovo: precoPara(cmv, deducoes, m1),
  cmv,
  deducoesPercent: deducoes,
  quantidade,
});

describe('elasticidadeDeEquilibrio', () => {
  it('reproduz o caso de referência: 25% para 10%, deduções 15%', () => {
    const r = elasticidadeDeEquilibrio(item(32.20, 15, 25, 10));
    expect(r.elasticidade).toBeCloseTo(-5.11, 1);
    expect(r.variacaoPrecoPercent).toBeCloseTo(-20, 6);
  });

  it('mostra que a margem de contribuição cai muito mais que o preço', () => {
    const r = elasticidadeDeEquilibrio(item(32.20, 15, 25, 10));
    expect(r.variacaoPrecoPercent).toBeCloseTo(-20, 6);
    // O preço cai 20% e a margem que sobra para pagar as contas cai 68% — o
    // custo não acompanha o desconto. É a alavanca que ninguém enxerga.
    expect(r.variacaoMargemContribuicaoPercent).toBeCloseTo(-68, 0);
    // Para empatar, o volume teria que mais que triplicar.
    expect(r.aumentoVolumeNecessarioPercent).toBeCloseTo(212.5, 0);
  });

  it('não se aplica quando o preço sobe', () => {
    const r = elasticidadeDeEquilibrio(item(10, 15, 20, 30));
    expect(r.motivo).toBe('sem-corte');
    expect(r.elasticidade).toBeNull();
    expect(r.variacaoPrecoPercent).toBeGreaterThan(0);
  });

  it('recusa quando o preço novo não cobre o custo variável', () => {
    // Nenhum volume salva: cada unidade a mais aumenta o prejuízo.
    const r = elasticidadeDeEquilibrio({
      precoAtual: 50, precoNovo: 20, cmv: 30, deducoesPercent: 15, quantidade: 100,
    });
    expect(r.motivo).toBe('sem-margem');
    expect(r.elasticidade).toBeNull();
  });

  it('não estoura sem preço', () => {
    const r = elasticidadeDeEquilibrio({ precoAtual: 0, precoNovo: 0, cmv: 1, deducoesPercent: 15, quantidade: 1 });
    expect(r.motivo).toBe('sem-dados');
  });
});

describe('a lei -(1-d)/m', () => {
  it('bate com a conta exata num corte pequeno', () => {
    for (const m0 of [10, 15, 20, 25, 30, 40, 50, 60]) {
      const exato = elasticidadeDeEquilibrio(item(20, 15, m0, m0 - 0.1))!.elasticidade!;
      const lei = elasticidadeDeEquilibrioMarginal(m0, 15)!;
      expect(Math.abs(exato - lei)).toBeLessThan(0.05);
    }
  });

  it('o que manda é o nível da margem, não o tamanho do corte', () => {
    // Cortar 1 ponto de uma margem de 20% já exige quase tanto quanto cortar 10.
    const corteMinimo = elasticidadeDeEquilibrio(item(20, 15, 20, 19))!.elasticidade!;
    const corteGrande = elasticidadeDeEquilibrio(item(20, 15, 20, 10))!.elasticidade!;
    expect(corteMinimo).toBeLessThan(-4);
    expect(Math.abs(corteGrande - corteMinimo)).toBeLessThan(2);
  });

  it('margem alta tolera desconto; margem baixa não', () => {
    expect(elasticidadeDeEquilibrioMarginal(50, 15)!).toBeGreaterThan(ELASTICIDADE_REFERENCIA_VAREJO);
    expect(elasticidadeDeEquilibrioMarginal(20, 15)!).toBeLessThan(ELASTICIDADE_REFERENCIA_VAREJO);
  });

  it('sem margem não há lei', () => {
    expect(elasticidadeDeEquilibrioMarginal(0, 15)).toBeNull();
  });
});

describe('elasticidadeDeEquilibrioDoMix', () => {
  it('num mix de produtos iguais, dá o mesmo que o produto isolado', () => {
    const um = elasticidadeDeEquilibrio(item(20, 15, 25, 15))!.elasticidade!;
    const mix = elasticidadeDeEquilibrioDoMix([
      item(20, 15, 25, 15, 100), item(20, 15, 25, 15, 300),
    ])!.elasticidade!;
    expect(mix).toBeCloseTo(um, 2);
  });

  it('fica entre os extremos quando os produtos são diferentes', () => {
    const facil = elasticidadeDeEquilibrio(item(20, 15, 50, 45))!.elasticidade!;
    const dificil = elasticidadeDeEquilibrio(item(20, 15, 20, 15))!.elasticidade!;
    const mix = elasticidadeDeEquilibrioDoMix([
      item(20, 15, 50, 45, 100), item(20, 15, 20, 15, 100),
    ])!.elasticidade!;
    expect(mix).toBeLessThan(facil);
    expect(mix).toBeGreaterThan(dificil);
  });

  it('ignora produtos que não têm corte de preço', () => {
    const so = elasticidadeDeEquilibrioDoMix([item(20, 15, 25, 15, 100)])!.elasticidade!;
    const com = elasticidadeDeEquilibrioDoMix([
      item(20, 15, 25, 15, 100),
      { precoAtual: 30, precoNovo: 30, cmv: 10, deducoesPercent: 15, quantidade: 500 },
    ])!.elasticidade!;
    expect(com).toBeCloseTo(so, 6);
  });

  it('sem corte nenhum, não se aplica', () => {
    const r = elasticidadeDeEquilibrioDoMix([
      { precoAtual: 30, precoNovo: 30, cmv: 10, deducoesPercent: 15, quantidade: 5 },
    ]);
    expect(r.motivo).toBe('sem-corte');
    expect(r.elasticidade).toBeNull();
  });

  it('lista vazia não estoura', () => {
    expect(elasticidadeDeEquilibrioDoMix([]).motivo).toBe('sem-dados');
  });
});

describe('vereditoDoCorte', () => {
  const corteEmMargemBaixa = elasticidadeDeEquilibrio(item(20, 15, 20, 15));
  const corteEmMargemAlta = elasticidadeDeEquilibrio(item(20, 15, 50, 45));

  it('sem medição, usa o teto do varejo como régua', () => {
    expect(vereditoDoCorte(corteEmMargemBaixa)).toBe('improvavel');
    expect(vereditoDoCorte(corteEmMargemAlta)).toBe('plausivel');
  });

  it('a elasticidade medida manda mais que a régua genérica', () => {
    // Um corte que a régua reprovaria passa se o histórico mostrar reação forte.
    expect(vereditoDoCorte(corteEmMargemBaixa, -6)).toBe('plausivel');
    // E um que ela aprovaria reprova se o histórico mostrar reação fraca.
    expect(vereditoDoCorte(corteEmMargemAlta, -1)).toBe('improvavel');
  });

  it('preço abaixo do custo variável é sempre improvável', () => {
    const r = elasticidadeDeEquilibrio({ precoAtual: 50, precoNovo: 20, cmv: 30, deducoesPercent: 15, quantidade: 1 });
    expect(vereditoDoCorte(r, -9)).toBe('improvavel');
  });

  it('aumento de preço não recebe veredito', () => {
    expect(vereditoDoCorte(elasticidadeDeEquilibrio(item(20, 15, 20, 30)))).toBe('nao-se-aplica');
  });
});
