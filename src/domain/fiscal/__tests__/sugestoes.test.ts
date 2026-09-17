import { describe, it, expect } from 'vitest';
import { fatorNaDescricao, sugerirVinculos } from '../sugestoes';
import type { ResumoProduto } from '../tipos';

function produto(opcoes: Partial<ResumoProduto> & { descricao: string }): ResumoProduto {
  return {
    chaveProduto: opcoes.chaveProduto ?? opcoes.descricao,
    origemChave: 'descricao',
    descricao: opcoes.descricao,
    ean: '',
    ncm: '',
    unidade: 'UN',
    codigos: [],
    periodos: [],
    ultimaCompra: null,
    ultimaVenda: null,
    custoMaisRecente: 0,
    precoMaisRecente: 0,
    quantidadeCompradaTotal: 0,
    quantidadeVendidaTotal: 0,
    variacaoCustoPercent: null,
    variacaoPrecoPercent: null,
    ...opcoes,
  };
}

describe('Fator lido da descrição', () => {
  it('reconhece as formas usadas nas notas', () => {
    expect(fatorNaDescricao('CAIXA CERVEJA PILSEN C/12')).toBe(12);
    expect(fatorNaDescricao('REFRIGERANTE FARDO 6')).toBe(6);
    expect(fatorNaDescricao('AGUA MINERAL CX 24')).toBe(24);
    expect(fatorNaDescricao('BISCOITO PACK 20')).toBe(20);
    expect(fatorNaDescricao('SUCO COM 12 UNIDADES')).toBe(12);
    expect(fatorNaDescricao('LEITE 12X1L')).toBe(12);
  });

  it('não confunde volume com quantidade', () => {
    expect(fatorNaDescricao('CERVEJA LATA 350ML')).toBeNull();
    expect(fatorNaDescricao('REFRIGERANTE 2L')).toBeNull();
  });

  it('devolve null quando não há pista', () => {
    expect(fatorNaDescricao('ARROZ TIPO 1')).toBeNull();
    expect(fatorNaDescricao('')).toBeNull();
  });
});

describe('Sugestões de vínculo', () => {
  const caixa = produto({
    chaveProduto: 'CAIXA CERVEJA PILSEN C 12',
    descricao: 'CAIXA CERVEJA PILSEN C/12',
    ncm: '22030000',
    quantidadeCompradaTotal: 240,
  });
  const lata = produto({
    chaveProduto: '7891991010016',
    descricao: 'Cerveja Pilsen Lata 350ml',
    ncm: '22030000',
    quantidadeVendidaTotal: 200,
  });

  it('propõe o par entre o que só é comprado e o que só é vendido', () => {
    const s = sugerirVinculos([caixa, lata]);
    expect(s).toHaveLength(1);
    expect(s[0].chaveOrigem).toBe(caixa.chaveProduto);
    expect(s[0].chaveDestino).toBe(lata.chaveProduto);
  });

  it('já vem com o fator lido da descrição', () => {
    expect(sugerirVinculos([caixa, lata])[0].fator).toBe(12);
  });

  it('deixa o fator nulo quando a descrição não diz', () => {
    const semFator = produto({
      chaveProduto: 'ENGRADADO CERVEJA PILSEN',
      descricao: 'ENGRADADO CERVEJA PILSEN',
      ncm: '22030000',
      quantidadeCompradaTotal: 100,
    });
    expect(sugerirVinculos([semFator, lata])[0].fator).toBeNull();
  });

  it('explica por que sugeriu', () => {
    const s = sugerirVinculos([caixa, lata])[0];
    expect(s.motivo).toMatch(/CERVEJA/i);
    expect(s.motivo).toMatch(/mesmo NCM/i);
    expect(s.confianca).toBeGreaterThan(50);
  });

  it('não sugere para produto que já tem compra e venda', () => {
    const completo = produto({
      chaveProduto: 'X',
      descricao: 'CERVEJA PILSEN LATA',
      quantidadeCompradaTotal: 10,
      quantidadeVendidaTotal: 10,
    });
    expect(sugerirVinculos([completo, lata])).toHaveLength(0);
  });

  it('não sugere quando as descrições não têm nada em comum', () => {
    const arroz = produto({
      chaveProduto: 'ARROZ',
      descricao: 'ARROZ TIPO 1 FARDO 30',
      quantidadeCompradaTotal: 30,
    });
    expect(sugerirVinculos([arroz, lata])).toHaveLength(0);
  });

  it('não repete o que o usuário já resolveu', () => {
    const jaResolvidas = new Set([caixa.chaveProduto]);
    expect(sugerirVinculos([caixa, lata], { jaResolvidas })).toHaveLength(0);
  });

  it('escolhe o destino mais parecido quando há vários', () => {
    const outraLata = produto({
      chaveProduto: 'OUTRA',
      descricao: 'Refrigerante Cola Lata 350ml',
      ncm: '22021000',
      quantidadeVendidaTotal: 50,
    });
    const s = sugerirVinculos([caixa, outraLata, lata]);
    expect(s[0].chaveDestino).toBe(lata.chaveProduto);
  });

  it('ordena as sugestões mais prováveis primeiro', () => {
    const fraca = produto({
      chaveProduto: 'FD SUCO',
      descricao: 'FARDO SUCO UVA 12',
      quantidadeCompradaTotal: 12,
    });
    const suco = produto({
      chaveProduto: 'SUCO',
      descricao: 'Suco Uva Garrafa',
      quantidadeVendidaTotal: 12,
    });
    const s = sugerirVinculos([fraca, caixa, suco, lata]);
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s[0].confianca).toBeGreaterThanOrEqual(s[1].confianca);
  });

  it('não sugere nada quando falta um dos lados', () => {
    expect(sugerirVinculos([caixa])).toHaveLength(0);
    expect(sugerirVinculos([lata])).toHaveLength(0);
  });
});
