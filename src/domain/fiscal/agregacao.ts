/**
 * Agregação dos itens das notas por produto e por competência.
 *
 * O preço de um produto muda ao longo do ano: o que foi comprado a R$ 6,20 em
 * maio pode custar R$ 6,80 em junho. Por isso nada aqui é somado no "geral" —
 * tudo é apurado mês a mês, e o custo/preço de referência é sempre o da
 * competência mais recente em que houve movimento daquele tipo.
 *
 * As médias são ponderadas pela quantidade, não simples: comprar 1.000 unidades
 * a R$ 6,00 e 10 unidades a R$ 9,00 dá um custo médio de R$ 6,03, não de R$ 7,50.
 */

import type {
  DirecaoNota,
  ItemNota,
  NotaFiscal,
  ResumoPeriodo,
  ResumoProduto,
  VinculoProduto,
} from './tipos';

/** Um item já situado na nota a que pertence. */
export interface ItemComContexto {
  item: ItemNota;
  direcao: DirecaoNota;
  competencia: string;
}

/** Achata as notas em itens com a direção e a competência de cada uma. */
export function achatarNotas(
  notas: { nota: NotaFiscal; direcao: DirecaoNota }[]
): ItemComContexto[] {
  const saida: ItemComContexto[] = [];
  for (const { nota, direcao } of notas) {
    for (const item of nota.itens) {
      saida.push({ item, direcao, competencia: nota.competencia });
    }
  }
  return saida;
}

/**
 * Converte os itens de um produto-embalagem para o produto que a empresa
 * realmente vende, usando os vínculos que ela cadastrou.
 *
 * É o caso da distribuidora que compra em fardo e revende por unidade: a nota
 * de compra traz "1 FARDO C/12" e a de venda traz "1 LATA". Com o vínculo
 * "1 fardo = 12 latas", as 10 caixas compradas viram 120 latas e o custo
 * unitário sai na mesma unidade do preço de venda.
 *
 * O valor em reais não muda — só a quantidade e a chave do produto. Vínculos
 * encadeados são seguidos (caixa → fardo → lata), com trava contra ciclos.
 */
export function aplicarVinculos(
  itens: ItemComContexto[],
  vinculos: VinculoProduto[]
): ItemComContexto[] {
  if (vinculos.length === 0) return itens;

  const porOrigem = new Map<string, VinculoProduto>();
  for (const v of vinculos) {
    if (v.chaveOrigem && v.chaveDestino && v.fator > 0 && v.chaveOrigem !== v.chaveDestino) {
      porOrigem.set(v.chaveOrigem, v);
    }
  }
  if (porOrigem.size === 0) return itens;

  /** Segue a corrente de vínculos até o produto final. */
  const resolver = (chave: string): { chave: string; fator: number } => {
    let atual = chave;
    let fator = 1;
    const visitados = new Set<string>([chave]);
    for (let i = 0; i < 10; i += 1) {
      const vinculo = porOrigem.get(atual);
      if (!vinculo || visitados.has(vinculo.chaveDestino)) break;
      fator *= vinculo.fator;
      atual = vinculo.chaveDestino;
      visitados.add(atual);
    }
    return { chave: atual, fator };
  };

  return itens.map(entrada => {
    const { chave, fator } = resolver(entrada.item.chaveProduto);
    // Só o destino decide se há o que fazer. O fator 1 é um vínculo legítimo e
    // dos mais comuns: o fornecedor chama de "REFRIG LATA 350ML" o que a
    // empresa vende como "Refri Lata", mesma unidade. Antes, esse caso saía
    // daqui sem conversão nenhuma — o vínculo aparecia confirmado na tela e o
    // produto continuava partido em dois, um com custo e sem preço, outro com
    // preço e sem custo.
    if (chave === entrada.item.chaveProduto) return entrada;

    const quantidade = entrada.item.quantidade * fator;
    return {
      ...entrada,
      item: {
        ...entrada.item,
        chaveProduto: chave,
        quantidade,
        // O total pago não muda; o que muda é em quantas unidades ele se divide.
        valorUnitario: quantidade > 0 ? entrada.item.valorProduto / quantidade : 0,
        valorUnitarioLiquido: quantidade > 0 ? entrada.item.valorLiquido / quantidade : 0,
        fatorConversao: entrada.item.fatorConversao * fator,
      },
    };
  });
}

interface Acumulador {
  quantidadeComprada: number;
  valorComprado: number;
  quantidadeVendida: number;
  valorVendido: number;
  itensIgnorados: number;
}

function novoAcumulador(): Acumulador {
  return {
    quantidadeComprada: 0,
    valorComprado: 0,
    quantidadeVendida: 0,
    valorVendido: 0,
    itensIgnorados: 0,
  };
}

function fecharPeriodo(competencia: string, acc: Acumulador): ResumoPeriodo {
  const custoMedio = acc.quantidadeComprada > 0 ? acc.valorComprado / acc.quantidadeComprada : 0;
  const precoMedio = acc.quantidadeVendida > 0 ? acc.valorVendido / acc.quantidadeVendida : 0;
  const margemBrutaPercent = custoMedio > 0 && precoMedio > 0
    ? ((precoMedio - custoMedio) / precoMedio) * 100
    : null;

  return {
    competencia,
    quantidadeComprada: acc.quantidadeComprada,
    valorComprado: acc.valorComprado,
    custoMedio,
    quantidadeVendida: acc.quantidadeVendida,
    valorVendido: acc.valorVendido,
    precoMedio,
    margemBrutaPercent,
    itensIgnorados: acc.itensIgnorados,
  };
}

function variacao(primeiro: number, ultimo: number): number | null {
  if (primeiro <= 0 || ultimo <= 0) return null;
  return ((ultimo - primeiro) / primeiro) * 100;
}

export interface OpcoesResumo {
  /** Competência inicial (AAAA-MM), inclusive. */
  de?: string;
  /** Competência final (AAAA-MM), inclusive. */
  ate?: string;
}

/**
 * Agrupa os itens por produto e, dentro de cada produto, por competência.
 *
 * Itens cuja natureza não é `normal` (devolução, transferência, remessa) são
 * contados em `itensIgnorados` e ficam de fora das médias — eles existem no
 * histórico, mas não representam o custo nem o preço praticado.
 */
export function resumirPorProdutoPeriodo(
  itens: ItemComContexto[],
  opcoes: OpcoesResumo = {}
): ResumoProduto[] {
  const dentroDoIntervalo = (competencia: string) => {
    if (opcoes.de && competencia < opcoes.de) return false;
    if (opcoes.ate && competencia > opcoes.ate) return false;
    return true;
  };

  interface EmMontagem {
    chaveProduto: string;
    origemChave: 'ean' | 'descricao';
    descricao: string;
    ean: string;
    ncm: string;
    unidade: string;
    codigos: Set<string>;
    periodos: Map<string, Acumulador>;
  }

  const porProduto = new Map<string, EmMontagem>();

  for (const { item, direcao, competencia } of itens) {
    if (!item.chaveProduto || !dentroDoIntervalo(competencia)) continue;

    let produto = porProduto.get(item.chaveProduto);
    if (!produto) {
      produto = {
        chaveProduto: item.chaveProduto,
        origemChave: item.origemChave,
        descricao: item.descricao,
        ean: item.ean,
        ncm: item.ncm,
        unidade: item.unidade,
        codigos: new Set(),
        periodos: new Map(),
      };
      porProduto.set(item.chaveProduto, produto);
    }
    // A descrição e a unidade da venda são as que a empresa usa no dia a dia; as
    // da compra são as do fornecedor, e podem estar na embalagem (CX) mesmo
    // depois de o item ter sido convertido para unidade.
    if (direcao === 'venda' && item.descricao) produto.descricao = item.descricao;
    if (direcao === 'venda' && item.unidade) produto.unidade = item.unidade;
    if (!produto.ean && item.ean) produto.ean = item.ean;
    if (!produto.ncm && item.ncm) produto.ncm = item.ncm;
    if (item.codigo) produto.codigos.add(item.codigo);

    let acc = produto.periodos.get(competencia);
    if (!acc) {
      acc = novoAcumulador();
      produto.periodos.set(competencia, acc);
    }

    if (item.natureza !== 'normal') {
      acc.itensIgnorados += 1;
      continue;
    }
    if (item.quantidade <= 0) {
      acc.itensIgnorados += 1;
      continue;
    }

    if (direcao === 'compra') {
      acc.quantidadeComprada += item.quantidade;
      acc.valorComprado += item.valorLiquido;
    } else {
      acc.quantidadeVendida += item.quantidade;
      acc.valorVendido += item.valorLiquido;
    }
  }

  const resumos: ResumoProduto[] = [];

  for (const produto of porProduto.values()) {
    const periodos = [...produto.periodos.entries()]
      .map(([competencia, acc]) => fecharPeriodo(competencia, acc))
      .sort((a, b) => a.competencia.localeCompare(b.competencia));

    const comCompra = periodos.filter(p => p.quantidadeComprada > 0);
    const comVenda = periodos.filter(p => p.quantidadeVendida > 0);

    resumos.push({
      chaveProduto: produto.chaveProduto,
      origemChave: produto.origemChave,
      descricao: produto.descricao,
      ean: produto.ean,
      ncm: produto.ncm,
      unidade: produto.unidade,
      codigos: [...produto.codigos],
      periodos,
      ultimaCompra: comCompra.length > 0 ? comCompra[comCompra.length - 1].competencia : null,
      ultimaVenda: comVenda.length > 0 ? comVenda[comVenda.length - 1].competencia : null,
      custoMaisRecente: comCompra.length > 0 ? comCompra[comCompra.length - 1].custoMedio : 0,
      precoMaisRecente: comVenda.length > 0 ? comVenda[comVenda.length - 1].precoMedio : 0,
      quantidadeCompradaTotal: periodos.reduce((s, p) => s + p.quantidadeComprada, 0),
      quantidadeVendidaTotal: periodos.reduce((s, p) => s + p.quantidadeVendida, 0),
      variacaoCustoPercent: comCompra.length > 1
        ? variacao(comCompra[0].custoMedio, comCompra[comCompra.length - 1].custoMedio)
        : null,
      variacaoPrecoPercent: comVenda.length > 1
        ? variacao(comVenda[0].precoMedio, comVenda[comVenda.length - 1].precoMedio)
        : null,
    });
  }

  return resumos.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

/** Competências presentes num conjunto de itens, da mais antiga para a mais nova. */
export function competenciasDisponiveis(itens: ItemComContexto[]): string[] {
  return [...new Set(itens.map(i => i.competencia))].filter(Boolean).sort();
}

/**
 * Valores que a importação sugere para o cadastro do produto, na competência
 * escolhida (ou na mais recente com movimento, quando nenhuma é informada).
 */
export interface SugestaoCadastro {
  cmv: number;
  precoVenda: number;
  /** Quantidade vendida na competência — vira a projeção mensal de vendas. */
  vendasProjetadas: number;
  competenciaCusto: string | null;
  competenciaPreco: string | null;
}

export function sugerirCadastro(resumo: ResumoProduto, competencia?: string): SugestaoCadastro {
  if (competencia) {
    const p = resumo.periodos.find(x => x.competencia === competencia);
    return {
      cmv: p?.custoMedio ?? 0,
      precoVenda: p?.precoMedio ?? 0,
      vendasProjetadas: p?.quantidadeVendida ?? 0,
      competenciaCusto: p && p.quantidadeComprada > 0 ? p.competencia : null,
      competenciaPreco: p && p.quantidadeVendida > 0 ? p.competencia : null,
    };
  }

  const ultimaVenda = resumo.ultimaVenda
    ? resumo.periodos.find(p => p.competencia === resumo.ultimaVenda)
    : undefined;

  return {
    cmv: resumo.custoMaisRecente,
    precoVenda: resumo.precoMaisRecente,
    vendasProjetadas: ultimaVenda?.quantidadeVendida ?? 0,
    competenciaCusto: resumo.ultimaCompra,
    competenciaPreco: resumo.ultimaVenda,
  };
}
