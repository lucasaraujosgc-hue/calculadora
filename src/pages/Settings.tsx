import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, Mail, Phone, Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { user, isGuest } = useAppContext();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (isGuest || !user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh]">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-6">Você está navegando como visitante. Crie uma conta para acessar esta área.</p>
        <a href="/auth" className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
          Fazer Cadastro / Login
        </a>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('A nova senha e a confirmação não coincidem.');
      return;
    }
    
    if (newPassword.length < 6) {
      setStatus('error');
      setMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email, 
          currentPassword, 
          newPassword 
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus('success');
        setMessage('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Erro ao alterar a senha.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Erro na conexão com o servidor.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Minha Conta</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Dados Pessoais */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Dados Pessoais
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Nome Completo</label>
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 border border-border rounded-md">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user.name}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">E-mail</label>
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 border border-border rounded-md">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Telefone</label>
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 border border-border rounded-md">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user.phone || 'Não informado'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Alterar Senha
            </h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}
              
              {status === 'success' && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Senha Atual</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nova Senha</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/50"
                  required
                  minLength={6}
                />
              </div>

              <button 
                type="submit" 
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-4"
              >
                {status === 'loading' ? (
                  'Salvando...'
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Nova Senha
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
