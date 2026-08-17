import React, { useEffect, useState } from 'react';
import { Shield, Trash2, CheckCircle2, XCircle, UserCog, Settings, Plus, X, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function AdminPanel() {
  const { user } = useAppContext();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userCosts, setUserCosts] = useState<any[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [activeTab, setActiveTab] = useState<'produtos' | 'custos'>('produtos');

  const [novoProdNome, setNovoProdNome] = useState('');
  const [novoProdCmv, setNovoProdCmv] = useState('');
  const [novoProdVendas, setNovoProdVendas] = useState('');
  
  const [novoCustoNome, setNovoCustoNome] = useState('');
  const [novoCustoValor, setNovoCustoValor] = useState('');

  const [isConfirmingClearProducts, setIsConfirmingClearProducts] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);

  const openUserPanel = (u: any) => {
    setSelectedUser(u);
    setActiveTab('produtos');
    setIsConfirmingClearProducts(false);
    fetchUserData(u.id);
  };

  const fetchUserData = async (userId: string) => {
    setLoadingUserData(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}/products`),
        fetch(`/api/admin/users/${userId}/fixed-costs`)
      ]);
      if (pRes.ok) setUserProducts(await pRes.json());
      if (cRes.ok) setUserCosts(await cRes.json());
    } catch (err) {
      console.error(err);
    }
    setLoadingUserData(false);
  };

  const handleAddProduct = async () => {
    if (!novoProdNome || !novoProdCmv) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoProdNome,
          cmv: Number(novoProdCmv),
          vendasProjetadas: Number(novoProdVendas) || 0
        })
      });
      if (res.ok) {
        setNovoProdNome(''); setNovoProdCmv(''); setNovoProdVendas('');
        fetchUserData(selectedUser.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Excluir produto?')) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUserData(selectedUser.id);
    } catch (err) {}
  };

  const handleClearAllProducts = async () => {
    if (!isConfirmingClearProducts) {
      setIsConfirmingClearProducts(true);
      setTimeout(() => setIsConfirmingClearProducts(false), 3000);
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/products`, { method: 'DELETE' });
      if (res.ok) fetchUserData(selectedUser.id);
    } catch (err) {
      console.error(err);
    }
    setIsConfirmingClearProducts(false);
  };

  const handleImportProductsAdmin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    setIsImportingProducts(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/products/import`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Planilha importada: ${data.importedCount} produto(s) adicionados.${data.errors?.length ? ` ${data.errors.length} linha(s) com erro.` : ''}`);
        fetchUserData(selectedUser.id);
      } else {
        alert(data.error || 'Erro ao importar planilha.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao importar planilha.');
    } finally {
      setIsImportingProducts(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddCost = async () => {
    if (!novoCustoNome || !novoCustoValor) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/fixed-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoCustoNome,
          valor: Number(novoCustoValor)
        })
      });
      if (res.ok) {
        setNovoCustoNome(''); setNovoCustoValor('');
        fetchUserData(selectedUser.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCost = async (id: string) => {
    if (!window.confirm('Excluir custo?')) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/fixed-costs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUserData(selectedUser.id);
    } catch (err) {}
  };

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
          console.error("Failed to load users:", data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setUsers([]);
        setLoading(false);
      });
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Erro ao excluir usuário');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-primary flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Gerencie os usuários cadastrados na plataforma.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Usuários ({users.length})</h2>
          <button onClick={fetchUsers} className="text-sm text-primary hover:underline">Atualizar</button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando usuários...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Data de Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || '-'}</td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                          <XCircle className="w-3 h-3" /> Usuário
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== 'admin' ? (
                        <select 
                          value={u.plan || 'free'} 
                          onChange={async (e) => {
                            const newPlan = e.target.value;
                            try {
                              const res = await fetch(`/api/admin/users/${encodeURIComponent(u.email)}/plan`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ planId: newPlan })
                              });
                              if (res.ok) {
                                fetchUsers();
                                alert('Plano atualizado com sucesso.');
                              } else {
                                alert('Erro ao atualizar plano.');
                              }
                            } catch (err) {
                              alert('Erro de conexão.');
                            }
                          }}
                          className="text-sm border border-border rounded-md px-2 py-1 bg-background"
                        >
                          <option value="free">Sem Plano</option>
                          <option value="basico">Básico</option>
                          <option value="intermediario">Intermediário</option>
                          <option value="ilimitado">Ilimitado</option>
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground uppercase font-bold">Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                                            {u.role !== 'admin' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openUserPanel(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md flex items-center gap-1 text-xs font-medium"
                            title="Gerenciar Dados do Cliente"
                          >
                            <Settings className="w-4 h-4" /> Dados
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.email)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary"><UserCog className="w-5 h-5"/> Gerenciar Dados: {selectedUser.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-border bg-muted/30">
              <button 
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'produtos' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:bg-muted/50'}`}
                onClick={() => setActiveTab('produtos')}
              >
                Produtos ({userProducts.length})
              </button>
              <button 
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'custos' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:bg-muted/50'}`}
                onClick={() => setActiveTab('custos')}
              >
                Custos Fixos ({userCosts.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-card/30">
              {loadingUserData ? (
                <div className="py-12 text-center text-muted-foreground">Carregando dados...</div>
              ) : activeTab === 'produtos' ? (
                <div className="space-y-6">
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="text-sm font-semibold mb-3">Adicionar Novo Produto</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input placeholder="Nome do produto" className="col-span-2 border rounded-md px-3 py-2 text-sm bg-background" value={novoProdNome} onChange={e=>setNovoProdNome(e.target.value)}/>
                      <input placeholder="Custo (R$)" type="number" className="border rounded-md px-3 py-2 text-sm bg-background" value={novoProdCmv} onChange={e=>setNovoProdCmv(e.target.value)}/>
                      <input placeholder="Vendas/mês" type="number" className="border rounded-md px-3 py-2 text-sm bg-background" value={novoProdVendas} onChange={e=>setNovoProdVendas(e.target.value)}/>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button onClick={handleAddProduct} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2">
                        <Plus className="w-4 h-4"/> Salvar Produto
                      </button>
                      <label className={`flex items-center justify-center border-2 border-dashed border-primary/50 text-primary bg-primary/5 px-4 py-2 rounded-md font-medium hover:bg-primary/10 hover:border-primary transition-all text-sm cursor-pointer ${isImportingProducts ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Upload className="w-4 h-4 mr-2" />
                        {isImportingProducts ? 'Importando...' : 'Importar Excel'}
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportProductsAdmin} disabled={isImportingProducts} />
                      </label>
                    </div>
                  </div>
                  
                  <div className="border border-border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Nome</th>
                          <th className="px-4 py-3 font-medium text-right">Custo (R$)</th>
                          <th className="px-4 py-3 font-medium text-right">Vendas/Mês</th>
                          <th className="px-4 py-3 font-medium text-right">Preço de Venda (R$)</th>
                          <th className="px-4 py-3 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userProducts.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado para este usuário.</td></tr>
                        ) : userProducts.map(p => (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{p.nome}</td>
                            <td className="px-4 py-2 text-right">{(p.cmv||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                            <td className="px-4 py-2 text-right">{p.vendasProjetadas||0}</td>
                            <td className="px-4 py-2 text-right font-medium text-emerald-600">
                              {p.precoFixo > 0 ? p.precoFixo.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '-'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {userProducts.length > 0 && (
                      <div className="p-3 border-t border-border bg-muted/10 flex justify-end">
                        <button
                          onClick={handleClearAllProducts}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isConfirmingClearProducts
                              ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                              : 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                          {isConfirmingClearProducts ? 'Confirmar Exclusão?' : 'Limpar Todos os Produtos'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="text-sm font-semibold mb-3">Adicionar Custo Fixo</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input placeholder="Descrição do custo" className="col-span-2 border rounded-md px-3 py-2 text-sm bg-background" value={novoCustoNome} onChange={e=>setNovoCustoNome(e.target.value)}/>
                      <input placeholder="Valor (R$)" type="number" className="border rounded-md px-3 py-2 text-sm bg-background" value={novoCustoValor} onChange={e=>setNovoCustoValor(e.target.value)}/>
                    </div>
                    <button onClick={handleAddCost} className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2">
                      <Plus className="w-4 h-4"/> Salvar Custo
                    </button>
                  </div>
                  
                  <div className="border border-border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Descrição</th>
                          <th className="px-4 py-3 font-medium text-right">Valor (R$)</th>
                          <th className="px-4 py-3 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userCosts.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum custo cadastrado para este usuário.</td></tr>
                        ) : userCosts.map(c => (
                          <tr key={c.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{c.nome}</td>
                            <td className="px-4 py-2 text-right">{(c.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => handleDeleteCost(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}