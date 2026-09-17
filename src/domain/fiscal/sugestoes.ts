/**
 * Sugestões de vínculo entre um produto-embalagem e o produto vendido.
 *
 * Quando a nota de compra não declara a unidade tributável, o sistema não tem
 * como saber sozinho que "CAIXA CERVEJA PILSEN C/12" é a mesma coisa que
 * "Cerveja Pilsen Lata 350ml". O que ele faz aqui é levantar candidatos e
 * propor um fator — a decisão é sempre do usuário.
 *
 * O sinal mais forte é o desencontro: um produto que só aparece em compras e
 * outro que só aparece em vendas, com descrições parecidas, quase sempre são o
 * mesmo item em embalagens diferentes.
 */

import type { ResumoProduto } from './tipos';

/** Palavras que indicam embalagem e não ajudam a identificar o produto. */
const PALAVRAS_EMBALAGEM = new Set([
  'CAIXA', 'CX', 'FARDO', 'FD', 'PACK', 'PCT', 'PACOTE', 'DISPLAY', 'DP',
  'EMBALAGEM', 'EMB', 'BANDEJA', 'ENGRADADO', 'UNIDADE', 'UN', 'UND', 'C', 'COM',
  'CONTENDO', 'KIT', 'SACO', 'SC', 'FRD',
]);

/** Palavras curtas ou genéricas demais para servirem de identificação. */
const PALAVRAS_IGNORADAS = new Set(['DE', 'DA', 'DO', 'E', 'A', 'O', 'ML', 'L', 'G', 'KG']);

/**
 * Procura na descrição quantas unidades vêm na embalagem.
 *
 * Reconhece as formas que aparecem de verdade nas notas: "C/12", "C 12",
 * "CX 12", "FARDO 12", "PACK 6", "COM 24", "12X", "X12", "EMB. 6".
 */
export function fatorNaDescricao(descricao: string): number | null {
  const texto = String(descricao ?? '').toUpperCase();

  const padroes: RegExp[] = [
    /\bC\s*\/\s*(\d{1,4})\b/,                              // C/12
    /\b(?:CX|CAIXA|FARDO|FD|PACK|PCT|PACOTE|DISPLAY|EMB)\.?\s*(?:C\s*\/\s*)?(\d{1,4})\b/, // FARDO 12, CX C/12
    /\bCOM\s+(\d{1,4})\b/,                                 // COM 24
    /\b(\d{1,4})\s*X\s*\d/,                                // 12X350
    /\bX\s*(\d{1,4})\b/,                                   // X12
  ];

  for (const padrao of padroes) {
    const m = texto.match(padrao);
    if (m) {
      const n = Number(m[1]);
      // Fatores absurdos quase sempre são volume (350ML) lido errado.
      if (Number.isFinite(n) && n >= 2 && n <= 500) return n;
    }
  }
  return null;
}

/** Palavras úteis de uma descrição, já sem as que indicam embalagem. */
function tokensUteis(descricao: string): string[] {
  return String(descricao ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(t =>
      t.length >= 2
      && !PALAVRAS_EMBALAGEM.has(t)
      && !PALAVRAS_IGNORADAS.has(t)
      && !/^\d+$/.test(t)
    );
}

export interface SugestaoVinculo {
  chaveOrigem: string;
  chaveDestino: string;
  nomeOrigem: string;
  nomeDestino: string;
  /** Fator lido da descrição; `null` quando o usuário precisa informar. */
  fator: number | null;
  /** Por que o sistema achou que são o mesmo produto. */
  motivo: string;
  /** 0 a 100 — serve só para ordenar as sugestões mais prováveis primeiro. */
  confianca: number;
}

export interface OpcoesSugestao {
  /** Chaves que já têm vínculo (confirmado ou descartado) e não devem voltar. */
  jaResolvidas?: Set<string>;
}

/**
 * Levanta os pares candidatos entre produtos só-comprados e só-vendidos.
 *
 * Nada aqui é aplicado: a função devolve propostas para o usuário confirmar.
 */
export function sugerirVinculos(
  produtos: ResumoProduto[],
  opcoes: OpcoesSugestao = {}
): SugestaoVinculo[] {
  const jaResolvidas = opcoes.jaResolvidas ?? new Set<string>();

  const soComprados = produtos.filter(p =>
    p.quantidadeCompradaTotal > 0
    && p.quantidadeVendidaTotal === 0
    && !jaResolvidas.has(p.chaveProduto)
  );
  const soVendidos = produtos.filter(p =>
    p.quantidadeVendidaTotal > 0
    && p.quantidadeCompradaTotal === 0
  );

  if (soComprados.length === 0 || soVendidos.length === 0) return [];

  const sugestoes: SugestaoVinculo[] = [];

  for (const origem of soComprados) {
    const tokensOrigem = tokensUteis(origem.descricao);
    if (tokensOrigem.length === 0) continue;

    let melhor: { destino: ResumoProduto; comuns: string[]; confianca: number } | null = null;

    for (const destino of soVendidos) {
      if (destino.chaveProduto === origem.chaveProduto) continue;
      const tokensDestino = new Set(tokensUteis(destino.descricao));
      const comuns = tokensOrigem.filter(t => tokensDestino.has(t));
      if (comuns.length === 0) continue;

      // Proporção de palavras em comum sobre a descrição mais curta: compara
      // bem "CAIXA CERVEJA PILSEN C/12" com "Cerveja Pilsen Lata 350ml".
      const menor = Math.min(tokensOrigem.length, tokensDestino.size);
      let confianca = (comuns.length / menor) * 100;

      // Mesmo NCM é um reforço forte: é a mesma classificação fiscal.
      const mesmoNcm = !!origem.ncm && origem.ncm === destino.ncm;
      if (mesmoNcm) confianca = Math.min(100, confianca + 25);

      // Duas palavras em comum já dizem bastante; uma só é fraco demais.
      if (comuns.length < 2 && !mesmoNcm) continue;

      if (!melhor || confianca > melhor.confianca) {
        melhor = { destino, comuns, confianca };
      }
    }

    if (!melhor) continue;

    const fator = fatorNaDescricao(origem.descricao);
    const partes: string[] = [];
    partes.push(`descrições compartilham ${melhor.comuns.slice(0, 3).join(', ')}`);
    if (origem.ncm && origem.ncm === melhor.destino.ncm) partes.push(`mesmo NCM (${origem.ncm})`);
    partes.push(`"${origem.descricao}" só aparece em compras e "${melhor.destino.descricao}" só em vendas`);

    sugestoes.push({
      chaveOrigem: origem.chaveProduto,
      chaveDestino: melhor.destino.chaveProduto,
      nomeOrigem: origem.descricao,
      nomeDestino: melhor.destino.descricao,
      fator,
      motivo: partes.join('; '),
      confianca: Math.round(melhor.confianca),
    });
  }

  return sugestoes.sort((a, b) => b.confianca - a.confianca);
}
