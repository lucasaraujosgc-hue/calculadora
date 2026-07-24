import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tabelas oficiais do Simples Nacional (Anexos I a V — LC 123/2006)
// Cada faixa: [limiteRBT12, aliquotaNominal(%), parcelaADeduzir]
// ---------------------------------------------------------------------------
const TABELAS_SIMPLES: Record<string, [number, number, number][]> = {
  'Anexo I': [
    [180000, 4.00, 0],
    [360000, 7.30, 5940],
    [720000, 9.50, 13860],
    [1800000, 10.70, 22500],
    [3600000, 14.30, 87300],
    [4800000, 19.00, 378000],
  ],
  'Anexo II': [
    [180000, 4.50, 0],
    [360000, 7.80, 5940],
    [720000, 10.00, 13860],
    [1800000, 11.20, 22500],
    [3600000, 14.70, 85500],
    [4800000, 30.00, 720000],
  ],
  'Anexo III': [
    [180000, 6.00, 0],
    [360000, 11.20, 9360],
    [720000, 13.50, 17640],
    [1800000, 16.00, 35640],
    [3600000, 21.00, 125640],
    [4800000, 33.00, 648000],
  ],
  'Anexo IV': [
    [180000, 4.50, 0],
    [360000, 9.00, 8100],
    [720000, 10.20, 12420],
    [1800000, 14.00, 39780],
    [3600000, 22.00, 183780],
    [4800000, 33.00, 828000],
  ],
  'Anexo V': [
    [180000, 15.50, 0],
    [360000, 18.00, 4500],
    [720000, 19.50, 9900],
    [1800000, 20.50, 17100],
    [3600000, 23.00, 62100],
    [4800000, 30.50, 540000],
  ],
};

const ANEXOS = Object.keys(TABELAS_SIMPLES);

const DESCRICAO_ANEXO: Record<string, string> = {
  'Anexo I': 'Comércio — lojas, mercados, distribuidoras, e-commerces. Alíquotas de 4% a 19%.',
  'Anexo II': 'Indústria — fábricas, confecções, marcenarias, transformação de produtos. Alíquotas de 4,5% a 30%.',
  'Anexo III': 'Serviços em geral — instalação, reparo, manutenção, agências de viagem e atividades intelectuais que atingem o Fator R. Alíquotas de 6% a 33%.',
  'Anexo IV': 'Serviços com CPP fora do DAS — construção civil, limpeza, vigilância (o INSS patronal é pago à parte). Alíquotas de 4,5% a 33%.',
  'Anexo V': 'Serviços intelectuais — TI, engenharia, arquitetura, consultoria, publicidade. Alíquotas de 15,5% a 30,5%, as mais altas do regime — por isso o Fator R importa tanto aqui.',
};

// Limite anual da Faixa 1 (RBT12 até R$ 180.000 = média mensal de até R$ 15.000)
const LIMITE_FAIXA_1 = 180000;

// Alíquotas especiais para faixa 1 (até 15 mil/mês)
const ALIQUOTA_ESPECIAL_ANEXO_I = 2.64;
const ALIQUOTA_ESPECIAL_ANEXO_II = 3.06;

function calcularAnexo(rbt12: number, anexoSelecionado: string, folhaMensal: number) {
  const folha12 = folhaMensal * 12;
  const fatorR = rbt12 > 0 ? (folha12 / rbt12) * 100 : 0;

  // Regra do Fator R: Anexo V só se aplica se Fator R < 28%. Caso contrário, usa o Anexo III.
  let anexoUsado = anexoSelecionado;
  if (anexoSelecionado === 'Anexo V' && fatorR >= 28) {
    anexoUsado = 'Anexo III';
  }

  const faixas = TABELAS_SIMPLES[anexoUsado];
  const faixa = faixas.find(f => rbt12 <= f[0]) || faixas[faixas.length - 1];
  const [, nominal, pd] = faixa;

  let aliquotaEfetiva = rbt12 > 0 ? (((rbt12 * (nominal / 100)) - pd) / rbt12) * 100 : 0;

  // --- REGRA ESPECIAL: se faturamento médio mensal <= 15 mil (faixa 1) ---
  if (rbt12 <= LIMITE_FAIXA_1) {
    if (anexoUsado === 'Anexo I') {
      aliquotaEfetiva = ALIQUOTA_ESPECIAL_ANEXO_I;
    } else if (anexoUsado === 'Anexo II') {
      aliquotaEfetiva = ALIQUOTA_ESPECIAL_ANEXO_II;
    }
  }

  return { fatorR, anexoUsado, nominal, pd, aliquotaEfetiva };
}

type AtividadePresumido = 'comercio' | 'servico';

const PRESUNCAO_PADRAO: Record<AtividadePresumido, { irpj: number; csll: number; issIcms: number; labelImposto: string }> = {
  comercio: { irpj: 8, csll: 12, issIcms: 20.5, labelImposto: 'ICMS' },
  servico: { irpj: 32, csll: 32, issIcms: 5, labelImposto: 'ISS' },
};

function calcularPresumido(faturamentoMensal: number, presuncaoIRPJ: number, presuncaoCSLL: number, aliquotaIssIcms: number) {
  const baseIRPJ = faturamentoMensal * (presuncaoIRPJ / 100);
  const baseCSLL = faturamentoMensal * (presuncaoCSLL / 100);

  const irpj = baseIRPJ * 0.15 + (baseIRPJ > 20000 ? (baseIRPJ - 20000) * 0.10 : 0);
  const csll = baseCSLL * 0.09;
  const pis = faturamentoMensal * 0.0065;
  const cofins = faturamentoMensal * 0.03;
  const issIcms = faturamentoMensal * (aliquotaIssIcms / 100);

  const total = irpj + csll + pis + cofins + issIcms;
  const aliquotaEfetiva = faturamentoMensal > 0 ? (total / faturamentoMensal) * 100 : 0;

  return { baseIRPJ, baseCSLL, irpj, csll, pis, cofins, issIcms, total, aliquotaEfetiva };
}

export default function SimuladorImpostos() {
  const [regime, setRegime] = useState<'mei' | 'simples' | 'presumido' | 'manual'>('simples');
  const [faturamentoMensal, setFaturamentoMensal] = useState(25000);
  const [aliquotaManual, setAliquotaManual] = useState(10);

  // Simples Nacional — modo único
  const [anexo, setAnexo] = useState('Anexo III');
  const [folhaMensal, setFolhaMensal] = useState(0);

  // Simples Nacional — modo rateio entre anexos
  const [ratearAnexos, setRatearAnexos] = useState(false);
  const [valoresPorAnexo, setValoresPorAnexo] = useState<Record<string, number>>({
    'Anexo I': 0, 'Anexo II': 0, 'Anexo III': 0, 'Anexo IV': 0, 'Anexo V': 0,
  });

  // Lucro Presumido
  const [atividadePresumido, setAtividadePresumido] = useState<AtividadePresumido>('servico');
  const [presuncaoIRPJ, setPresuncaoIRPJ] = useState(PRESUNCAO_PADRAO.servico.irpj);
  const [presuncaoCSLL, setPresuncaoCSLL] = useState(PRESUNCAO_PADRAO.servico.csll);
  const [aliquotaIssIcms, setAliquotaIssIcms] = useState(PRESUNCAO_PADRAO.servico.issIcms);

  const faturamentoAnual = faturamentoMensal * 12;

  const handleAtividadeChange = (val: AtividadePresumido) => {
    setAtividadePresumido(val);
    setPresuncaoIRPJ(PRESUNCAO_PADRAO[val].irpj);
    setPresuncaoCSLL(PRESUNCAO_PADRAO[val].csll);
    setAliquotaIssIcms(PRESUNCAO_PADRAO[val].issIcms);
  };

  const handleValorAnexoChange = (a: string, valor: number) => {
    setValoresPorAnexo(prev => ({ ...prev, [a]: valor }));
  };

  // Resultado do modo único (um anexo só)
  const simplesResult = useMemo(
    () => calcularAnexo(faturamentoAnual, anexo, folhaMensal),
    [faturamentoAnual, anexo, folhaMensal]
  );

  // Resultado do modo rateio (vários anexos, mesmo RBT12 total)
  const rateioResult = useMemo(() => {
    const linhas = ANEXOS
      .map(a => {
        const valor = valoresPorAnexo[a] || 0;
        if (valor <= 0) return null;
        const r = calcularAnexo(faturamentoAnual, a, folhaMensal);
        const imposto = valor * (r.aliquotaEfetiva / 100);
        const isentoIcmsElegivel = (a === 'Anexo I' || a === 'Anexo II') && faturamentoAnual <= LIMITE_FAIXA_1;
        return { anexo: a, valor, ...r, imposto, isentoIcmsElegivel };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const somaValores = linhas.reduce((acc, l) => acc + l.valor, 0);
    const totalImposto = linhas.reduce((acc, l) => acc + l.imposto, 0);
    return { linhas, somaValores, totalImposto };
  }, [faturamentoAnual, valoresPorAnexo, folhaMensal]);

  const presumidoResult = useMemo(
    () => calcularPresumido(faturamentoMensal, presuncaoIRPJ, presuncaoCSLL, aliquotaIssIcms),
    [faturamentoMensal, presuncaoIRPJ, presuncaoCSLL, aliquotaIssIcms]
  );

  // Cálculo dos impostos para cada regime (usado no gráfico de comparação)
  const impostoMEI = faturamentoAnual <= 81000 ? 75 : 0; // valor fixo do DAS-MEI (se dentro do limite)
  const aliquotaMEI = faturamentoMensal > 0 ? (impostoMEI / faturamentoMensal) * 100 : 0;

  let impostoSimples = 0;
  let aliquotaSimples = 0;
  if (ratearAnexos) {
    impostoSimples = rateioResult.totalImposto;
    aliquotaSimples = faturamentoMensal > 0 ? (impostoSimples / faturamentoMensal) * 100 : 0;
  } else {
    aliquotaSimples = simplesResult.aliquotaEfetiva;
    impostoSimples = faturamentoMensal * (aliquotaSimples / 100);
  }

  const impostoPresumido = presumidoResult.total;
  const aliquotaPresumido = presumidoResult.aliquotaEfetiva;

  const impostoManual = faturamentoMensal * (aliquotaManual / 100);
  const aliquotaManualEfetiva = aliquotaManual;

  // Dados para o gráfico de comparação entre regimes
  const comparacaoRegimes = [
    { regime: 'MEI', imposto: impostoMEI, aliquota: aliquotaMEI, cor: '#f59e0b' },
    { regime: 'Simples Nacional', imposto: impostoSimples, aliquota: aliquotaSimples, cor: '#3b82f6' },
    { regime: 'Lucro Presumido', imposto: impostoPresumido, aliquota: aliquotaPresumido, cor: '#10b981' },
    { regime: 'Manual', imposto: impostoManual, aliquota: aliquotaManualEfetiva, cor: '#ef4444' },
  ];

  // Para o regime selecionado, mostramos o detalhamento
  let impostoPercentual = 0;
  let custoMensal = 0;
  if (regime === 'mei') {
    custoMensal = impostoMEI;
    impostoPercentual = aliquotaMEI;
  } else if (regime === 'simples') {
    custoMensal = impostoSimples;
    impostoPercentual = aliquotaSimples;
  } else if (regime === 'presumido') {
    custoMensal = impostoPresumido;
    impostoPercentual = aliquotaPresumido;
  } else {
    custoMensal = impostoManual;
    impostoPercentual = aliquotaManualEfetiva;
  }

  // Verifica se deve mostrar aviso de monofásico/substituição
  const mostrarAvisoMonofasico = regime === 'simples' && (
    (anexo === 'Anexo I' || anexo === 'Anexo II') && faturamentoAnual <= LIMITE_FAIXA_1
  );

  const diferencaRateio = faturamentoMensal - rateioResult.somaValores;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Simulador de Impostos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Simule a carga tributária da sua empresa em cada regime, para ter noção de quanto do faturamento vira imposto.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* Formulário */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Faturamento Mensal Médio (R$)</label>
            <input
              type="number"
              value={faturamentoMensal}
              onChange={e => setFaturamentoMensal(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">Faturamento Anual (RBT12): R$ {faturamentoAnual.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Regime Tributário</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setRegime('mei')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'mei' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>MEI</button>
              <button onClick={() => setRegime('simples')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'simples' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Simples Nacional</button>
              <button onClick={() => setRegime('presumido')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'presumido' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Lucro Presumido</button>
              <button onClick={() => setRegime('manual')} className={`py-2 px-3 rounded-md border text-sm font-medium ${regime === 'manual' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}>Percentual Manual</button>
            </div>
          </div>

          {regime === 'manual' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Alíquota (%)</label>
              <input type="number" value={aliquotaManual} onChange={e => setAliquotaManual(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
            </div>
          )}

          {regime === 'mei' && faturamentoAnual > 81000 && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
              Atenção: o faturamento anual máximo do MEI é de R$ 81.000,00. Considere migrar para o Simples Nacional.
            </div>
          )}

          {/* ---------------- SIMPLES NACIONAL ---------------- */}
          {regime === 'simples' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Sua empresa tributa em mais de um anexo?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRatearAnexos(false)}
                    className={`py-2 px-3 rounded-md border text-sm font-medium ${!ratearAnexos ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  >
                    Não, um só anexo
                  </button>
                  <button
                    onClick={() => setRatearAnexos(true)}
                    className={`py-2 px-3 rounded-md border text-sm font-medium ${ratearAnexos ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  >
                    Sim, ratear entre anexos
                  </button>
                </div>
              </div>

              {!ratearAnexos && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Anexo da Atividade</label>
                  <select
                    value={anexo}
                    onChange={e => setAnexo(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                  >
                    {ANEXOS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{DESCRICAO_ANEXO[anexo]}</p>
                </div>
              )}

              {ratearAnexos && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Informe quanto do seu faturamento mensal cada anexo representa. Ex.: de R$ 15.000 faturados, R$ 4.000 no Anexo I, R$ 8.000 no Anexo II e R$ 3.000 no Anexo III.
                  </p>
                  {ANEXOS.map(a => (
                    <div key={a}>
                      <label className="block text-sm font-medium text-foreground mb-1">{a} (R$/mês)</label>
                      <input
                        type="number"
                        value={valoresPorAnexo[a]}
                        onChange={e => handleValorAnexoChange(a, Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                  <div className={`text-xs rounded-md p-2 ${Math.abs(diferencaRateio) < 0.01 ? 'bg-muted/50 text-muted-foreground' : 'bg-amber-100 text-amber-700'}`}>
                    Soma informada: R$ {rateioResult.somaValores.toFixed(2)} de R$ {faturamentoMensal.toFixed(2)} do faturamento mensal
                    {Math.abs(diferencaRateio) >= 0.01 && (
                      <> — {diferencaRateio > 0 ? `faltam R$ ${diferencaRateio.toFixed(2)}` : `passou R$ ${Math.abs(diferencaRateio).toFixed(2)}`}.</>
                    )}
                  </div>
                </div>
              )}

              {((ratearAnexos && (valoresPorAnexo['Anexo V'] || 0) > 0) || (!ratearAnexos && anexo === 'Anexo V')) && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Folha de Pagamento Média Mensal da empresa, incl. pró-labore (R$)</label>
                  <input
                    type="number"
                    value={folhaMensal}
                    onChange={e => setFolhaMensal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Fator R = folha ÷ faturamento (últimos 12 meses, total da empresa). Se atingir 28% ou mais, a parcela do Anexo V é tributada pelo Anexo III.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Empresas de comércio ou indústria (Anexo I ou II) com faturamento mensal médio de até R$ 15.000 (RBT12 de até R$ 180.000, a Faixa 1) costumam ter isenção de ICMS — mas isso depende de lei do seu Estado, então confirme com seu contador.
                </span>
              </div>
            </div>
          )}

          {/* ---------------- LUCRO PRESUMIDO ---------------- */}
          {regime === 'presumido' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tipo de Atividade</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAtividadeChange('comercio')}
                    className={`py-2 px-3 rounded-md border text-sm font-medium ${atividadePresumido === 'comercio' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  >
                    Comércio / Indústria
                  </button>
                  <button
                    onClick={() => handleAtividadeChange('servico')}
                    className={`py-2 px-3 rounded-md border text-sm font-medium ${atividadePresumido === 'servico' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  >
                    Serviços
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Presunção IRPJ (%)</label>
                  <input type="number" value={presuncaoIRPJ} onChange={e => setPresuncaoIRPJ(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Presunção CSLL (%)</label>
                  <input type="number" value={presuncaoCSLL} onChange={e => setPresuncaoCSLL(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Alíquota de {PRESUNCAO_PADRAO[atividadePresumido].labelImposto} (%)
                </label>
                <input type="number" value={aliquotaIssIcms} onChange={e => setAliquotaIssIcms(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                <p className="text-xs text-muted-foreground mt-1">
                  {PRESUNCAO_PADRAO[atividadePresumido].labelImposto === 'ISS'
                    ? 'O ISS é definido por cada município (normalmente entre 2% e 5%). Confirme a alíquota da sua cidade.'
                    : 'O ICMS é definido por cada Estado e varia por produto — ajuste conforme sua realidade.'}
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  No Lucro Presumido, IRPJ e CSLL incidem sobre uma margem de lucro presumida por lei (não sobre o faturamento direto), com adicional de 10% de IRPJ sobre o que exceder R$ 20.000/mês de base presumida. PIS (0,65%) e COFINS (3%) incidem sobre o faturamento total.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary border border-primary/20 p-5 rounded-xl text-primary-foreground shadow-sm col-span-2">
              <p className="text-sm font-medium opacity-80 mb-1">Imposto Mensal Estimado ({regime === 'mei' ? 'MEI' : regime === 'simples' ? 'Simples Nacional' : regime === 'presumido' ? 'Lucro Presumido' : 'Manual'})</p>
              <h3 className="text-4xl font-bold">R$ {custoMensal.toFixed(2)}</h3>
              <p className="text-sm opacity-80 mt-2">Alíquota efetiva de {impostoPercentual.toFixed(2)}% sobre o faturamento.</p>
            </div>
          </div>

          {regime === 'simples' && !ratearAnexos && (
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-2">
              <h3 className="text-lg font-medium text-primary mb-2">Detalhamento — Simples Nacional</h3>
              {simplesResult.anexoUsado !== anexo && (
                <p className="text-sm text-amber-700 bg-amber-100 rounded-md p-2 mb-2">
                  Fator R = {simplesResult.fatorR.toFixed(2)}% (≥ 28%) → tributado pelo <strong>{simplesResult.anexoUsado}</strong> em vez do Anexo V.
                </p>
              )}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Anexo utilizado</span><span className="font-medium">{simplesResult.anexoUsado}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Alíquota nominal da faixa</span><span className="font-medium">{simplesResult.nominal.toFixed(2)}%</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Parcela a deduzir</span><span className="font-medium">R$ {simplesResult.pd.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Alíquota efetiva</span><span className="font-semibold text-primary">{simplesResult.aliquotaEfetiva.toFixed(2)}%</span></div>
              {faturamentoAnual > 4800000 && (
                <p className="text-sm text-red-700 bg-red-100 rounded-md p-2 mt-2">
                  RBT12 acima de R$ 4.800.000 — fora do limite do Simples Nacional.
                </p>
              )}
              {mostrarAvisoMonofasico && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700 mt-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Importante:</strong> caso sua empresa revenda produtos monofásicos ou com substituição tributária, a alíquota do Simples Nacional pode ser ainda menor. Consulte seu contador para simular o valor real do DAS com essas particularidades.
                  </span>
                </div>
              )}
            </div>
          )}

          {regime === 'simples' && ratearAnexos && (
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-3">
              <h3 className="text-lg font-medium text-primary mb-2">Detalhamento — Rateio entre Anexos</h3>
              <p className="text-xs text-muted-foreground">
                O RBT12 total da empresa (R$ {faturamentoAnual.toFixed(2)}) define a faixa em cada anexo — só a alíquota efetiva de cada um muda.
              </p>
              {rateioResult.linhas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Informe o valor de faturamento de pelo menos um anexo.</p>
              )}
              {rateioResult.linhas.map(l => {
                const isAnexoComEsp = (l.anexo === 'Anexo I' || l.anexo === 'Anexo II') && faturamentoAnual <= LIMITE_FAIXA_1;
                return (
                  <div key={l.anexo} className="p-3 bg-muted/50 rounded-lg border border-border space-y-1">
                    <div className="flex justify-between text-sm font-medium text-foreground">
                      <span>{l.anexo}{l.anexoUsado !== l.anexo ? ` → tributado como ${l.anexoUsado}` : ''}</span>
                      <span>R$ {l.valor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Alíquota efetiva {l.aliquotaEfetiva.toFixed(2)}%</span>
                      <span>Imposto: R$ {l.imposto.toFixed(2)}</span>
                    </div>
                    {l.isentoIcmsElegivel && (
                      <p className="text-xs text-emerald-700 bg-emerald-100 rounded-md p-2 mt-1">
                        RBT12 dentro da Faixa 1 (até R$ 180.000) — essa parcela pode ter isenção de ICMS, dependendo da lei do seu Estado.
                      </p>
                    )}
                    {isAnexoComEsp && (
                      <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700 mt-1">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          Alíquota especial de {l.aliquotaEfetiva.toFixed(2)}% aplicada por se tratar de faixa 1 (até R$ 15 mil/mês). Se revender produtos monofásicos ou com substituição tributária, o valor pode ser ainda menor — consulte seu contador.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Total do DAS no mês</span>
                <span className="font-semibold text-primary">R$ {rateioResult.totalImposto.toFixed(2)}</span>
              </div>
              {rateioResult.linhas.some(l => l.isentoIcmsElegivel) && (
                <p className="text-xs text-muted-foreground mt-1">
                  * A isenção de ICMS para faixa 1 depende da legislação estadual — verifique com seu contador.
                </p>
              )}
            </div>
          )}

          {regime === 'presumido' && (
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-2">
              <h3 className="text-lg font-medium text-primary mb-2">Detalhamento — Lucro Presumido (mensal)</h3>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">IRPJ (15% + adicional)</span><span className="font-medium">R$ {presumidoResult.irpj.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">CSLL (9%)</span><span className="font-medium">R$ {presumidoResult.csll.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">PIS (0,65%)</span><span className="font-medium">R$ {presumidoResult.pis.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">COFINS (3%)</span><span className="font-medium">R$ {presumidoResult.cofins.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{PRESUNCAO_PADRAO[atividadePresumido].labelImposto} ({aliquotaIssIcms}%)</span><span className="font-medium">R$ {presumidoResult.issIcms.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Total mensal</span><span className="font-semibold text-primary">R$ {presumidoResult.total.toFixed(2)}</span></div>
            </div>
          )}

          {/* Gráfico de comparação entre regimes */}
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-primary mb-4">Comparação entre Regimes Tributários</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparacaoRegimes} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={v => `R$${v / 1000}k`} />
                  <YAxis dataKey="regime" type="category" axisLine={false} tickLine={false} width={110} />
                  <Tooltip
                    formatter={(v: number, name: string, props: any) => {
                      const item = comparacaoRegimes.find(d => d.regime === props.payload.regime);
                      return [`R$ ${v.toFixed(2)} (${item?.aliquota.toFixed(2)}%)`, 'Imposto Mensal'];
                    }}
                  />
                  <Bar dataKey="imposto" radius={[0, 4, 4, 0]} barSize={24}>
                    {comparacaoRegimes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Barras representam o valor mensal de imposto (alíquota efetiva entre parênteses).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}