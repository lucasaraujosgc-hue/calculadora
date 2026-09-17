/**
 * Tipos compartilhados entre o parser de NF-e (servidor) e as telas (cliente).
 *
 * A direção da nota — compra ou venda — sai da comparação entre o CNPJ/CPF
 * cadastrado pela empresa e os documentos do emitente e do destinatário:
 * se a empresa é a emitente, é venda; se é a destinatária, é compra.
 */

/** Direção da nota na visão da empresa que importou o arquivo. */
export type DirecaoNota = 'compra' | 'venda';

/**
 * Natureza da operação, deduzida do CFOP. Só as operações `normal` entram nas
 * médias de custo e de preço — devolução, transferência e remessa aparecem no
 * histórico, mas distorceriam o preço médio se fossem somadas.
 */
export type NaturezaOperacao =
  | 'normal'
  | 'devolucao'
  | 'transferencia'
  | 'remessa'
  | 'outro';

export interface ParticipanteNota {
  /** CNPJ ou CPF, apenas dígitos. */
  doc: string;
  nome: string;
}

export interface ItemNota {
  /** nItem — número do item dentro da nota. */
  numero: number;
  /** cProd — código do produto no emitente da nota. */
  codigo: string;
  /** cEAN/cEANTrib quando é um GTIN válido; string vazia quando "SEM GTIN". */
  ean: string;
  /** xProd. */
  descricao: string;
  ncm: string;
  cfop: string;
  /** uCom. */
  unidade: string;
  quantidade: number;
  /** vUnCom — valor unitário comercial, sem rateio de frete e acessórios. */
  valorUnitario: number;
  /** vProd. */
  valorProduto: number;
  desconto: number;
  frete: number;
  seguro: number;
  outros: number;
  icms: number;
  icmsSt: number;
  ipi: number;
  pis: number;
  cofins: number;
  natureza: NaturezaOperacao;
  /**
   * Valor total do item já com frete, seguro, outras despesas, IPI e ICMS-ST,
   * menos o desconto — o custo (ou a receita) que de fato entra na conta.
   */
  valorLiquido: number;
  /** valorLiquido ÷ quantidade. */
  valorUnitarioLiquido: number;
  /** Chave usada para casar o mesmo produto entre notas diferentes. */
  chaveProduto: string;
  /** Como a chave foi obtida, para a tela poder avisar quando é frágil. */
  origemChave: 'ean' | 'descricao';
}

export interface NotaFiscal {
  /** Chave de acesso de 44 dígitos. */
  chave: string;
  /** 55 = NF-e, 65 = NFC-e. */
  modelo: string;
  numero: string;
  serie: string;
  /** Data de emissão em ISO. */
  dataEmissao: string;
  /** Competência no formato AAAA-MM, usada para separar os períodos. */
  competencia: string;
  /** tpNF: 0 = entrada, 1 = saída, na visão de quem emitiu. */
  tipoNf: string;
  naturezaOperacao: string;
  emitente: ParticipanteNota;
  destinatario: ParticipanteNota;
  valorTotal: number;
  itens: ItemNota[];
}

/** Resumo de um produto em uma competência. */
export interface ResumoPeriodo {
  competencia: string;
  quantidadeComprada: number;
  valorComprado: number;
  /** Custo médio ponderado pela quantidade, já com frete/IPI/ST. */
  custoMedio: number;
  quantidadeVendida: number;
  valorVendido: number;
  /** Preço médio ponderado de venda. */
  precoMedio: number;
  /** Margem bruta do período, quando houve compra e venda. */
  margemBrutaPercent: number | null;
  /** Itens ignorados na média (devolução, transferência, remessa). */
  itensIgnorados: number;
}

/** Resumo de um produto ao longo de todas as competências importadas. */
export interface ResumoProduto {
  chaveProduto: string;
  origemChave: 'ean' | 'descricao';
  descricao: string;
  ean: string;
  ncm: string;
  unidade: string;
  /** Códigos vistos nas notas (do fornecedor na compra, seu na venda). */
  codigos: string[];
  periodos: ResumoPeriodo[];
  /** Competência mais recente com compra. */
  ultimaCompra: string | null;
  /** Competência mais recente com venda. */
  ultimaVenda: string | null;
  /** Custo médio da competência mais recente com compra. */
  custoMaisRecente: number;
  /** Preço médio da competência mais recente com venda. */
  precoMaisRecente: number;
  quantidadeCompradaTotal: number;
  quantidadeVendidaTotal: number;
  /** Variação percentual do custo entre a primeira e a última competência com compra. */
  variacaoCustoPercent: number | null;
  /** Variação percentual do preço entre a primeira e a última competência com venda. */
  variacaoPrecoPercent: number | null;
}
