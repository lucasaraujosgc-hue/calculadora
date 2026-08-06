import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/format';

export default function CustoFixo() {
  const { custosFixos, saveCustoFixo, removeCustoFixo } = useAppContext();
  const [quantidadeMensal, setQuantidadeMensal] = useState(1000);
  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');

  const custoFixoTotal = custosFixos.reduce((acc, curr) => acc + curr.valor, 0);
  const custoUnitario = quantidadeMensal > 0 ? (custoFixoTotal / quantidadeMensal) : 0;

  const handleAdd = () => {
    if (!novoNome || !novoValor) return;
    const item = { id: Date.now().toString(), nome: novoNome, valor: Number(novoValor) };
    saveCustoFixo(item);
    setNovoNome('');
    setNovoValor('');
  };

  const handleRemove = (id: string) => {
    removeCustoFixo(id);
  };

  const chartData = [0.5, 0.75, 1, 1.25, 1.5, 2].map(multiplier => {
    const qty = Math.round(quantidadeMensal * multiplier);
    return {
      name: `${qty} un`,
      custoUnitario: qty > 0 ? (custoFixoTotal / qty) : 0
    };
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Custos Fixos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Liste as despesas da empresa e descubra o custo fixo unitário.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        
        {/* Lista de Custos */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm h-fit">
          <h3 className="text-lg font-medium text-foreground mb-4">Suas Despesas Fixas (Mensais)</h3>
          
          <div className="space-y-3 mb-6">
            {custosFixos.map(custo => (
              <div key={custo.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background">
                <span className="font-medium text-foreground">{custo.nome}</span>
                <div className="flex items-center gap-4">
                  <span className="text-primary font-medium">{formatCurrency(custo.valor)}</span>
                  <button onClick={() => handleRemove(custo.id)} className="text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {custosFixos.length === 0 && (
               <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo fixo cadastrado.</p>
            )}
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3">
             <input 
               type="text" 
               placeholder="Nome (ex: Aluguel)" 
               value={novoNome} 
               onChange={e => setNovoNome(e.target.value)} 
               className="flex-1 px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm" 
             />
             <input 
               type="number" 
               placeholder="Valor (R$)" 
               value={novoValor} 
               onChange={e => setNovoValor(e.target.value)} 
               className="w-full sm:w-32 px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm" 
             />
             <button onClick={handleAdd} className="flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors shrink-0">
               <Plus className="w-4 h-4 mr-1" /> Add
             </button>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border flex justify-between items-center">
            <span className="font-medium text-foreground">Total Custo Fixo:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(custoFixoTotal)}</span>
          </div>
        </div>

        {/* Resultados Unitário */}
        <div className="space-y-6">
          <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">
              Para calcular quanto cada produto deve pagar destas contas, informe a quantidade total que você projeta vender no mês (soma de todos os produtos).
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-1">Volume Total de Vendas Projetadas (Unidades/mês)</label>
              <input 
                type="number" 
                value={quantidadeMensal} 
                onChange={e => setQuantidadeMensal(Number(e.target.value))} 
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div className="bg-primary border border-primary/20 p-6 rounded-xl text-primary-foreground shadow-sm mb-6">
              <p className="text-sm font-medium opacity-80 mb-2">Cada unidade absorve do custo fixo:</p>
              <h3 className="text-5xl font-bold">{formatCurrency(custoUnitario)}</h3>
            </div>
            
            <h3 className="text-lg font-medium text-primary mb-2 mt-8">Simulação: Efeito do Volume</h3>
            <p className="text-sm text-muted-foreground mb-6">Veja como o custo unitário cai se você vender mais.</p>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => `${formatCurrency(v)}`} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="custoUnitario" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
