import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando seu e-mail...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token não encontrado.');
      return;
    }

    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Sua conta foi ativada com sucesso!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Erro ao verificar e-mail.');
        }
      })
      .catch(err => {
        console.error(err);
        setStatus('error');
        setMessage('Erro na conexão com o servidor.');
      });
  }, [token]);

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
