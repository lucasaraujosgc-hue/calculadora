import { describe, it, expect } from 'vitest';
import {
  ALIQUOTA_REF_CBS,
  ALIQUOTA_REF_IBS,
  PRESETS_REGIME,
  parcelaPisCofins,
  projetarPrecoReforma,
  aliquotasDoAno,
  apurarIVA,
  baseDoPrecoPorFora,
  calcularDASReforma,
  porDentroParaPorFora,
  porForaParaPorDentro,
  precoComTributoPorFora,
  precoPorDentro,
  precoPorFora,
} from '../index';

describe('Cronograma da transição', () => {
  it('2026 é ano-teste: CBS 0,9% + IBS 0,1%, com PIS/COFINS ainda vigentes', () => {
    const a = aliquotasDoAno(2026);
    expect(a.cbs).toBe(0.9);
    expect(a.ibs).toBe(0.1);
    expect(a.pisCofinsVigente).toBe(true);
    expect(a.cbsCompensavelComPisCofins).toBe(true);
    expect(a.fatorIcmsIss).toBe(1);
  });

  it('2027 muda só a CBS: PIS/COFINS extintos, ICMS e ISS integrais', () => {
    const a = aliquotasDoAno(2027);
    expect(a.cbs).toBeCloseTo(ALIQUOTA_REF_CBS - 0.1, 10); // redução de 0,1 p.p. em 2027/2028
    expect(a.ibs).toBe(0.1); // IBS ainda em alíquota de teste
    expect(a.pisCofinsVigente).toBe(false);
    expect(a.ipiVigente).toBe(false);
    expect(a.fatorIcmsIss).toBe(1);
  });

  it('2029 a 2032 escalonam o IBS e reduzem ICMS/ISS', () => {
    expect(aliquotasDoAno(2029).ibs).toBeCloseTo(ALIQUOTA_REF_IBS * 0.1, 10);
    expect(aliquotasDoAno(2029).fatorIcmsIss).toBe(0.9);
    expect(aliquotasDoAno(2032).ibs).toBeCloseTo(ALIQUOTA_REF_IBS * 0.4, 10);
    expect(aliquotasDoAno(2032).fatorIcmsIss).toBe(0.6);
  });

  it('2033 é o regime pleno: IVA integral e ICMS/ISS extintos', () => {
    const a = aliquotasDoAno(2033);
    expect(a.cbs).toBe(ALIQUOTA_REF_CBS);
    expect(a.ibs).toBe(ALIQUOTA_REF_IBS);
    expect(a.totalPorFora).toBeCloseTo(ALIQUOTA_REF_CBS + ALIQUOTA_REF_IBS, 10);
    expect(a.fatorIcmsIss).toBe(0);
  });

  it('a alíquota de referência da CBS é 9,21%', () => {
    expect(ALIQUOTA_REF_CBS).toBe(9.21);
    expect(aliquotasDoAno(2027).cbs).toBeCloseTo(9.11, 10); // 9,21 − 0,1 p.p.
  });

  it('aceita alíquotas de referência customizadas', () => {
    expect(aliquotasDoAno(2033, 10, 20).totalPorFora).toBe(30);
  });
});

describe('Conversão por dentro × por fora', () => {
  it('converte alíquota por dentro em por fora', () => {
    expect(porDentroParaPorFora(20)).toBeCloseTo(25, 10); // 20/(100-20)
    expect(porDentroParaPorFora(18)).toBeCloseTo(21.9512, 3);
  });

  it('converte alíquota por fora na carga sobre o preço final', () => {
    expect(porForaParaPorDentro(25)).toBeCloseTo(20, 10);
    expect(porForaParaPorDentro(26.5)).toBeCloseTo(20.9486, 3);
  });

  it('as duas conversões são inversas uma da outra', () => {
    expect(porForaParaPorDentro(porDentroParaPorFora(9.25))).toBeCloseTo(9.25, 10);
  });

  it('soma o tributo por fora e volta à base', () => {
    expect(precoComTributoPorFora(100, 8.7)).toBeCloseTo(108.7, 10);
    expect(baseDoPrecoPorFora(108.7, 8.7)).toBeCloseTo(100, 10);
  });
});

describe('Apuração de CBS e IBS', () => {
  it('tributa apenas o valor agregado (débito − crédito)', () => {
    const r = apurarIVA(100000, 60000, 8.7, 0.1, 'padrao');
    expect(r.cbsDebito).toBeCloseTo(8700, 10);
    expect(r.cbsCredito).toBeCloseTo(5220, 10);
    expect(r.cbsLiquida).toBeCloseTo(3480, 10); // 8,7% sobre os 40 mil agregados
    expect(r.saldoCredor).toBe(0);
  });

  it('aplica o redutor de 60% na saída sem reduzir o crédito da entrada', () => {
    const r = apurarIVA(100000, 60000, 10, 0, 'reducao60');
    expect(r.aliquotaCbsAplicada).toBeCloseTo(4, 10);
    expect(r.cbsDebito).toBeCloseTo(4000, 10);
    expect(r.cbsCredito).toBeCloseTo(6000, 10); // crédito pela alíquota cheia
    expect(r.totalARecolher).toBe(0);
    expect(r.saldoCredor).toBeCloseTo(2000, 10);
  });

  it('aplica o redutor de 30%', () => {
    const r = apurarIVA(100000, 0, 10, 0, 'reducao30');
    expect(r.aliquotaCbsAplicada).toBeCloseTo(7, 10);
    expect(r.cbsDebito).toBeCloseTo(7000, 10);
  });

  it('alíquota zero não tributa a saída mas mantém o crédito das compras', () => {
    const r = apurarIVA(100000, 60000, 8.7, 0, 'zero');
    expect(r.cbsDebito).toBe(0);
    expect(r.cbsCredito).toBeCloseTo(5220, 10);
    expect(r.saldoCredor).toBeCloseTo(5220, 10);
  });

  it('revenda monofásica não tributa a saída nem gera crédito', () => {
    const r = apurarIVA(100000, 60000, 8.7, 0, 'monofasicoRevenda');
    expect(r.cbsDebito).toBe(0);
    expect(r.cbsCredito).toBe(0);
    expect(r.totalARecolher).toBe(0);
    expect(r.saldoCredor).toBe(0);
  });
});

describe('Simples Nacional na reforma', () => {
  const REP = { pisCofins: 12.74 + 2.76, icmsIss: 33.5 };

  it('dentro do DAS, o valor pago não muda', () => {
    const r = calcularDASReforma(5000, REP.pisCofins, REP.icmsIss, 1, false, false);
    expect(r.dasFinal).toBe(5000);
    expect(r.parcelaCbsRetirada).toBe(0);
  });

  it('fora do DAS em 2027, sai apenas a parcela de PIS/COFINS (a CBS)', () => {
    const r = calcularDASReforma(5000, REP.pisCofins, REP.icmsIss, 1, false, true);
    expect(r.parcelaCbsRetirada).toBeCloseTo(5000 * (REP.pisCofins / 100), 10);
    expect(r.parcelaIbsRetirada).toBe(0); // ICMS/ISS ainda integrais em 2027
    expect(r.dasFinal).toBeCloseTo(5000 - 5000 * (REP.pisCofins / 100), 10);
  });

  it('em 2026 nada sai do DAS, porque PIS e COFINS ainda existem', () => {
    const r = calcularDASReforma(5000, REP.pisCofins, REP.icmsIss, 1, true, true);
    expect(r.parcelaCbsRetirada).toBe(0);
    expect(r.dasFinal).toBe(5000);
  });

  it('a partir de 2029 sai também a fração de ICMS/ISS já convertida em IBS', () => {
    const r = calcularDASReforma(5000, REP.pisCofins, REP.icmsIss, 0.9, false, true);
    expect(r.parcelaIbsRetirada).toBeCloseTo(5000 * (REP.icmsIss * 0.1) / 100, 10);
  });
});

describe('Formação de preço', () => {
  it('por dentro: o tributo é parte do preço', () => {
    const r = precoPorDentro({
      custo: 100,
      despesasPercent: 10,
      margemPercent: 20,
      tributosPorDentroPercent: 10,
    });
    expect(r.precoFinal).toBeCloseTo(100 / 0.6, 10); // 166,67
    expect(r.tributos).toBeCloseTo(r.precoFinal * 0.1, 10);
    expect(r.cargaSobrePrecoFinal).toBeCloseTo(10, 10);
  });

  it('por fora: o preço é formado sem o IVA e o IVA é somado depois', () => {
    const r = precoPorFora({
      custo: 100,
      despesasPercent: 10,
      margemPercent: 20,
      aliquotaPorForaPercent: 10,
    });
    expect(r.receitaLiquida).toBeCloseTo(100 / 0.7, 10); // 142,86
    expect(r.precoFinal).toBeCloseTo((100 / 0.7) * 1.1, 10); // 157,14
    // A carga sobre o preço final é menor que a alíquota nominal por fora.
    expect(r.cargaSobrePrecoFinal).toBeCloseTo(porForaParaPorDentro(10), 10);
  });

  it('por fora com crédito na compra: o custo real cai', () => {
    const semCredito = precoPorFora({
      custo: 100,
      despesasPercent: 0,
      margemPercent: 20,
      aliquotaPorForaPercent: 8.7,
    });
    const comCredito = precoPorFora({
      custo: 100,
      creditoSobreCusto: 8,
      despesasPercent: 0,
      margemPercent: 20,
      aliquotaPorForaPercent: 8.7,
    });
    expect(comCredito.custoLiquido).toBe(92);
    expect(comCredito.precoFinal).toBeLessThan(semCredito.precoFinal);
  });

  it('por fora em 2027, com ICMS ainda por dentro', () => {
    const r = precoPorFora({
      custo: 100,
      despesasPercent: 0,
      margemPercent: 20,
      aliquotaPorForaPercent: 8.7,
      tributosPorDentroPercent: 18,
    });
    expect(r.receitaLiquida).toBeCloseTo(100 / 0.62, 10);
    expect(r.precoFinal).toBeCloseTo((100 / 0.62) * 1.087, 10);
  });

  it('retorna zero quando as deduções consomem todo o preço', () => {
    expect(precoPorDentro({ custo: 100, despesasPercent: 50, margemPercent: 30, tributosPorDentroPercent: 25 }).precoFinal).toBe(0);
    expect(precoPorFora({ custo: 100, despesasPercent: 60, margemPercent: 40, aliquotaPorForaPercent: 10 }).precoFinal).toBe(0);
  });
});

describe('Parcela de PIS/COFINS por regime', () => {
  it('Lucro Presumido usa 3,65% e Lucro Real 9,25%', () => {
    expect(parcelaPisCofins('presumido', 21.65, 'Anexo I', 0)).toBeCloseTo(3.65, 10);
    expect(parcelaPisCofins('real', 27.25, 'Anexo I', 0)).toBeCloseTo(9.25, 10);
  });

  it('nunca devolve mais do que o imposto informado', () => {
    expect(parcelaPisCofins('presumido', 2, 'Anexo I', 0)).toBeCloseTo(2, 10);
  });

  it('no Simples usa a repartição do anexo e da faixa', () => {
    // Anexo I, faixa 1: PIS 2,76% + COFINS 12,74% = 15,5% do DAS.
    expect(parcelaPisCofins('simplesFora', 10, 'Anexo I', 0)).toBeCloseTo(1.55, 10);
  });

  it('regimes em que o preço não muda devolvem zero', () => {
    expect(parcelaPisCofins('mei', 20, 'Anexo I', 0)).toBe(0);
    expect(parcelaPisCofins('simplesDentro', 20, 'Anexo I', 0)).toBe(0);
    expect(PRESETS_REGIME.mei.precoMuda).toBe(false);
    expect(PRESETS_REGIME.simplesDentro.precoMuda).toBe(false);
  });
});

describe('Projeção de preço na reforma', () => {
  const base = {
    cmv: 100,
    custoFixoUnitario: 0,
    impostoPercent: 21.65,
    pisCofinsPercent: 3.65,
    despesasPercent: 5,
    margemPercent: 20,
    aliquotaCbs: 9.11,
    classificacao: 'padrao' as const,
    percCmvComCredito: 0,
    precoAtual: 100 / (1 - 0.4665),
  };

  it('sem crédito, o preço sobe porque o imposto sai de dentro e entra por fora', () => {
    const r = projetarPrecoReforma(base);
    expect(r.impostoPorDentroRestante).toBeCloseTo(18, 10); // só o ICMS
    expect(r.creditoCbsUnitario).toBe(0);
    expect(r.receitaLiquida).toBeCloseTo(100 / (1 - 0.43), 10);
    expect(r.precoMantendoMargem).toBeCloseTo((100 / 0.57) * 1.0911, 10);
    expect(r.variacaoPercent).toBeGreaterThan(0);
  });

  it('com crédito de CBS na compra, o custo cai e o preço pode cair junto', () => {
    const r = projetarPrecoReforma({ ...base, percCmvComCredito: 100 });
    expect(r.creditoCbsUnitario).toBeCloseTo(100 * (9.11 / 109.11), 10);
    expect(r.custoLiquidoUnitario).toBeCloseTo(100 - 100 * (9.11 / 109.11), 10);
    expect(r.precoMantendoMargem).toBeLessThan(base.precoAtual);
    expect(r.variacaoPercent).toBeLessThan(0);
  });

  it('o redutor de 60% reduz a alíquota somada por fora', () => {
    const r = projetarPrecoReforma({ ...base, classificacao: 'reducao60' });
    expect(r.aliquotaCbsAplicada).toBeCloseTo(9.11 * 0.4, 10);
  });

  it('alíquota zero mantém o crédito da compra e não soma nada ao preço', () => {
    const r = projetarPrecoReforma({ ...base, classificacao: 'zero', percCmvComCredito: 100 });
    expect(r.cbsPorFora).toBe(0);
    expect(r.creditoCbsUnitario).toBeGreaterThan(0);
    expect(r.precoMantendoMargem).toBe(r.receitaLiquida);
  });

  it('revenda monofásica não gera crédito na compra', () => {
    const r = projetarPrecoReforma({ ...base, classificacao: 'monofasicoRevenda', percCmvComCredito: 100 });
    expect(r.creditoCbsUnitario).toBe(0);
  });

  it('mantendo o preço de hoje, calcula a margem que sobra', () => {
    const r = projetarPrecoReforma({ ...base, percCmvComCredito: 100 });
    // Como o preço projetado é menor, segurar o preço de hoje aumenta a margem.
    expect(r.margemMantendoPreco).toBeGreaterThan(base.margemPercent);
    expect(r.lucroMantendoPreco).toBeCloseTo(base.precoAtual * (r.margemMantendoPreco / 100), 8);
  });

  it('2033: com todo o imposto saindo de dentro, o preço é formado sem tributo', () => {
    const r = projetarPrecoReforma({
      ...base,
      pisCofinsPercent: base.impostoPercent,
      aliquotaCbs: 26.91,
      percCmvComCredito: 0,
    });
    expect(r.impostoPorDentroRestante).toBe(0);
    expect(r.receitaLiquida).toBeCloseTo(100 / (1 - 0.25), 10);
  });

  it('devolve zero quando as deduções consomem todo o preço', () => {
    const r = projetarPrecoReforma({ ...base, margemPercent: 90 });
    expect(r.precoMantendoMargem).toBe(0);
  });
});
