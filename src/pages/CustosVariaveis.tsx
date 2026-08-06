import React, { useState } from 'react';
import { Plus, Trash2, Lock, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/format';

export default function CustosVariaveis() {
  const { user, produtos, setProdutos, saveProduto, removeProduto, isGuest } = useAppContext();
  const [novoNome, setNovoNome] = useState('');
  const [novoCmv, setNovoCmv] = useState('');
  const [vendasProjetadas, setVendasProjetadas] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const MAX_PRODUTOS = user ? (user.plan === 'ilimitado' ? Infinity : (user.productLimit || 7)) : 5;
  const isLimitReached = produtos.length >= MAX_PRODUTOS;

  const handleAdd = () => {
    if (!novoNome || !novoCmv) return;
    if (isLimitReached) return;
    
    const item = { 
      id: Date.now().toString(), 
      nome: novoNome, 
      cmv: Number(novoCmv),
      vendasProjetadas: Number(vendasProjetadas) || 0,
      imposto: 0,
      taxaCartao: 0,
      comissao: 0,
      margem: 0,
      percentualRateio: 0
    };
    saveProduto(item);
    setNovoNome('');
    setNovoCmv('');
    setVendasProjetadas('');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.upgradeRequired) {
          alert('Faça upgrade para um plano superior para importar planilhas.');
        } else {
          alert(data.error || 'Erro ao importar planilha');
        }
        setIsImporting(false);
        if (e.target) e.target.value = '';
        return;
      }

      // Merge imported products into local state
      const newItems = data.imported.map((p: any) => ({
        id: crypto.randomUUID(),
        nome: p.name,
        cmv: p.costPrice,
        vendasProjetadas: 0,
        imposto: 0,
        taxaCartao: 0,
        comissao: 0,
        margem: 0,
        percentualRateio: 0,
        precoIdeal: p.salePrice || 0
      }));

      // Limit to MAX_PRODUTOS
      const availableSlots = MAX_PRODUTOS - produtos.length;
      if (availableSlots <= 0) {
        alert(`Limite de ${MAX_PRODUTOS} produtos atingido. Faça upgrade para cadastrar mais.`);
      } else {
        const toAdd = newItems.slice(0, availableSlots);
        setProdutos([...produtos, ...toAdd]);
        alert(`Planilha importada com sucesso! ${toAdd.length} produtos adicionados.`);
      }
    } catch (err) {
      alert('Erro de conexão ao importar planilha.');
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    removeProduto(id);
  };

  const handleClear = () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000);
      return;
    }
    produtos.forEach(p => removeProduto(p.id));
    setIsConfirmingClear(false);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Produtos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Cadastre seus produtos ou serviços e seus custos variáveis (aquisição, produção ou execução).</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm text-sm text-blue-900">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          O que é o Custo Variável?
        </h3>
        <p className="mb-3">
          Custos variáveis são aqueles que variam diretamente com o volume de vendas ou produção. Ou seja, se você não vender ou não produzir, não terá esse custo. 
          Eles devem ser inseridos por unidade (por produto ou por serviço prestado).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/60 p-3 rounded-lg">
            <h4 className="font-semibold text-blue-950 mb-1">🏪 Comércio (CMV)</h4>
            <p className="text-xs">Custo da Mercadoria Vendida. Inclui o valor pago ao fornecedor pelo produto, fretes sobre a compra e embalagens de envio (ex: caixas de e-commerce).</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg">
            <h4 className="font-semibold text-blue-950 mb-1">🏭 Indústria (CPV)</h4>
            <p className="text-xs">Custo do Produto Vendido. Inclui matéria-prima, insumos de fabricação e embalagens do produto.</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg">
            <h4 className="font-semibold text-blue-950 mb-1">💼 Serviços (CSP)</h4>
            <p className="text-xs">Custo do Serviço Prestado. Inclui materiais gastos durante a prestação, combustível/deslocamento específico até o cliente e terceirizações por job.</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-6">
         <div className="p-6 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">Adicionar Produto/Serviço</h3>
            <div className="text-sm">
              <span className={isLimitReached ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                {produtos.length} / {MAX_PRODUTOS} cadastrados
              </span>
            </div>
          </div>
          
          {isLimitReached && isGuest && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm flex items-start gap-3">
              <Lock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold mb-1">Limite atingido para visitantes</p>
                <p className="mb-2">Visitantes podem cadastrar até 5 produtos. Para cadastrar até 7 produtos e salvar seus dados permanentemente, crie uma conta gratuita.</p>
                <Link to="/auth" className="inline-block bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-amber-700 transition-colors">
                  Fazer Cadastro / Login
                </Link>
              </div>
            </div>
          )}
          
          {isLimitReached && !isGuest && (
             <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm flex items-start gap-3">
              <Lock className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold mb-1">Limite máximo atingido</p>
                <p>Você atingiu o limite de {MAX_PRODUTOS} produtos. Remova alguns produtos para adicionar novos.</p>
              </div>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
               <input 
                 type="text" 
                 placeholder="Ex: Camiseta ou Consultoria" 
                 value={novoNome} 
                 onChange={e => setNovoNome(e.target.value)} 
                 disabled={isLimitReached}
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm disabled:opacity-50" 
               />
             </div>
             <div className="w-full md:w-48">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Custo Variável (Unidade)</label>
               <input 
                 type="number" 
                 placeholder="Ex: 35.00" 
                 value={novoCmv} 
                 onChange={e => setNovoCmv(e.target.value)} 
                 disabled={isLimitReached}
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm disabled:opacity-50" 
               />
             </div>
             <div className="w-full md:w-48">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Vendas Projetadas (Mês)</label>
               <input 
                 type="number" 
                 placeholder="Ex: 100" 
                 value={vendasProjetadas} 
                 onChange={e => setVendasProjetadas(e.target.value)} 
                 disabled={isLimitReached}
                 className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50 text-sm disabled:opacity-50" 
               />
             </div>
             <div className="flex items-end gap-2">
               <button 
                 onClick={handleAdd} 
                 disabled={isLimitReached}
                 className="flex-1 flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors h-[38px] disabled:opacity-50"
               >
                 <Plus className="w-4 h-4 mr-1" /> Adicionar
               </button>
               
               <label
                 className={`flex-1 flex items-center justify-center border-2 border-dashed border-primary/50 text-primary bg-primary/5 px-4 py-2 rounded-md font-medium hover:bg-primary/10 hover:border-primary transition-all h-[38px] cursor-pointer ${isImporting || isLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Importar de Planilha (Excel)"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isImporting ? 'Importando...' : 'Importar Excel'}
                 <input 
                   type="file" 
                   accept=".xlsx,.xls" 
                   className="hidden" 
                   onChange={handleImportExcel}
                   disabled={isImporting || isLimitReached}
                 />
               </label>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Produto / Serviço</th>
                <th className="px-6 py-4">Custo Variável Unit. (R$)</th>
                <th className="px-6 py-4">Vendas Projetadas/Mês</th>
                <th className="px-6 py-4 w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {produtos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{p.nome}</td>
                  <td className="px-6 py-4 font-medium text-red-600">{formatCurrency(p.cmv)}</td>
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
                    Nenhum item cadastrado. Adicione seu primeiro produto ou serviço acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {produtos.length > 0 && (
            <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
              <button 
                onClick={handleClear}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isConfirmingClear 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                    : 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {isConfirmingClear ? 'Confirmar Exclusão?' : 'Limpar Todos os Produtos'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
