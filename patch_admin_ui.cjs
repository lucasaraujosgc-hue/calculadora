const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

// Update imports
if (!code.includes('import { Shield, Trash2, CheckCircle2, XCircle, X, Plus, UserCog, Edit, Settings } from "lucide-react";')) {
  code = code.replace(
    "import { Shield, Trash2, CheckCircle2, XCircle } from 'lucide-react';",
    "import { Shield, Trash2, CheckCircle2, XCircle, X, Plus, UserCog, Edit, Settings } from 'lucide-react';"
  );
}

const componentInjection = `
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userCosts, setUserCosts] = useState<any[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [activeTab, setActiveTab] = useState<'produtos' | 'custos'>('produtos');

  // Form states for adding
  const [novoProdNome, setNovoProdNome] = useState('');
  const [novoProdCmv, setNovoProdCmv] = useState('');
  const [novoProdVendas, setNovoProdVendas] = useState('');
  
  const [novoCustoNome, setNovoCustoNome] = useState('');
  const [novoCustoValor, setNovoCustoValor] = useState('');

  const openUserPanel = async (u: any) => {
    setSelectedUser(u);
    setActiveTab('produtos');
    fetchUserData(u.id);
  };

  const fetchUserData = async (userId: string) => {
    setLoadingUserData(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(\`/api/admin/users/\${userId}/products\`),
        fetch(\`/api/admin/users/\${userId}/fixed-costs\`)
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
      const res = await fetch(\`/api/admin/users/\${selectedUser.id}/products\`, {
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
    if (!confirm('Excluir produto?')) return;
    try {
      await fetch(\`/api/admin/users/\${selectedUser.id}/products/\${id}\`, { method: 'DELETE' });
      fetchUserData(selectedUser.id);
    } catch (err) {}
  };

  const handleAddCost = async () => {
    if (!novoCustoNome || !novoCustoValor) return;
    try {
      const res = await fetch(\`/api/admin/users/\${selectedUser.id}/fixed-costs\`, {
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
    if (!confirm('Excluir custo?')) return;
    try {
      await fetch(\`/api/admin/users/\${selectedUser.id}/fixed-costs/\${id}\`, { method: 'DELETE' });
      fetchUserData(selectedUser.id);
    } catch (err) {}
  };
`;

code = code.replace(
  'const fetchUsers = () => {',
  componentInjection + '\n  const fetchUsers = () => {'
);

const renderModal = `
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><UserCog className="w-5 h-5"/> Gerenciar Dados do Cliente</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedUser.name} ({selectedUser.email})</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-border bg-muted/30">
              <button 
                className={\`flex-1 py-3 text-sm font-medium \${activeTab === 'produtos' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:bg-muted/50'}\`}
                onClick={() => setActiveTab('produtos')}
              >
                Produtos (\${userProducts.length})
              </button>
              <button 
                className={\`flex-1 py-3 text-sm font-medium \${activeTab === 'custos' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:bg-muted/50'}\`}
                onClick={() => setActiveTab('custos')}
              >
                Custos Fixos (\${userCosts.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingUserData ? (
                <div className="py-12 text-center text-muted-foreground">Carregando dados...</div>
              ) : activeTab === 'produtos' ? (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="text-sm font-semibold mb-3">Adicionar Novo Produto</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input placeholder="Nome do produto" className="col-span-2 border rounded-md px-3 py-2 text-sm" value={novoProdNome} onChange={e=>setNovoProdNome(e.target.value)}/>
                      <input placeholder="Custo (R$)" type="number" className="border rounded-md px-3 py-2 text-sm" value={novoProdCmv} onChange={e=>setNovoProdCmv(e.target.value)}/>
                      <input placeholder="Vendas/mês" type="number" className="border rounded-md px-3 py-2 text-sm" value={novoProdVendas} onChange={e=>setNovoProdVendas(e.target.value)}/>
                    </div>
                    <button onClick={handleAddProduct} className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2">
                      <Plus className="w-4 h-4"/> Salvar Produto
                    </button>
                  </div>
                  
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 font-medium">Nome</th>
                          <th className="px-4 py-2 font-medium text-right">Custo (R$)</th>
                          <th className="px-4 py-2 font-medium text-right">Vendas/Mês</th>
                          <th className="px-4 py-2 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userProducts.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
                        ) : userProducts.map(p => (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{p.nome}</td>
                            <td className="px-4 py-2 text-right">{(p.cmv||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                            <td className="px-4 py-2 text-right">{p.vendasProjetadas||0}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="text-sm font-semibold mb-3">Adicionar Custo Fixo</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input placeholder="Descrição do custo" className="col-span-2 border rounded-md px-3 py-2 text-sm" value={novoCustoNome} onChange={e=>setNovoCustoNome(e.target.value)}/>
                      <input placeholder="Valor (R$)" type="number" className="border rounded-md px-3 py-2 text-sm" value={novoCustoValor} onChange={e=>setNovoCustoValor(e.target.value)}/>
                    </div>
                    <button onClick={handleAddCost} className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 flex items-center gap-2">
                      <Plus className="w-4 h-4"/> Salvar Custo
                    </button>
                  </div>
                  
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 font-medium">Descrição</th>
                          <th className="px-4 py-2 font-medium text-right">Valor (R$)</th>
                          <th className="px-4 py-2 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userCosts.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum custo cadastrado.</td></tr>
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
`;

code = code.replace(
  '          )}        </div>      </div>    </div>  );',
  '          )}        </div>      </div>' + renderModal + '    </div>  );'
);

// Add Manage button
const rowActions = `                      {u.role !== 'admin' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openUserPanel(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md flex items-center gap-1 text-xs font-medium"
                            title="Gerenciar Dados"
                          >
                            <Settings className="w-4 h-4" /> Dados
                          </button>
                          <button                             onClick={() => handleDeleteUser(u.email)}                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"                            title="Excluir Usuário"                          >                            <Trash2 className="w-4 h-4" />                          </button>
                        </div>
                      )}`;
                      
code = code.replace(
  `                      {u.role !== 'admin' && (                        <button                           onClick={() => handleDeleteUser(u.email)}                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"                          title="Excluir Usuário"                        >                          <Trash2 className="w-4 h-4" />                        </button>                      )}`,
  rowActions
);

// Wait, the current row action might be just the select + trash. Let's see what is inside the td.
fs.writeFileSync('patch_ui_output.js', code);
