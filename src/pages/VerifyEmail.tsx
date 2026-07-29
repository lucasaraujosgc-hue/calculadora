import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando token...');
  const [user, setUser] = useState<{name: string, email: string} | null>(null);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token não encontrado.');
      return;
    }

    fetch(`/api/verify/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setStatus('form');
        } else {
          setStatus('error');
          setMessage(data.error || 'Token inválido ou expirado.');
        }
      })
      .catch(err => {
        console.error(err);
        setStatus('error');
        setMessage('Erro na conexão com o servidor.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return alert('As senhas não coincidem.');
    }
    if (password.length < 6) {
      return alert('A senha deve ter pelo menos 6 caracteres.');
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setMessage(data.message || 'Sua conta foi ativada com sucesso!');
      } else {
        alert(data.error || 'Erro ao ativar conta.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro na conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="bg-card border border-border p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-muted-foreground">{message}</p>
          </div>
        )}
        
        {status === 'form' && (
          <div className="flex flex-col text-left">
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Criar Senha</h2>
            <p className="text-muted-foreground text-center mb-6">
              Olá {user?.name}, defina sua senha para ativar sua conta.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Confirmar Senha</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar e Ativar Conta'}
              </button>
            </form>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-2xl font-bold text-foreground">Tudo Certo!</h2>
            <p className="text-muted-foreground">{message}</p>
            <Link to="/auth" className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors w-full">
              Fazer Login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold text-foreground">Oops!</h2>
            <p className="text-muted-foreground">{message}</p>
            <Link to="/auth" className="mt-4 px-6 py-2 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors w-full">
              Voltar ao Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
