import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Link inválido ou expirado.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('As senhas não coincidem.');
      return;
    }
    
    if (password.length < 6) {
      setStatus('error');
      setMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setMessage('Senha redefinida com sucesso!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Erro ao redefinir senha.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Erro na conexão com o servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        
        <h2 className="text-2xl font-serif text-center text-primary mb-6">
          Nova Senha
        </h2>
        
        {status === 'success' ? (
          <div className="flex flex-col items-center space-y-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-xl font-semibold text-foreground">Sucesso!</h2>
            <p className="text-muted-foreground">{message}</p>
            <button 
              onClick={() => navigate('/auth')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors mt-4"
            >
              Fazer Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nova Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={!token || status === 'loading'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Confirmar Nova Senha</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={!token || status === 'loading'}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={!token || status === 'loading'} 
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-4"
            >
              {status === 'loading' ? 'Aguarde...' : 'Redefinir Senha'}
            </button>
          </form>
        )}
        
        {status !== 'success' && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <button 
              type="button"
              onClick={() => navigate('/auth')}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
