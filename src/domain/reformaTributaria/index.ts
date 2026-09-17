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
 * (ex.: 9.21 significa 9,21%).
 */

// ---------------------------------------------------------------------------
// Alíquotas de referência
// ---------------------------------------------------------------------------

/**
 * Alíquotas de referência estimadas para o IVA Dual em regime pleno:
 * CBS 9,21% + IBS 17,7%.
 *
 * ATENÇÃO: são ESTIMATIVAS. As alíquotas de referência definitivas serão
 * fixadas por Resolução do Senado Federal (EC 132/2023), com base no cálculo do
 * Tribunal de Contas da União, e cada Estado/Município pode fixar alíquota
 * própria de IBS acima ou abaixo da referência. Trate como parâmetro editável.
 */
export const ALIQUOTA_REF_CBS = 9.21;
export const ALIQUOTA_REF_IBS = 17.7;

// ---------------------------------------------------------------------------
// Regimes diferenciados (redutores de alíquota)
// ---------------------------------------------------------------------------

export type ClassificacaoReforma =
  | 'padrao'
  | 'reducao60'
  | 'reducao30'
  | 'zero'
  | 'monofasicoRevenda'
  | 'personalizado';

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
  personalizado: {
    // O fator real vem de `fatorDoRegime`, a partir da redução que o usuário digita.
    label: 'Redução personalizada',
    fator: 1,
    mantemCredito: true,
    descricao:
      'Informe você mesmo o percentual de redução da alíquota, para enquadramentos específicos ou para testar um cenário que ainda está em discussão.',
  },
};

/**
 * Fator multiplicador da alíquota, considerando a redução personalizada quando
 * o regime escolhido é `personalizado`.
 *
 * Ex.: uma redução de 60% devolve 0,4 — a alíquota cai para 40% da referência.
 */
export function fatorDoRegime(
  classificacao: ClassificacaoReforma,
  reducaoPersonalizadaPercent = 0
): number {
  if (classificacao !== 'personalizado') return REGIMES_DIFERENCIADOS[classificacao].fator;
  const reducao = Math.min(100, Math.max(0, reducaoPersonalizadaPercent));
  return 1 - reducao / 100;
}

// ---------------------------------------------------------------------------
// Catálogo de reduções da LC 214/2025
// ---------------------------------------------------------------------------

export type GrupoReducao =
  | 'Alíquota cheia'
  | 'Redução de 60%'
  | 'Redução de 30%'
  | 'Alíquota zero'
  | 'Regimes específicos'
  | 'Personalizado';

export interface CategoriaLC214 {
  id: string;
  label: string;
  grupo: GrupoReducao;
  /** Como essa categoria se comporta no cálculo. */
  classificacao: ClassificacaoReforma;
  descricao: string;
}

/**
 * As hipóteses de redução previstas na LC 214/2025, agrupadas pelo tamanho do
 * redutor. Cada categoria aponta para o comportamento de cálculo correspondente
 * — o que muda entre elas é o enquadramento, não a conta.
 *
 * O enquadramento exato depende dos anexos da lei e do NCM/NBS do item; a lista
 * serve para a empresa se localizar, não para substituir a análise do contador.
 */
export const CATEGORIAS_LC214: CategoriaLC214[] = [
  {
    id: 'cheia',
    label: 'Alíquota cheia (regra geral)',
    grupo: 'Alíquota cheia',
    classificacao: 'padrao',
    descricao: 'Nenhuma redução: alíquota de referência integral, com crédito amplo sobre tudo que for adquirido para a atividade.',
  },
  {
    id: 'alimentos',
    label: 'Alimentos destinados ao consumo humano',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Alimentos in natura e industrializados destinados ao consumo humano que não estejam na Cesta Básica Nacional.',
  },
  {
    id: 'higiene',
    label: 'Produtos de higiene pessoal e limpeza',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Produtos de higiene pessoal e de limpeza majoritariamente consumidos por famílias de baixa renda.',
  },
  {
    id: 'saude',
    label: 'Serviços de saúde e dispositivos médicos',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Serviços de saúde humana, dispositivos médicos, de acessibilidade para pessoas com deficiência e medicamentos não listados na alíquota zero.',
  },
  {
    id: 'educacao',
    label: 'Serviços de educação',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Educação infantil, ensino fundamental, médio, superior e profissional, nos termos dos anexos da lei.',
  },
  {
    id: 'agro',
    label: 'Insumos agropecuários e aquícolas',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Fertilizantes, defensivos, sementes, rações, medicamentos veterinários e demais insumos da produção rural.',
  },
  {
    id: 'transporteColetivo',
    label: 'Transporte coletivo de passageiros',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Transporte rodoviário, ferroviário, hidroviário e aéreo coletivo de passageiros de caráter intermunicipal e interestadual.',
  },
  {
    id: 'cultura',
    label: 'Produções artísticas, culturais, jornalísticas e desportivas',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Produção e distribuição de conteúdo artístico, cultural, de eventos, jornalístico e desportivo nacionais.',
  },
  {
    id: 'bensImobiliarios',
    label: 'Serviços de comunicação institucional e bens imobiliários',
    grupo: 'Redução de 60%',
    classificacao: 'reducao60',
    descricao: 'Hipóteses de redução de 60% aplicáveis a comunicação institucional e a determinadas operações com bens imóveis.',
  },
  {
    id: 'profissoes',
    label: 'Profissões intelectuais regulamentadas',
    grupo: 'Redução de 30%',
    classificacao: 'reducao30',
    descricao: 'Advocacia, medicina, engenharia, contabilidade, arquitetura, odontologia e demais profissões regulamentadas, prestadas por sociedade uniprofissional.',
  },
  {
    id: 'cestaBasica',
    label: 'Cesta Básica Nacional de Alimentos',
    grupo: 'Alíquota zero',
    classificacao: 'zero',
    descricao: 'Itens da Cesta Básica Nacional de Alimentos. A alíquota zero não anula os créditos das compras — o saldo credor se acumula e pode ser ressarcido.',
  },
  {
    id: 'hortifruti',
    label: 'Hortícolas, frutas e ovos',
    grupo: 'Alíquota zero',
    classificacao: 'zero',
    descricao: 'Produtos hortícolas, frutas e ovos frescos ou refrigerados, nos termos do anexo da lei.',
  },
  {
    id: 'medicamentosZero',
    label: 'Medicamentos e dispositivos listados em anexo',
    grupo: 'Alíquota zero',
    classificacao: 'zero',
    descricao: 'Medicamentos registrados na Anvisa e dispositivos médicos e de acessibilidade especificamente listados com alíquota zero.',
  },
  {
    id: 'prouni',
    label: 'Educação superior — Prouni',
    grupo: 'Alíquota zero',
    classificacao: 'zero',
    descricao: 'Serviços de educação de ensino superior prestados por instituição aderente ao Prouni, na proporção das bolsas.',
  },
  {
    id: 'transportePublico',
    label: 'Transporte público coletivo urbano',
    grupo: 'Alíquota zero',
    classificacao: 'zero',
    descricao: 'Transporte público coletivo de passageiros rodoviário, metroviário e hidroviário de caráter urbano, semiurbano e metropolitano.',
  },
  {
    id: 'combustiveis',
    label: 'Revenda de combustíveis (monofásico)',
    grupo: 'Regimes específicos',
    classificacao: 'monofasicoRevenda',
    descricao: 'CBS e IBS cobrados uma única vez, por unidade de medida (ad rem), na operação do produtor ou importador. As revendas seguintes saem com alíquota zero e sem crédito para o revendedor.',
  },
  {
    id: 'personalizado',
    label: 'Redução personalizada (informar o percentual)',
    grupo: 'Personalizado',
    classificacao: 'personalizado',
    descricao: 'Informe o percentual de redução que se aplica ao seu caso — útil para enquadramentos específicos ou para testar um cenário.',
  },
];

/** As categorias agrupadas, na ordem em que devem aparecer na tela. */
export const GRUPOS_REDUCAO: GrupoReducao[] = [
  'Alíquota cheia',
  'Redução de 60%',
  'Redução de 30%',
  'Alíquota zero',
  'Regimes específicos',
  'Personalizado',
];

export function categoriaPorId(id: string): CategoriaLC214 {
  return CATEGORIAS_LC214.find(c => c.id === id) ?? CATEGORIAS_LC214[0];
}

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
 * Ex.: 26,91% por fora representam 21,20% do preço pago pelo consumidor — é
 * esse o número comparável com a carga de hoje.
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
  classificacao: ClassificacaoReforma = 'padrao',
  reducaoPersonalizadaPercent = 0
): ApuracaoIVA {
  const regime = REGIMES_DIFERENCIADOS[classificacao];
  const fator = fatorDoRegime(classificacao, reducaoPersonalizadaPercent);

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

// ---------------------------------------------------------------------------
// Repartição dos tributos dentro do DAS do Simples Nacional
// ---------------------------------------------------------------------------

export type Reparticao = { cpp: number; issIcms: number; csll: number; irpj: number; cofins: number; pis: number };

/**
 * Percentual de cada tributo dentro do valor total do DAS, por anexo e faixa
 * (Anexos da LC 123/2006). Fonte: planilha "Percentual de Repartição dos
 * Tributos" da Receita Federal. `issIcms = 0` nas faixas em que o ICMS/ISS é
 * recolhido à parte, fora do DAS.
 *
 * Na reforma, a parcela de PIS + COFINS é a que vira CBS, e a de ICMS/ISS vira
 * IBS — por isso a tabela também serve para projetar preço.
 */
export const REPARTICAO_SIMPLES: Record<string, Reparticao[]> = {
  'Anexo I': [
    { cpp: 41.50, issIcms: 34.00, csll: 3.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
    { cpp: 41.50, issIcms: 34.00, csll: 3.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
    { cpp: 42.00, issIcms: 33.50, csll: 3.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
    { cpp: 42.00, issIcms: 33.50, csll: 3.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
    { cpp: 42.00, issIcms: 33.50, csll: 3.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
    { cpp: 42.10, issIcms: 0.00, csll: 10.00, irpj: 13.50, cofins: 28.27, pis: 6.13 },
  ],
  'Anexo II': [
    { cpp: 37.50, issIcms: 32.00, csll: 3.50, irpj: 5.50, cofins: 11.51, pis: 2.49 },
    { cpp: 37.50, issIcms: 32.00, csll: 3.50, irpj: 5.50, cofins: 11.51, pis: 2.49 },
    { cpp: 37.50, issIcms: 32.00, csll: 3.50, irpj: 5.50, cofins: 11.51, pis: 2.49 },
    { cpp: 37.50, issIcms: 32.00, csll: 3.50, irpj: 5.50, cofins: 11.51, pis: 2.49 },
    { cpp: 37.50, issIcms: 32.00, csll: 3.50, irpj: 5.50, cofins: 11.51, pis: 2.49 },
    { cpp: 23.50, issIcms: 0.00, csll: 7.50, irpj: 8.50, cofins: 20.96, pis: 4.54 },
  ],
  'Anexo III': [
    { cpp: 43.40, issIcms: 33.50, csll: 3.50, irpj: 4.00, cofins: 12.82, pis: 2.78 },
    { cpp: 43.40, issIcms: 32.00, csll: 3.50, irpj: 4.00, cofins: 14.05, pis: 3.05 },
    { cpp: 43.40, issIcms: 32.50, csll: 3.50, irpj: 4.00, cofins: 13.64, pis: 2.96 },
    { cpp: 43.40, issIcms: 32.50, csll: 3.50, irpj: 4.00, cofins: 13.64, pis: 2.96 },
    { cpp: 43.40, issIcms: 33.50, csll: 3.50, irpj: 4.00, cofins: 12.82, pis: 2.78 },
    { cpp: 30.50, issIcms: 0.00, csll: 15.00, irpj: 35.00, cofins: 16.03, pis: 3.47 },
  ],
  'Anexo IV': [
    { cpp: 0, issIcms: 44.50, csll: 15.20, irpj: 18.80, cofins: 17.67, pis: 3.83 },
    { cpp: 0, issIcms: 40.00, csll: 15.20, irpj: 19.80, cofins: 20.55, pis: 4.45 },
    { cpp: 0, issIcms: 40.00, csll: 15.20, irpj: 20.80, cofins: 19.73, pis: 4.27 },
    { cpp: 0, issIcms: 40.00, csll: 19.20, irpj: 17.80, cofins: 18.90, pis: 4.10 },
    { cpp: 0, issIcms: 40.00, csll: 19.20, irpj: 18.80, cofins: 18.08, pis: 3.92 },
    { cpp: 0, issIcms: 0.00, csll: 21.50, irpj: 53.50, cofins: 20.55, pis: 4.45 },
  ],
  'Anexo V': [
    { cpp: 28.85, issIcms: 14.00, csll: 15.00, irpj: 25.00, cofins: 14.10, pis: 3.05 },
    { cpp: 27.85, issIcms: 17.00, csll: 15.00, irpj: 23.00, cofins: 14.10, pis: 3.05 },
    { cpp: 23.85, issIcms: 19.00, csll: 15.00, irpj: 24.00, cofins: 14.92, pis: 3.23 },
    { cpp: 23.85, issIcms: 21.00, csll: 15.00, irpj: 21.00, cofins: 15.74, pis: 3.41 },
    { cpp: 23.85, issIcms: 23.50, csll: 12.50, irpj: 23.00, cofins: 14.10, pis: 3.05 },
    { cpp: 29.50, issIcms: 0.00, csll: 15.50, irpj: 35.00, cofins: 16.44, pis: 3.56 },
  ],
};

export const ANEXOS_SIMPLES = Object.keys(REPARTICAO_SIMPLES);

export const FAIXAS_SIMPLES = [
  'Faixa 1 — RBT12 até R$ 180 mil',
  'Faixa 2 — até R$ 360 mil',
  'Faixa 3 — até R$ 720 mil',
  'Faixa 4 — até R$ 1,8 milhão',
  'Faixa 5 — até R$ 3,6 milhões',
  'Faixa 6 — até R$ 4,8 milhões',
];

// ---------------------------------------------------------------------------
// Projeção de preço por regime tributário
// ---------------------------------------------------------------------------

export type RegimeReforma = 'mei' | 'simplesDentro' | 'simplesFora' | 'presumido' | 'real';

export interface PresetRegime {
  label: string;
  /** O preço muda em 2027 neste regime? */
  precoMuda: boolean;
  /** Parcela fixa de PIS/COFINS sobre o faturamento (Presumido e Real). */
  pisCofinsFixo: number | null;
  /** Precisa de anexo/faixa do Simples para saber a parcela de PIS/COFINS? */
  usaTabelaSimples: boolean;
  /** Quanto do CMV passa a gerar crédito de CBS que hoje não existe, em %. */
  creditoPadrao: number;
  descricao: string;
}

/**
 * Como cada regime chega em 2027, quando PIS e COFINS são extintos e a CBS
 * entra por fora (ICMS e ISS seguem integrais até 2028).
 */
export const PRESETS_REGIME: Record<RegimeReforma, PresetRegime> = {
  mei: {
    label: 'MEI',
    precoMuda: false,
    pisCofinsFixo: 0,
    usaTabelaSimples: false,
    creditoPadrao: 0,
    descricao:
      'O DAS-MEI é um valor fixo e a reforma não o altera: o seu preço não muda em 2027. O ponto de atenção é comercial — quem compra do MEI toma crédito limitado de CBS.',
  },
  simplesDentro: {
    label: 'Simples Nacional — CBS dentro do DAS',
    precoMuda: false,
    pisCofinsFixo: 0,
    usaTabelaSimples: false,
    creditoPadrao: 0,
    descricao:
      'Mantendo a CBS dentro do DAS, a alíquota efetiva não muda de valor (a parcela de PIS/COFINS só passa a se chamar CBS) e você não toma crédito das compras. O preço fica igual.',
  },
  simplesFora: {
    label: 'Simples Nacional — CBS por fora do DAS',
    precoMuda: true,
    pisCofinsFixo: null,
    usaTabelaSimples: true,
    creditoPadrao: 100,
    descricao:
      'Optando por apurar a CBS pelo regime regular, a parcela de PIS/COFINS sai do DAS, você passa a creditar a CBS das compras e o seu cliente PJ credita a alíquota cheia.',
  },
  presumido: {
    label: 'Lucro Presumido',
    precoMuda: true,
    pisCofinsFixo: 3.65,
    usaTabelaSimples: false,
    creditoPadrao: 100,
    descricao:
      'Hoje você paga 3,65% de PIS/COFINS cumulativo e não credita nada das compras. Em 2027 isso vira CBS por fora, com crédito amplo — costuma ser o regime que mais ganha.',
  },
  real: {
    label: 'Lucro Real',
    precoMuda: true,
    pisCofinsFixo: 9.25,
    usaTabelaSimples: false,
    creditoPadrao: 0,
    descricao:
      'Hoje você paga 9,25% de PIS/COFINS não cumulativo e já credita insumos. A CBS troca um crédito restrito por um crédito amplo, então o ganho vem das compras que hoje não geram crédito.',
  },
};

export interface ProjecaoPrecoInput {
  /** Custo variável unitário (CMV) pago hoje. */
  cmv: number;
  /** Custo fixo unitário rateado. */
  custoFixoUnitario: number;
  /** % de impostos sobre o preço, por dentro, praticado hoje. */
  impostoPercent: number;
  /** % do preço que hoje é PIS/COFINS — some em 2027 e vira CBS. */
  pisCofinsPercent: number;
  /** Taxas de cartão, comissões e outras despesas variáveis, em % do preço. */
  despesasPercent: number;
  /** Margem líquida praticada, em % do preço. */
  margemPercent: number;
  /** Alíquota da CBS no ano simulado, antes do redutor. */
  aliquotaCbs: number;
  /** Regime diferenciado do produto (redutor de alíquota). */
  classificacao: ClassificacaoReforma;
  /** % do CMV que passa a gerar crédito de CBS que hoje não existe. */
  percCmvComCredito: number;
  /** Preço praticado hoje. */
  precoAtual: number;
  /** Redução da alíquota, em %, quando a classificação é `personalizado`. */
  reducaoPersonalizadaPercent?: number;
}

export interface ProjecaoPreco {
  aliquotaCbsAplicada: number;
  /** % de imposto que continua por dentro do preço (ICMS/ISS e demais). */
  impostoPorDentroRestante: number;
  /** Crédito de CBS por unidade vindo do CMV. */
  creditoCbsUnitario: number;
  /** Custo unitário depois do crédito. */
  custoLiquidoUnitario: number;
  /** Receita que fica com a empresa, sem a CBS. */
  receitaLiquida: number;
  /** CBS somada por fora. */
  cbsPorFora: number;
  /** Preço final para manter a mesma margem. */
  precoMantendoMargem: number;
  /** Variação percentual do preço em relação ao praticado hoje. */
  variacaoPercent: number;
  /** Margem realizada caso o preço de hoje seja mantido. */
  margemMantendoPreco: number;
  /** Lucro por unidade caso o preço de hoje seja mantido. */
  lucroMantendoPreco: number;
}

/**
 * Projeta o preço de um produto em 2027, quando PIS e COFINS somem e a CBS
 * entra por fora.
 *
 * Hoje:  Preço = (CMV + CF) ÷ (1 − impostos% − despesas% − margem%)
 * 2027:  Receita líquida = (CMV − crédito CBS + CF) ÷ (1 − impostos restantes% − despesas% − margem%)
 *        Preço final     = Receita líquida × (1 + CBS%)
 *
 * O crédito é calculado "por dentro" do que se paga pela mercadoria
 * (CMV × t ÷ (1 + t)): parte-se do princípio de que o valor desembolsado na
 * compra não muda e que a CBS destacada nele volta como crédito.
 */
export function projetarPrecoReforma(input: ProjecaoPrecoInput): ProjecaoPreco {
  const regimeDif = REGIMES_DIFERENCIADOS[input.classificacao];
  const aliquotaCbsAplicada = input.aliquotaCbs * fatorDoRegime(input.classificacao, input.reducaoPersonalizadaPercent);

  const pisCofins = Math.min(Math.max(0, input.pisCofinsPercent), Math.max(0, input.impostoPercent));
  const impostoPorDentroRestante = Math.max(0, input.impostoPercent - pisCofins);

  const percCredito = Math.min(100, Math.max(0, input.percCmvComCredito));
  const creditoCbsUnitario = regimeDif.mantemCredito
    ? input.cmv * (percCredito / 100) * (input.aliquotaCbs / (100 + input.aliquotaCbs))
    : 0;

  const custoLiquidoUnitario = input.cmv - creditoCbsUnitario;
  const base = custoLiquidoUnitario + input.custoFixoUnitario;
  const deducoes = (impostoPorDentroRestante + input.despesasPercent + input.margemPercent) / 100;

  if (deducoes >= 1) {
    return {
      aliquotaCbsAplicada,
      impostoPorDentroRestante,
      creditoCbsUnitario,
      custoLiquidoUnitario,
      receitaLiquida: 0,
      cbsPorFora: 0,
      precoMantendoMargem: 0,
      variacaoPercent: 0,
      margemMantendoPreco: 0,
      lucroMantendoPreco: 0,
    };
  }

  const receitaLiquida = base / (1 - deducoes);
  const cbsPorFora = receitaLiquida * (aliquotaCbsAplicada / 100);
  const precoMantendoMargem = receitaLiquida + cbsPorFora;

  // Mantendo o preço de hoje, o que sobra de margem depois da nova conta.
  const receitaLiquidaNoPrecoAtual = input.precoAtual / (1 + aliquotaCbsAplicada / 100);
  const lucroMantendoPreco =
    receitaLiquidaNoPrecoAtual
    - base
    - receitaLiquidaNoPrecoAtual * ((impostoPorDentroRestante + input.despesasPercent) / 100);

  return {
    aliquotaCbsAplicada,
    impostoPorDentroRestante,
    creditoCbsUnitario,
    custoLiquidoUnitario,
    receitaLiquida,
    cbsPorFora,
    precoMantendoMargem,
    variacaoPercent: input.precoAtual > 0 ? ((precoMantendoMargem - input.precoAtual) / input.precoAtual) * 100 : 0,
    margemMantendoPreco: input.precoAtual > 0 ? (lucroMantendoPreco / input.precoAtual) * 100 : 0,
    lucroMantendoPreco,
  };
}

/**
 * Quanto do percentual de imposto informado corresponde a PIS/COFINS hoje, em
 * cada regime. No Simples usa-se a tabela de repartição do anexo/faixa; no
 * Presumido e no Real, as alíquotas fixas do regime.
 */
export function parcelaPisCofins(
  regime: RegimeReforma,
  impostoPercent: number,
  anexo: string,
  faixaIndex: number
): number {
  const preset = PRESETS_REGIME[regime];
  if (!preset.precoMuda) return 0;
  if (preset.pisCofinsFixo !== null) return Math.min(preset.pisCofinsFixo, Math.max(0, impostoPercent));

  const rep = REPARTICAO_SIMPLES[anexo]?.[faixaIndex] ?? REPARTICAO_SIMPLES['Anexo I'][0];
  return Math.max(0, impostoPercent) * ((rep.pis + rep.cofins) / 100);
}
