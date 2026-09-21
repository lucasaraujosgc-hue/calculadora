import { describe, it, expect } from 'vitest';
import {
  achatarNotas,
  aplicarVinculos,
  competenciasDisponiveis,
  resumirPorProdutoPeriodo,
  sugerirCadastro,
  type ItemComContexto,
} from '../agregacao';
import type { DirecaoNota, ItemNota, NaturezaOperacao, NotaFiscal } from '../tipos';

function item(opcoes: Partial<ItemNota> & { quantidade: number; valorLiquido: number }): ItemNota {
  const descricao = opcoes.descricao ?? 'REFRIGERANTE COLA 2L';
  const ean = opcoes.ean ?? '7891000100103';
  return {
    numero: 1,
    codigo: 'X',
    ean,
    descricao,
    ncm: '22021000',
    cfop: '5102',
    unidade: 'UN',
    valorUnitario: opcoes.valorLiquido / opcoes.quantidade,
    unidadeComercial: 'UN',
    quantidadeComercial: opcoes.quantidade,
    unidadeTributavel: 'UN',
    quantidadeTributavel: opcoes.quantidade,
    eanTributavel: ean,
    eanComercial: ean,
    chaveComercial: ean || descricao,
    fatorConversao: 1,
    convertidoPorEmbalagem: false,
    valorProduto: opcoes.valorLiquido,
    desconto: 0,
    frete: 0,
    seguro: 0,
    outros: 0,
    icms: 0,
    icmsSt: 0,
    ipi: 0,
    pis: 0,
    cofins: 0,
    natureza: 'normal' as NaturezaOperacao,
    valorUnitarioLiquido: opcoes.valorLiquido / opcoes.quantidade,
    chaveProduto: ean || descricao,
    origemChave: ean ? 'ean' : 'descricao',
    ...opcoes,
  };
}

function ctx(competencia: string, direcao: DirecaoNota, i: ItemNota): ItemComContexto {
  return { item: i, direcao, competencia };
}

describe('Resumo por produto e período', () => {
  it('separa os valores por competência em vez de somar tudo junto', () => {
    // Mesmo produto, custo diferente em maio e em junho.
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 100, valorLiquido: 620 })),
      ctx('2026-06', 'compra', item({ quantidade: 100, valorLiquido: 680 })),
    ];
    const [r] = resumirPorProdutoPeriodo(itens);

    expect(r.periodos.map(p => p.competencia)).toEqual(['2026-05', '2026-06']);
    expect(r.periodos[0].custoMedio).toBeCloseTo(6.2, 10);
    expect(r.periodos[1].custoMedio).toBeCloseTo(6.8, 10);
    // A referência é sempre a competência mais recente, não a média do período todo.
    expect(r.custoMaisRecente).toBeCloseTo(6.8, 10);
    expect(r.ultimaCompra).toBe('2026-06');
    expect(r.variacaoCustoPercent).toBeCloseTo(((6.8 - 6.2) / 6.2) * 100, 8);
  });

  it('usa média ponderada pela quantidade, não média simples', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 1000, valorLiquido: 6000 })),
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 90 })),
    ];
    const [r] = resumirPorProdutoPeriodo(itens);
    // Ponderada: 6090 / 1010 = 6,0297 (a média simples daria 7,50).
    expect(r.periodos[0].custoMedio).toBeCloseTo(6090 / 1010, 10);
  });

  it('calcula a margem bruta do período quando há compra e venda', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 100, valorLiquido: 600 })),
      ctx('2026-05', 'venda', item({ quantidade: 80, valorLiquido: 800 })),
    ];
    const [r] = resumirPorProdutoPeriodo(itens);
    const p = r.periodos[0];
    expect(p.custoMedio).toBeCloseTo(6, 10);
    expect(p.precoMedio).toBeCloseTo(10, 10);
    expect(p.margemBrutaPercent).toBeCloseTo(40, 10); // (10 − 6) / 10
  });

  it('deixa a margem nula quando falta um dos lados no período', () => {
    const itens = [ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 60 }))];
    expect(resumirPorProdutoPeriodo(itens)[0].periodos[0].margemBrutaPercent).toBeNull();
  });

  it('mantém devolução e remessa fora das médias, mas registra que existiram', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 100, valorLiquido: 600 })),
      ctx('2026-05', 'compra', item({ quantidade: 20, valorLiquido: 500, natureza: 'devolucao', cfop: '1202' })),
      ctx('2026-05', 'venda', item({ quantidade: 5, valorLiquido: 90, natureza: 'remessa', cfop: '5915' })),
    ];
    const [r] = resumirPorProdutoPeriodo(itens);
    const p = r.periodos[0];
    expect(p.custoMedio).toBeCloseTo(6, 10); // a devolução não puxou o custo para cima
    expect(p.quantidadeVendida).toBe(0);
    expect(p.itensIgnorados).toBe(2);
  });

  it('ignora itens com quantidade zerada', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 60 })),
      ctx('2026-05', 'compra', { ...item({ quantidade: 1, valorLiquido: 0 }), quantidade: 0 }),
    ];
    const [r] = resumirPorProdutoPeriodo(itens);
    expect(r.periodos[0].custoMedio).toBeCloseTo(6, 10);
    expect(r.periodos[0].itensIgnorados).toBe(1);
  });

  it('casa o mesmo produto entre compra e venda pelo GTIN, mesmo com descrição diferente', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 60, descricao: 'REFRI COLA 2000ML FORNECEDOR' })),
      ctx('2026-05', 'venda', item({ quantidade: 8, valorLiquido: 80, descricao: 'Refrigerante Cola 2L' })),
    ];
    const resumos = resumirPorProdutoPeriodo(itens);
    expect(resumos).toHaveLength(1);
    // A descrição que vale é a da venda, que é como a empresa chama o produto.
    expect(resumos[0].descricao).toBe('Refrigerante Cola 2L');
    expect(resumos[0].origemChave).toBe('ean');
  });

  it('separa produtos diferentes', () => {
    const itens = [
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 60, ean: '7891000100103', descricao: 'A' })),
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 90, ean: '7891000100110', descricao: 'B' })),
    ];
    expect(resumirPorProdutoPeriodo(itens)).toHaveLength(2);
  });

  it('respeita o filtro de competências', () => {
    const itens = [
      ctx('2026-04', 'compra', item({ quantidade: 10, valorLiquido: 50 })),
      ctx('2026-05', 'compra', item({ quantidade: 10, valorLiquido: 60 })),
      ctx('2026-06', 'compra', item({ quantidade: 10, valorLiquido: 70 })),
    ];
    const [r] = resumirPorProdutoPeriodo(itens, { de: '2026-05', ate: '2026-05' });
    expect(r.periodos).toHaveLength(1);
    expect(r.periodos[0].competencia).toBe('2026-05');
    expect(r.custoMaisRecente).toBeCloseTo(6, 10);
  });

  it('lista as competências em ordem', () => {
    const itens = [
      ctx('2026-06', 'compra', item({ quantidade: 1, valorLiquido: 7 })),
      ctx('2026-04', 'compra', item({ quantidade: 1, valorLiquido: 5 })),
      ctx('2026-06', 'venda', item({ quantidade: 1, valorLiquido: 9 })),
    ];
    expect(competenciasDisponiveis(itens)).toEqual(['2026-04', '2026-06']);
  });
});

describe('Sugestão para o cadastro do produto', () => {
  const itens = [
    ctx('2026-05', 'compra', item({ quantidade: 100, valorLiquido: 620 })),
    ctx('2026-05', 'venda', item({ quantidade: 90, valorLiquido: 900 })),
    ctx('2026-06', 'compra', item({ quantidade: 100, valorLiquido: 680 })),
    ctx('2026-06', 'venda', item({ quantidade: 120, valorLiquido: 1260 })),
  ];

  it('sem competência informada, usa o movimento mais recente de cada lado', () => {
    const [r] = resumirPorProdutoPeriodo(itens);
    const s = sugerirCadastro(r);
    expect(s.cmv).toBeCloseTo(6.8, 10);
    expect(s.precoVenda).toBeCloseTo(10.5, 10);
    expect(s.vendasProjetadas).toBe(120);
    expect(s.competenciaCusto).toBe('2026-06');
    expect(s.competenciaPreco).toBe('2026-06');
  });

  it('com competência informada, usa os valores daquele mês', () => {
    const [r] = resumirPorProdutoPeriodo(itens);
    const s = sugerirCadastro(r, '2026-05');
    expect(s.cmv).toBeCloseTo(6.2, 10);
    expect(s.precoVenda).toBeCloseTo(10, 10);
    expect(s.vendasProjetadas).toBe(90);
  });

  it('devolve zeros para uma competência sem movimento', () => {
    const [r] = resumirPorProdutoPeriodo(itens);
    const s = sugerirCadastro(r, '2026-01');
    expect(s.cmv).toBe(0);
    expect(s.precoVenda).toBe(0);
    expect(s.competenciaCusto).toBeNull();
  });
});

describe('Achatamento das notas', () => {
  it('leva a direção e a competência da nota para cada item', () => {
    const nota = {
      competencia: '2026-05',
      itens: [item({ quantidade: 1, valorLiquido: 10 }), item({ quantidade: 2, valorLiquido: 20 })],
    } as unknown as NotaFiscal;
    const achatado = achatarNotas([{ nota, direcao: 'compra' }]);
    expect(achatado).toHaveLength(2);
    expect(achatado.every(i => i.direcao === 'compra' && i.competencia === '2026-05')).toBe(true);
  });
});

describe('Vínculo manual entre fardo e unidade', () => {
  // A nota de compra não declarou embalagem: veio "1 fardo" por R$ 72, sem GTIN
  // que case com a unidade vendida.
  const compraFardo = ctx('2026-06', 'compra', item({
    quantidade: 10, valorLiquido: 720, ean: '', descricao: 'FARDO REFRI C/12',
    chaveProduto: 'FARDO REFRI C 12', origemChave: 'descricao', unidade: 'CX', valorProduto: 720,
  }));
  const vendaUnidade = ctx('2026-06', 'venda', item({
    quantidade: 100, valorLiquido: 900, ean: '7891000100103', descricao: 'Refrigerante Cola Lata',
  }));

  it('sem vínculo, viram dois produtos e nenhum tem margem', () => {
    const r = resumirPorProdutoPeriodo([compraFardo, vendaUnidade]);
    expect(r).toHaveLength(2);
    expect(r.every(p => p.periodos[0].margemBrutaPercent === null)).toBe(true);
  });

  it('com o vínculo, o fardo entra no histórico do produto vendido', () => {
    const vinculados = aplicarVinculos([compraFardo, vendaUnidade], [
      { chaveOrigem: 'FARDO REFRI C 12', chaveDestino: '7891000100103', fator: 12 },
    ]);
    const r = resumirPorProdutoPeriodo(vinculados);
    expect(r).toHaveLength(1);

    const p = r[0].periodos[0];
    expect(p.quantidadeComprada).toBe(120); // 10 fardos × 12
    expect(p.custoMedio).toBeCloseTo(6, 10); // 720 ÷ 120
    expect(p.precoMedio).toBeCloseTo(9, 10);
    expect(p.margemBrutaPercent).toBeCloseTo(((9 - 6) / 9) * 100, 10);
  });

  it('o total pago não muda com a conversão', () => {
    const [convertido] = aplicarVinculos([compraFardo], [
      { chaveOrigem: 'FARDO REFRI C 12', chaveDestino: '7891000100103', fator: 12 },
    ]);
    expect(convertido.item.valorLiquido).toBeCloseTo(720, 10);
    expect(convertido.item.quantidade * convertido.item.valorUnitarioLiquido).toBeCloseTo(720, 10);
  });

  it('segue vínculos encadeados (caixa → fardo → lata)', () => {
    const caixa = ctx('2026-06', 'compra', item({
      quantidade: 2, valorLiquido: 1440, ean: '', descricao: 'CAIXA',
      chaveProduto: 'CAIXA', origemChave: 'descricao', valorProduto: 1440,
    }));
    const [convertido] = aplicarVinculos([caixa], [
      { chaveOrigem: 'CAIXA', chaveDestino: 'FARDO', fator: 10 },
      { chaveOrigem: 'FARDO', chaveDestino: 'LATA', fator: 12 },
    ]);
    expect(convertido.item.chaveProduto).toBe('LATA');
    expect(convertido.item.quantidade).toBe(240); // 2 × 10 × 12
    expect(convertido.item.valorUnitarioLiquido).toBeCloseTo(6, 10);
  });

  it('não entra em laço quando os vínculos apontam um para o outro', () => {
    const [convertido] = aplicarVinculos([compraFardo], [
      { chaveOrigem: 'FARDO REFRI C 12', chaveDestino: 'B', fator: 2 },
      { chaveOrigem: 'B', chaveDestino: 'FARDO REFRI C 12', fator: 3 },
    ]);
    expect(convertido.item.chaveProduto).toBe('B');
    expect(convertido.item.quantidade).toBe(20);
  });

  it('junta dois produtos de mesma unidade com fator 1', () => {
    // O caso mais comum de vínculo manual, e o que estava quebrado: o
    // fornecedor chama de "REFRIG LATA 350ML" o que a empresa vende como
    // "Refrigerante Cola Lata". Mesma unidade, fator 1. Antes, `aplicarVinculos`
    // saía sem converter porque o fator era 1, e o vínculo aparecia confirmado
    // na tela enquanto o produto continuava partido em dois — um com custo e
    // sem preço, outro com preço e sem custo.
    const compra = ctx('2026-06', 'compra', item({
      quantidade: 100, valorLiquido: 300, valorProduto: 300, ean: '',
      descricao: 'REFRIG LATA 350ML', chaveProduto: 'REFRIG LATA 350ML', origemChave: 'descricao',
    }));

    const semVinculo = resumirPorProdutoPeriodo([compra, vendaUnidade]);
    expect(semVinculo).toHaveLength(2);

    const comVinculo = resumirPorProdutoPeriodo(aplicarVinculos([compra, vendaUnidade], [
      { chaveOrigem: 'REFRIG LATA 350ML', chaveDestino: '7891000100103', fator: 1 },
    ]));
    expect(comVinculo).toHaveLength(1);
    expect(comVinculo[0].custoMaisRecente).toBeCloseTo(3, 6);
    expect(comVinculo[0].precoMaisRecente).toBeCloseTo(9, 6);
    expect(comVinculo[0].periodos[0].margemBrutaPercent).not.toBeNull();
  });

  it('com fator 1, a quantidade e o valor pago não mudam', () => {
    const compra = ctx('2026-06', 'compra', item({
      quantidade: 40, valorLiquido: 200, valorProduto: 200, ean: '',
      descricao: 'MESMO ITEM OUTRO NOME', chaveProduto: 'MESMO ITEM OUTRO NOME', origemChave: 'descricao',
    }));
    const [convertido] = aplicarVinculos([compra], [
      { chaveOrigem: 'MESMO ITEM OUTRO NOME', chaveDestino: '7891000100103', fator: 1 },
    ]);
    expect(convertido.item.chaveProduto).toBe('7891000100103');
    expect(convertido.item.quantidade).toBe(40);
    expect(convertido.item.quantidade * convertido.item.valorUnitarioLiquido).toBeCloseTo(200, 6);
  });

  it('ignora vínculos inválidos', () => {
    const iguais = aplicarVinculos([compraFardo], [
      { chaveOrigem: 'FARDO REFRI C 12', chaveDestino: 'FARDO REFRI C 12', fator: 12 },
    ]);
    expect(iguais[0].item.quantidade).toBe(10);
    const fatorZero = aplicarVinculos([compraFardo], [
      { chaveOrigem: 'FARDO REFRI C 12', chaveDestino: 'X', fator: 0 },
    ]);
    expect(fatorZero[0].item.quantidade).toBe(10);
  });
});

describe('Unidade mostrada no resumo', () => {
  it('usa a unidade da venda, não a da embalagem comprada', () => {
    const compraEmCaixa = ctx('2026-06', 'compra', item({
      quantidade: 240, valorLiquido: 960, unidade: 'CX', valorProduto: 960,
    }));
    const vendaEmUnidade = ctx('2026-06', 'venda', item({
      quantidade: 200, valorLiquido: 1200, unidade: 'UN', valorProduto: 1200,
    }));
    const [r] = resumirPorProdutoPeriodo([compraEmCaixa, vendaEmUnidade]);
    expect(r.unidade).toBe('UN');
  });
});
