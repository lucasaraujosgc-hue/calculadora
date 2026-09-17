import { describe, it, expect } from 'vitest';
import {
  ErroNotaFiscal,
  classificarCfop,
  competenciaDe,
  direcaoDaNota,
  eanValido,
  lerNotaFiscal,
  normalizarDescricao,
  somenteDigitos,
} from '../nfe';

const CNPJ_EMPRESA = '12345678000199';
const CNPJ_FORNECEDOR = '98765432000111';

/** Monta um XML de NF-e mínimo, mas com a estrutura real do layout 4.00. */
function xmlNota(opcoes: {
  chave?: string;
  emit?: string;
  dest?: string;
  dhEmi?: string;
  tpNF?: string;
  itens?: string;
  mod?: string;
} = {}) {
  const chave = opcoes.chave ?? '35240612345678000199550010000000011000000017';
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide>
        <mod>${opcoes.mod ?? '55'}</mod>
        <serie>1</serie>
        <nNF>1234</nNF>
        <dhEmi>${opcoes.dhEmi ?? '2026-05-14T10:22:33-03:00'}</dhEmi>
        <tpNF>${opcoes.tpNF ?? '1'}</tpNF>
        <natOp>VENDA DE MERCADORIA</natOp>
      </ide>
      <emit>
        <CNPJ>${opcoes.emit ?? CNPJ_EMPRESA}</CNPJ>
        <xNome>Mercadinho do Lucas LTDA</xNome>
      </emit>
      <dest>
        <CNPJ>${opcoes.dest ?? CNPJ_FORNECEDOR}</CNPJ>
        <xNome>Cliente Teste</xNome>
      </dest>
      ${opcoes.itens ?? `
      <det nItem="1">
        <prod>
          <cProd>ABC-1</cProd>
          <cEAN>7891000100103</cEAN>
          <xProd>REFRIGERANTE COLA 2L</xProd>
          <NCM>22021000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>8.5000000000</vUnCom>
          <vProd>85.00</vProd>
          <vDesc>5.00</vDesc>
          <vFrete>10.00</vFrete>
        </prod>
        <imposto>
          <ICMS><ICMS00><vICMS>15.30</vICMS></ICMS00></ICMS>
          <IPI><IPITrib><vIPI>4.00</vIPI></IPITrib></IPI>
          <PIS><PISAliq><vPIS>1.40</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><vCOFINS>6.46</vCOFINS></COFINSAliq></COFINS>
        </imposto>
      </det>`}
      <total>
        <ICMSTot><vNF>94.00</vNF></ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${chave}</chNFe></infProt></protNFe>
</nfeProc>`;
}

describe('Normalizações', () => {
  it('extrai só os dígitos de CNPJ e chave', () => {
    expect(somenteDigitos('12.345.678/0001-99')).toBe('12345678000199');
    expect(somenteDigitos(null)).toBe('');
  });

  it('normaliza a descrição para servir de chave', () => {
    expect(normalizarDescricao('Refrigerante  Cola 2L.')).toBe('REFRIGERANTE COLA 2L');
    expect(normalizarDescricao('Açúcar Cristal 1kg')).toBe('ACUCAR CRISTAL 1KG');
  });

  it('só aceita GTIN com tamanho válido', () => {
    expect(eanValido('7891000100103')).toBe(true);
    expect(eanValido('12345678')).toBe(true);
    expect(eanValido('SEM GTIN')).toBe(false);
    expect(eanValido('0000000000000')).toBe(false);
    expect(eanValido('123')).toBe(false);
  });

  it('extrai a competência da data de emissão', () => {
    expect(competenciaDe('2026-05-14T10:22:33-03:00')).toBe('2026-05');
    expect(competenciaDe('sem data')).toBe('');
  });
});

describe('Classificação de CFOP', () => {
  it('reconhece compra e venda normais', () => {
    expect(classificarCfop('1102')).toBe('normal'); // compra dentro do estado
    expect(classificarCfop('2102')).toBe('normal'); // compra de outro estado
    expect(classificarCfop('5102')).toBe('normal'); // venda dentro do estado
    expect(classificarCfop('6102')).toBe('normal'); // venda para outro estado
    expect(classificarCfop('5405')).toBe('normal'); // venda de produto com ST
  });

  it('reconhece devolução, transferência e remessa', () => {
    expect(classificarCfop('1202')).toBe('devolucao');
    expect(classificarCfop('5202')).toBe('devolucao');
    expect(classificarCfop('5152')).toBe('transferencia');
    expect(classificarCfop('5915')).toBe('remessa');
  });

  it('devolve "outro" para CFOP inválido', () => {
    expect(classificarCfop('')).toBe('outro');
    expect(classificarCfop('99')).toBe('outro');
  });
});

describe('Leitura do XML', () => {
  it('lê os dados da nota e do item', () => {
    const nota = lerNotaFiscal(xmlNota());
    expect(nota.chave).toBe('35240612345678000199550010000000011000000017');
    expect(nota.modelo).toBe('55');
    expect(nota.numero).toBe('1234');
    expect(nota.competencia).toBe('2026-05');
    expect(nota.emitente.doc).toBe(CNPJ_EMPRESA);
    expect(nota.destinatario.doc).toBe(CNPJ_FORNECEDOR);
    expect(nota.itens).toHaveLength(1);

    const item = nota.itens[0];
    expect(item.descricao).toBe('REFRIGERANTE COLA 2L');
    expect(item.ean).toBe('7891000100103');
    expect(item.origemChave).toBe('ean');
    expect(item.chaveProduto).toBe('7891000100103');
    expect(item.ncm).toBe('22021000'); // preserva o zero à esquerda
    expect(item.quantidade).toBe(10);
    expect(item.natureza).toBe('normal');
  });

  it('soma frete e IPI e desconta o desconto no valor que entra na conta', () => {
    const item = lerNotaFiscal(xmlNota()).itens[0];
    // 85 − 5 + 10 (frete) + 4 (IPI) = 94
    expect(item.valorLiquido).toBeCloseTo(94, 10);
    expect(item.valorUnitarioLiquido).toBeCloseTo(9.4, 10);
    // O valor unitário comercial puro continua disponível para comparação.
    expect(item.valorUnitario).toBeCloseTo(8.5, 10);
  });

  it('lê os impostos de dentro dos grupos do layout', () => {
    const item = lerNotaFiscal(xmlNota()).itens[0];
    expect(item.icms).toBeCloseTo(15.3, 10);
    expect(item.ipi).toBeCloseTo(4, 10);
    expect(item.pis).toBeCloseTo(1.4, 10);
    expect(item.cofins).toBeCloseTo(6.46, 10);
  });

  it('usa a descrição como chave quando não há GTIN', () => {
    const semGtin = xmlNota({
      itens: `<det nItem="1"><prod>
        <cProd>X1</cProd><cEAN>SEM GTIN</cEAN><xProd>Pão Francês</xProd>
        <NCM>19059090</NCM><CFOP>5102</CFOP><uCom>KG</uCom>
        <qCom>2.0000</qCom><vUnCom>15.00</vUnCom><vProd>30.00</vProd>
      </prod><imposto/></det>`,
    });
    const item = lerNotaFiscal(semGtin).itens[0];
    expect(item.ean).toBe('');
    expect(item.origemChave).toBe('descricao');
    expect(item.chaveProduto).toBe('PAO FRANCES');
  });

  it('aceita nota com vários itens', () => {
    const doisItens = xmlNota({
      itens: `
      <det nItem="1"><prod><cProd>A</cProd><cEAN>7891000100103</cEAN><xProd>ITEM A</xProd>
        <CFOP>5102</CFOP><uCom>UN</uCom><qCom>1</qCom><vUnCom>10</vUnCom><vProd>10</vProd></prod><imposto/></det>
      <det nItem="2"><prod><cProd>B</cProd><cEAN>7891000100110</cEAN><xProd>ITEM B</xProd>
        <CFOP>5102</CFOP><uCom>UN</uCom><qCom>2</qCom><vUnCom>20</vUnCom><vProd>40</vProd></prod><imposto/></det>`,
    });
    const nota = lerNotaFiscal(doisItens);
    expect(nota.itens.map(i => i.descricao)).toEqual(['ITEM A', 'ITEM B']);
    expect(nota.itens[1].numero).toBe(2);
  });

  it('recusa XML de evento com mensagem clara', () => {
    const evento = `<?xml version="1.0"?><procEventoNFe><evento><infEvento><tpEvento>110111</tpEvento></infEvento></evento></procEventoNFe>`;
    expect(() => lerNotaFiscal(evento)).toThrow(ErroNotaFiscal);
    expect(() => lerNotaFiscal(evento)).toThrow(/evento da nota/i);
  });

  it('recusa arquivo que não é nota', () => {
    expect(() => lerNotaFiscal('<?xml version="1.0"?><qualquerCoisa/>')).toThrow(/não encontramos uma NF-e/i);
  });

  it('recusa nota sem data de emissão', () => {
    expect(() => lerNotaFiscal(xmlNota({ dhEmi: '' }))).toThrow(/data de emissão/i);
  });
});

describe('Direção da nota pelo CNPJ da empresa', () => {
  it('é venda quando a empresa é a emitente', () => {
    const nota = lerNotaFiscal(xmlNota({ emit: CNPJ_EMPRESA, dest: CNPJ_FORNECEDOR }));
    const r = direcaoDaNota(nota, CNPJ_EMPRESA);
    expect(r.direcao).toBe('venda');
    expect(r.motivo).toMatch(/emitente/i);
  });

  it('é compra quando a empresa é a destinatária', () => {
    const nota = lerNotaFiscal(xmlNota({ emit: CNPJ_FORNECEDOR, dest: CNPJ_EMPRESA }));
    expect(direcaoDaNota(nota, CNPJ_EMPRESA).direcao).toBe('compra');
  });

  it('aceita o CNPJ formatado com pontuação', () => {
    const nota = lerNotaFiscal(xmlNota({ emit: CNPJ_EMPRESA }));
    expect(direcaoDaNota(nota, '12.345.678/0001-99').direcao).toBe('venda');
  });

  it('usa o tpNF quando a empresa está nos dois lados', () => {
    const entrada = lerNotaFiscal(xmlNota({ emit: CNPJ_EMPRESA, dest: CNPJ_EMPRESA, tpNF: '0' }));
    expect(direcaoDaNota(entrada, CNPJ_EMPRESA).direcao).toBe('compra');
    const saida = lerNotaFiscal(xmlNota({ emit: CNPJ_EMPRESA, dest: CNPJ_EMPRESA, tpNF: '1' }));
    expect(direcaoDaNota(saida, CNPJ_EMPRESA).direcao).toBe('venda');
  });

  it('recusa nota de terceiros', () => {
    const nota = lerNotaFiscal(xmlNota({ emit: CNPJ_FORNECEDOR, dest: '11111111000111' }));
    expect(() => direcaoDaNota(nota, CNPJ_EMPRESA)).toThrow(/não é da sua empresa/i);
  });

  it('exige documento válido cadastrado', () => {
    const nota = lerNotaFiscal(xmlNota());
    expect(() => direcaoDaNota(nota, '123')).toThrow(/CNPJ ou CPF válido/i);
  });

  it('funciona com CPF de 11 dígitos', () => {
    const cpf = '12345678901';
    const nota = lerNotaFiscal(xmlNota({ emit: cpf, itens: undefined }));
    expect(direcaoDaNota(nota, cpf).direcao).toBe('venda');
  });
});
