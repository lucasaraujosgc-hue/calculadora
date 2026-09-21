import { describe, it, expect } from 'vitest';
import {
  calculateSellingPrice,
  calcularProduto,
  calcularMix,
  somarDespesasPersonalizadas,
  resolverMargem,
  type DespesaVariavelDef,
  type EstrategiaDef,
  type ProdutoCalculo,
} from '../index';

const FRETE: DespesaVariavelDef = { id: 'd1', nome: 'Frete' };
const EMBALAGEM: DespesaVariavelDef = { id: 'd2', nome: 'Embalagem' };

const ATRACAO: EstrategiaDef = { id: 'e1', nome: 'Atração', margem: 10 };
const PADRAO: EstrategiaDef = { id: 'e2', nome: 'Padrão', margem: 20 };
const ALTA: EstrategiaDef = { id: 'e3', nome: 'Margem alta', margem: 30 };
const ESTRATEGIAS = [ATRACAO, PADRAO, ALTA];

describe('calculateSellingPrice', () => {
  it('embute a margem como fração do preço, não como markup sobre o custo', () => {
    // 100 / (1 - 0,20) = 125 — e 20% de 125 são 25, a margem pedida.
    expect(calculateSellingPrice(100, 0, 0, 0, 0, 0.2)).toBe(125);
  });

  it('soma o custo fixo unitário ao CMV antes de aplicar a margem', () => {
    expect(calculateSellingPrice(80, 20, 0, 0, 0, 0.2)).toBe(125);
  });

  it('devolve 0 quando as deduções consomem o preço inteiro', () => {
    expect(calculateSellingPrice(100, 0, 0.5, 0.3, 0.1, 0.1)).toBe(0);
    expect(calculateSellingPrice(100, 0, 0.9, 0.2, 0, 0)).toBe(0);
  });
});

describe('somarDespesasPersonalizadas', () => {
  it('soma só as despesas que ainda existem na lista do usuário', () => {
    const valores = { d1: 3, d2: 2, apagada: 99 };
    expect(somarDespesasPersonalizadas(valores, [FRETE, EMBALAGEM])).toBe(5);
  });

  it('ignora produto sem despesas personalizadas', () => {
    expect(somarDespesasPersonalizadas(undefined, [FRETE])).toBe(0);
  });

  it('para de contar uma despesa assim que ela é removida da lista', () => {
    const valores = { d1: 3 };
    expect(somarDespesasPersonalizadas(valores, [])).toBe(0);
  });
});

describe('calcularProduto', () => {
  const base: ProdutoCalculo = {
    id: 'p1',
    cmv: 50,
    vendasProjetadas: 200,
    percentualRateio: 100,
    imposto: 8,
    taxaCartao: 5,
    comissao: 2,
    margem: 25,
  };

  it('rateia o custo fixo pelas vendas projetadas', () => {
    const r = calcularProduto(base, 10000);
    expect(r.valorRateadoCF).toBe(10000);
    expect(r.custoFixoUnitario).toBe(50);
  });

  it('separa imposto das demais despesas para a composição do preço', () => {
    const r = calcularProduto(base, 10000);
    expect(r.impostoPercent).toBe(8);
    expect(r.despesasPercent).toBe(7);
    expect(r.deducoesPercent).toBe(15);
  });

  it('inclui as despesas personalizadas nas deduções', () => {
    const r = calcularProduto({ ...base, despesasVariaveis: { d1: 3, d2: 2 } }, 10000, [FRETE, EMBALAGEM]);
    expect(r.despesasPercent).toBe(12);
    expect(r.deducoesPercent).toBe(20);
  });

  it('entrega exatamente a margem pedida no preço sugerido', () => {
    const r = calcularProduto(base, 10000);
    // (50 + 50) / (1 - 0,40) = 166,67
    expect(r.preco).toBeCloseTo(166.67, 2);
    expect(r.margemReal).toBe(25);
  });

  it('recalcula a margem real quando o usuário fixa o preço', () => {
    const r = calcularProduto({ ...base, modoPrecificacao: 'preco', precoFixo: 120 }, 10000);
    // 120 - (50 + 50) - 15% de 120 = 2 -> 1,67% de 120
    expect(r.margemReal).toBeCloseTo(1.67, 2);
    expect(r.valorMargem).toBeCloseTo(2, 2);
  });

  it('acusa prejuízo quando o preço fixado não cobre nem o custo variável', () => {
    const r = calcularProduto({ ...base, modoPrecificacao: 'preco', precoFixo: 55 }, 10000);
    expect(r.isValidMargem).toBe(false);
    expect(r.peUnidades).toBe(Infinity);
  });

  it('marca o rateio como ocioso quando o produto não tem vendas projetadas', () => {
    const r = calcularProduto({ ...base, vendasProjetadas: 0 }, 10000);
    expect(r.rateioOcioso).toBe(true);
    // A cota existe em reais, mas não entra em preço nenhum.
    expect(r.valorRateadoCF).toBe(10000);
    expect(r.custoFixoUnitario).toBe(0);
  });

  it('não marca rateio ocioso em produto sem rateio', () => {
    const r = calcularProduto({ ...base, vendasProjetadas: 0, percentualRateio: 0 }, 10000);
    expect(r.rateioOcioso).toBe(false);
  });
});

describe('calcularMix', () => {
  it('fecha o resultado com o custo fixo inteiro, não com o rateado', () => {
    const mix = calcularMix(
      [{ id: 'a', cmv: 50, vendasProjetadas: 200, percentualRateio: 100, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25 }],
      10000
    );
    expect(mix.lucroLiquidoTotal).toBeCloseTo(mix.margemContribuicaoTotal - 10000, 6);
    expect(mix.custoFixoDescoberto).toBe(0);
  });

  it('denuncia o custo fixo que evapora em produto sem vendas projetadas', () => {
    // O caso que deixava o Mix verde e o Dashboard no vermelho: rateio fecha
    // 100%, os dois produtos "no alvo" de 10%, e metade do custo fixo não está
    // em preço nenhum.
    const mix = calcularMix(
      [
        { id: 'a', cmv: 50, vendasProjetadas: 200, percentualRateio: 50, imposto: 8, taxaCartao: 5, comissao: 2, margem: 10 },
        { id: 'b', cmv: 50, vendasProjetadas: 0, percentualRateio: 50, imposto: 8, taxaCartao: 5, comissao: 2, margem: 10 },
      ],
      10000
    );

    expect(mix.totalRateio).toBe(100);
    expect(mix.custoFixoNaoRateado).toBe(0);
    expect(mix.custoFixoNaoAbsorvido).toBe(5000);
    expect(mix.custoFixoDescoberto).toBe(5000);
    expect(mix.produtosComRateioOcioso.map(p => p.id)).toEqual(['b']);
    expect(mix.lucroLiquidoTotal).toBeLessThan(0);
  });

  it('denuncia o custo fixo que ninguém rateou', () => {
    const mix = calcularMix(
      [{ id: 'a', cmv: 50, vendasProjetadas: 200, percentualRateio: 60, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25 }],
      10000
    );
    expect(mix.custoFixoNaoRateado).toBe(4000);
    expect(mix.custoFixoNaoAbsorvido).toBe(0);
    expect(mix.custoFixoDescoberto).toBe(4000);
  });

  it('não acusa vazamento por arredondamento de centavo no rateio', () => {
    const mix = calcularMix(
      [
        { id: 'a', cmv: 10, vendasProjetadas: 100, percentualRateio: 33.3333, margem: 20 },
        { id: 'b', cmv: 10, vendasProjetadas: 100, percentualRateio: 33.3333, margem: 20 },
        { id: 'c', cmv: 10, vendasProjetadas: 100, percentualRateio: 33.3334, margem: 20 },
      ],
      3000
    );
    expect(mix.custoFixoDescoberto).toBe(0);
  });

  it('calcula o ponto de equilíbrio pelo índice de margem de contribuição', () => {
    const mix = calcularMix(
      [{ id: 'a', cmv: 50, vendasProjetadas: 200, percentualRateio: 100, imposto: 8, taxaCartao: 5, comissao: 2, margem: 25 }],
      10000
    );
    const esperado = 10000 / (mix.percMargemContribuicao / 100);
    expect(mix.pontoEquilibrioFaturamento).toBeCloseTo(esperado, 6);
  });

  it('devolve zeros em vez de NaN quando não há receita', () => {
    const mix = calcularMix([], 10000);
    expect(mix.receitaTotal).toBe(0);
    expect(mix.percMargemContribuicao).toBe(0);
    expect(mix.percLucroLiquido).toBe(0);
    expect(mix.pontoEquilibrioFaturamento).toBe(0);
    expect(mix.lucroLiquidoTotal).toBe(-10000);
  });

  it('soma as despesas personalizadas nos totais do mix', () => {
    const semFrete = calcularMix(
      [{ id: 'a', cmv: 50, vendasProjetadas: 100, percentualRateio: 100, margem: 20, despesasVariaveis: { d1: 5 } }],
      1000
    );
    const comFrete = calcularMix(
      [{ id: 'a', cmv: 50, vendasProjetadas: 100, percentualRateio: 100, margem: 20, despesasVariaveis: { d1: 5 } }],
      1000,
      [FRETE]
    );
    expect(comFrete.produtos[0].preco).toBeGreaterThan(semFrete.produtos[0].preco);
    expect(comFrete.despesasValorTotal).toBeGreaterThan(0);
    expect(semFrete.despesasValorTotal).toBe(0);
  });
});

describe('resolverMargem', () => {
  it('usa a margem da estratégia quando o produto segue uma', () => {
    const r = resolverMargem({ margem: 99, estrategiaId: 'e1' }, ESTRATEGIAS);
    expect(r.margem).toBe(10);
    expect(r.estrategia?.nome).toBe('Atração');
  });

  it('usa a margem do próprio produto quando é Personalizado', () => {
    const r = resolverMargem({ margem: 37, estrategiaId: null }, ESTRATEGIAS);
    expect(r.margem).toBe(37);
    expect(r.estrategia).toBeNull();
  });

  it('cai para a margem do produto quando a estratégia foi apagada', () => {
    // Apagar uma faixa não pode zerar o preço de quem a seguia: o produto volta
    // a valer pela própria margem, que é o último valor conhecido dele.
    const r = resolverMargem({ margem: 22, estrategiaId: 'sumiu' }, ESTRATEGIAS);
    expect(r.margem).toBe(22);
    expect(r.estrategia).toBeNull();
  });

  it('trata produto sem margem nem estratégia como zero', () => {
    expect(resolverMargem({}, ESTRATEGIAS).margem).toBe(0);
  });
});

describe('estratégias de margem no cálculo', () => {
  const produto: ProdutoCalculo = {
    id: 'p1', cmv: 50, vendasProjetadas: 100, percentualRateio: 100,
    imposto: 8, taxaCartao: 5, comissao: 2, margem: 99,
  };

  it('o preço segue a estratégia, não a margem gravada no produto', () => {
    const comEstrategia = calcularProduto({ ...produto, estrategiaId: 'e2' }, 1000, [], ESTRATEGIAS);
    const equivalente = calcularProduto({ ...produto, margem: 20 }, 1000);
    expect(comEstrategia.preco).toBeCloseTo(equivalente.preco, 6);
    expect(comEstrategia.margemAlvo).toBe(20);
    expect(comEstrategia.estrategia?.nome).toBe('Padrão');
  });

  it('mudar a margem da faixa muda o preço de todos os produtos dela', () => {
    const mix = (margemPadrao: number) => calcularMix(
      [
        { id: 'a', cmv: 10, vendasProjetadas: 100, percentualRateio: 50, estrategiaId: 'e2' },
        { id: 'b', cmv: 20, vendasProjetadas: 100, percentualRateio: 50, estrategiaId: 'e2' },
      ],
      1000, [],
      [{ ...PADRAO, margem: margemPadrao }]
    );
    const antes = mix(20);
    const depois = mix(35);
    expect(depois.produtos[0].preco).toBeGreaterThan(antes.produtos[0].preco);
    expect(depois.produtos[1].preco).toBeGreaterThan(antes.produtos[1].preco);
    expect(depois.produtos.every(p => p.margemAlvo === 35)).toBe(true);
  });

  it('produtos de faixas diferentes recebem multiplicadores diferentes', () => {
    // O contrário da margem uniforme: mesmo custo, preços diferentes porque o
    // papel de cada item no mix é diferente.
    const mix = calcularMix(
      [
        { id: 'isca', cmv: 30, vendasProjetadas: 100, percentualRateio: 50, estrategiaId: 'e1' },
        { id: 'gordo', cmv: 30, vendasProjetadas: 100, percentualRateio: 50, estrategiaId: 'e3' },
      ],
      0, [], ESTRATEGIAS
    );
    const [isca, gordo] = mix.produtos;
    expect(isca.preco).toBeLessThan(gordo.preco);
    expect(isca.estrategia?.nome).toBe('Atração');
    expect(gordo.estrategia?.nome).toBe('Margem alta');
  });

  it('preço fixo continua ignorando a estratégia e reportando a margem real', () => {
    const r = calcularProduto(
      { ...produto, estrategiaId: 'e3', modoPrecificacao: 'preco', precoFixo: 100 },
      0, [], ESTRATEGIAS
    );
    expect(r.preco).toBe(100);
    expect(r.margemAlvo).toBe(30);       // a faixa que ele segue
    expect(r.margemReal).toBeCloseTo(35, 6); // 100 - 50 - 15% de 100 = 35
  });
});
