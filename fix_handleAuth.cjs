const fs = require('fs');
let code = fs.readFileSync('src/pages/AuthScreen.tsx', 'utf8');

const target = `  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {`;

const replacement = `  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) {
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
    if (isForgotPassword) {`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/AuthScreen.tsx', code);
