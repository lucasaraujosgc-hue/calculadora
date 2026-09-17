/**
 * Leitura de XML de NF-e / NFC-e (layout 4.00 da Receita Federal).
 *
 * O arquivo pode vir como `nfeProc` (a nota já autorizada, com o protocolo) ou
 * como `NFe` puro. A direção — compra ou venda — não sai do XML: ela sai da
 * comparação entre o CNPJ/CPF cadastrado pela empresa e os documentos do
 * emitente e do destinatário da nota.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ItemNota, NaturezaOperacao, NotaFiscal, DirecaoNota } from './tipos';

export class ErroNotaFiscal extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Tudo como texto: chaves de acesso, NCM e códigos de produto têm zeros à
  // esquerda que o parser destruiria ao converter para número.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Mantém apenas os dígitos — serve para CNPJ, CPF e chave de acesso. */
export function somenteDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Normaliza a descrição do produto para servir de chave quando não há GTIN:
 * maiúsculas, sem acentos, sem pontuação e sem espaços repetidos.
 */
export function normalizarDescricao(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * GTIN válido tem 8, 12, 13 ou 14 dígitos. O layout permite "SEM GTIN" quando o
 * produto não tem código de barras, e muita gente preenche com zeros.
 */
export function eanValido(valor: unknown): boolean {
  const d = somenteDigitos(valor);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  return !/^0+$/.test(d);
}

/**
 * Natureza da operação a partir do CFOP.
 *
 * O terceiro ao quinto dígito dizem o que aconteceu; o primeiro só diz se a
 * operação é de entrada (1, 2, 3) ou de saída (5, 6, 7). Só as operações
 * classificadas como `normal` entram nas médias de custo e de preço — somar uma
 * devolução ou uma remessa em consignação distorceria o preço médio.
 */
export function classificarCfop(cfop: string): NaturezaOperacao {
  const c = somenteDigitos(cfop);
  if (c.length !== 4) return 'outro';
  const fim = c.slice(1);

  const devolucoes = new Set([
    '201', '202', '208', '209', '210', '410', '411', '412', '413', '414', '415',
    '503', '504', '553', '555', '556', '660', '661', '662', '918', '919', '921',
  ]);
  const transferencias = new Set(['151', '152', '153', '155', '156', '351', '352', '353', '354', '355', '356', '408', '409', '552', '557']);
  const remessas = new Set([
    '554', '901', '902', '903', '904', '905', '906', '907', '908', '909', '910',
    '911', '912', '913', '914', '915', '916', '917', '920', '922', '923', '924',
    '925', '926', '931', '932', '933', '934', '949',
  ]);

  if (devolucoes.has(fim)) return 'devolucao';
  if (transferencias.has(fim)) return 'transferencia';
  if (remessas.has(fim)) return 'remessa';

  // Compra/venda de mercadoria, industrialização e prestação de serviço.
  const normais = new Set([
    '101', '102', '111', '113', '116', '117', '118', '119', '120', '122', '124', '125', '126',
    '251', '252', '253', '254', '255', '256', '257', '301', '302', '303', '304', '305', '306',
    '307', '401', '402', '403', '405', '551', '556', '651', '652', '653', '656', '657', '658',
    '659', '667',
  ]);
  if (normais.has(fim)) return 'normal';
  return 'outro';
}

function paraNumero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Percorre um caminho de tags, aceitando ausências no meio do caminho. */
function pegar(obj: any, ...caminho: string[]): any {
  let atual = obj;
  for (const chave of caminho) {
    if (atual === null || atual === undefined) return undefined;
    atual = atual[chave];
  }
  return atual;
}

/** Soma um campo de um grupo de imposto que pode vir sob várias tags-filhas. */
function somarImposto(grupo: any, campo: string): number {
  if (!grupo || typeof grupo !== 'object') return 0;
  let total = 0;
  for (const valor of Object.values(grupo)) {
    if (valor && typeof valor === 'object') {
      const v = (valor as any)[campo];
      if (v !== undefined) total += paraNumero(v);
    }
  }
  return total;
}

function comoLista<T>(valor: T | T[] | undefined): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Extrai a competência (AAAA-MM) de uma data de emissão do XML. */
export function competenciaDe(dataEmissao: string): string {
  const m = String(dataEmissao).match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  return `${m[1]}-${m[2]}`;
}

function montarItem(det: any): ItemNota {
  const prod = det?.prod ?? {};
  const imposto = det?.imposto ?? {};

  const quantidadeComercial = paraNumero(prod.qCom);
  const quantidadeTributavel = paraNumero(prod.qTrib);
  const unidadeComercial = String(prod.uCom ?? '').trim();
  const unidadeTributavel = String(prod.uTrib ?? '').trim();
  const valorProduto = paraNumero(prod.vProd);
  const desconto = paraNumero(prod.vDesc);
  const frete = paraNumero(prod.vFrete);
  const seguro = paraNumero(prod.vSeg);
  const outros = paraNumero(prod.vOutro);

  const icms = somarImposto(imposto.ICMS, 'vICMS');
  const icmsSt = somarImposto(imposto.ICMS, 'vICMSST');
  const ipi = somarImposto(imposto.IPI, 'vIPI');
  const pis = somarImposto(imposto.PIS, 'vPIS');
  const cofins = somarImposto(imposto.COFINS, 'vCOFINS');

  // Custo (ou receita) que de fato entra na conta: o valor do produto mais o que
  // é cobrado junto e menos o desconto. O ICMS-ST e o IPI entram porque são
  // pagos ao fornecedor e, em regra, não geram crédito.
  const valorLiquido = valorProduto - desconto + frete + seguro + outros + ipi + icmsSt;

  const eanComercial = eanValido(prod.cEAN) ? somenteDigitos(prod.cEAN) : '';
  const eanTributavel = eanValido(prod.cEANTrib) ? somenteDigitos(prod.cEANTrib) : '';
  const descricao = String(prod.xProd ?? '').trim();

  // Quando a nota diz que a unidade comercial é uma embalagem (uCom ≠ uTrib e
  // qTrib ≠ qCom), o próprio documento já informa quantas unidades tem dentro.
  // É esse número que faz uma compra em fardo casar com uma venda por unidade:
  // 10 caixas de 12 viram 120 unidades, e o custo unitário sai certo.
  const convertidoPorEmbalagem =
    quantidadeComercial > 0
    && quantidadeTributavel > 0
    && quantidadeTributavel !== quantidadeComercial
    && unidadeTributavel !== ''
    && unidadeTributavel !== unidadeComercial;

  const quantidade = convertidoPorEmbalagem
    ? quantidadeTributavel
    : (quantidadeComercial || quantidadeTributavel);
  const unidade = convertidoPorEmbalagem ? unidadeTributavel : unidadeComercial;
  const valorUnitario = convertidoPorEmbalagem
    ? paraNumero(prod.vUnTrib)
    : paraNumero(prod.vUnCom);

  // Convertido o item, a chave também tem de ser a da unidade — senão o fardo
  // continuaria sendo um produto diferente da lata.
  const ean = convertidoPorEmbalagem
    ? (eanTributavel || eanComercial)
    : (eanComercial || eanTributavel);
  const chaveProduto = ean || normalizarDescricao(descricao);

  const fatorConversao = quantidadeComercial > 0 && quantidadeTributavel > 0
    ? quantidadeTributavel / quantidadeComercial
    : 1;

  const cfop = String(prod.CFOP ?? '').trim();

  return {
    numero: Number(det?.['@nItem'] ?? 0) || 0,
    codigo: String(prod.cProd ?? '').trim(),
    ean,
    descricao,
    ncm: String(prod.NCM ?? '').trim(),
    cfop,
    unidade,
    quantidade,
    valorUnitario,
    unidadeComercial,
    quantidadeComercial,
    unidadeTributavel,
    quantidadeTributavel,
    eanTributavel,
    eanComercial,
    chaveComercial: eanComercial || normalizarDescricao(descricao),
    fatorConversao,
    convertidoPorEmbalagem,
    valorProduto,
    desconto,
    frete,
    seguro,
    outros,
    icms,
    icmsSt,
    ipi,
    pis,
    cofins,
    natureza: classificarCfop(cfop),
    valorLiquido,
    valorUnitarioLiquido: quantidade > 0 ? valorLiquido / quantidade : 0,
    chaveProduto,
    origemChave: ean ? 'ean' : 'descricao',
  };
}

/**
 * Lê um XML de NF-e/NFC-e e devolve a nota já normalizada.
 *
 * Lança `ErroNotaFiscal` com uma mensagem em português quando o arquivo não é
 * uma nota — XML de evento (cancelamento, carta de correção), inutilização ou
 * qualquer outro conteúdo.
 */
export function lerNotaFiscal(xml: string): NotaFiscal {
  let raiz: any;
  try {
    raiz = parser.parse(xml);
  } catch {
    throw new ErroNotaFiscal('Arquivo não é um XML válido.');
  }

  if (raiz?.procEventoNFe || raiz?.evento || raiz?.retEvento) {
    throw new ErroNotaFiscal('Este XML é de um evento da nota (cancelamento, carta de correção ou manifestação), não da nota em si.');
  }
  if (raiz?.ProcInutNFe || raiz?.inutNFe) {
    throw new ErroNotaFiscal('Este XML é de inutilização de numeração, não de uma nota.');
  }

  const nfe = raiz?.nfeProc?.NFe ?? raiz?.NFe ?? raiz?.nfeProc?.['NFe'];
  const inf = nfe?.infNFe;
  if (!inf) {
    throw new ErroNotaFiscal('Não encontramos uma NF-e neste arquivo. Envie o XML da nota (nfeProc ou NFe).');
  }

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const dest = inf.dest ?? {};

  // dhEmi no layout 4.00; dEmi ainda aparece em notas antigas.
  const dataEmissaoBruta = String(ide.dhEmi ?? ide.dEmi ?? '').trim();
  const competencia = competenciaDe(dataEmissaoBruta);
  if (!competencia) {
    throw new ErroNotaFiscal('A nota não tem data de emissão legível.');
  }

  const chaveAttr = somenteDigitos(inf['@Id']);
  const chaveProtocolo = somenteDigitos(pegar(raiz, 'nfeProc', 'protNFe', 'infProt', 'chNFe'));
  const chave = chaveAttr.length === 44 ? chaveAttr : chaveProtocolo;
  if (chave.length !== 44) {
    throw new ErroNotaFiscal('A nota não tem chave de acesso de 44 dígitos.');
  }

  const itens = comoLista(inf.det).map(montarItem).filter(i => i.descricao !== '');
  if (itens.length === 0) {
    throw new ErroNotaFiscal('A nota não tem itens legíveis.');
  }

  const emitDoc = somenteDigitos(emit.CNPJ ?? emit.CPF);
  const destDoc = somenteDigitos(dest.CNPJ ?? dest.CPF);

  return {
    chave,
    modelo: String(ide.mod ?? '').trim(),
    numero: String(ide.nNF ?? '').trim(),
    serie: String(ide.serie ?? '').trim(),
    dataEmissao: dataEmissaoBruta,
    competencia,
    tipoNf: String(ide.tpNF ?? '').trim(),
    naturezaOperacao: String(ide.natOp ?? '').trim(),
    emitente: { doc: emitDoc, nome: String(emit.xNome ?? '').trim() },
    destinatario: { doc: destDoc, nome: String(dest.xNome ?? '').trim() },
    valorTotal: paraNumero(pegar(inf, 'total', 'ICMSTot', 'vNF')),
    itens,
  };
}

export interface ResultadoDirecao {
  direcao: DirecaoNota;
  /** Explicação em português de como a direção foi decidida. */
  motivo: string;
}

/**
 * Decide se a nota é compra ou venda comparando o documento da empresa com o do
 * emitente e o do destinatário.
 *
 * - empresa é a emitente  → venda (ela vendeu)
 * - empresa é a destinatária → compra (ela comprou)
 * - empresa nos dois lados (transferência entre filiais) → usa o tpNF
 * - empresa em nenhum dos lados → a nota não é dela
 */
export function direcaoDaNota(nota: NotaFiscal, documentoEmpresa: string): ResultadoDirecao {
  const empresa = somenteDigitos(documentoEmpresa);
  if (empresa.length !== 11 && empresa.length !== 14) {
    throw new ErroNotaFiscal('Cadastre um CNPJ ou CPF válido antes de importar notas.');
  }

  const ehEmitente = nota.emitente.doc === empresa;
  const ehDestinatario = nota.destinatario.doc === empresa;

  if (ehEmitente && ehDestinatario) {
    // tpNF: 0 = entrada, 1 = saída, na visão de quem emitiu.
    return nota.tipoNf === '0'
      ? { direcao: 'compra', motivo: 'Nota da própria empresa nos dois lados, classificada pelo tipo de operação (entrada).' }
      : { direcao: 'venda', motivo: 'Nota da própria empresa nos dois lados, classificada pelo tipo de operação (saída).' };
  }
  if (ehEmitente) {
    return { direcao: 'venda', motivo: `Sua empresa é a emitente (destinatário: ${nota.destinatario.nome || 'consumidor final'}).` };
  }
  if (ehDestinatario) {
    return { direcao: 'compra', motivo: `Sua empresa é a destinatária (emitente: ${nota.emitente.nome}).` };
  }

  throw new ErroNotaFiscal(
    `A nota ${nota.numero} não é da sua empresa: emitente ${nota.emitente.doc || 'sem documento'}, destinatário ${nota.destinatario.doc || 'sem documento'}.`
  );
}
