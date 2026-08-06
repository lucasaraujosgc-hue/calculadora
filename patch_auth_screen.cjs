const fs = require('fs');
let code = fs.readFileSync('src/pages/AuthScreen.tsx', 'utf8');

// We need to add state for verification flow
const statesTarget = `  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);`;

const statesReplacement = `  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);`;

code = code.replace(statesTarget, statesReplacement);

const handleAuthTarget = `    if (isForgotPassword) {
       if (!email) return alert('Informe seu e-mail');`;

const handleAuthReplacement = `    if (isVerifying) {
       if (!email || !verificationCode) return alert('Preencha o e-mail e o código');
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
         alert(err.message || 'Erro ao verificar código.');
       } finally {
         setIsLoading(false);
       }
       return;
    }

    if (isForgotPassword) {
       if (!email) return alert('Informe seu e-mail');`;

code = code.replace(handleAuthTarget, handleAuthReplacement);

const registerValTarget = `       if (!name || !email || !phone || !password) return alert('Preencha todos os campos');
       if (password.length < 6) return alert('A senha deve ter pelo menos 6 caracteres');`;

const registerValReplacement = `       if (!name || !email || !phone || !password || !confirmPassword) return alert('Preencha todos os campos');
       if (password.length < 6) return alert('A senha deve ter pelo menos 6 caracteres');
       if (password !== confirmPassword) return alert('As senhas não coincidem');`;

code = code.replace(registerValTarget, registerValReplacement);

const registerResTarget = `         login(data.user, rememberMe);
         const origin = (location.state as any)?.from?.pathname || '/';
         navigate(origin);`;

const registerResReplacement = `         if (data.requireVerification) {
           setIsRegistering(false);
           setIsVerifying(true);
           alert('Um código foi enviado para o seu e-mail. Por favor, insira-o para continuar.');
         } else {
           login(data.user, rememberMe);
           const origin = (location.state as any)?.from?.pathname || '/';
           navigate(origin);
         }`;

code = code.replace(registerResTarget, registerResReplacement);

const loginResTarget = `         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');`;

const loginResReplacement = `         const data = await res.json();
         if (!res.ok) {
           if (data.requireVerification) {
             setIsVerifying(true);
             throw new Error('Você precisa verificar seu e-mail primeiro. Um código foi enviado no cadastro.');
           }
           throw new Error(data.error || 'Erro ao fazer login');
         }`;

code = code.replace(loginResTarget, loginResReplacement);

const jsxHeaderTarget = `        <h2 className="text-2xl font-serif text-center text-primary mb-6">
          {isForgotPassword ? 'Recuperar Senha' : (isRegistering ? 'Criar Conta' : 'Acessar Conta')}
        </h2>`;

const jsxHeaderReplacement = `        <h2 className="text-2xl font-serif text-center text-primary mb-6">
          {isVerifying ? 'Verificar E-mail' : isForgotPassword ? 'Recuperar Senha' : (isRegistering ? 'Criar Conta' : 'Acessar Conta')}
        </h2>`;

code = code.replace(jsxHeaderTarget, jsxHeaderReplacement);

const formTarget = `          {isForgotPassword ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
              <input 
                 type="email" 
                 value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="seu@email.com"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enviaremos um link para o seu e-mail para que você possa redefinir sua senha.
              </p>
            </div>
          ) : (
            <>`;

const formReplacement = `          {isVerifying ? (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
                <input 
                   type="email" 
                   value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="seu@email.com"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enviaremos um link para o seu e-mail para que você possa redefinir sua senha.
              </p>
            </div>
          ) : (
            <>`;

code = code.replace(formTarget, formReplacement);

const pwdTarget = `              {isRegistering && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                  <input 
                     type="password" 
                     value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
              )}`;

const pwdReplacement = `              {isRegistering && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                    <input 
                       type="password" 
                       value={password}
                      onChange={e => setPassword(e.target.value)}
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
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Repita sua senha"
                      minLength={6}
                    />
                  </div>
                </>
              )}`;

code = code.replace(pwdTarget, pwdReplacement);

const btnTarget = `          <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isLoading ? 'Aguarde...' : (isForgotPassword ? 'Enviar Link' : (isRegistering ? 'Cadastrar' : 'Entrar'))}
          </button>`;

const btnReplacement = `          <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isLoading ? 'Aguarde...' : (isVerifying ? 'Verificar Conta' : isForgotPassword ? 'Enviar Link' : (isRegistering ? 'Cadastrar' : 'Entrar'))}
          </button>`;

code = code.replace(btnTarget, btnReplacement);

const backTarget = `          {isForgotPassword ? (
            <button 
               type="button"
              onClick={() => setIsForgotPassword(false)}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          ) : (`;

const backReplacement = `          {isVerifying ? (
            <button 
               type="button"
              onClick={() => setIsVerifying(false)}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          ) : isForgotPassword ? (
            <button 
               type="button"
              onClick={() => setIsForgotPassword(false)}
              className="text-sm text-primary hover:underline"
            >
              Voltar para o login
            </button>
          ) : (`;

code = code.replace(backTarget, backReplacement);

fs.writeFileSync('src/pages/AuthScreen.tsx', code);
