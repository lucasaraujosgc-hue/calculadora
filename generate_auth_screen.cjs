const fs = require('fs');
const content = `import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

export default function AuthScreen() {
  const { login, setGuestMode } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [verificationCode, setVerificationCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isVerifying) {
       if (!email || !verificationCode) return setErrorMsg('Preencha o e-mail e o código');
       setIsLoading(true);
       try {
         const res = await fetch('/api/verify-code', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, code: verificationCode }),
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao verificar código');
         
         login(data.user, rememberMe);
         const origin = (location.state as any)?.from?.pathname || '/';
         navigate(origin);
       } catch (err: any) {
         setErrorMsg(err.message || 'Erro ao verificar código.');
       } finally {
         setIsLoading(false);
       }
       return;
    }

    if (isForgotPassword) {
       if (!email) return setErrorMsg('Preencha seu e-mail');
       setIsLoading(true);
       try {
         const res = await fetch('/api/forgot-password', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email }),
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao solicitar recuperação de senha');
         
         setSuccessMsg(data.message || 'Instruções enviadas para seu e-mail.');
         setIsForgotPassword(false);
       } catch (err: any) {
         setErrorMsg(err.message || 'Houve um erro ao solicitar a recuperação.');
       } finally {
         setIsLoading(false);
       }
       return;
    }
    
    if (isRegistering) {
       if (!name || !email || !phone || !password || !confirmPassword) return setErrorMsg('Preencha todos os campos');
       if (password.length < 6) return setErrorMsg('A senha deve ter pelo menos 6 caracteres');
       if (password !== confirmPassword) return setErrorMsg('As senhas não coincidem');

       setIsLoading(true);
       try {
         const res = await fetch('/api/register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name, email, phone, password }),
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao registrar');
         
         if (data.requireVerification) {
           setIsRegistering(false);
           setIsVerifying(true);
           setSuccessMsg('Um código foi enviado para o seu e-mail. Por favor, insira-o para continuar.');
         } else {
           login(data.user, rememberMe);
           const origin = (location.state as any)?.from?.pathname || '/';
           navigate(origin);
         }
       } catch (err: any) {
         setErrorMsg(err.message || 'Houve um erro ao realizar o cadastro.');
       } finally {
         setIsLoading(false);
       }
    } else {
       if (!email || !password) return setErrorMsg('Preencha e-mail e senha');
       
       setIsLoading(true);
       try {
         const res = await fetch('/api/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password }),
         });
         
         const data = await res.json();
         if (!res.ok) {
           if (data.requireVerification) {
             setIsVerifying(true);
             throw new Error('Você precisa verificar seu e-mail primeiro. Um código foi enviado no cadastro.');
           }
           throw new Error(data.error || 'Erro ao fazer login');
         }
         
         login(data.user, rememberMe);
         const origin = (location.state as any)?.from?.pathname || '/';
         navigate(origin);
       } catch (err: any) {
         setErrorMsg(err.message || 'Erro ao fazer login.');
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
          {isVerifying ? 'Verificar E-mail' : isForgotPassword ? 'Recuperar Senha' : (isRegistering ? 'Criar Conta' : 'Acessar Conta')}
        </h2>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-600 rounded-md text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-md text-sm font-medium">
            {successMsg}
          </div>
        )}
        
        <form onSubmit={handleAuth} className="space-y-4">
          {isVerifying ? (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
                <input 
                   type="email" 
                   value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 opacity-70"
                  placeholder="seu@email.com"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Código de Verificação</label>
                <input 
                   type="text" 
                   value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-center tracking-widest font-mono text-lg"
                  placeholder="000000"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Verifique sua caixa de entrada e spam.
                </p>
              </div>
            </>
          ) : isForgotPassword ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
              <input 
                 type="email" 
                 value={email}
                onChange={e => {setEmail(e.target.value); setErrorMsg('');}}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="seu@email.com"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enviaremos um link para o seu e-mail para que você possa redefinir sua senha.
              </p>
            </div>
          ) : (
            <>
              {isRegistering && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => {setName(e.target.value); setErrorMsg('');}}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                    <input 
                      type="text" 
                      value={phone}
                      onChange={e => {setPhone(e.target.value); setErrorMsg('');}}
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
                  onChange={e => {setEmail(e.target.value); setErrorMsg('');}}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="seu@email.com"
                />
              </div>

              {isRegistering ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                    <input 
                       type="password" 
                       value={password}
                      onChange={e => {setPassword(e.target.value); setErrorMsg('');}}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Confirmar Senha</label>
                    <input 
                       type="password" 
                       value={confirmPassword}
                      onChange={e => {setConfirmPassword(e.target.value); setErrorMsg('');}}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => {setPassword(e.target.value); setErrorMsg('');}}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="••••••••"
                  />
                  <div className="flex justify-end mt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </div>
              )}

              {!isRegistering && (
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
              )}
            </>
          )}
          
          <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isLoading ? 'Aguarde...' : (isVerifying ? 'Verificar Conta' : isForgotPassword ? 'Enviar Link' : (isRegistering ? 'Cadastrar' : 'Entrar'))}
          </button>
        </form>
        
        <div className="mt-6 flex flex-col items-center gap-4">
          {isVerifying ? (
            <button 
               type="button"
              onClick={() => {
                setIsVerifying(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          ) : isForgotPassword ? (
            <button 
               type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          ) : (
            <button 
               type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-sm text-primary hover:underline"
            >
              {isRegistering ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/AuthScreen.tsx', content);
