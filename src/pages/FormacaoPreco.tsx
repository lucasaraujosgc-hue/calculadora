import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAppContext } from '../context/AppContext';

export default function FormacaoPreco() {
  const { produtos, custosFixos, setProdutos } = useAppContext();
  
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

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);

  // Sync selected product
  useEffect(() => {
    if (produtos.length > 0 && !selectedProductId) {
      setSelectedProductId(produtos[0].id);
    }
  }, [produtos]);

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
      if (p.margem !== undefined) setMargem(p.margem);
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
          precoFixo
        };
      }
      return p;
    });
    setProdutos(updated);
    alert('Valores salvos no produto!');
  };

  // --- Calculations ---
  const custoFixoUnitario = vendasProjetadas > 0 ? (custoFixoTotal / vendasProjetadas) : 0;

  const despesasVariaveisPerc = imposto + taxaCartao + comissao;
  const totalPerc = despesasVariaveisPerc + margem;
  const divisor = (100 - totalPerc) / 100;
  
  const precoIdealCalculado = divisor > 0 ? ((custo + custoFixoUnitario) / divisor) : 0;
  
  let precoFinal = precoIdealCalculado;
  let margemReal = margem;

  if (modoPrecificacao === 'preco') {
    precoFinal = precoFixo;
    const custoTot = custo + custoFixoUnitario;
    const descontosVariaveis = precoFinal * (despesasVariaveisPerc / 100);
    const lucroLiquidoReais = precoFinal - custoTot - descontosVariaveis;
    margemReal = precoFinal > 0 ? (lucroLiquidoReais / precoFinal) * 100 : 0;
  }
  
  const valorImposto = precoFinal * (imposto / 100);
  const valorTaxa = precoFinal * (taxaCartao / 100);
  const valorComissao = precoFinal * (comissao / 100);
  const valorMargem = precoFinal * (margemReal / 100);
  
  const margemContribuicao = precoFinal - custo - valorImposto - valorTaxa - valorComissao; 
  
  const isValidMargem = margemContribuicao > 0;
  const peUnidades = isValidMargem ? (custoFixoTotal / margemContribuicao) : Infinity;

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

  const data = [
    { name: 'Custo Variável (CMV)', value: custo },
    { name: 'Custo Fixo Unitário', value: custoFixoUnitario },
    { name: 'Impostos', value: valorImposto },
    { name: 'Taxas & Comissões', value: valorTaxa + valorComissao },
    { name: 'Lucro Líquido', value: valorMargem },
  ].map(item => ({ ...item, value: Number(item.value.toFixed(2)) }));

  const COLORS = ['#94a3b8', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];

  const chartData = [0, 0.5, 1, 1.5, 2].map(mult => {
    const qty = Math.round(peUnidades * mult);
    return {
      unidades: qty,
      receita: qty * precoFinal,
      custoTotal: custoFixoTotal + (qty * custo) + (qty * (precoFinal * ((imposto + taxaCartao + comissao)/100))),
      lucro: (qty * precoFinal) - (custoFixoTotal + (qty * custo) + (qty * (precoFinal * ((imposto + taxaCartao + comissao)/100))))
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
                {produtos.length === 0 && <option value="">Nenhum produto cadastrado</option>}
                {produtos.map(p => (
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Outros (Comissão e afins) %</label>
                <input type="number" value={comissao} onChange={e => setComissao(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm" />
              </div>
              <div>
                {modoPrecificacao === 'margem' ? (
                  <>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Margem Líquida Desejada (%)</label>
                    <input type="number" value={margem} onChange={e => setMargem(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Preço de Venda Praticado (R$)</label>
                    <input type="number" value={precoFixo} onChange={e => setPrecoFixo(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-md bg-primary/10 font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50" />
                  </>
                )}
              </div>
            </div>

            <button onClick={handleSaveToProduct} className="w-full py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors mt-4">
              Salvar Configuração no Produto
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="col-span-1 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className={`border p-5 rounded-xl shadow-sm ${modoPrecificacao === 'margem' ? 'bg-primary border-primary/20 text-primary-foreground' : 'bg-card border-border'}`}>
                <p className={`text-sm font-medium mb-1 ${modoPrecificacao === 'margem' ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {modoPrecificacao === 'margem' ? 'Preço de Venda Ideal' : 'Preço de Venda Simulado'}
                </p>
                <h3 className={`text-4xl font-bold ${modoPrecificacao === 'preco' ? 'text-foreground' : ''}`}>R$ {precoFinal.toFixed(2)}</h3>
             </div>
             
             <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                <p className="text-sm font-medium text-muted-foreground mb-1">Margem de Contribuição</p>
                <h3 className={`text-3xl font-semibold ${margemContribuicao > 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {margemContribuicao.toFixed(2)}</h3>
                <p className="text-xs text-muted-foreground mt-1">Valor que sobra para pagar Custos Fixos e gerar Lucro.</p>
             </div>

             <div className={`border p-5 rounded-xl shadow-sm md:col-span-2 ${modoPrecificacao === 'preco' ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Lucro Líquido (por unidade)</p>
                    <h3 className={`text-3xl font-semibold ${valorMargem >= 0 ? 'text-primary' : 'text-red-600'}`}>
                      R$ {valorMargem.toFixed(2)}
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

          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-primary">Ponto de Equilíbrio (Break-Even)</h3>
            </div>
            
            <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary/80 font-medium flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <span>
                  <strong>Nota sobre Custos Fixos:</strong> Esta projeção individual considera, para fins de cálculo, que <strong>apenas este produto</strong> será responsável por pagar 100% das despesas fixas do negócio. Para ratear os custos entre vários produtos, acesse a aba "Preços em Lote".
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
               <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total de Custos Fixos</p>
                  <p className="text-2xl font-bold text-foreground">R$ {custoFixoTotal.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Soma de todas as despesas da operação.</p>
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
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              {data.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">R$ {item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
