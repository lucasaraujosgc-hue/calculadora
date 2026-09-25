import { describe, it, expect } from 'vitest';
import {
  sugerirConciliacao,
  CONFIANCA_MINIMA,
  type ProdutoCadastro,
  type ProdutoFiscal,
} from '../conciliacao';

const fiscal = (chave: string, descricao: string): ProdutoFiscal => ({ chaveProduto: chave, descricao });
const cad = (id: string, nome: string, chaveFiscal?: string | null): ProdutoCadastro => ({ id, nome, chaveFiscal });

describe('sugerirConciliacao', () => {
  it('casa nome idêntico depois de normalizar acento e caixa', () => {
    const r = sugerirConciliacao(
      [cad('p1', 'Refrigerante Cola Lata')],
      [fiscal('789', 'REFRIGERANTE COLA LATA'), fiscal('790', 'AGUA MINERAL 5L')]
    );
    expect(r).toHaveLength(1);
    expect(r[0].chaveProduto).toBe('789');
    expect(r[0].confianca).toBe(100);
    expect(r[0].motivo).toContain('igual');
  });

  it('casa por sobreposição de palavras quando o nome não é idêntico', () => {
    const r = sugerirConciliacao(
      [cad('p1', 'Refri Cola Lata')],
      [fiscal('789', 'REFRIGERANTE COLA LATA 350ML')]
    );
    expect(r[0].chaveProduto).toBe('789');
    expect(r[0].confianca).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);
    expect(r[0].motivo).toContain('COLA');
  });

  it('ignora produtos do cadastro que já têm chave', () => {
    const r = sugerirConciliacao(
      [cad('p1', 'Refrigerante Cola Lata', '789'), cad('p2', 'Agua Mineral 5L')],
      [fiscal('789', 'REFRIGERANTE COLA LATA'), fiscal('790', 'AGUA MINERAL 5L')]
    );
    expect(r).toHaveLength(1);
    expect(r[0].produtoId).toBe('p2');
    expect(r[0].chaveProduto).toBe('790');
  });

  it('não propõe uma chave fiscal que outro produto do cadastro já usa', () => {
    // 'p1' já é o dono do 789; 'p2', com nome parecido, não pode receber o mesmo.
    const r = sugerirConciliacao(
      [cad('p1', 'Refrigerante Cola Lata', '789'), cad('p2', 'Refrigerante Cola Lata Extra')],
      [fiscal('789', 'REFRIGERANTE COLA LATA')]
    );
    expect(r).toHaveLength(1);
    expect(r[0].produtoId).toBe('p2');
    expect(r[0].chaveProduto).toBeNull();
  });

  it('dá a chave disputada ao melhor par e deixa o outro sem proposta', () => {
    // Os dois se parecem com a mesma nota; confirmar ambos deixaria duas linhas
    // do catálogo apontando para o mesmo histórico.
    const r = sugerirConciliacao(
      [cad('p1', 'Refrigerante Cola Lata'), cad('p2', 'Refrigerante Cola')],
      [fiscal('789', 'REFRIGERANTE COLA LATA')]
    );
    const comChave = r.filter(s => s.chaveProduto !== null);
    expect(comChave).toHaveLength(1);
    expect(comChave[0].produtoId).toBe('p1');
    expect(comChave[0].confianca).toBe(100);
  });

  it('não propõe nada abaixo do limiar, mas lista o produto assim mesmo', () => {
    const r = sugerirConciliacao(
      [cad('p1', 'Parafuso Sextavado 8mm')],
      [fiscal('789', 'REFRIGERANTE COLA LATA')]
    );
    expect(r).toHaveLength(1);
    expect(r[0].chaveProduto).toBeNull();
    expect(r[0].motivo).toContain('à mão');
  });

  it('ordena as propostas mais confiáveis primeiro', () => {
    const r = sugerirConciliacao(
      [cad('p1', 'Parafuso Sextavado'), cad('p2', 'Agua Mineral 5L')],
      [fiscal('790', 'AGUA MINERAL 5L')]
    );
    expect(r[0].produtoId).toBe('p2');
    expect(r[0].confianca).toBe(100);
    expect(r[1].chaveProduto).toBeNull();
  });

  it('devolve lista vazia quando está tudo conciliado', () => {
    expect(sugerirConciliacao([cad('p1', 'X', '789')], [fiscal('789', 'X')])).toEqual([]);
  });

  it('não estoura sem notas importadas', () => {
    const r = sugerirConciliacao([cad('p1', 'Refrigerante Cola Lata')], []);
    expect(r).toHaveLength(1);
    expect(r[0].chaveProduto).toBeNull();
  });

  it('é estável entre duas chamadas com os mesmos dados', () => {
    const entradaCadastro = [cad('p1', 'Cerveja Pilsen Lata'), cad('p2', 'Cerveja Pilsen Long Neck')];
    const entradaFiscal = [fiscal('1', 'CERVEJA PILSEN LATA 350'), fiscal('2', 'CERVEJA PILSEN LONG NECK 355')];
    const a = sugerirConciliacao(entradaCadastro, entradaFiscal);
    const b = sugerirConciliacao(entradaCadastro, entradaFiscal);
    expect(a).toEqual(b);
  });
});
