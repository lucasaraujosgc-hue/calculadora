import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Info } from 'lucide-react';
import { formatCurrency } from '../utils/format';

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

// ---------------------------------------------------------------------------
// Percentual de Repartição dos Tributos do Simples Nacional (Anexo I da LC 123)
// Percentuais de CADA tributo dentro do valor total do DAS, por anexo/faixa.
// Fonte: planilha "Percentual de Repartição dos Tributos" (Receita Federal).
// issIcms = 0 nas faixas em que o ICMS/ISS é recolhido à parte, fora do DAS.
// ---------------------------------------------------------------------------
type Reparticao = { cpp: number; issIcms: number; csll: number; irpj: number; cofins: number; pis: number };

const REPARTICAO_SIMPLES: Record<string, Reparticao[]> = {
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

function calcularAnexo(rbt12: number, anexoSelecionado: string, folhaMensal: number) {
  const folha12 = folhaMensal * 12;
  const fatorR = rbt12 > 0 ? (folha12 / rbt12) * 100 : 0;

  // Regra do Fator R: Anexo V só se aplica se Fator R < 28%. Caso contrário, usa o Anexo III.
  let anexoUsado = anexoSelecionado;
  if (anexoSelecionado === 'Anexo V' && fatorR >= 28) {
    anexoUsado = 'Anexo III';
  }

  const faixas = TABELAS_SIMPLES[anexoUsado];
  let faixaIndex = faixas.findIndex(f => rbt12 <= f[0]);
  if (faixaIndex === -1) faixaIndex = faixas.length - 1;
  const [, nominal, pd] = faixas[faixaIndex];

  let aliquotaEfetiva = rbt12 > 0 ? (((rbt12 * (nominal / 100)) - pd) / rbt12) * 100 : 0;

  // --- REGRA ESPECIAL: se faturamento médio mensal <= 15 mil (faixa 1) ---
  if (rbt12 <= LIMITE_FAIXA_1) {
    if (anexoUsado === 'Anexo I') {
      aliquotaEfetiva = ALIQUOTA_ESPECIAL_ANEXO_I;
    } else if (anexoUsado === 'Anexo II') {
      aliquotaEfetiva = ALIQUOTA_ESPECIAL_ANEXO_II;
    }
  }

  return { fatorR, anexoUsado, nominal, pd, aliquotaEfetiva, faixaIndex };
}

// Aplica os redutores de ICMS-ST/Isento e PIS/COFINS monofásico/alíquota zero
// segregando a receita informada e excluindo, apenas sobre ela, o percentual
// daquele tributo dentro do DAS (conforme tabela de repartição do anexo/faixa).
function calcularRedutorSimples(
  faturamento: number,
  aliquotaEfetiva: number,
  faixaIndex: number,
  anexoUsado: string,
  percIcmsEspecial: number,
  percPisCofinsEspecial: number
) {
  const rep = REPARTICAO_SIMPLES[anexoUsado][faixaIndex];
  const percIcms = Math.min(100, Math.max(0, percIcmsEspecial));
  const percPisCofins = Math.min(100, Math.max(0, percPisCofinsEspecial - Math.max(0, percIcms + percPisCofinsEspecial - 100)));
  const percNormal = Math.max(0, 100 - percIcms - percPisCofins);

  const dasSemReducao = faturamento * (aliquotaEfetiva / 100);

  const receitaNormal = faturamento * (percNormal / 100);
  const receitaIcmsEsp = faturamento * (percIcms / 100);
  const receitaPisCofinsEsp = faturamento * (percPisCofins / 100);

  const dasNormal = receitaNormal * (aliquotaEfetiva / 100);
  const dasIcmsEsp = receitaIcmsEsp * (aliquotaEfetiva / 100) * (1 - rep.issIcms / 100);
  const dasPisCofinsEsp = receitaPisCofinsEsp * (aliquotaEfetiva / 100) * (1 - (rep.pis + rep.cofins) / 100);

  const dasComReducao = dasNormal + dasIcmsEsp + dasPisCofinsEsp;
  const economia = dasSemReducao - dasComReducao;

  return { dasSemReducao, dasComReducao, economia, reparticao: rep, percIcms, percPisCofins, percNormal };
}

type AtividadePresumido = 'comercio' | 'servico';

const PRESUNCAO_PADRAO: Record<AtividadePresumido, { irpj: number; csll: number; issIcms: number; labelImposto: string }> = {
  comercio: { irpj: 8, csll: 12, issIcms: 20.5, labelImposto: 'ICMS' },
  servico: { irpj: 32, csll: 32, issIcms: 5, labelImposto: 'ISS' },
};

// Percentual aproximado de INSS Patronal + RAT (Riscos Ambientais do Trabalho)
// sobre a folha de pagamento no Lucro Presumido: 20% (patronal) + ~1% a 6% (RAT,
// varia por grau de risco/CNAE) + terceiros (Sistema S), média de mercado ~25,8%.
const ALIQUOTA_PATRONAL_RAT = 25.8;

function calcularPresumido(
  faturamentoMensal: number,
  presuncaoIRPJ: number,
  presuncaoCSLL: number,
  aliquotaIssIcms: number,
  atividade: AtividadePresumido,
  percIcmsEspecial: number,
  percPisCofinsEspecial: number,
  icmsCreditoCompras: number
) {
  const baseIRPJ = faturamentoMensal * (presuncaoIRPJ / 100);
  const baseCSLL = faturamentoMensal * (presuncaoCSLL / 100);

  const irpj = baseIRPJ * 0.15 + (baseIRPJ > 20000 ? (baseIRPJ - 20000) * 0.10 : 0);
  const csll = baseCSLL * 0.09;

  const percPisCofinsEsp = Math.min(100, Math.max(0, percPisCofinsEspecial));
  const percPisCofinsNormal = Math.max(0, 100 - percPisCofinsEsp);
  const pis = faturamentoMensal * (percPisCofinsNormal / 100) * 0.0065;
  const cofins = faturamentoMensal * (percPisCofinsNormal / 100) * 0.03;

  const percIcmsEsp = Math.min(100, Math.max(0, percIcmsEspecial));
  const percIcmsNormal = Math.max(0, 100 - percIcmsEsp);

  // Comércio/Indústria: apura ICMS (débito sobre venda − crédito sobre compras).
  // Serviço: apura ISS (sem crédito de compras).
  const icmsDebito = atividade === 'comercio' ? faturamentoMensal * (percIcmsNormal / 100) * (aliquotaIssIcms / 100) : 0;
  const creditoAplicavel = atividade === 'comercio' ? icmsCreditoCompras : 0;
  const icmsLiquido = Math.max(0, icmsDebito - creditoAplicavel);
  const saldoCredorIcms = Math.max(0, creditoAplicavel - icmsDebito);

  const issValor = atividade === 'servico' ? faturamentoMensal * (percIcmsNormal / 100) * (aliquotaIssIcms / 100) : 0;

  const issIcms = atividade === 'comercio' ? icmsLiquido : issValor;

  const total = irpj + csll + pis + cofins + issIcms;
  const aliquotaEfetiva = faturamentoMensal > 0 ? (total / faturamentoMensal) * 100 : 0;

  return {
    baseIRPJ, baseCSLL, irpj, csll, pis, cofins,
    icmsDebito, icmsCredito: creditoAplicavel, saldoCredorIcms,
    issIcms, total, aliquotaEfetiva,
  };
}

// ---------------------------------------------------------------------------
// Estados e regiões do Brasil + alíquotas de ICMS interestadual
// Fonte da regra interestadual: Resolução do Senado nº 22/1989 (alterada pela
// nº 13/2012) — 7% de Sul/Sudeste (exceto ES) para Norte/Nordeste/Centro-Oeste/ES;
// 12% nos demais casos entre estados diferentes. Alíquota interna varia por Estado.
// ---------------------------------------------------------------------------
const REGIOES: Record<string, string[]> = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
};

const NOME_ESTADO: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

// Alíquotas internas (dentro do próprio Estado) — tabela ICMS 2026 atualizada
// (fonte: https://contaazul.com/blog/tabela-de-aliquota-interestadual/,
// atualizada em 13/03/2026). Alagoas passa a 20,5% a partir de 01/04/2026.
// Cada Estado pode alterar por lei própria; confirme sempre com seu contador.
const ALIQUOTA_INTERNA: Record<string, number> = {
  AC: 19, AL: 20.5, AP: 18, AM: 20, BA: 20.5, CE: 20, DF: 20, ES: 17, GO: 19, MA: 23,
  MT: 17, MS: 17, MG: 18, PA: 19, PB: 20, PR: 19.5, PE: 20.5, PI: 22.5, RJ: 20,
  RN: 20, RS: 17, RO: 19.5, RR: 20, SC: 17, SP: 18, SE: 19, TO: 20,
};

function regiaoDoEstado(uf: string): string {
  for (const [regiao, estados] of Object.entries(REGIOES)) {
    if (estados.includes(uf)) return regiao;
  }
  return '';
}

function calcularAliquotaICMS(origem: string, destino: string): { aliquota: number; tipo: string } {
  if (!origem || !destino) return { aliquota: 0, tipo: '' };
  if (origem === destino) {
    return { aliquota: ALIQUOTA_INTERNA[origem] ?? 18, tipo: 'interna (mesma UF)' };
  }
  const regiaoOrigem = regiaoDoEstado(origem);
  const regiaoDestino = regiaoDoEstado(destino);
  const origemSulSudesteExcetoES = (regiaoOrigem === 'Sul' || regiaoOrigem === 'Sudeste') && origem !== 'ES';
  const destinoElegivel7 = regiaoDestino === 'Norte' || regiaoDestino === 'Nordeste' || regiaoDestino === 'Centro-Oeste' || destino === 'ES';

  if (origemSulSudesteExcetoES && destinoElegivel7) {
    return { aliquota: 7, tipo: 'interestadual de 7%' };
  }
  return { aliquota: 12, tipo: 'interestadual de 12%' };
}

// MEI 2026
type AtividadeMei = 'comercio' | 'servico' | 'ambos';
const MEI_VALORES: Record<AtividadeMei, number> = { comercio: 82.05, servico: 86.05, ambos: 87.05 };
const MEI_LABELS: Record<AtividadeMei, string> = {
  comercio: 'Comércio ou Indústria (INSS + ICMS)',
  servico: 'Prestação de Serviços (INSS + ISS)',
  ambos: 'Comércio e Serviços (INSS + ICMS + ISS)',
};
const LIMITE_ANUAL_MEI = 81000;

// ---------------------------------------------------------------------------
// Componentes auxiliares de UI
// ---------------------------------------------------------------------------
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function EstadoSelector({ label, value, onChange, help }: { label: string; value: string; onChange: (uf: string) => void; help?: string }) {
  const [regiaoAberta, setRegiaoAberta] = useState<string>(value ? regiaoDoEstado(value) : '');

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      {help && <p className="text-xs text-muted-foreground mb-2">{help}</p>}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {Object.keys(REGIOES).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRegiaoAberta(r)}
            className={`py-1.5 px-1 rounded-md border text-[11px] font-medium leading-tight ${regiaoAberta === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
          >
            {r}
          </button>
        ))}
      </div>
      {regiaoAberta && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/40 rounded-md border border-border">
          {REGIOES[regiaoAberta].map(uf => (
            <button
              key={uf}
              type="button"
              onClick={() => onChange(uf)}
              title={NOME_ESTADO[uf]}
              className={`py-1 px-2.5 rounded-md border text-xs font-medium ${value === uf ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
            >
              {uf}
            </button>
          ))}
        </div>
      )}
      {value && <p className="text-xs text-muted-foreground mt-1">Selecionado: {NOME_ESTADO[value]} ({value})</p>}
    </div>
  );
}

export default function SimuladorImpostos() {
  const [regime, setRegime] = useState<'mei' | 'simples' | 'presumido' | 'manual'>('simples');
  const [faturamentoMensal, setFaturamentoMensal] = useState(25000);
  const [aliquotaManual, setAliquotaManual] = useState(10);

  // MEI
  const [atividadeMei, setAtividadeMei] = useState<AtividadeMei>('comercio');

  // Simples Nacional — modo único
  const [anexo, setAnexo] = useState('Anexo III');
  const [folhaMensal, setFolhaMensal] = useState(0);

  // Simples Nacional — modo rateio entre anexos
  const [ratearAnexos, setRatearAnexos] = useState(false);
  const [valoresPorAnexo, setValoresPorAnexo] = useState<Record<string, number>>({
    'Anexo I': 0, 'Anexo II': 0, 'Anexo III': 0, 'Anexo IV': 0, 'Anexo V': 0,
  });

  // Simples Nacional — redutores (ICMS-ST/Isento e PIS/COFINS monofásico/alíq. zero)
  const [icmsEspecialSimples, setIcmsEspecialSimples] = useState(false);
  const [percIcmsSTSimples, setPercIcmsSTSimples] = useState(0);
  const [percIcmsIsentoSimples, setPercIcmsIsentoSimples] = useState(0);
  const [pisCofinsEspecialSimples, setPisCofinsEspecialSimples] = useState(false);
  const [percMonofasicoSimples, setPercMonofasicoSimples] = useState(0);
  const [percAliqZeroSimples, setPercAliqZeroSimples] = useState(0);

  // Lucro Presumido
  const [atividadePresumido, setAtividadePresumido] = useState<AtividadePresumido>('servico');
  const [presuncaoIRPJ, setPresuncaoIRPJ] = useState(PRESUNCAO_PADRAO.servico.irpj);
  const [presuncaoCSLL, setPresuncaoCSLL] = useState(PRESUNCAO_PADRAO.servico.csll);
  const [aliquotaIssIcms, setAliquotaIssIcms] = useState(PRESUNCAO_PADRAO.servico.issIcms);

  // Lucro Presumido — folha de pagamento (Patronal + RAT)
  const [folhaPresumido, setFolhaPresumido] = useState(0);

  // Lucro Presumido — compras de mercadorias e crédito de ICMS (só comércio/indústria)
  const [valorCompraMensal, setValorCompraMensal] = useState(0);
  const [estadoCompra, setEstadoCompra] = useState('BA');
  const [estadoEmpresa, setEstadoEmpresa] = useState('BA');

  // Lucro Presumido — redutores
  const [icmsEspecialPresumido, setIcmsEspecialPresumido] = useState(false);
  const [percIcmsSTPresumido, setPercIcmsSTPresumido] = useState(0);
  const [percIcmsIsentoPresumido, setPercIcmsIsentoPresumido] = useState(0);
  const [pisCofinsEspecialPresumido, setPisCofinsEspecialPresumido] = useState(false);
  const [percMonofasicoPresumido, setPercMonofasicoPresumido] = useState(0);
  const [percAliqZeroPresumido, setPercAliqZeroPresumido] = useState(0);

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

  const percIcmsEspecialSimplesTotal = icmsEspecialSimples ? percIcmsSTSimples + percIcmsIsentoSimples : 0;
  const percPisCofinsEspecialSimplesTotal = pisCofinsEspecialSimples ? percMonofasicoSimples + percAliqZeroSimples : 0;

  const redutorSimples = useMemo(
    () => calcularRedutorSimples(
      faturamentoMensal,
      simplesResult.aliquotaEfetiva,
      simplesResult.faixaIndex,
      simplesResult.anexoUsado,
      percIcmsEspecialSimplesTotal,
      percPisCofinsEspecialSimplesTotal
    ),
    [faturamentoMensal, simplesResult, percIcmsEspecialSimplesTotal, percPisCofinsEspecialSimplesTotal]
  );

  const temRedutorSimplesAtivo = !ratearAnexos && (icmsEspecialSimples || pisCofinsEspecialSimples);

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

  // Crédito de ICMS sobre compras (Lucro Presumido, comércio/indústria)
  const infoAliquotaCompra = useMemo(
    () => calcularAliquotaICMS(estadoCompra, estadoEmpresa),
    [estadoCompra, estadoEmpresa]
  );
  const icmsCreditoCompras = atividadePresumido === 'comercio'
    ? valorCompraMensal * (infoAliquotaCompra.aliquota / 100)
    : 0;

  const percIcmsEspecialPresumidoTotal = icmsEspecialPresumido ? percIcmsSTPresumido + percIcmsIsentoPresumido : 0;
  const percPisCofinsEspecialPresumidoTotal = pisCofinsEspecialPresumido ? percMonofasicoPresumido + percAliqZeroPresumido : 0;

  const presumidoResult = useMemo(
    () => calcularPresumido(
      faturamentoMensal, presuncaoIRPJ, presuncaoCSLL, aliquotaIssIcms, atividadePresumido,
      percIcmsEspecialPresumidoTotal, percPisCofinsEspecialPresumidoTotal, icmsCreditoCompras
    ),
    [faturamentoMensal, presuncaoIRPJ, presuncaoCSLL, aliquotaIssIcms, atividadePresumido,
      percIcmsEspecialPresumidoTotal, percPisCofinsEspecialPresumidoTotal, icmsCreditoCompras]
  );

  const encargoPatronalPresumido = folhaPresumido * (ALIQUOTA_PATRONAL_RAT / 100);

  // Cálculo dos impostos para cada regime (usado no gráfico de comparação)
  const impostoMEI = faturamentoAnual <= LIMITE_ANUAL_MEI ? MEI_VALORES[atividadeMei] : 0;
  const aliquotaMEI = faturamentoMensal > 0 ? (impostoMEI / faturamentoMensal) * 100 : 0;

  let impostoSimples = 0;
  let aliquotaSimples = 0;
  if (ratearAnexos) {
    impostoSimples = rateioResult.totalImposto;
    aliquotaSimples = faturamentoMensal > 0 ? (impostoSimples / faturamentoMensal) * 100 : 0;
  } else {
    impostoSimples = temRedutorSimplesAtivo ? redutorSimples.dasComReducao : faturamentoMensal * (simplesResult.aliquotaEfetiva / 100);
    aliquotaSimples = faturamentoMensal > 0 ? (impostoSimples / faturamentoMensal) * 100 : 0;
  }

  const impostoPresumidoTributos = presumidoResult.total;
  const impostoPresumido = impostoPresumidoTributos + encargoPatronalPresumido;
  const aliquotaPresumido = faturamentoMensal > 0 ? (impostoPresumido / faturamentoMensal) * 100 : 0;

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
  const mostrarAvisoMonofasico = regime === 'simples' && !temRedutorSimplesAtivo && (
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
            <p className="text-xs text-muted-foreground mt-1">Faturamento Anual (RBT12): {formatCurrency(faturamentoAnual)}</p>
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

          {/* ---------------- MEI ---------------- */}
          {regime === 'mei' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tipo de Atividade do MEI (2026)</label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(MEI_VALORES) as AtividadeMei[]).map(k => (
                    <button
                      key={k}
                      onClick={() => setAtividadeMei(k)}
                      className={`py-2 px-3 rounded-md border text-sm font-medium text-left flex items-center justify-between ${atividadeMei === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                    >
                      <span>{MEI_LABELS[k]}</span>
                      <span className="font-semibold">{formatCurrency(MEI_VALORES[k])}</span>
                    </button>
                  ))}
                </div>
              </div>
              {faturamentoAnual > LIMITE_ANUAL_MEI && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                  Atenção: o faturamento anual máximo do MEI é de R$ {LIMITE_ANUAL_MEI.toLocaleString('pt-BR')},00. Considere migrar para o Simples Nacional.
                </div>
              )}
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
                    Soma informada: {formatCurrency(rateioResult.somaValores)} de {formatCurrency(faturamentoMensal)} do faturamento mensal
                    {Math.abs(diferencaRateio) >= 0.01 && (
                      <> — {diferencaRateio > 0 ? `faltam ${formatCurrency(diferencaRateio)}` : `passou ${formatCurrency(Math.abs(diferencaRateio))}`}.</>
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

              {!ratearAnexos && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch checked={icmsEspecialSimples} onChange={setIcmsEspecialSimples} />
                    <span className="text-sm font-medium text-foreground">Parte do faturamento tem ICMS por Substituição Tributária ou Isenção?</span>
                  </div>
                  {icmsEspecialSimples && (
                    <div className="grid grid-cols-2 gap-3 pl-1">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">% com Substituição Tributária</label>
                        <input type="number" value={percIcmsSTSimples} onChange={e => setPercIcmsSTSimples(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">% Isento de ICMS</label>
                        <input type="number" value={percIcmsIsentoSimples} onChange={e => setPercIcmsIsentoSimples(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <ToggleSwitch checked={pisCofinsEspecialSimples} onChange={setPisCofinsEspecialSimples} />
                    <span className="text-sm font-medium text-foreground">Parte do faturamento tem PIS/COFINS Monofásico ou Alíquota Zero?</span>
                  </div>
                  {pisCofinsEspecialSimples && (
                    <div className="grid grid-cols-2 gap-3 pl-1">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">% Monofásico</label>
                        <input type="number" value={percMonofasicoSimples} onChange={e => setPercMonofasicoSimples(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">% Alíquota Zero</label>
                        <input type="number" value={percAliqZeroSimples} onChange={e => setPercAliqZeroSimples(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                      </div>
                    </div>
                  )}
                  {(icmsEspecialSimples || pisCofinsEspecialSimples) && (
                    <p className="text-xs text-muted-foreground">
                      Esses percentuais reduzem o DAS: sobre a parcela informada, o Simples deixa de cobrar o percentual daquele tributo dentro da alíquota, conforme a tabela de repartição do {simplesResult.anexoUsado} na faixa atual.
                    </p>
                  )}
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
                    : 'O ICMS é definido por cada Estado e varia por produto — esta é a alíquota aplicada sobre a venda (débito). Ajuste conforme sua realidade.'}
                </p>
              </div>

              <div className="pt-3 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1">Folha de Pagamento Mensal, incl. pró-labore (R$)</label>
                <input
                  type="number"
                  value={folhaPresumido}
                  onChange={e => setFolhaPresumido(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  No Lucro Presumido, o INSS Patronal + RAT (Riscos Ambientais do Trabalho) é pago à parte da folha, girando em torno de {ALIQUOTA_PATRONAL_RAT.toFixed(1)}% da folha — diferente do Simples, onde esse encargo já costuma estar embutido no DAS.
                </p>
                {folhaPresumido > 0 && (
                  <p className="text-xs font-medium text-primary mt-1">
                    Patronal + RAT estimado: {formatCurrency(encargoPatronalPresumido)}/mês
                  </p>
                )}
              </div>

              {atividadePresumido === 'comercio' && (
                <div className="space-y-4 pt-3 border-t border-border">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Valor de Compra de Mercadorias no Mês (R$)</label>
                    <input
                      type="number"
                      value={valorCompraMensal}
                      onChange={e => setValorCompraMensal(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <EstadoSelector
                    label="Estado de Compra das Mercadorias (origem)"
                    value={estadoCompra}
                    onChange={setEstadoCompra}
                    help="Selecione primeiro a região, depois o Estado do fornecedor."
                  />

                  <EstadoSelector
                    label="Estado da sua Empresa (destino)"
                    value={estadoEmpresa}
                    onChange={setEstadoEmpresa}
                    help="Selecione primeiro a região, depois o Estado onde sua empresa está estabelecida."
                  />

                  {estadoCompra && estadoEmpresa && (
                    <div className="p-3 bg-muted/50 rounded-md border border-border text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between"><span>Alíquota de ICMS aplicada ({infoAliquotaCompra.tipo})</span><span className="font-medium text-foreground">{infoAliquotaCompra.aliquota.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span>Crédito de ICMS sobre a compra</span><span className="font-medium text-foreground">{formatCurrency(icmsCreditoCompras)}</span></div>
                      <p className="pt-1">
                        {estadoCompra === estadoEmpresa
                          ? 'Compra dentro do mesmo Estado da empresa — aplicada a alíquota interna.'
                          : 'Compra interestadual — regra da Resolução do Senado nº 22/89 (7% de Sul/Sudeste, exceto ES, para Norte/Nordeste/Centro-Oeste/ES; 12% nos demais casos entre Estados diferentes).'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <ToggleSwitch checked={icmsEspecialPresumido} onChange={setIcmsEspecialPresumido} />
                  <span className="text-sm font-medium text-foreground">
                    Parte do faturamento tem {PRESUNCAO_PADRAO[atividadePresumido].labelImposto} por Substituição Tributária ou Isenção?
                  </span>
                </div>
                {icmsEspecialPresumido && (
                  <div className="grid grid-cols-2 gap-3 pl-1">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">% com Substituição Tributária</label>
                      <input type="number" value={percIcmsSTPresumido} onChange={e => setPercIcmsSTPresumido(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">% Isento</label>
                      <input type="number" value={percIcmsIsentoPresumido} onChange={e => setPercIcmsIsentoPresumido(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <ToggleSwitch checked={pisCofinsEspecialPresumido} onChange={setPisCofinsEspecialPresumido} />
                  <span className="text-sm font-medium text-foreground">Parte do faturamento tem PIS/COFINS Monofásico ou Alíquota Zero?</span>
                </div>
                {pisCofinsEspecialPresumido && (
                  <div className="grid grid-cols-2 gap-3 pl-1">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">% Monofásico</label>
                      <input type="number" value={percMonofasicoPresumido} onChange={e => setPercMonofasicoPresumido(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">% Alíquota Zero</label>
                      <input type="number" value={percAliqZeroPresumido} onChange={e => setPercAliqZeroPresumido(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  No Lucro Presumido, IRPJ e CSLL incidem sobre uma margem de lucro presumida por lei (não sobre o faturamento direto), com adicional de 10% de IRPJ sobre o que exceder R$ 20.000/mês de base presumida. PIS (0,65%) e COFINS (3%) incidem sobre o faturamento total, exceto na parcela informada como monofásica ou alíquota zero.
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
              <h3 className="text-4xl font-bold">{formatCurrency(custoMensal)}</h3>
              <p className="text-sm opacity-80 mt-2">Alíquota efetiva de {impostoPercentual.toFixed(2)}% sobre o faturamento.</p>
              {regime === 'presumido' && folhaPresumido > 0 && (
                <p className="text-xs opacity-70 mt-1">Inclui {formatCurrency(encargoPatronalPresumido)} de Patronal + RAT sobre a folha.</p>
              )}
            </div>
          </div>

          {regime === 'mei' && (
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-2">
              <h3 className="text-lg font-medium text-primary mb-2">Detalhamento — MEI</h3>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Atividade</span><span className="font-medium">{MEI_LABELS[atividadeMei]}</span></div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Valor fixo do DAS-MEI (2026)</span><span className="font-semibold text-primary">{formatCurrency(MEI_VALORES[atividadeMei])}</span></div>
              <p className="text-xs text-muted-foreground pt-1">O DAS-MEI é um valor fixo mensal, independente do faturamento (respeitado o limite anual de R$ {LIMITE_ANUAL_MEI.toLocaleString('pt-BR')}), por isso a alíquota efetiva cai quanto maior o faturamento.</p>
            </div>
          )}

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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Parcela a deduzir</span><span className="font-medium">{formatCurrency(simplesResult.pd)}</span></div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Alíquota efetiva (nominal)</span><span className="font-semibold text-primary">{simplesResult.aliquotaEfetiva.toFixed(2)}%</span></div>

              {temRedutorSimplesAtivo && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md space-y-1">
                  <p className="text-xs font-medium text-emerald-800">Com os redutores informados:</p>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">DAS sem redutor</span><span className="font-medium">{formatCurrency(redutorSimples.dasSemReducao)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">DAS com redutor</span><span className="font-semibold text-emerald-700">{formatCurrency(redutorSimples.dasComReducao)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Economia no mês</span><span className="font-medium text-emerald-700">{formatCurrency(redutorSimples.economia)}</span></div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Percentuais de repartição do {simplesResult.anexoUsado} nesta faixa: ICMS/ISS {redutorSimples.reparticao.issIcms.toFixed(2)}%, PIS {redutorSimples.reparticao.pis.toFixed(2)}%, COFINS {redutorSimples.reparticao.cofins.toFixed(2)}%.
                  </p>
                </div>
              )}

              {faturamentoAnual > 4800000 && (
                <p className="text-sm text-red-700 bg-red-100 rounded-md p-2 mt-2">
                  RBT12 acima de R$ 4.800.000 — fora do limite do Simples Nacional.
                </p>
              )}
              {mostrarAvisoMonofasico && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700 mt-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Importante:</strong> caso sua empresa revenda produtos monofásicos ou com substituição tributária, ative os redutores acima para simular a alíquota real do DAS com essas particularidades.
                  </span>
                </div>
              )}
            </div>
          )}

          {regime === 'simples' && ratearAnexos && (
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-3">
              <h3 className="text-lg font-medium text-primary mb-2">Detalhamento — Rateio entre Anexos</h3>
              <p className="text-xs text-muted-foreground">
                O RBT12 total da empresa ({formatCurrency(faturamentoAnual)}) define a faixa em cada anexo — só a alíquota efetiva de cada um muda. Os redutores de ICMS-ST/Isento e PIS/COFINS especial ficam disponíveis apenas no modo de anexo único.
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
                      <span>{formatCurrency(l.valor)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Alíquota efetiva {l.aliquotaEfetiva.toFixed(2)}%</span>
                      <span>Imposto: {formatCurrency(l.imposto)}</span>
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
                <span className="font-semibold text-primary">{formatCurrency(rateioResult.totalImposto)}</span>
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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">IRPJ (15% + adicional)</span><span className="font-medium">{formatCurrency(presumidoResult.irpj)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">CSLL (9%)</span><span className="font-medium">{formatCurrency(presumidoResult.csll)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">PIS (0,65%)</span><span className="font-medium">{formatCurrency(presumidoResult.pis)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">COFINS (3%)</span><span className="font-medium">{formatCurrency(presumidoResult.cofins)}</span></div>

              {atividadePresumido === 'comercio' ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">ICMS débito (sobre venda)</span><span className="font-medium">{formatCurrency(presumidoResult.icmsDebito)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">(–) Crédito de ICMS sobre compras</span><span className="font-medium">{formatCurrency(presumidoResult.icmsCredito)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">ICMS líquido a recolher</span><span className="font-semibold">{formatCurrency(presumidoResult.issIcms)}</span></div>
                  {presumidoResult.saldoCredorIcms > 0 && (
                    <p className="text-xs text-emerald-700 bg-emerald-100 rounded-md p-2 mt-1">
                      Saldo credor de ICMS de {formatCurrency(presumidoResult.saldoCredorIcms)} — o crédito das compras superou o débito das vendas e pode ser aproveitado nos próximos meses.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">ISS ({aliquotaIssIcms}%)</span><span className="font-medium">{formatCurrency(presumidoResult.issIcms)}</span></div>
              )}

              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Total de tributos</span><span className="font-semibold text-primary">{formatCurrency(presumidoResult.total)}</span></div>

              {folhaPresumido > 0 && (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Patronal + RAT ({ALIQUOTA_PATRONAL_RAT.toFixed(1)}% da folha)</span><span className="font-medium">{formatCurrency(encargoPatronalPresumido)}</span></div>
                  <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Total geral (tributos + encargos)</span><span className="font-semibold text-primary">{formatCurrency(impostoPresumido)}</span></div>
                </>
              )}
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
                      return [`${formatCurrency(v)} (${item?.aliquota.toFixed(2)}%)`, 'Imposto Mensal'];
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
              Barras representam o valor mensal de imposto (alíquota efetiva entre parênteses). O valor do Lucro Presumido inclui Patronal + RAT quando a folha é informada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}