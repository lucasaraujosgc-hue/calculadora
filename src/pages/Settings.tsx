import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, Mail, Phone, Lock, Save, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

export default function Settings() {
  const { user, isGuest, salvarDocumentoEmpresa } = useAppContext();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // CNPJ/CPF da empresa — é ele que separa compra de venda na importação de XML.
  const [taxId, setTaxId] = useState(user?.taxId || '');
  const [taxStatus, setTaxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [taxMessage, setTaxMessage] = useState('');

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

  const handleSalvarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitos = taxId.replace(/\D/g, '');
    if (digitos.length !== 11 && digitos.length !== 14) {
      setTaxStatus('error');
      setTaxMessage('Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).');
      return;
    }
    setTaxStatus('loading');
    try {
      await salvarDocumentoEmpresa(digitos);
      setTaxStatus('success');
      setTaxMessage('Documento salvo. Agora você já pode importar os XMLs das suas notas.');
    } catch (err: any) {
      setTaxStatus('error');
      setTaxMessage(err.message || 'Erro ao salvar o documento.');
    }
  };

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

            <form onSubmit={handleSalvarDocumento} className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-muted-foreground mb-1">CNPJ ou CPF da empresa</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 px-3 py-2 border border-border rounded-md flex-1 bg-background focus-within:ring-2 focus-within:ring-primary/50">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={taxId}
                    onChange={e => { setTaxId(e.target.value); setTaxStatus('idle'); }}
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-transparent outline-none font-medium text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={taxStatus === 'loading'}
                  className="shrink-0 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {taxStatus === 'loading' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                É por ele que o sistema separa, nos XMLs que você importar na aba Produtos, o que é compra do que é venda.
              </p>
              {taxStatus === 'success' && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 mt-2 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />{taxMessage}
                </p>
              )}
              {taxStatus === 'error' && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mt-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{taxMessage}
                </p>
              )}
            </form>
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
