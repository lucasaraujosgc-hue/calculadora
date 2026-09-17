/**
 * Reforma Tributária — motor de cálculo (EC 132/2023 + LC 214/2025)
 *
 * Regras independentes da interface para simular a transição do modelo atual
 * (PIS/COFINS/ICMS/ISS/IPI, tributos "por dentro") para o IVA Dual brasileiro:
 *
 *   • CBS — Contribuição sobre Bens e Serviços (federal, substitui PIS e COFINS)
 *   • IBS — Imposto sobre Bens e Serviços (estadual + municipal, substitui ICMS e ISS)
 *
 * A diferença estrutural mais importante: CBS e IBS são calculados **por fora**.
 * A base de cálculo é o valor da operação SEM os próprios tributos (LC 214/2025,
 * art. 12, § 2º — não integram a própria base, nem a base um do outro, nem o IPI
 * ou descontos incondicionais). Hoje, ICMS, PIS e COFINS são calculados "por
 * dentro": a alíquota incide sobre o preço que já contém o imposto.
 *
 * Todos os percentuais neste módulo são expressos em pontos percentuais
 * (ex.: 8.8 significa 8,8%).
 */

// ---------------------------------------------------------------------------
// Alíquotas de referência
// ---------------------------------------------------------------------------

/**
 * Alíquotas de referência estimadas pelo Ministério da Fazenda para o IVA Dual
 * em regime pleno: 26,5% no total (CBS 8,8% + IBS 17,7%).
 *
 * ATENÇÃO: são ESTIMATIVAS. As alíquotas de referência definitivas serão
 * fixadas por Resolução do Senado Federal (EC 132/2023), com base no cálculo do
 * Tribunal de Contas da União, e cada Estado/Município pode fixar alíquota
 * própria de IBS acima ou abaixo da referência. Trate como parâmetro editável.
 */
export const ALIQUOTA_REF_CBS = 8.8;
export const ALIQUOTA_REF_IBS = 17.7;

// ---------------------------------------------------------------------------
// Regimes diferenciados (redutores de alíquota)
// ---------------------------------------------------------------------------

export type ClassificacaoReforma =
  | 'padrao'
  | 'reducao60'
  | 'reducao30'
  | 'zero'
  | 'monofasicoRevenda';

export interface RegimeDiferenciado {
  label: string;
  /** Multiplicador aplicado à alíquota de referência (1 = alíquota cheia). */
  fator: number;
  /** A operação de saída dá direito a manter os créditos das compras? */
  mantemCredito: boolean;
  descricao: string;
}

/**
 * Redutores de alíquota da LC 214/2025.
 *
 * Sobre os créditos: a alíquota zero NÃO anula os créditos das operações
 * anteriores (o contribuinte acumula saldo credor), enquanto isenção e
 * imunidade, em regra, implicam a anulação desses créditos. Nos regimes
 * monofásicos (combustíveis), o tributo é concentrado na primeira operação e as
 * revendas seguintes não são tributadas nem geram crédito ao revendedor.
 */
export const REGIMES_DIFERENCIADOS: Record<ClassificacaoReforma, RegimeDiferenciado> = {
  padrao: {
    label: 'Alíquota cheia (regime regular)',
    fator: 1,
    mantemCredito: true,
    descricao:
      'Regra geral: alíquota de referência integral de CBS e IBS, com crédito amplo sobre tudo que for adquirido para a atividade.',
  },
  reducao60: {
    label: 'Redução de 60% da alíquota',
    fator: 0.4,
    mantemCredito: true,
    descricao:
      'Alimentos para consumo humano, produtos de higiene e limpeza, serviços de saúde e educação, dispositivos médicos, medicamentos, insumos agropecuários, transporte coletivo de passageiros, produções artísticas e culturais, entre outros listados nos Anexos da LC 214/2025.',
  },
  reducao30: {
    label: 'Redução de 30% da alíquota',
    fator: 0.7,
    mantemCredito: true,
    descricao:
      'Serviços de profissões intelectuais regulamentadas (advocacia, medicina, engenharia, contabilidade, arquitetura e afins), quando prestados por sociedade uniprofissional.',
  },
  zero: {
    label: 'Alíquota zero',
    fator: 0,
    mantemCredito: true,
    descricao:
      'Cesta Básica Nacional de Alimentos, medicamentos e dispositivos médicos listados em anexo, serviços de educação de ensino superior do Prouni, transporte público coletivo urbano, entre outros. A alíquota zero não anula os créditos das compras — o saldo credor se acumula e pode ser ressarcido.',
  },
  monofasicoRevenda: {
    label: 'Revenda em regime monofásico (combustíveis)',
    fator: 0,
    mantemCredito: false,
    descricao:
      'Nos combustíveis, CBS e IBS são cobrados uma única vez, com alíquotas por unidade de medida (ad rem), na operação do produtor/importador. As revendas seguintes saem com alíquota zero e o revendedor não toma crédito daquela aquisição.',
  },
};

// ---------------------------------------------------------------------------
// Cronograma da transição
// ---------------------------------------------------------------------------

export interface FaseCronograma {
  ano: number;
  /** Alíquota fixa de teste da CBS (2026). `null` = usa a alíquota de referência. */
  cbsFixaTeste: number | null;
  /** Redução em pontos percentuais aplicada à CBS em 2027 e 2028. */
  reducaoCbsPP: number;
  /** Alíquota fixa de teste do IBS. `null` = fração da alíquota de referência. */
  ibsFixaTeste: number | null;
  /** Fração da alíquota de referência do IBS cobrada no ano (2029 em diante). */
  fatorIbs: number;
  /** Fração das alíquotas de ICMS e ISS ainda vigentes no ano (1 = integrais). */
  fatorIcmsIss: number;
  /** PIS e COFINS ainda existem neste ano? */
  pisCofinsVigente: boolean;
  /** IPI ainda é cobrado (fora da Zona Franca de Manaus)? */
  ipiVigente: boolean;
  /** Os valores de CBS/IBS do ano são compensáveis com PIS/COFINS (ano-teste)? */
  cbsCompensavelComPisCofins: boolean;
  titulo: string;
  resumo: string;
}

export const CRONOGRAMA: FaseCronograma[] = [
  {
    ano: 2026,
    cbsFixaTeste: 0.9,
    reducaoCbsPP: 0,
    ibsFixaTeste: 0.1,
    fatorIbs: 0,
    fatorIcmsIss: 1,
    pisCofinsVigente: true,
    ipiVigente: true,
    cbsCompensavelComPisCofins: true,
    titulo: 'Ano-teste',
    resumo:
      'CBS de 0,9% e IBS de 0,1% apenas para teste do sistema. Os valores são compensados com PIS/COFINS devidos e o recolhimento é dispensado para quem cumprir as obrigações acessórias. Na prática, a carga tributária não muda: PIS, COFINS, ICMS, ISS e IPI seguem integrais.',
  },
  {
    ano: 2027,
    cbsFixaTeste: null,
    reducaoCbsPP: 0.1,
    ibsFixaTeste: 0.1,
    fatorIbs: 0,
    fatorIcmsIss: 1,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'CBS cheia — PIS e COFINS extintos',
    resumo:
      'A virada de chave da CBS. PIS e COFINS são extintos e substituídos pela CBS na alíquota de referência (reduzida em 0,1 p.p. em 2027 e 2028 para compensar o IBS de teste). O IPI é zerado, exceto para produtos com industrialização na Zona Franca de Manaus, e entra em vigor o Imposto Seletivo. ICMS e ISS continuam integrais — só a CBS muda.',
  },
  {
    ano: 2028,
    cbsFixaTeste: null,
    reducaoCbsPP: 0.1,
    ibsFixaTeste: 0.1,
    fatorIbs: 0,
    fatorIcmsIss: 1,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'CBS cheia — segundo ano',
    resumo:
      'Repete 2027: CBS na alíquota de referência (reduzida em 0,1 p.p.), IBS ainda em 0,1% de teste e ICMS/ISS integrais.',
  },
  {
    ano: 2029,
    cbsFixaTeste: null,
    reducaoCbsPP: 0,
    ibsFixaTeste: null,
    fatorIbs: 0.1,
    fatorIcmsIss: 0.9,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'Início da transição do IBS',
    resumo:
      'O IBS passa a ser cobrado a 1/10 da alíquota de referência e as alíquotas de ICMS e ISS são reduzidas a 90% do valor atual. A partir daqui a empresa convive com os dois sistemas.',
  },
  {
    ano: 2030,
    cbsFixaTeste: null,
    reducaoCbsPP: 0,
    ibsFixaTeste: null,
    fatorIbs: 0.2,
    fatorIcmsIss: 0.8,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'Transição do IBS — 2/10',
    resumo: 'IBS a 2/10 da alíquota de referência; ICMS e ISS reduzidos a 80%.',
  },
  {
    ano: 2031,
    cbsFixaTeste: null,
    reducaoCbsPP: 0,
    ibsFixaTeste: null,
    fatorIbs: 0.3,
    fatorIcmsIss: 0.7,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'Transição do IBS — 3/10',
    resumo: 'IBS a 3/10 da alíquota de referência; ICMS e ISS reduzidos a 70%.',
  },
  {
    ano: 2032,
    cbsFixaTeste: null,
    reducaoCbsPP: 0,
    ibsFixaTeste: null,
    fatorIbs: 0.4,
    fatorIcmsIss: 0.6,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'Transição do IBS — 4/10',
    resumo: 'IBS a 4/10 da alíquota de referência; ICMS e ISS reduzidos a 60%.',
  },
  {
    ano: 2033,
    cbsFixaTeste: null,
    reducaoCbsPP: 0,
    ibsFixaTeste: null,
    fatorIbs: 1,
    fatorIcmsIss: 0,
    pisCofinsVigente: false,
    ipiVigente: false,
    cbsCompensavelComPisCofins: false,
    titulo: 'Regime pleno',
    resumo:
      'ICMS e ISS são extintos. Restam apenas CBS e IBS, ambos por fora, não cumulativos e com crédito amplo, além do Imposto Seletivo sobre bens prejudiciais à saúde e ao meio ambiente.',
  },
];

export const ANOS_REFORMA = CRONOGRAMA.map(f => f.ano);

export interface AliquotasDoAno extends FaseCronograma {
  /** Alíquota de CBS vigente no ano, antes do redutor do regime diferenciado. */
  cbs: number;
  /** Alíquota de IBS vigente no ano, antes do redutor do regime diferenciado. */
  ibs: number;
  /** CBS + IBS. */
  totalPorFora: number;
}

/** Alíquotas de CBS e IBS vigentes em um ano da transição. */
export function aliquotasDoAno(
  ano: number,
  refCbs: number = ALIQUOTA_REF_CBS,
  refIbs: number = ALIQUOTA_REF_IBS
): AliquotasDoAno {
  const fase = CRONOGRAMA.find(f => f.ano === ano) ?? CRONOGRAMA[CRONOGRAMA.length - 1];
  const cbs = fase.cbsFixaTeste ?? Math.max(0, refCbs - fase.reducaoCbsPP);
  const ibs = fase.ibsFixaTeste ?? refIbs * fase.fatorIbs;
  return { ...fase, cbs, ibs, totalPorFora: cbs + ibs };
}

// ---------------------------------------------------------------------------
// Conversão entre "por dentro" e "por fora"
// ---------------------------------------------------------------------------

/**
 * Converte uma alíquota "por dentro" (embutida no preço, como ICMS e PIS/COFINS
 * hoje) na alíquota "por fora" equivalente (somada ao preço, como CBS e IBS).
 *
 *   t_fora = t_dentro / (1 − t_dentro)
 *
 * Ex.: 18% por dentro equivalem a 21,95% por fora — o mesmo imposto em reais.
 */
export function porDentroParaPorFora(aliquotaPorDentro: number): number {
  if (aliquotaPorDentro >= 100) return Infinity;
  return (aliquotaPorDentro / (100 - aliquotaPorDentro)) * 100;
}

/**
 * Converte uma alíquota "por fora" na carga equivalente sobre o preço final.
 *
 *   t_dentro = t_fora / (1 + t_fora)
 *
 * Ex.: os 26,5% por fora do IVA Dual representam 20,95% do preço pago pelo
 * consumidor — é esse o número comparável com a carga de hoje.
 */
export function porForaParaPorDentro(aliquotaPorFora: number): number {
  return (aliquotaPorFora / (100 + aliquotaPorFora)) * 100;
}

/** Preço final ao cliente quando o tributo é somado por fora. */
export function precoComTributoPorFora(baseSemTributo: number, aliquotaPorFora: number): number {
  return baseSemTributo * (1 + aliquotaPorFora / 100);
}

/** Base de cálculo (valor sem o tributo) a partir de um preço final "por fora". */
export function baseDoPrecoPorFora(precoFinal: number, aliquotaPorFora: number): number {
  return precoFinal / (1 + aliquotaPorFora / 100);
}

// ---------------------------------------------------------------------------
// Apuração de CBS e IBS
// ---------------------------------------------------------------------------

export interface ApuracaoIVA {
  /** Multiplicador do regime diferenciado aplicado às alíquotas. */
  fator: number;
  aliquotaCbsAplicada: number;
  aliquotaIbsAplicada: number;
  cbsDebito: number;
  cbsCredito: number;
  cbsLiquida: number;
  ibsDebito: number;
  ibsCredito: number;
  ibsLiquida: number;
  /** CBS + IBS a recolher no período (nunca negativo). */
  totalARecolher: number;
  /** Crédito que sobrou e vira saldo credor para os períodos seguintes. */
  saldoCredor: number;
}

/**
 * Apura CBS e IBS de um período pelo regime regular (não cumulativo pleno):
 * débito sobre as vendas menos crédito sobre as compras e despesas.
 *
 * @param baseVenda      Receita do período SEM CBS/IBS (base de cálculo).
 * @param baseCredito    Compras e despesas do período SEM CBS/IBS.
 * @param aliquotaCbs    Alíquota de CBS do ano, antes do redutor.
 * @param aliquotaIbs    Alíquota de IBS do ano, antes do redutor.
 * @param classificacao  Regime diferenciado aplicável à saída.
 */
export function apurarIVA(
  baseVenda: number,
  baseCredito: number,
  aliquotaCbs: number,
  aliquotaIbs: number,
  classificacao: ClassificacaoReforma = 'padrao'
): ApuracaoIVA {
  const regime = REGIMES_DIFERENCIADOS[classificacao];
  const fator = regime.fator;

  const aliquotaCbsAplicada = aliquotaCbs * fator;
  const aliquotaIbsAplicada = aliquotaIbs * fator;

  const cbsDebito = baseVenda * (aliquotaCbsAplicada / 100);
  const ibsDebito = baseVenda * (aliquotaIbsAplicada / 100);

  // O crédito é tomado pela alíquota cheia da operação anterior — o redutor da
  // saída não reduz o crédito da entrada. Quando o regime veda o crédito
  // (monofásico), a entrada não gera nada a compensar.
  const cbsCredito = regime.mantemCredito ? baseCredito * (aliquotaCbs / 100) : 0;
  const ibsCredito = regime.mantemCredito ? baseCredito * (aliquotaIbs / 100) : 0;

  const cbsLiquida = cbsDebito - cbsCredito;
  const ibsLiquida = ibsDebito - ibsCredito;
  const liquidoTotal = cbsLiquida + ibsLiquida;

  return {
    fator,
    aliquotaCbsAplicada,
    aliquotaIbsAplicada,
    cbsDebito,
    cbsCredito,
    cbsLiquida,
    ibsDebito,
    ibsCredito,
    ibsLiquida,
    totalARecolher: Math.max(0, liquidoTotal),
    saldoCredor: Math.max(0, -liquidoTotal),
  };
}

// ---------------------------------------------------------------------------
// Simples Nacional na reforma
// ---------------------------------------------------------------------------

export interface ParcelasDAS {
  /** DAS depois da reforma no ano simulado. */
  dasFinal: number;
  /** Parcela retirada do DAS por corresponder à CBS (antigos PIS e COFINS). */
  parcelaCbsRetirada: number;
  /** Parcela retirada do DAS por corresponder ao IBS (antigos ICMS e ISS). */
  parcelaIbsRetirada: number;
  /** Percentual do DAS que corresponde a CBS + IBS no ano. */
  percentualIvaNoDas: number;
}

/**
 * Efeito da reforma sobre o DAS do Simples Nacional.
 *
 * A LC 214/2025 mantém a empresa do Simples recolhendo CBS e IBS dentro do DAS,
 * com as mesmas alíquotas efetivas (a repartição interna é que passa a chamar
 * CBS no lugar de PIS/COFINS e IBS no lugar de ICMS/ISS). Mas cria uma opção:
 * apurar CBS e IBS **por fora do DAS**, pelo regime regular. Nesse caso a
 * parcela correspondente sai do DAS e o cliente passa a tomar crédito integral,
 * em vez do crédito reduzido que a compra de um optante pelo Simples gera.
 *
 * @param das             Valor do DAS no mês, antes da reforma.
 * @param percPisCofins   % do DAS correspondente a PIS + COFINS (tabela de repartição do anexo/faixa).
 * @param percIcmsIss     % do DAS correspondente a ICMS ou ISS.
 * @param fatorIcmsIss    Fração de ICMS/ISS ainda vigente no ano (ver cronograma).
 * @param pisCofinsVigente PIS/COFINS ainda existem no ano?
 * @param foraDoDAS       A empresa optou por apurar CBS/IBS pelo regime regular?
 */
export function calcularDASReforma(
  das: number,
  percPisCofins: number,
  percIcmsIss: number,
  fatorIcmsIss: number,
  pisCofinsVigente: boolean,
  foraDoDAS: boolean
): ParcelasDAS {
  // Enquanto PIS/COFINS existem (2026), nada saiu do DAS para a CBS.
  const percCbsNoDas = pisCofinsVigente ? 0 : percPisCofins;
  // A parcela de ICMS/ISS vira IBS na mesma proporção em que ICMS e ISS são
  // reduzidos ao longo da transição.
  const percIbsNoDas = percIcmsIss * (1 - fatorIcmsIss);

  const parcelaCbsRetirada = foraDoDAS ? das * (percCbsNoDas / 100) : 0;
  const parcelaIbsRetirada = foraDoDAS ? das * (percIbsNoDas / 100) : 0;

  return {
    dasFinal: das - parcelaCbsRetirada - parcelaIbsRetirada,
    parcelaCbsRetirada,
    parcelaIbsRetirada,
    percentualIvaNoDas: percCbsNoDas + percIbsNoDas,
  };
}

// ---------------------------------------------------------------------------
// Formação de preço
// ---------------------------------------------------------------------------

export interface PrecoPorDentroInput {
  /** Custo de aquisição/produção da unidade. */
  custo: number;
  /** Crédito de tributos embutido na compra (reduz o custo real). */
  creditoSobreCusto?: number;
  /** Despesas variáveis sobre o preço de venda, em % (taxas, comissões, frete). */
  despesasPercent: number;
  /** Margem de lucro desejada sobre o preço de venda, em %. */
  margemPercent: number;
  /** Tributos calculados por dentro sobre o preço de venda, em %. */
  tributosPorDentroPercent: number;
}

export interface ResultadoPreco {
  /** Custo líquido considerado (custo − créditos). */
  custoLiquido: number;
  /** Receita que fica com a empresa, sem os tributos por fora. */
  receitaLiquida: number;
  /** Tributos calculados na operação. */
  tributos: number;
  /** Preço final pago pelo cliente. */
  precoFinal: number;
  /** Despesas variáveis em reais. */
  despesas: number;
  /** Lucro em reais. */
  lucro: number;
  /** Carga tributária em relação ao preço final, em %. */
  cargaSobrePrecoFinal: number;
}

/**
 * Formação de preço no modelo atual, com tributos por dentro.
 *
 *   Preço = Custo líquido ÷ (1 − tributos% − despesas% − margem%)
 *
 * Os tributos já estão dentro do preço: é por isso que uma alíquota de 27% pode
 * consumir mais do que parece quando somada às despesas e à margem.
 */
export function precoPorDentro(input: PrecoPorDentroInput): ResultadoPreco {
  const custoLiquido = input.custo - (input.creditoSobreCusto ?? 0);
  const deducoes =
    (input.tributosPorDentroPercent + input.despesasPercent + input.margemPercent) / 100;

  if (deducoes >= 1) {
    return {
      custoLiquido,
      receitaLiquida: 0,
      tributos: 0,
      precoFinal: 0,
      despesas: 0,
      lucro: 0,
      cargaSobrePrecoFinal: 0,
    };
  }

  const precoFinal = custoLiquido / (1 - deducoes);
  const tributos = precoFinal * (input.tributosPorDentroPercent / 100);
  const despesas = precoFinal * (input.despesasPercent / 100);
  const lucro = precoFinal * (input.margemPercent / 100);

  return {
    custoLiquido,
    receitaLiquida: precoFinal - tributos,
    tributos,
    precoFinal,
    despesas,
    lucro,
    cargaSobrePrecoFinal: precoFinal > 0 ? (tributos / precoFinal) * 100 : 0,
  };
}

export interface PrecoPorForaInput {
  custo: number;
  creditoSobreCusto?: number;
  despesasPercent: number;
  margemPercent: number;
  /** Alíquota somada ao preço (CBS + IBS), em %. */
  aliquotaPorForaPercent: number;
  /**
   * Tributos que continuam sendo calculados por dentro no ano simulado
   * (em 2027, por exemplo, ICMS e ISS seguem por dentro), em %.
   */
  tributosPorDentroPercent?: number;
}

/**
 * Formação de preço no modelo da reforma, com CBS e IBS por fora.
 *
 *   Receita líquida = Custo líquido ÷ (1 − tributos_por_dentro% − despesas% − margem%)
 *   Preço final     = Receita líquida × (1 + alíquota_por_fora%)
 *
 * A empresa forma o preço sem o IVA e só então soma CBS e IBS, que aparecem
 * destacados no documento fiscal e não são receita dela.
 */
export function precoPorFora(input: PrecoPorForaInput): ResultadoPreco {
  const custoLiquido = input.custo - (input.creditoSobreCusto ?? 0);
  const porDentro = input.tributosPorDentroPercent ?? 0;
  const deducoes = (porDentro + input.despesasPercent + input.margemPercent) / 100;

  if (deducoes >= 1) {
    return {
      custoLiquido,
      receitaLiquida: 0,
      tributos: 0,
      precoFinal: 0,
      despesas: 0,
      lucro: 0,
      cargaSobrePrecoFinal: 0,
    };
  }

  const receitaLiquida = custoLiquido / (1 - deducoes);
  const ivaPorFora = receitaLiquida * (input.aliquotaPorForaPercent / 100);
  const tributosPorDentro = receitaLiquida * (porDentro / 100);
  const precoFinal = receitaLiquida + ivaPorFora;
  const tributos = ivaPorFora + tributosPorDentro;

  return {
    custoLiquido,
    receitaLiquida,
    tributos,
    precoFinal,
    despesas: receitaLiquida * (input.despesasPercent / 100),
    lucro: receitaLiquida * (input.margemPercent / 100),
    cargaSobrePrecoFinal: precoFinal > 0 ? (tributos / precoFinal) * 100 : 0,
  };
}
