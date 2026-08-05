import React, { useEffect, useState } from 'react';
import { Shield, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function AdminPanel() {
  const { user } = useAppContext();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
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
                          value={u.plan || ''} 
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
                          <option value="">Sem Plano</option>
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
                        <button 
                          onClick={() => handleDeleteUser(u.email)}
                          className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
