import { describe, it, expect } from 'vitest';
import { classificarABC, sugerirMapeamento, type EstrategiaParaMapear } from '../index';

const ids = (itens: { id: string }[]) => itens.map(i => i.id);

describe('classificarABC', () => {
  it('põe em A os poucos itens que fazem a maior parte do valor', () => {
    const r = classificarABC([
      { id: 'a', valor: 800 },
      { id: 'b', valor: 100 },
      { id: 'c', valor: 50 },
      { id: 'd', valor: 30 },
      { id: 'e', valor: 20 },
    ]);
    expect(r.porId.a.classe).toBe('A');
    expect(r.porId.b.classe).toBe('B');
    expect(r.porId.e.classe).toBe('C');
    expect(r.total).toBe(1000);
  });

  it('ordena do maior para o menor e numera a posição', () => {
    const r = classificarABC([
      { id: 'pequeno', valor: 1 },
      { id: 'grande', valor: 100 },
      { id: 'medio', valor: 10 },
    ]);
    expect(ids(r.itens)).toEqual(['grande', 'medio', 'pequeno']);
    expect(r.porId.grande.posicao).toBe(1);
    expect(r.porId.pequeno.posicao).toBe(3);
  });

  it('o item que cruza a linha dos 80% ainda é A', () => {
    // Produto único: sozinho ele é 100% do faturamento e tem que ser classe A.
    const r = classificarABC([{ id: 'unico', valor: 500 }]);
    expect(r.porId.unico.classe).toBe('A');
    expect(r.porId.unico.acumulado).toBe(100);
  });

  it('distribui as classes em um mix uniforme', () => {
    // 10 itens iguais: 8 fecham 80% (A), o 9º fecha 90% (B), o 10º é C.
    const r = classificarABC(Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, valor: 10 })));
    const conta = (c: string) => r.itens.filter(i => i.classe === c).length;
    expect(conta('A')).toBe(8);
    expect(conta('B')).toBe(2);
    expect(conta('C')).toBe(0);
  });

  it('trata valor negativo como zero em vez de mandá-lo para o fim da fila', () => {
    const r = classificarABC([
      { id: 'bom', valor: 100 },
      { id: 'prejuizo', valor: -50 },
    ]);
    expect(r.porId.prejuizo.valor).toBe(0);
    expect(r.total).toBe(100);
    expect(r.porId.bom.classe).toBe('A');
  });

  it('não quebra quando não há valor nenhum', () => {
    const r = classificarABC([{ id: 'a', valor: 0 }, { id: 'b', valor: 0 }]);
    expect(r.total).toBe(0);
    expect(r.itens.every(i => i.classe === 'C')).toBe(true);
    expect(r.itens.every(i => i.participacao === 0)).toBe(true);
  });

  it('devolve uma lista vazia sem estourar', () => {
    const r = classificarABC([]);
    expect(r.itens).toEqual([]);
    expect(r.resumo.every(c => c.quantidade === 0)).toBe(true);
  });

  it('mantém a ordem original nos empates, para a classificação não dançar', () => {
    const entrada = [{ id: 'x', valor: 10 }, { id: 'y', valor: 10 }, { id: 'z', valor: 10 }];
    expect(ids(classificarABC(entrada).itens)).toEqual(['x', 'y', 'z']);
    expect(ids(classificarABC(entrada).itens)).toEqual(['x', 'y', 'z']);
  });

  it('o resumo fecha com o total', () => {
    const r = classificarABC([
      { id: 'a', valor: 800 }, { id: 'b', valor: 100 }, { id: 'c', valor: 100 },
    ]);
    expect(r.resumo.reduce((s, c) => s + c.quantidade, 0)).toBe(3);
    expect(r.resumo.reduce((s, c) => s + c.valor, 0)).toBe(1000);
    expect(r.resumo.reduce((s, c) => s + c.participacao, 0)).toBeCloseTo(100, 6);
  });
});

describe('sugerirMapeamento', () => {
  const faixas: EstrategiaParaMapear[] = [
    { id: 'zero', nome: 'Sem margem', margem: 0 },
    { id: 'atracao', nome: 'Atração', margem: 10 },
    { id: 'padrao', nome: 'Padrão', margem: 20 },
    { id: 'alta', nome: 'Margem alta', margem: 30 },
  ];

  it('dá a menor margem para A e a maior para C', () => {
    expect(sugerirMapeamento(faixas)).toEqual({ A: 'atracao', B: 'padrao', C: 'alta' });
  });

  it('nunca sugere uma faixa de 0% — seria vender o carro-chefe a preço de custo', () => {
    const m = sugerirMapeamento(faixas);
    expect(Object.values(m)).not.toContain('zero');
  });

  it('com duas faixas, B acompanha a maior', () => {
    const m = sugerirMapeamento([
      { id: 'baixa', nome: 'Baixa', margem: 5 },
      { id: 'alta', nome: 'Alta', margem: 40 },
    ]);
    expect(m).toEqual({ A: 'baixa', B: 'alta', C: 'alta' });
  });

  it('com uma faixa só, todas as classes apontam para ela', () => {
    const m = sugerirMapeamento([{ id: 'u', nome: 'Única', margem: 25 }]);
    expect(m).toEqual({ A: 'u', B: 'u', C: 'u' });
  });

  it('sem faixa com margem positiva, não sugere nada', () => {
    expect(sugerirMapeamento([{ id: 'zero', nome: 'Sem margem', margem: 0 }]))
      .toEqual({ A: null, B: null, C: null });
    expect(sugerirMapeamento([])).toEqual({ A: null, B: null, C: null });
  });

  it('não depende dos nomes, só da ordem das margens', () => {
    const m = sugerirMapeamento([
      { id: 'x', nome: 'Encomenda', margem: 55 },
      { id: 'y', nome: 'Feira', margem: 7 },
      { id: 'z', nome: 'Normal', margem: 22 },
    ]);
    expect(m).toEqual({ A: 'y', B: 'z', C: 'x' });
  });
});
