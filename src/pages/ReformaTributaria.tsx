import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Info, AlertTriangle, ArrowRight, CheckCircle2, Receipt, Scale, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import {
  ALIQUOTA_REF_CBS,
  ALIQUOTA_REF_IBS,
  CRONOGRAMA,
  REGIMES_DIFERENCIADOS,
  aliquotasDoAno,
  apurarIVA,
  porDentroParaPorFora,
  porForaParaPorDentro,
  precoPorDentro,
  precoPorFora,
  type ClassificacaoReforma,
} from '../domain/reformaTributaria';

// Regimes atuais de PIS/COFINS, para comparar com a CBS que os substitui.
const PIS_COFINS_ATUAL: Record<string, { label: string; aliquota: number; ajuda: string }> = {
  cumulativo: {
    label: 'Cumulativo (Lucro Presumido) — 3,65%',
    aliquota: 3.65,
    ajuda: 'PIS 0,65% + COFINS 3% sobre o faturamento, sem direito a crédito nas compras.',
  },
  naoCumulativo: {
    label: 'Não cumulativo (Lucro Real) — 9,25%',
    aliquota: 9.25,
    ajuda: 'PIS 1,65% + COFINS 7,6% sobre o faturamento, com crédito sobre insumos.',
  },
  monofasico: {
    label: 'Revenda monofásica / alíquota zero — 0%',
    aliquota: 0,
    ajuda: 'Bebidas, autopeças, perfumaria, medicamentos e afins: o PIS/COFINS foi concentrado na indústria e a revenda sai com alíquota zero. Esse regime acaba com a CBS.',
  },
  simples: {
    label: 'Dentro do DAS do Simples Nacional',
    aliquota: 0,
    ajuda: 'No Simples, PIS e COFINS já estão embutidos na alíquota do DAS — informe aqui apenas os tributos por fora do DAS.',
  },
};

const CLASSIFICACOES: ClassificacaoReforma[] = ['padrao', 'reducao60', 'reducao30', 'zero', 'monofasicoRevenda'];

function Campo({ label, value, onChange, sufixo, ajuda }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  sufixo?: string;
  ajuda?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}{sufixo ? ` (${sufixo})` : ''}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
      />
      {ajuda && <p className="text-xs text-muted-foreground mt-1">{ajuda}</p>}
    </div>
  );
}

function Linha({ label, valor, destaque, negativo }: { label: string; valor: string; destaque?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${destaque ? 'border-t border-border pt-2 mt-2' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${destaque ? 'font-semibold' : 'font-medium'} ${negativo ? 'text-red-600' : destaque ? 'text-primary' : ''}`}>{valor}</span>
    </div>
  );
}

export default function ReformaTributaria() {
  // Linha do tempo
  const [anoSelecionado, setAnoSelecionado] = useState(2027);

  // Parâmetros gerais
  const [refCbs, setRefCbs] = useState(ALIQUOTA_REF_CBS);
  const [refIbs, setRefIbs] = useState(ALIQUOTA_REF_IBS);
  const [classificacao, setClassificacao] = useState<ClassificacaoReforma>('padrao');

  // Simulador de preço
  const [custoLiquido, setCustoLiquido] = useState(100);
  const [regimeAtual, setRegimeAtual] = useState<keyof typeof PIS_COFINS_ATUAL>('cumulativo');
  const [aliquotaIcmsIss, setAliquotaIcmsIss] = useState(18);
  const [despesasPercent, setDespesasPercent] = useState(10);
  const [margemPercent, setMargemPercent] = useState(20);

  // Conversor de alíquotas
  const [aliquotaConversor, setAliquotaConversor] = useState(Number((ALIQUOTA_REF_CBS + ALIQUOTA_REF_IBS).toFixed(2)));

  const fase = useMemo(() => aliquotasDoAno(anoSelecionado, refCbs, refIbs), [anoSelecionado, refCbs, refIbs]);
  const regimeDif = REGIMES_DIFERENCIADOS[classificacao];

  const aliq2027 = useMemo(() => aliquotasDoAno(2027, refCbs, refIbs), [refCbs, refIbs]);
  const aliq2033 = useMemo(() => aliquotasDoAno(2033, refCbs, refIbs), [refCbs, refIbs]);

  const pisCofinsAtual = PIS_COFINS_ATUAL[regimeAtual].aliquota;

  // --- Cenário HOJE: tudo por dentro do preço --------------------------------
  const cenarioHoje = useMemo(
    () => precoPorDentro({
      custo: custoLiquido,
      despesasPercent,
      margemPercent,
      tributosPorDentroPercent: pisCofinsAtual + aliquotaIcmsIss,
    }),
    [custoLiquido, despesasPercent, margemPercent, pisCofinsAtual, aliquotaIcmsIss]
  );

  // --- Cenário 2027: CBS por fora, ICMS/ISS ainda por dentro -----------------
  const cenario2027 = useMemo(
    () => precoPorFora({
      custo: custoLiquido,
      despesasPercent,
      margemPercent,
      aliquotaPorForaPercent: aliq2027.cbs * regimeDif.fator,
      tributosPorDentroPercent: aliquotaIcmsIss,
    }),
    [custoLiquido, despesasPercent, margemPercent, aliq2027, regimeDif, aliquotaIcmsIss]
  );

  // --- Cenário 2033: CBS + IBS por fora, sem ICMS/ISS ------------------------
  const cenario2033 = useMemo(
    () => precoPorFora({
      custo: custoLiquido,
      despesasPercent,
      margemPercent,
      aliquotaPorForaPercent: aliq2033.totalPorFora * regimeDif.fator,
      tributosPorDentroPercent: 0,
    }),
    [custoLiquido, despesasPercent, margemPercent, aliq2033, regimeDif]
  );

  const variacao = (novo: number) => (cenarioHoje.precoFinal > 0 ? ((novo - cenarioHoje.precoFinal) / cenarioHoje.precoFinal) * 100 : 0);

  const dadosGrafico = [
    { cenario: 'Hoje', preco: cenarioHoje.precoFinal, cor: '#94a3b8' },
    { cenario: '2027 (CBS)', preco: cenario2027.precoFinal, cor: '#3b82f6' },
    { cenario: '2033 (pleno)', preco: cenario2033.precoFinal, cor: '#10b981' },
  ];

  // Revenda: quanto de CBS sobra depois do crédito da compra
  const revenda = useMemo(
    () => apurarIVA(cenario2027.receitaLiquida, custoLiquido, aliq2027.cbs, 0, classificacao),
    [cenario2027.receitaLiquida, custoLiquido, aliq2027.cbs, classificacao]
  );

  const equivalentePorDentro = porForaParaPorDentro(aliquotaConversor);
  const equivalentePorFora = porDentroParaPorFora(aliquotaConversor);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Reforma Tributária</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Como a CBS e o IBS mudam a formação de preço da sua empresa — e por que o imposto “por fora” exige refazer a conta do preço de venda.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* O que muda, em três frases                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-medium text-primary">Cinco tributos viram dois</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            PIS e COFINS são substituídos pela <strong>CBS</strong> (federal). ICMS e ISS, pelo <strong>IBS</strong> (estadual e municipal). O IPI é zerado, salvo produtos da Zona Franca de Manaus.
          </p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-medium text-primary">O imposto passa a ser por fora</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            CBS e IBS não entram na própria base de cálculo, nem na base um do outro. Você forma o preço <em>sem</em> o imposto e ele é somado e destacado na nota — como o sales tax americano.
          </p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-medium text-primary">Crédito amplo</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Tudo que a empresa comprar para a atividade gera crédito — não só insumos. Você só recolhe sobre o valor que agregou. Em compensação, acabam a monofasia e a substituição tributária.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Linha do tempo                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-1">Linha do tempo da transição</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Clique no ano para ver o que está valendo. <strong>Em 2027 só a CBS muda</strong>: ICMS e ISS continuam integrais até 2028.
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-4">
          {CRONOGRAMA.map(f => (
            <button
              key={f.ano}
              type="button"
              onClick={() => setAnoSelecionado(f.ano)}
              className={`py-2 px-1 rounded-md border text-xs font-medium ${
                anoSelecionado === f.ano
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              {f.ano}
            </button>
          ))}
        </div>

        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="font-medium text-foreground mb-1">{anoSelecionado} — {fase.titulo}</h3>
          <p className="text-sm text-muted-foreground">{fase.resumo}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-background rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">CBS (por fora)</p>
              <p className="text-lg font-semibold text-primary">{fase.cbs.toFixed(2)}%</p>
            </div>
            <div className="bg-background rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">IBS (por fora)</p>
              <p className="text-lg font-semibold text-primary">{fase.ibs.toFixed(2)}%</p>
            </div>
            <div className="bg-background rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">PIS/COFINS</p>
              <p className="text-lg font-semibold">{fase.pisCofinsVigente ? 'Vigentes' : 'Extintos'}</p>
            </div>
            <div className="bg-background rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">ICMS e ISS</p>
              <p className="text-lg font-semibold">{fase.fatorIcmsIss === 0 ? 'Extintos' : `${(fase.fatorIcmsIss * 100).toFixed(0)}%`}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Por dentro x por fora — a explicação                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-1">Por dentro × por fora: a mudança na conta do preço</h2>
        <p className="text-sm text-muted-foreground mb-4">
          É a diferença mais importante da nova sistemática, e a que mais confunde. Hoje, quando você vende por R$ 100 com 18% de ICMS,
          os R$ 18 <em>já estão</em> dentro dos R$ 100 — a alíquota incide sobre o preço que a contém. Com a CBS, a alíquota incide sobre
          o valor da operação <em>sem</em> o tributo, e o resultado é somado ao preço.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-muted/40">
            <h3 className="font-medium text-foreground mb-2">Hoje — imposto por dentro</h3>
            <p className="text-sm text-muted-foreground mb-3">
              O preço de venda é o ponto de partida, e o imposto é uma fatia dele. Para chegar ao preço a partir do custo, você divide:
            </p>
            <div className="bg-background border border-border rounded-md p-3 font-mono text-xs sm:text-sm text-foreground">
              Preço = Custo ÷ (1 − tributos% − despesas% − margem%)
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Aumentar a alíquota em 1 ponto custa mais do que 1% do preço, porque o imposto está na base de si mesmo.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <h3 className="font-medium text-primary mb-2">A partir de 2027 — CBS por fora</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Você forma o preço que interessa à empresa e só depois soma a CBS, que aparece destacada na nota e não é receita sua:
            </p>
            <div className="bg-background border border-border rounded-md p-3 font-mono text-xs sm:text-sm text-foreground space-y-1">
              <div>Receita líquida = Custo ÷ (1 − outros tributos% − despesas% − margem%)</div>
              <div>Preço final = Receita líquida × (1 + CBS%)</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A margem passa a ser calculada sobre a receita líquida — o imposto sai da disputa pelo preço.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 mt-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Não compare alíquotas diretamente.</strong> Uma alíquota de {aliquotaConversor.toFixed(2)}% por fora representa{' '}
            {equivalentePorDentro.toFixed(2)}% do preço final pago pelo cliente — é esse número que se compara com a carga “por dentro” de hoje.
            No sentido inverso, {aliquotaConversor.toFixed(2)}% por dentro equivalem a {Number.isFinite(equivalentePorFora) ? equivalentePorFora.toFixed(2) : '—'}% por fora.
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Campo
            label="Converter a alíquota"
            sufixo="%"
            value={aliquotaConversor}
            onChange={setAliquotaConversor}
            ajuda="Digite uma alíquota para ver as duas leituras."
          />
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <p className="text-xs text-muted-foreground">Se for por fora, a carga sobre o preço final é</p>
            <p className="text-xl font-semibold text-primary">{equivalentePorDentro.toFixed(2)}%</p>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">t ÷ (1 + t)</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <p className="text-xs text-muted-foreground">Se for por dentro, a alíquota por fora equivalente é</p>
            <p className="text-xl font-semibold text-primary">{Number.isFinite(equivalentePorFora) ? `${equivalentePorFora.toFixed(2)}%` : '—'}</p>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">t ÷ (1 − t)</p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Simulador de preço                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-5 self-start">
          <div>
            <h2 className="text-lg font-medium text-primary">Simulador de preço na nova sistemática</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Compare o preço de um produto ou serviço hoje, em 2027 (só a CBS muda) e em 2033 (regime pleno), mantendo a mesma margem.
            </p>
          </div>

          <Campo
            label="Custo líquido do produto ou serviço"
            sufixo="R$"
            value={custoLiquido}
            onChange={setCustoLiquido}
            ajuda="O custo já descontado dos créditos de tributos que você recupera na compra."
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Seu PIS/COFINS hoje</label>
            <select
              value={regimeAtual}
              onChange={e => setRegimeAtual(e.target.value as keyof typeof PIS_COFINS_ATUAL)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(PIS_COFINS_ATUAL).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{PIS_COFINS_ATUAL[regimeAtual].ajuda}</p>
          </div>

          <Campo
            label="ICMS ou ISS da sua operação"
            sufixo="%"
            value={aliquotaIcmsIss}
            onChange={setAliquotaIcmsIss}
            ajuda="Continua por dentro do preço até 2028, e vai sendo reduzido de 2029 a 2032."
          />

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Despesas variáveis" sufixo="%" value={despesasPercent} onChange={setDespesasPercent} />
            <Campo label="Margem desejada" sufixo="%" value={margemPercent} onChange={setMargemPercent} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Regime do seu produto ou serviço na reforma</label>
            <select
              value={classificacao}
              onChange={e => setClassificacao(e.target.value as ClassificacaoReforma)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
            >
              {CLASSIFICACOES.map(c => (
                <option key={c} value={c}>{REGIMES_DIFERENCIADOS[c].label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{regimeDif.descricao}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <Campo
              label="Alíquota de referência da CBS"
              sufixo="%"
              value={refCbs}
              onChange={setRefCbs}
              ajuda={`Estimativa de referência: ${ALIQUOTA_REF_CBS.toFixed(2).replace('.', ',')}%.`}
            />
            <Campo
              label="Alíquota de referência do IBS"
              sufixo="%"
              value={refIbs}
              onChange={setRefIbs}
              ajuda={`Estimativa de referência: ${ALIQUOTA_REF_IBS.toFixed(2).replace('.', ',')}%.`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Juntas, as estimativas somam {(refCbs + refIbs).toFixed(2)}% por fora — equivalentes a {porForaParaPorDentro(refCbs + refIbs).toFixed(2)}% do preço final.
            As alíquotas definitivas serão fixadas por Resolução do Senado Federal.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { titulo: 'Hoje', dado: cenarioHoje, cor: 'border-border', destaque: false },
              { titulo: '2027 — CBS', dado: cenario2027, cor: 'border-blue-300', destaque: true },
              { titulo: '2033 — pleno', dado: cenario2033, cor: 'border-emerald-300', destaque: false },
            ].map(({ titulo, dado, cor }) => {
              const v = titulo === 'Hoje' ? 0 : variacao(dado.precoFinal);
              return (
                <div key={titulo} className={`bg-card border ${cor} p-4 rounded-xl shadow-sm`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{titulo}</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(dado.precoFinal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">preço final ao cliente</p>
                  {titulo !== 'Hoje' && (
                    <p className={`text-xs font-medium mt-2 ${v > 0.005 ? 'text-red-600' : v < -0.005 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {v > 0 ? '▲' : v < 0 ? '▼' : '='} {Math.abs(v).toFixed(2)}% vs hoje
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-primary mb-3">Composição do preço</h3>
            <div className="space-y-4">
              {[
                { titulo: 'Hoje — tudo por dentro', dado: cenarioHoje, extra: `PIS/COFINS ${pisCofinsAtual.toFixed(2)}% + ICMS/ISS ${aliquotaIcmsIss.toFixed(2)}%, embutidos no preço` },
                { titulo: `2027 — CBS ${(aliq2027.cbs * regimeDif.fator).toFixed(2)}% por fora`, dado: cenario2027, extra: `ICMS/ISS ${aliquotaIcmsIss.toFixed(2)}% ainda por dentro; PIS e COFINS extintos` },
                { titulo: `2033 — CBS + IBS ${(aliq2033.totalPorFora * regimeDif.fator).toFixed(2)}% por fora`, dado: cenario2033, extra: 'ICMS e ISS extintos; toda a tributação sai de dentro do preço' },
              ].map(({ titulo, dado, extra }) => (
                <div key={titulo} className="p-3 bg-muted/40 rounded-lg border border-border">
                  <p className="text-sm font-medium text-foreground">{titulo}</p>
                  <p className="text-xs text-muted-foreground mb-2">{extra}</p>
                  <Linha label="Custo líquido" valor={formatCurrency(dado.custoLiquido)} />
                  <Linha label="Despesas variáveis" valor={formatCurrency(dado.despesas)} />
                  <Linha label="Lucro" valor={formatCurrency(dado.lucro)} />
                  <Linha label="Tributos na operação" valor={formatCurrency(dado.tributos)} />
                  <Linha label="Receita líquida da empresa" valor={formatCurrency(dado.receitaLiquida)} />
                  <Linha label="Preço final ao cliente" valor={formatCurrency(dado.precoFinal)} destaque />
                  <p className="text-xs text-muted-foreground mt-2">
                    Carga sobre o preço final: <strong>{dado.cargaSobrePrecoFinal.toFixed(2)}%</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-primary mb-4">Preço final em cada cenário</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                  <YAxis dataKey="cenario" type="category" axisLine={false} tickLine={false} width={95} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Preço final']} />
                  <Bar dataKey="preco" radius={[0, 4, 4, 0]} barSize={22}>
                    {dadosGrafico.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Mesma margem em todos os cenários. O que muda é quanto do preço é imposto e quanto é receita da empresa.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Fim da monofasia / revenda com alíquota zero                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-1">O fim da revenda com alíquota zero</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Hoje, quem revende bebidas, autopeças, perfumaria ou medicamentos aproveita a monofasia: a indústria recolhe o PIS/COFINS de toda a
          cadeia e a revenda sai com <strong>alíquota zero</strong>. A CBS acaba com esse regime (salvo os casos específicos previstos em lei,
          como combustíveis): a partir de 2027 a revenda é tributada normalmente — <em>mas</em> o revendedor passa a tomar crédito da CBS
          destacada na compra. Na prática, você recolhe a alíquota sobre o que agregou, não sobre o faturamento inteiro.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-muted/40 rounded-lg border border-border">
            <p className="text-sm font-medium text-foreground mb-2">Com os números do simulador acima</p>
            <Linha label="Receita líquida da venda" valor={formatCurrency(cenario2027.receitaLiquida)} />
            <Linha label="Compra que gera crédito" valor={formatCurrency(custoLiquido)} />
            <Linha label={`CBS débito (${revenda.aliquotaCbsAplicada.toFixed(2)}%)`} valor={formatCurrency(revenda.cbsDebito)} />
            <Linha label={`(–) Crédito de CBS da compra (${regimeDif.mantemCredito ? aliq2027.cbs.toFixed(2) : '0,00'}%)`} valor={formatCurrency(revenda.cbsCredito)} />
            <Linha label="CBS a recolher no período" valor={formatCurrency(revenda.totalARecolher)} destaque />
            {revenda.saldoCredor > 0 && (
              <p className="text-xs text-emerald-700 bg-emerald-100 rounded-md p-2 mt-2">
                Saldo credor de {formatCurrency(revenda.saldoCredor)} — o crédito das compras superou o débito das vendas. A alíquota zero não
                anula o crédito, então esse saldo se acumula e pode ser ressarcido.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Efeito líquido: a CBS incide sobre a margem bruta de {formatCurrency(Math.max(0, cenario2027.receitaLiquida - custoLiquido))}.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Quem ganha:</strong> revendedores com margem baixa e muita compra com crédito. O imposto passa a acompanhar o valor
                agregado, e não o faturamento bruto.
              </span>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Quem perde:</strong> quem hoje revende monofásico com alíquota zero e tem margem alta, e prestadores de serviço com
                folha grande e poucas compras — a folha de pagamento não gera crédito de CBS.
              </span>
            </div>
            <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                A substituição tributária do ICMS também desaparece com o IBS, pelo mesmo motivo: não há por que antecipar imposto de uma
                cadeia em que cada elo credita o que o anterior pagou.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Redutores                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-1">Redutores de alíquota</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Nem todo mundo paga a alíquota cheia. A lei prevê reduções que se aplicam tanto à CBS quanto ao IBS. Os valores abaixo já usam as
          alíquotas de referência que você informou.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium text-muted-foreground">Regime</th>
                <th className="py-2 px-3 font-medium text-muted-foreground text-right">CBS 2027</th>
                <th className="py-2 px-3 font-medium text-muted-foreground text-right">CBS + IBS 2033</th>
                <th className="py-2 pl-3 font-medium text-muted-foreground text-right">Carga s/ preço final</th>
              </tr>
            </thead>
            <tbody>
              {CLASSIFICACOES.map(c => {
                const r = REGIMES_DIFERENCIADOS[c];
                const cbs = aliq2027.cbs * r.fator;
                const pleno = aliq2033.totalPorFora * r.fator;
                return (
                  <tr key={c} className={`border-b border-border/60 ${classificacao === c ? 'bg-primary/5' : ''}`}>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-foreground">{r.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.descricao}</p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{cbs.toFixed(2)}%</td>
                    <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{pleno.toFixed(2)}%</td>
                    <td className="py-2 pl-3 text-right text-muted-foreground whitespace-nowrap">{porForaParaPorDentro(pleno).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          A classificação correta depende do enquadramento do seu produto ou serviço nos anexos da lei — confirme com seu contador antes de
          reprecificar.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Simples Nacional                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-1">Se você é do Simples Nacional</h2>
        <p className="text-sm text-muted-foreground mb-4">
          O Simples continua existindo e a alíquota do DAS não muda de valor: dentro dele, a parcela que hoje se chama PIS/COFINS passa a se
          chamar CBS, e a de ICMS/ISS passa a ser IBS. A novidade é que você ganha uma <strong>escolha</strong>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-muted/40">
            <h3 className="font-medium text-foreground mb-2">Manter CBS e IBS dentro do DAS</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Uma guia só, sem apuração de créditos.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> O DAS não sobe por causa da reforma.</li>
              <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> Seu cliente PJ só credita o valor de CBS/IBS embutido no DAS — bem menos que a alíquota cheia.</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <h3 className="font-medium text-primary mb-2">Recolher CBS e IBS por fora do DAS</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Seu cliente PJ credita a alíquota cheia — você deixa de perder venda no B2B.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Você também passa a tomar crédito das suas compras.</li>
              <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> A parcela sai do DAS, mas a apuração vira regime regular — mais obrigação acessória.</li>
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground mt-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Regra prática: quem vende para consumidor final tende a ficar dentro do DAS; quem vende para outras empresas tende a ganhar
            recolhendo por fora. Simule os dois cenários na aba <strong>Impostos</strong>, na seção Reforma Tributária.
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* O que fazer agora                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-medium text-primary mb-3">O que fazer agora</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {[
            'Levante quanto das suas compras vai gerar crédito de CBS — é isso que define se a reforma te ajuda ou te machuca.',
            'Confira a classificação dos seus produtos: alíquota cheia, redução de 60%, de 30% ou alíquota zero muda tudo no preço.',
            'Se você revende monofásicos com alíquota zero hoje, refaça o preço: a partir de 2027 a saída é tributada e a compra vira crédito.',
            'Revise contratos longos e tabelas de preço: diga se o valor é “com” ou “sem” CBS, porque o imposto agora é destacado por fora.',
            'Prepare o caixa para o split payment: o imposto pode ser separado no momento do pagamento, antes de o dinheiro chegar à empresa.',
            'Se é do Simples, decida com seu contador entre CBS/IBS dentro ou fora do DAS — a escolha muda o preço que você consegue praticar no B2B.',
          ].map(item => (
            <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 p-4 bg-muted/50 border border-border rounded-xl text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Base normativa: Emenda Constitucional nº 132/2023 e Lei Complementar nº 214/2025. As alíquotas de referência de CBS e IBS são
          estimativas de referência (CBS {ALIQUOTA_REF_CBS.toFixed(2)}% + IBS {ALIQUOTA_REF_IBS.toFixed(2)}%) e ainda serão fixadas por Resolução do Senado Federal; Estados e
          Municípios podem fixar alíquotas próprias de IBS. Esta página é uma ferramenta de simulação e planejamento — não substitui a
          orientação do seu contador.
        </span>
      </div>
    </div>
  );
}
