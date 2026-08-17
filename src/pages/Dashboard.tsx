import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, ShoppingBag, Percent, Target, Box, FileText, Info, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { useAppContext, ProdutoItem } from '../context/AppContext';
import { calculateSellingPrice, calculateContributionMargin } from '../domain/pricing';
import { formatCurrency } from '../utils/format';

export default function Dashboard() {
  const { produtos, custosFixos, saveProduto, snapshots, createSnapshot } = useAppContext();

  const [metaLucro, setMetaLucro] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVendas, setEditVendas] = useState<number>(0);
  const [modoSimulador, setModoSimulador] = useState<'proporcional' | 'inteligente'>('proporcional');

  const [varCmv, setVarCmv] = useState<number>(0);
  const [varVendas, setVarVendas] = useState<number>(0);
  const [varCustoFixo, setVarCustoFixo] = useState<number>(0);

  const resetSimulation = () => {
    setVarCmv(0);
    setVarVendas(0);
    setVarCustoFixo(0);
  };


  const custoFixoTotal = custosFixos.reduce((a, b) => a + b.valor, 0);

  let receitaEstimada = 0;
  let margemContribuicaoTotal = 0;
  
  let custosVariaveisTotais = 0;
  let impostoValorTotal = 0;
  let taxasComissoesValorTotal = 0;

  let produtosComPrejuizo: { nome: string; margem: number }[] = [];


  const mcUnitMap: Record<string, number> = {};

  produtos.forEach(p => {
    const vendas = p.vendasProjetadas || 0;
    const imposto = p.imposto || 0;
    const taxa = p.taxaCartao || 0;
    const com = p.comissao || 0;
    const margem = p.margem || 0;
    const rateio = p.percentualRateio || 0;
    
    const valorRateadoCF = (rateio / 100) * custoFixoTotal;
    const custoFixoUnitario = vendas > 0 ? (valorRateadoCF / vendas) : 0;
    
    const despesasVariaveisPerc = imposto + taxa + com;
    
    let preco = 0;
    let margemReal = margem;
    
    if (p.modoPrecificacao === 'preco') {
      preco = p.precoFixo || 0;
      const custoTot = p.cmv + custoFixoUnitario;
      const descontosVariaveis = preco * (despesasVariaveisPerc / 100);
      const lucroReais = preco - custoTot - descontosVariaveis;
      margemReal = preco > 0 ? (lucroReais / preco) * 100 : 0;
    } else {
      preco = calculateSellingPrice(p.cmv, custoFixoUnitario, imposto/100, taxa/100, com/100, margem/100);
    }
    
    receitaEstimada += preco * vendas;
    custosVariaveisTotais += p.cmv * vendas;
    
    const valorImposto = preco * (imposto / 100);
    const valorTaxasCom = preco * ((taxa + com) / 100);
    
    impostoValorTotal += valorImposto * vendas;
    taxasComissoesValorTotal += valorTaxasCom * vendas;
    
    
    const margemContribuicao = preco - p.cmv - valorImposto - valorTaxasCom;
    if (margemContribuicao < 0) {
      produtosComPrejuizo.push({ nome: p.nome, margem: margemContribuicao });
    }

    mcUnitMap[p.id] = margemContribuicao;
    
    margemContribuicaoTotal += margemContribuicao * vendas;
  });

  const lucroLiquidoTotal = margemContribuicaoTotal - custoFixoTotal;
  const totalRateio = produtos.filter(p => p.cmv > 0).reduce((acc, p) => acc + (p.percentualRateio || 0), 0);
  const rateioDiff = Math.abs(100 - totalRateio);
  const isRateioIncompleto = rateioDiff > 0.1 && totalRateio < 100;
  const isRateioExcedido = rateioDiff > 0.1 && totalRateio > 100;


  const despesasVariaveisTotal = impostoValorTotal + taxasComissoesValorTotal;

  const percMargemContribuicao = receitaEstimada > 0 ? (margemContribuicaoTotal / receitaEstimada) * 100 : 0;
  const percLucroLiquido = receitaEstimada > 0 ? (lucroLiquidoTotal / receitaEstimada) * 100 : 0;
  
  // Ponto de Equilibrio Global = Custo Fixo / Indice de Margem de Contribuicao (em Receita)
  const pontoEquilibrioFaturamento = percMargemContribuicao > 0 ? (custoFixoTotal / (percMargemContribuicao / 100)) : 0;

  const pieData = [
    { name: 'Custo Fixo', value: custoFixoTotal },
    { name: 'Custo Variável (CMV)', value: custosVariaveisTotais },
    { name: 'Despesas Variáveis', value: despesasVariaveisTotal },
  ].filter(d => d.value > 0);

  const COLORS = ['#94a3b8', '#f87171', '#fbbf24', '#34d399', '#60a5fa'];

  // Grafico de Ponto de Equilíbrio
  const peGrafico = [];
  if (receitaEstimada > 0) {
    const step = receitaEstimada / 5;
    for (let i = 0; i <= 6; i++) {
      const rec = step * i;
      const custoTotalGraf = custoFixoTotal + (rec * (1 - (percMargemContribuicao/100)));
      peGrafico.push({
        faturamento: rec,
        custoTotal: custoTotalGraf
      });
    }
  }

  // Simulador de Meta de Lucro
  const fatorMeta = margemContribuicaoTotal > 0 ? (custoFixoTotal + metaLucro) / margemContribuicaoTotal : 0;
  const gapSimulador = (custoFixoTotal + metaLucro) - margemContribuicaoTotal;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousSnapshots = snapshots.filter(s => new Date(s.createdAt) < startOfMonth);
  const lastMonthSnapshot = previousSnapshots.length > 0 ? previousSnapshots[0] : null;

  let lastFaturamento = 0;
  let lastLucro = 0;
  let lastCustoFixo = 0;
  let lastPercMargem = 0;

  if (lastMonthSnapshot) {
    let lastMargemContribuicaoTotal = 0;
    lastCustoFixo = lastMonthSnapshot.custoFixoTotal;
    
    lastMonthSnapshot.produtos.forEach(p => {
       const vendas = p.vendasProjetadas || 0;
       const imposto = p.imposto || 0;
       const taxa = p.taxaCartao || 0;
       const com = p.comissao || 0;
       const margem = p.margem || 0;
       const rateio = p.percentualRateio || 0;
       
       const valorRateadoCF = (rateio / 100) * lastCustoFixo;
       const custoFixoUnitario = vendas > 0 ? (valorRateadoCF / vendas) : 0;
       
       let preco = 0;
       if (p.modoPrecificacao === 'preco') {
         preco = p.precoFixo || 0;
       } else {
         preco = calculateSellingPrice(p.cmv, custoFixoUnitario, imposto/100, taxa/100, com/100, margem/100);
       }
       lastFaturamento += preco * vendas;
       
       const valorImposto = preco * (imposto / 100);
       const valorTaxasCom = preco * ((taxa + com) / 100);
       
       const margemContribuicao = preco - p.cmv - valorImposto - valorTaxasCom;
       lastMargemContribuicaoTotal += margemContribuicao * vendas;
    });

    lastLucro = lastMargemContribuicaoTotal - lastCustoFixo;
    lastPercMargem = lastFaturamento > 0 ? (lastMargemContribuicaoTotal / lastFaturamento) * 100 : 0;
  }

  const varFat = lastFaturamento > 0 ? ((receitaEstimada - lastFaturamento) / lastFaturamento) * 100 : 0;
  const varLuc = lastLucro !== 0 ? ((lucroLiquidoTotal - lastLucro) / Math.abs(lastLucro)) * 100 : 0;
  const varCF = lastCustoFixo > 0 ? ((custoFixoTotal - lastCustoFixo) / lastCustoFixo) * 100 : 0;
  const varPercMC = percMargemContribuicao - lastPercMargem;
  
  const renderVar = (val: number, inverse = false) => {
    const isGood = inverse ? val < 0 : val > 0;
    const isBad = inverse ? val > 0 : val < 0;
    const color = isGood ? 'text-emerald-600' : isBad ? 'text-red-600' : 'text-muted-foreground';
    const Icon = val >= 0 ? ArrowUpRight : ArrowDownRight;
    if (val === 0) return <span className="text-xs text-muted-foreground ml-2">0%</span>;
    return <span className={`text-xs font-medium ml-2 inline-flex items-center ${color}`}><Icon className="w-3 h-3 mr-0.5" />{Math.abs(val).toFixed(1)}%</span>
  };

  // Scenario Simulator Calculations
  let simFat = 0;
  let simMC = 0;
  const simCustoFixo = custoFixoTotal * (1 + varCustoFixo / 100);

  produtos.forEach(p => {
    const pCmv = p.cmv * (1 + varCmv / 100);
    const pVendas = (p.vendasProjetadas || 0) * (1 + varVendas / 100);
    const imposto = p.imposto || 0;
    const taxa = p.taxaCartao || 0;
    const com = p.comissao || 0;
    const margem = p.margem || 0;
    const rateio = p.percentualRateio || 0;

    const valorRateadoCF = (rateio / 100) * simCustoFixo;
    const custoFixoUnitario = pVendas > 0 ? (valorRateadoCF / pVendas) : 0;

    let preco = 0;
    if (p.modoPrecificacao === 'preco') {
      preco = p.precoFixo || 0;
    } else {
      preco = calculateSellingPrice(pCmv, custoFixoUnitario, imposto/100, taxa/100, com/100, margem/100);
    }
    simFat += preco * pVendas;

    const valorImposto = preco * (imposto / 100);
    const valorTaxasCom = preco * ((taxa + com) / 100);
    const margemContribuicao = preco - pCmv - valorImposto - valorTaxasCom;
    simMC += margemContribuicao * pVendas;
  });
  const simLucro = simMC - simCustoFixo;

  const somaMCUnits = produtos.reduce((acc, p) => acc + (mcUnitMap[p.id] || 0), 0);

  const exportExcel = (isDashboard: boolean) => {
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();
      
      const wsResumo = XLSX.utils.json_to_sheet([
        { Metrica: "Faturamento Projetado", Valor: receitaEstimada },
        { Metrica: "Custo Fixo Total", Valor: custoFixoTotal },
        { Metrica: "Custo Variável Total", Valor: custosVariaveisTotais },
        { Metrica: "Despesas Variáveis", Valor: despesasVariaveisTotal },
        { Metrica: "Margem de Contribuição Total", Valor: margemContribuicaoTotal },
        { Metrica: "Lucro Líquido Estimado", Valor: lucroLiquidoTotal },
        { Metrica: "Ponto de Equilíbrio", Valor: pontoEquilibrioFaturamento }
      ]);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const prodData = produtos.map(p => ({
        "Produto": p.nome,
        "CMV": p.cmv,
        "Vendas Proj.": p.vendasProjetadas,
        "Rateio (%)": p.percentualRateio,
        "Margem Contrib. (Un)": mcUnitMap[p.id] || 0
      }));
      const wsProd = XLSX.utils.json_to_sheet(prodData);
      XLSX.utils.book_append_sheet(wb, wsProd, "Produtos");

      XLSX.writeFile(wb, `relatorio-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const handleSaveEdit = (p: ProdutoItem) => {
    saveProduto({ ...p, vendasProjetadas: editVendas });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 pb-12">
            <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-primary">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visão geral real baseada nos seus cadastros.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => exportExcel(true)} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
             <FileText className="w-4 h-4"/> Excel
           </button>
           <button onClick={() => window.print()} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
             <FileText className="w-4 h-4"/> PDF
           </button>
        </div>
      </div>

      {produtosComPrejuizo.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
             <p className="text-sm font-medium">
               ⚠️ {produtosComPrejuizo.length} produto(s) vendendo no prejuízo: {produtosComPrejuizo.slice(0,3).map(p => p.nome).join(', ')}{produtosComPrejuizo.length > 3 ? ` e mais ${produtosComPrejuizo.length - 3} outros` : ''}.
             </p>
             <Link to="/mix-preco-lote?filter=prejuizo" className="text-sm font-semibold underline mt-2 inline-block hover:text-red-900">
               Corrigir no Mix de Preços
             </Link>
          </div>
        </div>
      )}


      {(isRateioIncompleto || isRateioExcedido) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
             <p className="text-sm font-medium">
               {isRateioExcedido
                 ? `Rateio excedido: ${totalRateio.toFixed(2)}% distribuído (${(totalRateio - 100).toFixed(2)}% acima do total).` 
                 : `⚠️ Rateio de custo fixo incompleto: ${totalRateio.toFixed(2)}% distribuído (faltam ${(100 - totalRateio).toFixed(2)}%).`
               } Os valores abaixo podem não refletir o resultado real até o rateio ser ajustado na tela de Mix e Preço em Lote.
             </p>
             <Link to="/mix-preco-lote" className="text-sm font-semibold underline mt-2 inline-block hover:text-amber-900">
               Ajustar Mix de Preços
             </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Faturamento Projetado', value: `${formatCurrency(receitaEstimada)}`, isPositive: true, icon: DollarSign },
          { title: 'Custo Fixo Mensal', value: `${formatCurrency(custoFixoTotal)}`, isPositive: false, icon: TrendingUp },
          { title: 'Custo Variável (CMV)', value: `${formatCurrency(custosVariaveisTotais)}`, isPositive: false, icon: Box },
          { title: 'Despesas Variáveis (S/ Margem)', value: `${formatCurrency(despesasVariaveisTotal)}`, isPositive: false, icon: FileText, desc: 'Impostos, Taxas e Comissões' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${stat.isPositive ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
              {stat.desc && <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm lg:col-span-1">
          <h3 className="font-serif text-lg mb-4 text-primary">Margens e Lucro Global</h3>
          <div className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
               <p className="text-sm text-muted-foreground">Margem de Contribuição Total</p>
               <h4 className="text-2xl font-bold text-primary">{formatCurrency(margemContribuicaoTotal)}</h4>
               <p className="text-sm font-medium text-primary/80">{percMargemContribuicao.toFixed(1)}% da receita</p>
               <p className="text-xs text-muted-foreground mt-2">Valor que sobra para pagar os custos fixos.</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
               <p className="text-sm text-emerald-800">Lucro Líquido Estimado</p>
               <h4 className="text-2xl font-bold text-emerald-600">{formatCurrency(lucroLiquidoTotal)}</h4>
               <p className="text-sm font-medium text-emerald-600">{percLucroLiquido.toFixed(1)}% da receita</p>
               <p className="text-xs text-emerald-700/70 mt-2">Valor livre após todos os custos e despesas.</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm lg:col-span-2">
          <h3 className="font-serif text-lg mb-1 text-primary">Ponto de Equilíbrio</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Faturamento necessário para não ter prejuízo: <span className="font-bold text-foreground">{formatCurrency(pontoEquilibrioFaturamento)}</span>
          </p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={peGrafico} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="faturamento" 
                  tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} 
                  style={{ fontSize: '12px' }} 
                />
                <YAxis 
                  tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} 
                  style={{ fontSize: '12px' }} 
                />
                <RechartsTooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label: number) => `Faturamento: ${formatCurrency(label)}`}
                />
                <Legend />
                <ReferenceLine x={pontoEquilibrioFaturamento} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'PE', position: 'top', fill: '#f59e0b', fontSize: 12 }} />
                <Line type="monotone" dataKey="faturamento" name="Receita" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="custoTotal" name="Custo Total (Fixo + Var)" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* SIMULADOR DE META DE LUCRO */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
         <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                <Target className="w-5 h-5" /> Simulador de Meta de Lucro
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Informe o lucro líquido desejado no mês para descobrir a quantidade de vendas necessária de cada produto.
              </p>
            </div>
            {metaLucro > 0 && (
              <div className="flex bg-muted/50 p-1 rounded-md border border-border shrink-0">
                <button
                  onClick={() => setModoSimulador('proporcional')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${modoSimulador === 'proporcional' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}
                >
                  Proporcional
                </button>
                <button
                  onClick={() => setModoSimulador('inteligente')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${modoSimulador === 'inteligente' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}
                >
                  Inteligente
                </button>
              </div>
            )}
         </div>
         
         <div className="max-w-xs mb-6">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Lucro Líquido Desejado (R$)
            </label>
            <input 
              type="number" 
              value={metaLucro || ''}
              onChange={(e) => setMetaLucro(Number(e.target.value))}
              placeholder="Ex: 5000"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
            />
         </div>

         {metaLucro > 0 && (
           <div className="overflow-x-auto rounded-lg border border-border">
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 text-right">Vendas Atuais</th>
                    <th className="px-4 py-3 text-right text-primary">Vendas Necessárias (Meta)</th>
                    <th className="px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => {
                    let sugerido = 0;
                    if (modoSimulador === 'proporcional') {
                      sugerido = Math.ceil((p.vendasProjetadas || 0) * fatorMeta);
                    } else {
                      const mcUnit = mcUnitMap[p.id] || 0;
                      const pesoMC = somaMCUnits > 0 ? mcUnit / somaMCUnits : 0;
                      const vendasExtras = (mcUnit > 0 && gapSimulador > 0) ? (gapSimulador / mcUnit) * pesoMC : 0;
                      sugerido = Math.ceil((p.vendasProjetadas || 0) + Math.max(0, vendasExtras));
                    }
                    const isEditing = editingId === p.id;
                    
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{p.nome}</td>
                        <td className="px-4 py-3 text-right">{p.vendasProjetadas || 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {isEditing ? (
                             <input 
                               type="number"
                               value={editVendas}
                               onChange={e => setEditVendas(Number(e.target.value))}
                               className="w-20 px-2 py-1 border rounded text-right ml-auto"
                             />
                          ) : (
                             sugerido
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleSaveEdit(p)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setEditingId(p.id!); setEditVendas(sugerido); }} 
                              className="p-1 text-primary hover:bg-primary/10 rounded inline-flex items-center gap-1 text-xs font-medium"
                            >
                              <Edit2 className="w-3 h-3"/> Aplicar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           </div>
         )}
      </div>

      <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
        <h3 className="text-primary font-medium flex items-center gap-2 mb-2">
          <Info className="w-4 h-4" /> Como analisar seus indicadores
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li><strong>Ponto de Equilíbrio:</strong> É o momento em que a empresa "empata". Abaixo disso é prejuízo, acima é lucro.</li>
          <li><strong>Margem de Contribuição:</strong> Mostra quanto cada venda contribui para pagar os custos fixos após descontar os custos variáveis (impostos, taxas, CMV).</li>
          <li><strong>Simulador:</strong> Edite as vendas para testar cenários ou aplique as "Vendas Necessárias" para salvar no cadastro do produto automaticamente.</li>
        </ul>
      </div>

    </div>
  );
}
