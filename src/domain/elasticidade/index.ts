/**
 * Elasticidade-preço da demanda, estimada do histórico de notas.
 *
 * A pergunta que isto responde: quando esta empresa subiu o preço deste
 * produto, quanto o volume caiu? É o número que falta para decidir preço de
 * atração com alguma base — sem ele, baixar a margem é um custo certo contra um
 * retorno suposto.
 *
 * O método é a regressão log-log, que é o padrão para isto:
 *
 *     ln(quantidade) = a + b · ln(preço)
 *
 * O coeficiente `b` é a própria elasticidade: se vale −1,3, cada 1% de aumento
 * no preço veio acompanhado de 1,3% de queda no volume.
 *
 * ATENÇÃO — o que este módulo NÃO é. Dado mensal de varejo é confundido por
 * sazonalidade, promoção, ruptura de estoque e movimento do concorrente. Com
 * seis ou oito pontos, uma regressão produz um número que parece preciso e é
 * quase todo ruído. Por isso aqui a estimativa vem sempre acompanhada de um
 * grau de confiança, e em boa parte dos casos a resposta certa é "não dá para
 * dizer" — que é a resposta que este módulo devolve sem constrangimento.
 */

export interface PontoSerie {
  /** AAAA-MM. */
  competencia: string;
  /** Preço médio praticado no mês. */
  preco: number;
  /** Quantidade vendida no mês. */
  quantidade: number;
}

/**
 * Quanto se pode confiar na estimativa.
 * - `insuficiente`: não há o que medir; nenhum número é devolvido.
 * - `fraca`: o padrão existe mas explica pouco da variação. Serve de indício.
 * - `razoavel`: o preço explica boa parte do movimento do volume.
 * - `boa`: série longa e padrão consistente.
 */
export type ConfiancaElasticidade = 'insuficiente' | 'fraca' | 'razoavel' | 'boa';

export type ClassificacaoElasticidade = 'elastico' | 'inelastico' | 'sem-padrao';

/** Mínimo de meses com venda para tentar qualquer estimativa. */
export const MINIMO_PONTOS = 4;
/** Abaixo desta variação de preço não há experimento nenhum para ler. */
export const MINIMO_VARIACAO_PRECO = 3;

export interface ResultadoElasticidade {
  /** O coeficiente. Negativo é o comportamento normal. `null` sem estimativa. */
  elasticidade: number | null;
  confianca: ConfiancaElasticidade;
  /** Por que não deu, ou o que a estimativa significa. Texto para a tela. */
  motivo: string;
  classificacao: ClassificacaoElasticidade | null;
  /** Meses efetivamente usados. */
  pontos: number;
  /** Quanto da variação do volume o preço explica (0 a 1). */
  r2: number | null;
  /** Diferença entre o maior e o menor preço da série, em %. */
  variacaoPrecoPercent: number;
  menorPreco: number;
  maiorPreco: number;
}

/**
 * Estima a elasticidade de uma série mensal.
 *
 * Meses sem venda ou sem preço ficam de fora: o logaritmo não existe em zero, e
 * um mês sem venda costuma ser ruptura de estoque, não reação a preço — incluí-lo
 * como "volume zero" ensinaria à regressão uma queda que o preço não causou.
 */
export function estimarElasticidade(serie: PontoSerie[]): ResultadoElasticidade {
  const validos = serie.filter(p => p.preco > 0 && p.quantidade > 0);

  const precos = validos.map(p => p.preco);
  const menorPreco = precos.length > 0 ? Math.min(...precos) : 0;
  const maiorPreco = precos.length > 0 ? Math.max(...precos) : 0;
  const variacaoPrecoPercent = menorPreco > 0 ? ((maiorPreco - menorPreco) / menorPreco) * 100 : 0;

  const base = {
    elasticidade: null,
    classificacao: null,
    pontos: validos.length,
    r2: null,
    variacaoPrecoPercent,
    menorPreco,
    maiorPreco,
  };

  if (validos.length < MINIMO_PONTOS) {
    return {
      ...base,
      confianca: 'insuficiente',
      motivo: `São necessários pelo menos ${MINIMO_PONTOS} meses com venda para estimar; há ${validos.length}.`,
    };
  }

  if (variacaoPrecoPercent < MINIMO_VARIACAO_PRECO) {
    return {
      ...base,
      confianca: 'insuficiente',
      motivo: 'O preço praticamente não mudou no período. Não dá para medir reação a uma mudança que não houve.',
    };
  }

  const xs = validos.map(p => Math.log(p.preco));
  const ys = validos.map(p => Math.log(p.quantidade));
  const n = xs.length;
  const mediaX = xs.reduce((s, v) => s + v, 0) / n;
  const mediaY = ys.reduce((s, v) => s + v, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mediaX) * (ys[i] - mediaY);
    sxx += (xs[i] - mediaX) ** 2;
  }

  // Preços distintos em reais podem colapsar em log por arredondamento; sem
  // dispersão em x não há reta.
  if (sxx === 0) {
    return {
      ...base,
      confianca: 'insuficiente',
      motivo: 'Os preços do período não têm variação suficiente para estimar.',
    };
  }

  const b = sxy / sxx;
  const a = mediaY - b * mediaX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const previsto = a + b * xs[i];
    ssRes += (ys[i] - previsto) ** 2;
    ssTot += (ys[i] - mediaY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // Volume subindo junto com o preço não é elasticidade positiva: é sinal de
  // que outra coisa (sazonalidade, o produto entrando na moda, uma campanha)
  // mandou mais que o preço. Devolver "+0,8" aqui seria convidar o usuário a
  // subir preço esperando vender mais.
  if (b >= 0) {
    return {
      ...base,
      elasticidade: b,
      r2,
      confianca: 'insuficiente',
      classificacao: 'sem-padrao',
      motivo: 'No período, o volume subiu junto com o preço. Isso aponta para sazonalidade ou outro fator mais forte que o preço — não para reação ao preço.',
    };
  }

  const confianca: ConfiancaElasticidade =
    r2 >= 0.6 && n >= 6 ? 'boa'
    : r2 >= 0.3 ? 'razoavel'
    : 'fraca';

  const classificacao: ClassificacaoElasticidade = Math.abs(b) > 1 ? 'elastico' : 'inelastico';

  const motivo = classificacao === 'elastico'
    ? 'O volume reage mais que proporcionalmente ao preço: descontos tendem a se pagar, aumentos custam caro em volume.'
    : 'O volume reage menos que proporcionalmente ao preço: há espaço para preço sem perder tanta venda.';

  return {
    elasticidade: b,
    confianca,
    motivo,
    classificacao,
    pontos: n,
    r2,
    variacaoPrecoPercent,
    menorPreco,
    maiorPreco,
  };
}

/**
 * Projeta a variação de volume para uma variação de preço, em pontos percentuais.
 *
 * Num modelo log-log a relação é multiplicativa, não linear: variar o preço em
 * `d` multiplica o volume por `(1 + d)^b`. Vale para variações modestas e dentro
 * da faixa de preços que a série cobriu — extrapolar para muito além do que a
 * empresa já praticou é inventar.
 */
export function projetarVolume(
  resultado: ResultadoElasticidade,
  variacaoPrecoPercent: number
): number | null {
  if (resultado.elasticidade === null || resultado.confianca === 'insuficiente') return null;
  const fator = 1 + variacaoPrecoPercent / 100;
  if (fator <= 0) return null;
  return (Math.pow(fator, resultado.elasticidade) - 1) * 100;
}

/** Rótulo curto do grau de confiança, para a tela. */
export const ROTULO_CONFIANCA: Record<ConfiancaElasticidade, string> = {
  insuficiente: 'Sem dados suficientes',
  fraca: 'Indício fraco',
  razoavel: 'Indício razoável',
  boa: 'Padrão consistente',
};
