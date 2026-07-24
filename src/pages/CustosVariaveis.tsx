import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function CustosVariaveis() {
  const { produtos, setProdutos } = useAppContext();
  const [novoNome, setNovoNome] = useState('');
  const [novoCmv, setNovoCmv] = useState('');
  const [vendasProjetadas, setVendasProjetadas] = useState('');

  const handleAdd = () => {
    if (!novoNome || !novoCmv) return;
    const item = { 
      id: Date.now().toString(), 
      nome: novoNome, 
      cmv: Number(novoCmv),
      vendasProjetadas: Number(vendasProjetadas) || 0
    };
    setProdutos([...produtos, item]);
    setNovoNome('');
    setNovoCmv('');
    setVendasProjetadas('');
  };

  const handleRemove = (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Custos Variáveis & Produtos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Cadastre seus produtos e seus custos de aquisição ou fabricação (CMV).</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="p-6 border-b border-border bg-muted/30">
          <h3 className="text-lg font-medium text-foreground mb-4">Adicionar Produto</h3>
          <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Produto</label>
               <input 
                 type="text" 
                 placeholder="Ex: Camiseta Básica" 
                 value={novoNome} 
                 onChange={e => setNovoNome(e.target.value)} 
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm" 
               />
             </div>
             <div className="w-full md:w-48">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Custo de Aquisição (R$)</label>
               <input 
                 type="number" 
                 placeholder="Ex: 35.00" 
                 value={novoCmv} 
                 onChange={e => setNovoCmv(e.target.value)} 
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm" 
               />
             </div>
             <div className="w-full md:w-48">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Vendas Projetadas (Mês)</label>
               <input 
                 type="number" 
                 placeholder="Ex: 100" 
                 value={vendasProjetadas} 
                 onChange={e => setVendasProjetadas(e.target.value)} 
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm" 
               />
             </div>
             <div className="flex items-end">
               <button onClick={handleAdd} className="w-full flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors h-[38px]">
                 <Plus className="w-4 h-4 mr-1" /> Adicionar
               </button>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Nome do Produto</th>
                <th className="px-6 py-4">Custo Variável (CMV)</th>
                <th className="px-6 py-4">Vendas Projetadas/Mês</th>
                <th className="px-6 py-4 w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {produtos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{p.nome}</td>
                  <td className="px-6 py-4 font-medium text-red-600">R$ {p.cmv.toFixed(2)}</td>
                  <td className="px-6 py-4 text-foreground">{p.vendasProjetadas || 0} un</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleRemove(p.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado. Adicione seu primeiro produto acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
