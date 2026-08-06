const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const loginTarget = /const match = await bcrypt\.compare\(parsed\.password, user\.passwordHash\);\n\s*if \(\!match\) return res\.status\(401\)\.json\(\{ error: "Credenciais inválidas\." \}\);\n\s*const token = jwt\.sign\(\{ email: user\.email, role: user\.role \}, JWT_SECRET as string, \{ expiresIn: "7d" \}\);/;

const loginReplacement = `const match = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Credenciais inválidas." });
    
    if (!user.isVerified) {
      return res.status(403).json({ error: "Conta não verificada", requireVerification: true, email: user.email });
    }

    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: "7d" });`;

code = code.replace(loginTarget, loginReplacement);

const verifyEndpoint = `
app.post("/api/verify-code", authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "E-mail e código são obrigatórios." });
    
    const userList = await db.select().from(users).where(eq(users.email, email));
    if (userList.length === 0) return res.status(400).json({ error: "Usuário não encontrado." });
    
    const user = userList[0];
    if (user.isVerified) return res.json({ success: true, message: "Conta já verificada." });
    
    if (user.verificationToken !== code) return res.status(400).json({ error: "Código inválido." });
    
    await db.update(users).set({ isVerified: true, verificationToken: null }).where(eq(users.id, user.id));
    
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: "7d" });
    res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    
    const plan = PLANS[user.planId as keyof typeof PLANS] || PLANS.basico;
    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        phone: "",
        role: user.role,
        plan: user.planId,
        productLimit: plan.productLimit,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erro interno", details: err.message });
  }
});
`;

code = code.replace('app.post("/api/forgot-password"', verifyEndpoint + '\napp.post("/api/forgot-password"');

fs.writeFileSync('server.ts', code);
