import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppContext, ProdutoItem } from '../context/AppContext';

export default function MixPrecoLote() {
  const { produtos, custosFixos, setProdutos } = useAppContext();
  const [useGlobalImposto, setUseGlobalImposto] = useState(false);
  const [globalImposto, setGlobalImposto] = useState(0);

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  const handleUpdateProduto = (id: string, field: keyof ProdutoItem, value: number) => {
    const updated = produtos.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setProdutos(updated);
  };

  const totalRateio = produtos.reduce((acc, p) => acc + (p.percentualRateio || 0), 0);
  const rateioPendente = 100 - totalRateio;
  const valorPendente = (rateioPendente / 100) * custoFixoTotal;

  let receitaTotal = 0;
  let margemTotal = 0;
  let vendasTotais = 0;

  const dataGraficoTotal: { name: string, value: number }[] = [
    { name: 'Custo Variável (CMV)', value: 0 },
    { name: 'Custo Fixo Unitário', value: 0 },
    { name: 'Impostos', value: 0 },
    { name: 'Taxas & Comissões', value: 0 },
    { name: 'Lucro Líquido', value: 0 },
  ];

  const processedProdutos = produtos.map(p => {
    const imposto = useGlobalImposto ? globalImposto : (p.imposto || 0);
    const taxaCartao = p.taxaCartao || 0;
    const comissao = p.comissao || 0;
    const margem = p.margem || 0;
    const vendas = p.vendasProjetadas || 0;
    const rateio = p.percentualRateio || 0;

    const valorRateadoCF = (rateio / 100) * custoFixoTotal;
    const custoFixoUnitario = vendas > 0 ? (valorRateadoCF / vendas) : 0;

    const despesasVariaveisPerc = imposto + taxaCartao + comissao;
    const totalPerc = despesasVariaveisPerc + margem;
    const divisor = (100 - totalPerc) / 100;
    
    const preco = divisor > 0 ? ((p.cmv + custoFixoUnitario) / divisor) : 0;
    
    const valorImposto = preco * (imposto / 100);
    const valorTaxa = preco * (taxaCartao / 100);
    const valorComissao = preco * (comissao / 100);
    const valorMargem = preco * (margem / 100);
    const margemContribuicao = preco - p.cmv - valorImposto - valorTaxa - valorComissao;

    const isValidMargem = margemContribuicao > 0;
    const peUnidades = isValidMargem ? (valorRateadoCF / margemContribuicao) : Infinity;

    receitaTotal += preco * vendas;
    margemTotal += margemContribuicao * vendas;
    vendasTotais += vendas;

    // Acumular para o gráfico final
    dataGraficoTotal[0].value += p.cmv * vendas;
    dataGraficoTotal[1].value += custoFixoUnitario * vendas;
    dataGraficoTotal[2].value += valorImposto * vendas;
    dataGraficoTotal[3].value += (valorTaxa + valorComissao) * vendas;
    dataGraficoTotal[4].value += valorMargem * vendas;

    return {
      ...p,
      imposto,
      taxaCartao,
      comissao,
      margem,
      rateio,
      vendas,
      preco,
      margemContribuicao,
      valorMargem,
      peUnidades,
      isValidMargem
    };
  });

  const lucroMix = margemTotal - custoFixoTotal;
  const COLORS = ['#94a3b8', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-primary">Mix de Preços em Lote</h1>
        <p className="text-muted-foreground mt-1 text-sm">Visualize e edite as variáveis de formação de preço de todos os produtos de uma só vez.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Configuração Global & Resultado do Mix</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Configure variáveis globais e analise a saúde da sua operação.</p>
        </div>
        
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Imposto Único</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input 
                    type="checkbox" 
                    checked={useGlobalImposto} 
                    onChange={e => setUseGlobalImposto(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary/50"
                  />
                  Aplicar imposto único para todos os produtos
                </label>
              </div>
              {useGlobalImposto && (
                <div className="mt-3 flex items-center gap-2">
                  <input 
                    type="number" 
                    value={globalImposto}
                    onChange={e => setGlobalImposto(Number(e.target.value))}
                    className="w-24 px-3 py-2 border border-border rounded-md bg-background text-sm font-medium"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>

            <div>
               <h3 className="text-sm font-semibold text-foreground mb-3">Rateio Global do Custo Fixo</h3>
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Custo Fixo Total (R$ {custoFixoTotal.toFixed(2)})</p>
                </div>
                <div className="text-left sm:text-right">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Total Rateado</span>
                    <span className={`text-xl sm:text-2xl font-bold ${totalRateio === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {totalRateio.toFixed(1)}%
                    </span>
                </div>
              </div>
              {totalRateio !== 100 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-800">
                    {rateioPendente > 0 
                      ? `Faltam ${rateioPendente.toFixed(1)}% (R$ ${valorPendente.toFixed(2)}) do custo fixo sem rateio.`
                      : `Você rateou ${Math.abs(rateioPendente).toFixed(1)}% a mais que 100%.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Projeção do Mix de Vendas</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div className="p-3 sm:p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">Vendas Totais</p>
                 <p className="text-lg sm:text-xl font-bold text-foreground">{vendasTotais} un</p>
               </div>
               <div className="p-3 sm:p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">Receita Estimada</p>
                 <p className="text-lg sm:text-xl font-bold text-foreground">R$ {receitaTotal.toFixed(2)}</p>
               </div>
               <div className="p-3 sm:p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">M.C. Total</p>
                 <p className="text-lg sm:text-xl font-bold text-emerald-600">R$ {margemTotal.toFixed(2)}</p>
               </div>
               <div className={`p-3 sm:p-4 rounded-xl border ${lucroMix >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                 <p className={`text-xs font-medium mb-1 ${lucroMix >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Resultado Estimado</p>
                 <p className={`text-lg sm:text-xl font-bold ${lucroMix >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>R$ {lucroMix.toFixed(2)}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">CMV (R$)</th>
                <th className="px-4 py-3">Vendas (un)</th>
                <th className="px-4 py-3">Rateio CF (%)</th>
                <th className="px-4 py-3">Imposto (%)</th>
                <th className="px-4 py-3">Taxa Cartão (%)</th>
                <th className="px-4 py-3">Outros (%)</th>
                <th className="px-4 py-3">Margem (%)</th>
                <th className="px-4 py-3 border-l border-border bg-primary/5 text-primary">Preço (R$)</th>
                <th className="px-4 py-3 bg-primary/5 text-emerald-600">M.C. (R$)</th>
                <th className="px-4 py-3 bg-primary/5 text-primary">Lucro Líq. (R$)</th>
                <th className="px-4 py-3 bg-primary/5 text-amber-600">P.E. (un)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processedProdutos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground border-r border-border min-w-[150px]">{p.nome}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">R$ {p.cmv.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      value={p.vendas}
                      onChange={(e) => handleUpdateProduto(p.id, 'vendasProjetadas', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-border rounded bg-muted/30 focus:ring-2 focus:ring-primary/50 text-sm text-center"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      value={p.rateio}
                      onChange={(e) => handleUpdateProduto(p.id, 'percentualRateio', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500/50 text-sm font-bold text-center text-amber-900"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      value={p.imposto} 
                      onChange={(e) => handleUpdateProduto(p.id, 'imposto', Number(e.target.value))} 
                      disabled={useGlobalImposto}
                      className={`w-16 px-2 py-1 border border-border rounded text-sm text-center ${useGlobalImposto ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background focus:ring-2 focus:ring-primary/50'}`} 
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={p.taxaCartao} onChange={(e) => handleUpdateProduto(p.id, 'taxaCartao', Number(e.target.value))} className="w-16 px-2 py-1 border border-border rounded bg-background focus:ring-2 focus:ring-primary/50 text-sm text-center" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={p.comissao} onChange={(e) => handleUpdateProduto(p.id, 'comissao', Number(e.target.value))} className="w-16 px-2 py-1 border border-border rounded bg-background focus:ring-2 focus:ring-primary/50 text-sm text-center" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={p.margem} onChange={(e) => handleUpdateProduto(p.id, 'margem', Number(e.target.value))} className="w-16 px-2 py-1 border border-border rounded bg-background font-bold text-primary focus:ring-2 focus:ring-primary/50 text-sm text-center" />
                  </td>
                  <td className="px-4 py-3 border-l border-border bg-primary/5 font-bold text-primary">
                    {p.preco.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 bg-primary/5 font-medium text-emerald-600">
                    {p.margemContribuicao.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 bg-primary/5 font-medium text-primary">
                    {p.valorMargem.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 bg-primary/5 font-medium text-amber-600">
                    {p.isValidMargem ? (p.peUnidades > 999999 ? 'Irreal' : Math.ceil(p.peUnidades)) : 'Prejuízo'}
                  </td>
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado. Adicione produtos na aba Custos Variáveis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {produtos.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Composição de Custos do Mix de Vendas</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataGraficoTotal}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dataGraficoTotal.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {dataGraficoTotal.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-muted-foreground font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">R$ {item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
