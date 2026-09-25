import { describe, it, expect } from 'vitest';
import {
  estimarElasticidade,
  projetarVolume,
  MINIMO_PONTOS,
  type PontoSerie,
} from '../index';

/** Série sintética com elasticidade exata: Q = k · P^b. */
function serieComElasticidade(b: number, precos: number[], k = 10000): PontoSerie[] {
  return precos.map((preco, i) => ({
    competencia: `2026-${String(i + 1).padStart(2, '0')}`,
    preco,
    quantidade: k * Math.pow(preco, b),
  }));
}

describe('estimarElasticidade — quando não dá para medir', () => {
  it('recusa série curta demais', () => {
    const r = estimarElasticidade(serieComElasticidade(-1.5, [10, 11, 12]));
    expect(r.confianca).toBe('insuficiente');
    expect(r.elasticidade).toBeNull();
    expect(r.motivo).toContain(String(MINIMO_PONTOS));
  });

  it('recusa quando o preço não mudou', () => {
    const r = estimarElasticidade([
      { competencia: '2026-01', preco: 10, quantidade: 100 },
      { competencia: '2026-02', preco: 10, quantidade: 130 },
      { competencia: '2026-03', preco: 10, quantidade: 90 },
      { competencia: '2026-04', preco: 10.1, quantidade: 120 },
    ]);
    expect(r.confianca).toBe('insuficiente');
    expect(r.motivo).toContain('não mudou');
  });

  it('descarta meses sem venda em vez de tratá-los como volume zero', () => {
    // Um mês sem venda costuma ser ruptura de estoque, não reação a preço.
    const serie: PontoSerie[] = [
      ...serieComElasticidade(-1.5, [10, 12, 14, 16]),
      { competencia: '2026-05', preco: 11, quantidade: 0 },
      { competencia: '2026-06', preco: 0, quantidade: 50 },
    ];
    const r = estimarElasticidade(serie);
    expect(r.pontos).toBe(4);
    expect(r.elasticidade).toBeCloseTo(-1.5, 6);
  });

  it('não devolve elasticidade positiva como se fosse resposta a preço', () => {
    // Volume e preço subindo juntos: sazonalidade, não elasticidade.
    const r = estimarElasticidade([
      { competencia: '2026-01', preco: 10, quantidade: 100 },
      { competencia: '2026-02', preco: 12, quantidade: 140 },
      { competencia: '2026-03', preco: 14, quantidade: 180 },
      { competencia: '2026-04', preco: 16, quantidade: 230 },
    ]);
    expect(r.confianca).toBe('insuficiente');
    expect(r.classificacao).toBe('sem-padrao');
    expect(r.motivo).toContain('sazonalidade');
    expect(projetarVolume(r, 10)).toBeNull();
  });

  it('não estoura com série vazia', () => {
    const r = estimarElasticidade([]);
    expect(r.confianca).toBe('insuficiente');
    expect(r.pontos).toBe(0);
    expect(r.variacaoPrecoPercent).toBe(0);
  });
});

describe('estimarElasticidade — quando dá', () => {
  it('recupera o coeficiente de uma série sem ruído', () => {
    const r = estimarElasticidade(serieComElasticidade(-1.8, [10, 12, 14, 16, 18, 20]));
    expect(r.elasticidade).toBeCloseTo(-1.8, 6);
    expect(r.r2).toBeCloseTo(1, 6);
    expect(r.confianca).toBe('boa');
    expect(r.classificacao).toBe('elastico');
  });

  it('separa elástico de inelástico pelo módulo do coeficiente', () => {
    const elastico = estimarElasticidade(serieComElasticidade(-2.2, [10, 12, 14, 16, 18, 20]));
    const inelastico = estimarElasticidade(serieComElasticidade(-0.4, [10, 12, 14, 16, 18, 20]));
    expect(elastico.classificacao).toBe('elastico');
    expect(inelastico.classificacao).toBe('inelastico');
    expect(inelastico.motivo).toContain('espaço para preço');
  });

  it('baixa a confiança quando o preço explica pouco do volume', () => {
    // Mesma tendência de queda, mas com volume pulando sem relação com o preço.
    const r = estimarElasticidade([
      { competencia: '2026-01', preco: 10, quantidade: 200 },
      { competencia: '2026-02', preco: 12, quantidade: 400 },
      { competencia: '2026-03', preco: 14, quantidade: 120 },
      { competencia: '2026-04', preco: 16, quantidade: 300 },
      { competencia: '2026-05', preco: 18, quantidade: 90 },
    ]);
    expect(r.elasticidade).toBeLessThan(0);
    expect(r.confianca).toBe('fraca');
    expect(r.r2!).toBeLessThan(0.3);
  });

  it('exige série longa para confiança boa, não só r² alto', () => {
    const curta = estimarElasticidade(serieComElasticidade(-1.5, [10, 12, 14, 16]));
    expect(curta.r2).toBeCloseTo(1, 6);
    expect(curta.confianca).toBe('razoavel');
  });

  it('reporta a faixa de preço que a série cobriu', () => {
    const r = estimarElasticidade(serieComElasticidade(-1.5, [10, 12, 14, 20]));
    expect(r.menorPreco).toBe(10);
    expect(r.maiorPreco).toBe(20);
    expect(r.variacaoPrecoPercent).toBeCloseTo(100, 6);
  });
});

describe('projetarVolume', () => {
  const r = estimarElasticidade(serieComElasticidade(-2, [10, 12, 14, 16, 18, 20]));

  it('aplica a relação multiplicativa do modelo log-log', () => {
    // b = -2: subir 10% o preço multiplica o volume por 1,1^-2 = 0,826.
    expect(projetarVolume(r, 10)).toBeCloseTo(-17.36, 2);
    // Baixar 10%: 0,9^-2 = 1,2346.
    expect(projetarVolume(r, -10)).toBeCloseTo(23.46, 2);
  });

  it('não projeta sobre estimativa insuficiente', () => {
    expect(projetarVolume(estimarElasticidade([]), 10)).toBeNull();
  });

  it('recusa uma queda de preço de 100% ou mais', () => {
    expect(projetarVolume(r, -100)).toBeNull();
    expect(projetarVolume(r, -150)).toBeNull();
  });

  it('preço parado não muda volume', () => {
    expect(projetarVolume(r, 0)).toBeCloseTo(0, 6);
  });
});
