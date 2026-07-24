import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, ShoppingBag, Percent } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Dashboard() {
  const { produtos, custosFixos } = useAppContext();

  const custoFixoTotal = custosFixos.reduce((a, b) => a + b.valor, 0);

  let receitaEstimada = 0;
  let margemTotal = 0;
  let produtosSemMargem = 0;

  produtos.forEach(p => {
    const vendas = p.vendasProjetadas || 0;
    const imposto = p.imposto || 0;
    const taxa = p.taxaCartao || 0;
    const com = p.comissao || 0;
    const margem = p.margem || 0;
    const totalPerc = imposto + taxa + com + margem;
    const divisor = (100 - totalPerc) / 100;
    
    // Calcula precoIdeal, mas também é possivel usar o do produto se existir.
    const preco = divisor > 0 ? (p.cmv / divisor) : (p.precoIdeal || 0);
    
    receitaEstimada += preco * vendas;
    
    const despesas = preco * ((imposto + taxa + com) / 100);
    const margemContribuicao = preco - p.cmv - despesas;
    
    margemTotal += margemContribuicao * vendas;

    if (margemContribuicao <= 0) {
      produtosSemMargem++;
    }
  });

  const lucroEstimado = margemTotal - custoFixoTotal;
  const mediaMargem = receitaEstimada > 0 ? (margemTotal / receitaEstimada) * 100 : 0;
  
  // Fake chart data based on estimated monthly revenue
  const data = [
    { name: 'Mês 1', revenue: receitaEstimada * 0.8, profit: (lucroEstimado * 0.8) },
    { name: 'Mês 2', revenue: receitaEstimada * 0.9, profit: (lucroEstimado * 0.9) },
    { name: 'Mês 3', revenue: receitaEstimada * 1.0, profit: lucroEstimado },
    { name: 'Mês 4', revenue: receitaEstimada * 1.1, profit: (lucroEstimado * 1.1) },
    { name: 'Mês 5', revenue: receitaEstimada * 1.2, profit: (lucroEstimado * 1.2) },
    { name: 'Mês 6', revenue: receitaEstimada * 1.3, profit: (lucroEstimado * 1.3) },
  ];

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
          { title: 'Custo Fixo Mensal', value: `R$ ${custoFixoTotal.toFixed(2)}`, isPositive: false, icon: TrendingUp },
          { title: 'Lucro Estimado', value: `R$ ${lucroEstimado.toFixed(2)}`, isPositive: lucroEstimado > 0, icon: ShoppingBag },
          { title: 'Margem Global (Média)', value: `${mediaMargem.toFixed(1)}%`, isPositive: mediaMargem > 20, icon: Percent },
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
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-medium text-foreground mb-6">Projeção de Faturamento e Lucro (Próximos Meses)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
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
