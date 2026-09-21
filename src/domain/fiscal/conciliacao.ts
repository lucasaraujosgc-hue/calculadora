/**
 * Conciliação entre os produtos do cadastro e os das notas fiscais.
 *
 * A partir da primeira vez que o usuário aplica valores de uma nota a um
 * produto, o elo fica gravado em `products.chave_fiscal` e o assunto acaba.
 * Este módulo existe para o que veio antes: o catálogo que já estava cadastrado
 * — digitado à mão, importado de planilha — e que não tem chave nenhuma.
 *
 * Aqui só se propõe. Quem decide é o usuário, pelo mesmo motivo de sempre: um
 * casamento errado joga o histórico de preço de um produto no preço de outro.
 */

import { normalizarDescricao } from './nfe';
import { tokensUteis } from './sugestoes';

export interface ProdutoCadastro {
  id: string;
  nome: string;
  chaveFiscal?: string | null;
}

export interface ProdutoFiscal {
  chaveProduto: string;
  descricao: string;
  ean?: string;
}

export interface SugestaoConciliacao {
  produtoId: string;
  nomeProduto: string;
  /** Produto fiscal proposto; `null` quando nada passou do limiar. */
  chaveProduto: string | null;
  descricaoFiscal: string | null;
  /** 0 a 100 — serve para ordenar e para a tela dizer o quanto confiar. */
  confianca: number;
  motivo: string;
}

/** Abaixo disto a proposta atrapalha mais do que ajuda; o usuário escolhe à mão. */
export const CONFIANCA_MINIMA = 40;

/**
 * Propõe, para cada produto do cadastro ainda sem chave, o produto fiscal
 * correspondente.
 *
 * Duas regras que evitam estrago:
 *
 * - produtos fiscais já usados por outro produto do cadastro ficam fora, senão
 *   confirmar duas propostas deixaria duas linhas do catálogo apontando para o
 *   mesmo histórico;
 * - cada produto fiscal é proposto para no máximo um produto do cadastro. As
 *   duplas são avaliadas todas, ordenadas por confiança, e atribuídas de cima
 *   para baixo — o melhor par leva, e os perdedores ficam sem proposta em vez
 *   de disputarem a mesma chave.
 */
export function sugerirConciliacao(
  cadastro: ProdutoCadastro[],
  fiscais: ProdutoFiscal[]
): SugestaoConciliacao[] {
  const pendentes = cadastro.filter(p => !p.chaveFiscal);
  if (pendentes.length === 0) return [];

  const jaUsadas = new Set(
    cadastro.map(p => p.chaveFiscal).filter((c): c is string => !!c)
  );
  const disponiveis = fiscais.filter(f => !jaUsadas.has(f.chaveProduto));

  interface Par {
    produtoId: string;
    chaveProduto: string;
    descricaoFiscal: string;
    confianca: number;
    motivo: string;
  }

  const pares: Par[] = [];

  for (const produto of pendentes) {
    const nomeNormalizado = normalizarDescricao(produto.nome);
    const tokensProduto = tokensUteis(produto.nome);

    for (const fiscal of disponiveis) {
      // Nome idêntico depois de normalizar (acento, caixa, pontuação) é o
      // sinal mais forte que existe sem código de barras no cadastro.
      if (nomeNormalizado && nomeNormalizado === normalizarDescricao(fiscal.descricao)) {
        pares.push({
          produtoId: produto.id,
          chaveProduto: fiscal.chaveProduto,
          descricaoFiscal: fiscal.descricao,
          confianca: 100,
          motivo: 'O nome no cadastro é igual ao da nota.',
        });
        continue;
      }

      if (tokensProduto.length === 0) continue;
      const tokensFiscal = new Set(tokensUteis(fiscal.descricao));
      const comuns = tokensProduto.filter(t => tokensFiscal.has(t));
      if (comuns.length === 0) continue;

      // Proporção sobre a descrição mais curta, como em `sugerirVinculos`:
      // compara bem "Refri Cola Lata" com "REFRIGERANTE COLA LATA 350ML".
      const menor = Math.min(tokensProduto.length, tokensFiscal.size);
      const confianca = Math.round((comuns.length / menor) * 100);

      pares.push({
        produtoId: produto.id,
        chaveProduto: fiscal.chaveProduto,
        descricaoFiscal: fiscal.descricao,
        confianca,
        motivo: `Descrições compartilham ${comuns.slice(0, 4).join(', ')}.`,
      });
    }
  }

  pares.sort((a, b) =>
    b.confianca - a.confianca
    || a.produtoId.localeCompare(b.produtoId)
    || a.chaveProduto.localeCompare(b.chaveProduto)
  );

  const produtoAtendido = new Set<string>();
  const chaveTomada = new Set<string>();
  const escolhidos = new Map<string, Par>();

  for (const par of pares) {
    if (par.confianca < CONFIANCA_MINIMA) continue;
    if (produtoAtendido.has(par.produtoId) || chaveTomada.has(par.chaveProduto)) continue;
    produtoAtendido.add(par.produtoId);
    chaveTomada.add(par.chaveProduto);
    escolhidos.set(par.produtoId, par);
  }

  // Todo produto pendente aparece na lista, com ou sem proposta: a tela precisa
  // mostrar o que ficou de fora tanto quanto o que casou.
  return pendentes
    .map(produto => {
      const escolhido = escolhidos.get(produto.id);
      if (!escolhido) {
        return {
          produtoId: produto.id,
          nomeProduto: produto.nome,
          chaveProduto: null,
          descricaoFiscal: null,
          confianca: 0,
          motivo: 'Nenhum produto das notas se parece o suficiente. Escolha à mão, se houver.',
        };
      }
      return {
        produtoId: produto.id,
        nomeProduto: produto.nome,
        chaveProduto: escolhido.chaveProduto,
        descricaoFiscal: escolhido.descricaoFiscal,
        confianca: escolhido.confianca,
        motivo: escolhido.motivo,
      };
    })
    .sort((a, b) => b.confianca - a.confianca || a.nomeProduto.localeCompare(b.nomeProduto, 'pt-BR'));
}
