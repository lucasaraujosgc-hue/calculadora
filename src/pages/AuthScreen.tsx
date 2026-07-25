import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

export default function AuthScreen() {
  const { login, setGuestMode } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
       if (!name || !email || !phone || !password) return alert('Preencha todos os campos');
       
       setIsLoading(true);
       try {
         const res = await fetch('/api/register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name, email, phone, password }),
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao registrar');
         
         alert(data.message || 'Verifique seu e-mail para ativar a conta.');
         setIsRegistering(false); // go back to login view
       } catch (err: any) {
         alert(err.message || 'Houve um erro ao realizar o cadastro.');
         console.error(err);
       } finally {
         setIsLoading(false);
       }
    } else {
       if (!email || !password) return alert('Preencha e-mail e senha');
       
       setIsLoading(true);
       try {
         const res = await fetch('/api/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password }),
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
         
         login(data.user, rememberMe);
         const origin = (location.state as any)?.from?.pathname || '/';
         navigate(origin);
       } catch (err: any) {
         alert(err.message || 'Erro ao fazer login.');
         console.error(err);
       } finally {
         setIsLoading(false);
       }
    }
  };

  const handleGuest = () => {
    setGuestMode(true);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        
        <h2 className="text-2xl font-serif text-center text-primary mb-6">
          {isRegistering ? 'Criar Conta' : 'Acessar Conta'}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {isRegistering && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="seu@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="rememberMe" 
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
            />
            <label htmlFor="rememberMe" className="text-sm font-medium text-foreground">
              Manter-se conectado
            </label>
          </div>
          
          <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isLoading ? 'Aguarde...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>
        
        <div className="mt-6 flex flex-col items-center gap-4">
          <button 
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-primary hover:underline"
          >
            {isRegistering ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}
