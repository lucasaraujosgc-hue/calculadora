import React from 'react';
import { Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, ShoppingBag, Percent, Target, Box, FileText, Info } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Dashboard() {
  const { produtos, custosFixos } = useAppContext();

  const custoFixoTotal = custosFixos.reduce((a, b) => a + b.valor, 0);

  let receitaEstimada = 0;
  let margemTotal = 0;
  let produtosSemMargem = 0;
  let custosVariaveisTotais = 0;
  let impostoValorTotal = 0;
  let taxasComissoesValorTotal = 0;

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
      const totalPerc = despesasVariaveisPerc + margem;
      const divisor = (100 - totalPerc) / 100;
      preco = divisor > 0 ? ((p.cmv + custoFixoUnitario) / divisor) : 0;
    }
    
    receitaEstimada += preco * vendas;
    custosVariaveisTotais += p.cmv * vendas;
    
    const valorImposto = preco * (imposto / 100);
    const valorTaxasCom = preco * ((taxa + com) / 100);
    const valorMargem = preco * (margemReal / 100);
    
    impostoValorTotal += valorImposto * vendas;
    taxasComissoesValorTotal += valorTaxasCom * vendas;
    
    const despesas = valorImposto + valorTaxasCom;
    const margemContribuicao = preco - p.cmv - despesas;
    
    margemTotal += margemContribuicao * vendas;

    if (margemContribuicao <= 0) {
      produtosSemMargem++;
    }
  });

  const lucroEstimado = margemTotal - custoFixoTotal;
  const mediaMargem = receitaEstimada > 0 ? (margemTotal / receitaEstimada) * 100 : 0;
  const impostoPorcentagem = receitaEstimada > 0 ? (impostoValorTotal / receitaEstimada) * 100 : 0;
  const pontoEquilibrio = mediaMargem > 0 ? (custoFixoTotal / (mediaMargem / 100)) : 0;

  const pieData = [
    { name: 'Custo Fixo', value: custoFixoTotal },
    { name: 'Custo Variável (CMV)', value: custosVariaveisTotais },
    { name: 'Impostos', value: impostoValorTotal },
    { name: 'Taxas/Comissões', value: taxasComissoesValorTotal },
  ].filter(d => d.value > 0);

  const COLORS = ['#f43f5e', '#3b82f6', '#eab308', '#8b5cf6'];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-primary">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visão geral real baseada nos seus cadastros.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Receita Estimada Mensal', value: `R$ ${receitaEstimada.toFixed(2)}`, isPositive: receitaEstimada > 0, icon: DollarSign },
          { title: 'Ponto de Equilíbrio', value: `R$ ${pontoEquilibrio.toFixed(2)}`, isPositive: receitaEstimada >= pontoEquilibrio, icon: Target },
          { title: 'Lucro Estimado', value: `R$ ${lucroEstimado.toFixed(2)}`, isPositive: lucroEstimado > 0, icon: ShoppingBag },
          { title: 'Margem Global (Média)', value: `${mediaMargem.toFixed(1)}%`, isPositive: mediaMargem > 20, icon: Percent },
          
          { title: 'Custo Fixo Mensal', value: `R$ ${custoFixoTotal.toFixed(2)}`, isPositive: false, icon: TrendingUp },
          { title: 'Custo Variável Total', value: `R$ ${custosVariaveisTotais.toFixed(2)}`, isPositive: false, icon: Box },
          { title: 'Impostos Gerais', value: `R$ ${impostoValorTotal.toFixed(2)} (${impostoPorcentagem.toFixed(1)}%)`, isPositive: false, icon: FileText },
          { title: 'Taxas e Comissões', value: `R$ ${taxasComissoesValorTotal.toFixed(2)}`, isPositive: false, icon: Percent },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={`flex items-center text-xs font-medium ${stat.isPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
                {stat.isPositive ? 'Positivo' : 'Atenção'}
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">Como analisar seus indicadores</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Target className="w-4 h-4" />
                 </div>
                 <h4 className="font-semibold text-blue-800 text-sm">Ponto de Equilíbrio</h4>
               </div>
               <p className="text-sm text-blue-700 leading-relaxed mt-1">
                 É o valor em vendas necessário para pagar todos os seus custos (fixos e variáveis) sem gerar prejuízo. Se a receita for maior que ele, a operação tem lucro.
               </p>
            </div>
            
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Percent className="w-4 h-4" />
                 </div>
                 <h4 className="font-semibold text-purple-800 text-sm">Margem Global</h4>
               </div>
               <p className="text-sm text-purple-700 leading-relaxed mt-1">
                 Mostra o quanto sobra em percentual após abater o custo do produto, impostos e taxas. Indica a saúde de contribuição do seu mix de produtos.
               </p>
            </div>
            
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <Box className="w-4 h-4" />
                 </div>
                 <h4 className="font-semibold text-rose-800 text-sm">Custo Variável e CMV</h4>
               </div>
               <p className="text-sm text-rose-700 leading-relaxed mt-1">
                 Custos que crescem junto com as vendas. O CMV é o custo base do produto. Analisar o peso dessa fatia na receita é vital para a precificação.
               </p>
            </div>
            
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                 </div>
                 <h4 className="font-semibold text-emerald-800 text-sm">Lucro Estimado</h4>
               </div>
               <p className="text-sm text-emerald-700 leading-relaxed mt-1">
                 O resultado final projetado para o fim do mês, após pagar todos os custos e despesas. É o oxigênio financeiro do seu negócio.
               </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-medium text-foreground mb-6">Estrutura de Custos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="lg:col-span-3 bg-card border border-border p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-medium text-foreground mb-6">Alertas</h3>
          <div className="space-y-4">
             {lucroEstimado < 0 && (
               <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                     <span className="font-medium text-red-700 text-sm">Operação em Prejuízo</span>
                  </div>
                  <p className="text-xs text-red-600">Seu lucro global estimado é de R$ {lucroEstimado.toFixed(2)}. Revise seus custos fixos ou ajuste a margem dos produtos.</p>
               </div>
             )}
             
             {produtosSemMargem > 0 && (
               <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="flex items-center justify-between mb-1">
                     <span className="font-medium text-amber-700 text-sm">Produtos no Vermelho</span>
                  </div>
                  <p className="text-xs text-amber-600">Você tem {produtosSemMargem} produto(s) com margem de contribuição zero ou negativa.</p>
               </div>
             )}

             {lucroEstimado >= 0 && produtosSemMargem === 0 && (
               <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center justify-between mb-1">
                     <span className="font-medium text-emerald-700 text-sm">Operação Saudável</span>
                  </div>
                  <p className="text-xs text-emerald-600">Todos os produtos possuem margem positiva e a operação está lucrando.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
