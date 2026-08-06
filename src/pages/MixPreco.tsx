import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppContext, ProdutoItem } from '../context/AppContext';
import { formatCurrency } from '../utils/format';

export default function MixPreco() {
  const { produtos, custosFixos, saveProduto, setProdutos } = useAppContext();
  const [useGlobalImposto, setUseGlobalImposto] = useState(false);
  const [globalImposto, setGlobalImposto] = useState(0);

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  const handleUpdateProduto = (id: string, field: keyof ProdutoItem, value: number | string) => {
    let updatedProduto;
    const updated = produtos.map(p => {
      if (p.id === id) {
        updatedProduto = { ...p, [field]: value };
        return updatedProduto;
      }
      return p;
    });
    setProdutos(updated);
    if (updatedProduto) {
      saveProduto(updatedProduto).catch(err => console.error(err));
    }
  };

  const totalRateio = produtos.reduce((acc, p) => acc + (p.percentualRateio || 0), 0);
  const rateioPendente = 100 - totalRateio;
  const valorPendente = (rateioPendente / 100) * custoFixoTotal;

  let receitaTotal = 0;
  let margemTotal = 0;
  let vendasTotais = 0;

  produtos.forEach(p => {
    const imposto = useGlobalImposto ? globalImposto : (p.imposto || 0);
    const taxaCartao = p.taxaCartao || 0;
    const comissao = p.comissao || 0;
    const margem = p.margem || 0;
    const vendas = p.vendasProjetadas || 0;

    const rateio = p.percentualRateio || 0;
    const valorRateadoCF = (rateio / 100) * custoFixoTotal;
    const custoFixoUnitario = vendas > 0 ? (valorRateadoCF / vendas) : 0;

    const despesasVariaveisPerc = imposto + taxaCartao + comissao;
    let preco = 0;
    
    if (p.modoPrecificacao === 'preco') {
      preco = p.precoFixo || 0;
    } else {
      const totalPerc = despesasVariaveisPerc + margem;
      const divisor = (100 - totalPerc) / 100;
      preco = divisor > 0 ? ((p.cmv + custoFixoUnitario) / divisor) : 0;
    }
    
    const valorImposto = preco * (imposto / 100);
    const valorTaxa = preco * (taxaCartao / 100);
    const valorComissao = preco * (comissao / 100);
    const margemContribuicao = preco - p.cmv - valorImposto - valorTaxa - valorComissao;

    receitaTotal += preco * vendas;
    margemTotal += margemContribuicao * vendas;
    vendasTotais += vendas;
  });

  const lucroMix = margemTotal - custoFixoTotal;

  const COLORS = ['#94a3b8', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Mix de Preços</h1>
        <p className="text-muted-foreground mt-1 text-sm">Projete a formação de preço de vários produtos e rateie o custo fixo entre eles.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-bold text-foreground">Configuração Global & Resultado do Mix</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure variáveis globais e analise a saúde da sua operação.</p>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
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
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Custo Fixo Total ({formatCurrency(custoFixoTotal)})</p>
                </div>
                <div className="text-right">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Total Rateado</span>
                    <span className={`text-2xl font-bold ${totalRateio === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {totalRateio.toFixed(1)}%
                    </span>
                </div>
              </div>
              {totalRateio !== 100 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-800">
                    {rateioPendente > 0 
                      ? `Faltam ${rateioPendente.toFixed(1)}% (${formatCurrency(valorPendente)}) do custo fixo sem rateio.`
                      : `Você rateou ${Math.abs(rateioPendente).toFixed(1)}% a mais que 100%.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Projeção do Mix de Vendas</h3>
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">Vendas Totais Projetadas</p>
                 <p className="text-xl font-bold text-foreground">{vendasTotais} un</p>
               </div>
               <div className="p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">Receita Estimada</p>
                 <p className="text-xl font-bold text-foreground">{formatCurrency(receitaTotal)}</p>
               </div>
               <div className="p-4 rounded-xl border border-border bg-background">
                 <p className="text-xs text-muted-foreground mb-1">Margem de Contrib. Total</p>
                 <p className="text-xl font-bold text-emerald-600">{formatCurrency(margemTotal)}</p>
               </div>
               <div className={`p-4 rounded-xl border ${lucroMix >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                 <p className={`text-xs font-medium mb-1 ${lucroMix >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Resultado (Lucro/Prejuízo)</p>
                 <p className={`text-xl font-bold ${lucroMix >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(lucroMix)}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {produtos.map((p) => {
          const imposto = useGlobalImposto ? globalImposto : (p.imposto || 0);
          const taxaCartao = p.taxaCartao || 0;
          const comissao = p.comissao || 0;
          const margem = p.margem || 0;
          const rateio = p.percentualRateio || 0;
          const vendasProjetadas = p.vendasProjetadas || 0;

          const valorRateadoCF = (rateio / 100) * custoFixoTotal;
          const custoFixoUnitario = vendasProjetadas > 0 ? (valorRateadoCF / vendasProjetadas) : 0;

          const despesasVariaveisPerc = imposto + taxaCartao + comissao;
          
          let precoFinal = 0;
          let margemReal = margem;

          if (p.modoPrecificacao === 'preco') {
            precoFinal = p.precoFixo || 0;
            const custoTot = p.cmv + custoFixoUnitario;
            const descontosVariaveis = precoFinal * (despesasVariaveisPerc / 100);
            const lucroReais = precoFinal - custoTot - descontosVariaveis;
            margemReal = precoFinal > 0 ? (lucroReais / precoFinal) * 100 : 0;
          } else {
            const totalPerc = despesasVariaveisPerc + margem;
            const divisor = (100 - totalPerc) / 100;
            precoFinal = divisor > 0 ? ((p.cmv + custoFixoUnitario) / divisor) : 0;
          }
          
          const valorImposto = precoFinal * (imposto / 100);
          const valorTaxa = precoFinal * (taxaCartao / 100);
          const valorComissao = precoFinal * (comissao / 100);
          const valorMargem = precoFinal * (margemReal / 100);
          const margemContribuicao = precoFinal - p.cmv - valorImposto - valorTaxa - valorComissao;
          
          // Ponto de equilíbrio específico para este produto com base no SEU rateio
          const isValidMargem = margemContribuicao > 0;
          const peUnidades = isValidMargem ? (valorRateadoCF / margemContribuicao) : Infinity;

          const data = [
            { name: 'Custo Variável (CMV)', value: p.cmv },
            { name: 'Custo Fixo Unitário', value: custoFixoUnitario },
            { name: 'Impostos', value: valorImposto },
            { name: 'Taxas & Comissões', value: valorTaxa + valorComissao },
            { name: 'Lucro Líquido', value: valorMargem },
          ].map(item => ({ ...item, value: Number(item.value.toFixed(2)) }));

          return (
            <div key={p.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-foreground">{p.nome}</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border shadow-sm">
                    <label className="text-sm font-medium text-foreground">Vendas Projetadas:</label>
                    <input 
                      type="number" 
                      value={vendasProjetadas}
                      onChange={(e) => handleUpdateProduto(p.id, 'vendasProjetadas', Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-border rounded bg-muted/30 focus:ring-2 focus:ring-primary/50 text-sm font-bold text-center"
                    />
                    <span className="text-sm text-muted-foreground">un</span>
                  </div>

                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <label className="text-sm font-medium text-amber-800">% Rateio Custo Fixo:</label>
                    <input 
                      type="number" 
                      value={rateio}
                      onChange={(e) => handleUpdateProduto(p.id, 'percentualRateio', Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-amber-300 rounded bg-white focus:ring-2 focus:ring-amber-500/50 text-sm font-bold text-center text-amber-900"
                    />
                    <span className="text-sm text-amber-800">%</span>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Inputs */}
                <div className="col-span-1 lg:col-span-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Custo de Aquisição (CMV)</label>
                    <input type="number" value={p.cmv} onChange={(e) => handleUpdateProduto(p.id, 'cmv', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                  </div>

                  <div className="flex gap-2 mt-4 mb-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateProduto(p.id, 'modoPrecificacao', 'margem' as any)}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                    >
                      Calcular por Margem
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateProduto(p.id, 'modoPrecificacao', 'preco' as any)}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-colors ${p.modoPrecificacao === 'preco' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                    >
                      Preço Fixo
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Impostos (%)</label>
                      <input 
                        type="number" 
                        value={imposto} 
                        onChange={(e) => handleUpdateProduto(p.id, 'imposto', Number(e.target.value))} 
                        disabled={useGlobalImposto}
                        className={`w-full px-3 py-2 border border-border rounded-md text-sm ${useGlobalImposto ? 'bg-muted/50 cursor-not-allowed text-muted-foreground' : 'bg-background'}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Taxa Cartão (%)</label>
                      <input type="number" value={taxaCartao} onChange={(e) => handleUpdateProduto(p.id, 'taxaCartao', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Outros (Comissão e afins) %</label>
                      <input type="number" value={comissao} onChange={(e) => handleUpdateProduto(p.id, 'comissao', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
                    </div>
                    <div>
                      {(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? (
                        <>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Margem Líquida (%)</label>
                          <input type="number" value={margem} onChange={(e) => handleUpdateProduto(p.id, 'margem', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                        </>
                      ) : (
                        <>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Preço Venda (R$)</label>
                          <input type="number" value={p.precoFixo || 0} onChange={(e) => handleUpdateProduto(p.id, 'precoFixo', Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preço e M.C. */}
                <div className="col-span-1 lg:col-span-4 space-y-4">
                  <div className={`border p-5 rounded-xl shadow-sm ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'bg-primary border-primary/20 text-primary-foreground' : 'bg-card border-border'}`}>
                    <p className={`text-sm font-medium mb-1 ${(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'opacity-80' : 'text-muted-foreground'}`}>
                      {(!p.modoPrecificacao || p.modoPrecificacao === 'margem') ? 'Preço de Venda Ideal' : 'Preço de Venda Fixo'}
                    </p>
                    <h3 className={`text-4xl font-bold ${p.modoPrecificacao === 'preco' ? 'text-foreground' : ''}`}>{formatCurrency(precoFinal)}</h3>
                  </div>
                  
                  <div className="bg-background border border-border p-5 rounded-xl shadow-sm flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Margem de Contribuição</p>
                    <h3 className={`text-3xl font-semibold ${margemContribuicao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(margemContribuicao)}</h3>
                  </div>

                  <div className="bg-background border border-border p-5 rounded-xl shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido</p>
                        <h3 className={`text-3xl font-semibold ${valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>{formatCurrency(valorMargem)}</h3>
                      </div>
                      {p.modoPrecificacao === 'preco' && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Margem %</p>
                          <h3 className={`text-xl font-semibold ${margemReal >= 0 ? 'text-primary' : 'text-red-600'}`}>{margemReal.toFixed(1)}%</h3>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-background border border-border p-4 rounded-xl shadow-sm flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">P.E. Deste Produto</p>
                    <p className="text-xl font-bold text-amber-600">
                      {isValidMargem ? (peUnidades > 999999 ? 'Irreal' : `${Math.ceil(peUnidades)} unidades`) : 'Prejuízo'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Para pagar sua cota do custo fixo ({formatCurrency(valorRateadoCF)})</p>
                  </div>
                </div>

                {/* Gráfico Detalhamento */}
                <div className="col-span-1 lg:col-span-4 border border-border rounded-xl p-4 flex flex-col">
                  <p className="text-sm font-medium text-foreground mb-4 text-center">Composição do Preço</p>
                  <div className="h-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${formatCurrency(value)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {data.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {produtos.length === 0 && (
          <div className="text-center p-12 bg-card border border-border rounded-xl shadow-sm text-muted-foreground">
            Nenhum produto cadastrado. Cadastre produtos na aba Custos Variáveis.
          </div>
        )}
      </div>
    </div>
  );
}
