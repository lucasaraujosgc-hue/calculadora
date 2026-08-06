const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldRegister = `const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().min(8), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });`;

const newRegister = `const registerSchema = z.object({ name: z.string().min(2, "Nome muito curto"), email: z.string().email("E-mail inválido"), phone: z.string().min(8, "Telefone muito curto"), password: z.string().min(6, "Senha muito curta") });
const loginSchema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Senha obrigatória") });`;

code = code.replace(oldRegister, newRegister);

code = code.replace(/res\.status\(400\)\.json\(\{ error: "Dados inválidos", details: err\.errors \}\);/g, `const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : "Dados inválidos";
    res.status(400).json({ error: msgs, details: err.errors });`);

fs.writeFileSync('server.ts', code);
