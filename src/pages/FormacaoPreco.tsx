import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { calcularProduto } from '../domain/pricing';
import { formatCurrency } from '../utils/format';
import CostCompositionChart from '../components/CostCompositionChart';
import DespesasVariaveisManager from '../components/DespesasVariaveisManager';
import EstrategiasManager, { SeletorEstrategia } from '../components/Estrategias';
import {
  PainelReformaPreco,
  SeloPrecoReforma,
  useMotorReforma,
  useReformaPrecoConfig,
} from '../components/ReformaPreco';

export default function FormacaoPreco() {
  const { produtos, custosFixos, saveProduto, despesasVariaveis, estrategias } = useAppContext();
  const validProdutos = produtos.filter(p => p.cmv > 0);
  
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // States para o calculo
  const [custo, setCusto] = useState(0);
  const [imposto, setImposto] = useState(10);
  const [taxaCartao, setTaxaCartao] = useState(3);
  const [comissao, setComissao] = useState(2);
  const [margem, setMargem] = useState(20);
  const [vendasProjetadas, setVendasProjetadas] = useState(100);
  const [modoPrecificacao, setModoPrecificacao] = useState<'margem' | 'preco'>('margem');
  const [precoFixo, setPrecoFixo] = useState(0);
  const [percentualRateio, setPercentualRateio] = useState(100);
  const [estrategiaId, setEstrategiaId] = useState<string | null>(null);
  // Percentuais das despesas variáveis que o usuário criou, por id da despesa.
  const [despesasProduto, setDespesasProduto] = useState<Record<string, number>>({});

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  // Projeção do preço na Reforma Tributária (compartilhada com Preços em Lote)
  const { config: reformaConfig, setConfig: setReformaConfig } = useReformaPrecoConfig();
  const motorReforma = useMotorReforma(reformaConfig);

  // Sync selected product
  useEffect(() => {
    if (validProdutos.length > 0 && !selectedProductId) {
      setSelectedProductId(validProdutos[0].id);
    }
  }, [validProdutos, selectedProductId]);

  useEffect(() => {
    const p = produtos.find(p => p.id === selectedProductId);
    if (p) {
      setCusto(p.cmv);
      setVendasProjetadas(p.vendasProjetadas || 100);
      setModoPrecificacao(p.modoPrecificacao || 'margem');
      setPrecoFixo(p.precoFixo || 0);
      if (p.imposto !== undefined) setImposto(p.imposto);
      if (p.taxaCartao !== undefined) setTaxaCartao(p.taxaCartao);
      if (p.comissao !== undefined) setComissao(p.comissao);
      if (p.percentualRateio !== undefined) setPercentualRateio(p.percentualRateio);
      if (p.margem !== undefined) setMargem(p.margem);
      setDespesasProduto(p.despesasVariaveis || {});
      setEstrategiaId(p.estrategiaId ?? null);
    }
  }, [selectedProductId, produtos]);

  // Handle Save Back to Product
  const handleSaveToProduct = () => {
    const updated = produtos.map(p => {
      if (p.id === selectedProductId) {
        return { 
          ...p, 
          cmv: custo, 
          vendasProjetadas, 
          imposto, 
          taxaCartao, 
          comissao, 
          margem, 
          precoIdeal: precoFinal,
          modoPrecificacao,
          precoFixo,
          percentualRateio,
          despesasVariaveis: despesasProduto,
          estrategiaId
        };
      }
      return p;
    });
    saveProduto(updated.find(p => p.id === selectedProductId)!);
    alert('Valores salvos no produto!');
  };

  // --- Cálculos ---
  // Toda a conta vem do motor em src/domain/pricing: é a mesma função que o
  // Dashboard e o Mix usam, então as três telas não têm como divergir.
  const calc = calcularProduto(
    {
      id: selectedProductId,
      cmv: custo,
      vendasProjetadas,
      percentualRateio,
      imposto,
      taxaCartao,
      comissao,
      despesasVariaveis: despesasProduto,
      margem,
      estrategiaId,
      modoPrecificacao,
      precoFixo,
    },
    custoFixoTotal,
    despesasVariaveis,
    estrategias
  );

  const {
    valorRateadoCF,
    custoFixoUnitario,
    despesasPercent,
    deducoesPercent: despesasVariaveisPerc,
    preco: precoFinal,
    margemReal,
    valorImposto,
    valorDespesas,
    valorMargem,
    margemContribuicao,
    peUnidades,
    isValidMargem,
    margemAlvo,
    estrategia,
  } = calc;

  const vendasPorDia = vendasProjetadas / 30;
  const diasParaAtingir = (isValidMargem && vendasPorDia > 0) ? peUnidades / vendasPorDia : Infinity;
  
  let tempoAtingirStr = '';
  if (!isValidMargem) {
    tempoAtingirStr = 'Inatingível (Prejuízo)';
  } else if (diasParaAtingir > 3650) {
    tempoAtingirStr = 'Mais de 10 anos (Irreal)';
  } else if (diasParaAtingir > 30) {
    const meses = Math.floor(diasParaAtingir / 30);
    const dias = Math.ceil(diasParaAtingir % 30);
    tempoAtingirStr = `${meses} ${meses === 1 ? 'mês' : 'meses'}${dias > 0 ? ` e ${dias} dias` : ''}`;
  } else {
    tempoAtingirStr = `${Math.ceil(diasParaAtingir)} dias`;
  }

  const projecaoReforma = motorReforma.projetar({
    cmv: custo,
    custoFixoUnitario,
    impostoPercent: imposto,
    despesasPercent,
    margemPercent: margemReal,
    precoAtual: precoFinal,
  });

  const data = [
    { name: 'Custo Variável (CMV)', value: custo },
    { name: 'Custo Fixo Unitário', value: custoFixoUnitario },
    { name: 'Impostos', value: valorImposto },
    { name: 'Taxas & Despesas', value: valorDespesas },
    { name: 'Lucro Líquido', value: valorMargem },
  ].map(item => ({ ...item, value: Number(item.value.toFixed(2)) }));

  const chartData = [0, 0.5, 1, 1.5, 2].map(mult => {
    const qty = Math.round(peUnidades * mult);
    return {
      unidades: qty,
      receita: qty * precoFinal,
      custoTotal: custoFixoTotal + (qty * custo) + (qty * (precoFinal * (despesasVariaveisPerc/100))),
      lucro: (qty * precoFinal) - (custoFixoTotal + (qty * custo) + (qty * (precoFinal * (despesasVariaveisPerc/100))))
    };
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Formação de Preço & Ponto de Equilíbrio</h1>
        <p className="text-muted-foreground mt-1 text-sm">Selecione um produto para calcular seu preço ideal e meta de vendas.</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-lg flex items-center justify-between">
        <p className="text-sm font-medium">Atenção: Para o correto funcionamento, preencha os custos fixos e variáveis nas respectivas abas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Formulário */}
        <div className="col-span-1 lg:col-span-4 space-y-6">
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Selecione o Produto</label>
              <select 
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm font-medium"
              >
                {validProdutos.length === 0 && <option value="">Nenhum produto com custo cadastrado</option>}
                {validProdutos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Custo de Aquisição/Fabricação (CMV)</label>
                <input type="number" value={custo} onChange={e => setCusto(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Vendas Projetadas (Mês)</label>
                <input type="number" value={vendasProjetadas} onChange={e => setVendasProjetadas(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Custeio Fixo - Rateio (%)</label>
                <input type="number" value={percentualRateio} onChange={e => setPercentualRateio(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Parcela do custo fixo global (100% = total) que as vendas deste produto vão cobrir.</p>
              </div>
            </div>

            <h3 className="text-sm font-medium text-foreground pt-4 border-t border-border">Estratégia de Precificação</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModoPrecificacao('margem')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${modoPrecificacao === 'margem' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              >
                1. Calcular Preço Ideal
              </button>
              <button
                type="button"
                onClick={() => setModoPrecificacao('preco')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${modoPrecificacao === 'preco' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              >
                2. Simular Preço de Venda
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Impostos (%)</label>
                <input type="number" value={imposto} onChange={e => setImposto(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Taxa Cartão (%)</label>
                <input type="number" value={taxaCartao} onChange={e => setTaxaCartao(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Comissão (%)</label>
                <input type="number" value={comissao} onChange={e => setComissao(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div>
                {modoPrecificacao === 'margem' ? (
                  <>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Margem Líquida Desejada (%)
                    </label>
                    {/* Com uma faixa ativa, a margem vem dela e o campo fica travado —
                        senão haveria dois números disputando o mesmo preço. */}
                    <input
                      type="number"
                      value={margemAlvo}
                      disabled={!!estrategia}
                      onChange={e => setMargem(Number(e.target.value))}
                      title={estrategia ? `Definida pela estratégia ${estrategia.nome}. Escolha "Personalizado" abaixo para editar só este produto.` : undefined}
                      className={`w-full px-3 py-2 border border-border rounded-md font-bold text-sm focus:ring-2 focus:ring-primary/50 ${estrategia ? 'bg-muted/40 text-muted-foreground cursor-not-allowed' : 'bg-primary/10 text-primary'}`}
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Preço de Venda Praticado (R$)</label>
                    <input type="number" value={precoFixo} onChange={e => setPrecoFixo(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Estratégia de margem</label>
              <SeletorEstrategia
                produto={{
                  id: selectedProductId, nome: '', cmv: custo,
                  margem, estrategiaId,
                }}
                onChange={(updates) => {
                  if (updates.estrategiaId !== undefined) setEstrategiaId(updates.estrategiaId);
                  if (updates.margem !== undefined) setMargem(updates.margem);
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                A faixa define a margem alvo. "Personalizado" libera o campo acima só para este produto.
              </p>
            </div>

            {despesasVariaveis.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold text-foreground mb-2">Minhas despesas variáveis (%)</p>
                <div className="grid grid-cols-2 gap-4">
                  {despesasVariaveis.map(d => (
                    <div key={d.id}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 truncate" title={d.nome}>
                        {d.nome} (%)
                      </label>
                      <input
                        type="number"
                        value={despesasProduto[d.id] ?? 0}
                        onChange={e => setDespesasProduto(prev => ({ ...prev, [d.id]: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <EstrategiasManager compacto />
            </div>

            <div className="pt-4 border-t border-border">
              <DespesasVariaveisManager compacto />
            </div>

            <button onClick={handleSaveToProduct} className="w-full py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors mt-4">
              Salvar Configuração no Produto
            </button>
          </div>

          <PainelReformaPreco config={reformaConfig} setConfig={setReformaConfig} motor={motorReforma} />
        </div>

        {/* Resultados */}
        <div className="col-span-1 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className={`border p-5 rounded-xl shadow-sm ${modoPrecificacao === 'margem' ? 'bg-primary border-primary/20 text-primary-foreground' : 'bg-card border-border'}`}>
                <p className={`text-sm font-medium mb-1 ${modoPrecificacao === 'margem' ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {modoPrecificacao === 'margem' ? 'Preço de Venda Ideal' : 'Preço de Venda Simulado'}
                </p>
                <h3 className={`text-4xl font-bold ${modoPrecificacao === 'preco' ? 'text-foreground' : ''}`}>{formatCurrency(precoFinal)}</h3>
             </div>
             
             <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                <p className="text-sm font-medium text-muted-foreground mb-1">Margem de Contribuição</p>
                <h3 className={`text-3xl font-semibold ${margemContribuicao > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(margemContribuicao)}</h3>
                <p className="text-xs text-muted-foreground mt-1">Valor que sobra para pagar Custos Fixos e gerar Lucro.</p>
             </div>

             <div className={`border p-5 rounded-xl shadow-sm md:col-span-2 ${modoPrecificacao === 'preco' ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido (por unidade)</p>
                    <h3 className={`text-3xl font-semibold ${valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>
                      {formatCurrency(valorMargem)}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Margem Realizada (%)</p>
                    <h3 className={`text-3xl font-semibold ${margemReal >= 0 ? 'text-primary' : 'text-red-600'}`}>
                      {margemReal.toFixed(1)}%
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">O lucro real após descontar sua cota de custo fixo (estimativa).</p>
             </div>
          </div>

          {reformaConfig.ativo && (
            <div className="bg-card border border-sky-300 p-6 rounded-xl shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-medium text-primary">Este preço com a Reforma Tributária — {reformaConfig.ano}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {motorReforma.preset.label}
                    {motorReforma.precoMuda && ` · ${motorReforma.aliquotaPorFora.toFixed(2)}% por fora do preço`}
                  </p>
                </div>
                <div className="shrink-0">
                  <SeloPrecoReforma projecao={projecaoReforma} precoMuda={motorReforma.precoMuda} formatar={formatCurrency} />
                </div>
              </div>

              {motorReforma.precoMuda ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-muted/40 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Preço de hoje</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(precoFinal)}</p>
                      <p className="text-xs text-muted-foreground mt-1">margem de {margemReal.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                      <p className="text-xs text-sky-800 mb-1">Mantendo a mesma margem</p>
                      <p className="text-xl font-bold text-sky-700">{formatCurrency(projecaoReforma.precoMantendoMargem)}</p>
                      <p className={`text-xs mt-1 font-medium ${projecaoReforma.variacaoPercent > 0.005 ? 'text-red-600' : projecaoReforma.variacaoPercent < -0.005 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {projecaoReforma.variacaoPercent >= 0 ? '+' : ''}{projecaoReforma.variacaoPercent.toFixed(2)}% no preço
                      </p>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Mantendo o preço de hoje</p>
                      <p className={`text-xl font-bold ${projecaoReforma.margemMantendoPreco >= margemReal ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {projecaoReforma.margemMantendoPreco.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        de margem ({formatCurrency(projecaoReforma.lucroMantendoPreco)} por unidade)
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">CMV de hoje</span><span className="font-medium">{formatCurrency(custo)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">(–) Crédito de CBS embutido na compra</span><span className="font-medium text-emerald-700">{formatCurrency(projecaoReforma.creditoCbsUnitario)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo líquido depois do crédito</span><span className="font-medium">{formatCurrency(projecaoReforma.custoLiquidoUnitario)}</span></div>
                    <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Imposto que continua por dentro do preço</span><span className="font-medium">{projecaoReforma.impostoPorDentroRestante.toFixed(2)}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Receita líquida da empresa</span><span className="font-medium">{formatCurrency(projecaoReforma.receitaLiquida)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">(+) CBS somada por fora ({projecaoReforma.aliquotaCbsAplicada.toFixed(2)}%)</span><span className="font-medium">{formatCurrency(projecaoReforma.cbsPorFora)}</span></div>
                    <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Preço final ao cliente</span><span className="font-semibold text-primary">{formatCurrency(projecaoReforma.precoMantendoMargem)}</span></div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    O imposto sai de dentro do preço e passa a ser somado por fora, destacado na nota. Ao mesmo tempo, o crédito de
                    CBS da compra derruba o custo. Por isso o preço pode cair mesmo com a alíquota parecendo maior.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Em {reformaConfig.ano}, no {motorReforma.preset.label}, o valor da guia não muda — então o preço de{' '}
                  {formatCurrency(precoFinal)} continua valendo. {motorReforma.preset.descricao}
                </p>
              )}
            </div>
          )}

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-primary">Ponto de Equilíbrio (Break-Even)</h3>
            </div>
            
            <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary/80 font-medium flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <span>
                  <strong>Nota sobre Custos Fixos:</strong> Esta projeção considera o <strong>Custeio Fixo - Rateio (%)</strong> informado na seção de Vendas. O Ponto de Equilíbrio indica quantas unidades deste produto precisam ser vendidas para pagar a parcela rateada do custo fixo.
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
               <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Custo Fixo Rateado</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(valorRateadoCF)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Parcela do custo fixo que este produto deve pagar.</p>
               </div>
               <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ponto de Equilíbrio (Unidades)</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {isValidMargem ? (peUnidades > 999999 ? 'Irreal' : `${Math.ceil(peUnidades)} un`) : 'Prejuízo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Quantidade mínima a vender para não ter prejuízo.</p>
               </div>
               <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tempo para atingir o P.E.</p>
                  <p className="text-2xl font-bold text-primary">
                    {tempoAtingirStr}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Considerando {vendasProjetadas} vendas em 30 dias.</p>
               </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="unidades" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(v) => `${v} un`} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(value) => `${formatCurrency((value/1000))}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                    formatter={(value: number) => `${formatCurrency(value)}`}
                    labelFormatter={(label) => `${label} unidades`}
                  />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="custoTotal" name="Custo Total (Fixo+Var)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCusto)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-primary mb-4">Composição do Preço Ideal</h3>
            <CostCompositionChart data={data} size="md" legendLayout="grid-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
