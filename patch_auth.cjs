const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const registerTarget = /const newUser = await db\.insert\(users\)\.values\(\{\n\s*name: parsed\.name,\n\s*email: parsed\.email,\n\s*passwordHash,\n\s*role: isBootstrapAdmin \? 'admin' : 'user',\n\s*planId: isBootstrapAdmin \? 'ilimitado' : 'free',\n\s*\}\)\.returning\(\);[\s\S]*?res\.json\(\{[\s\S]*?success: true,[\s\S]*?user: \{[\s\S]*?name: newUser\[0\]\.name,[\s\S]*?email: newUser\[0\]\.email,[\s\S]*?phone: parsed\.phone,[\s\S]*?role: newUser\[0\]\.role,[\s\S]*?plan: newUser\[0\]\.planId,[\s\S]*?productLimit: plan\.productLimit,[\s\S]*?\},[\s\S]*?\}\);/g;

const registerReplacement = `
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser = await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: isBootstrapAdmin ? 'admin' : 'user',
      planId: isBootstrapAdmin ? 'ilimitado' : 'free',
      verificationToken,
      isVerified: false
    }).returning();

    try {
      await db.insert(leads).values({ name: parsed.name, email: parsed.email, phone: parsed.phone });
    } catch (leadErr) {
      console.error("Erro ao registrar lead de cadastro:", leadErr);
    }

    try {
      await transporter.sendMail({
        from: \`\${process.env.SMTP_FROM_NAME || "Vírgula Contábil"} <\${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>\`,
        to: parsed.email,
        subject: "Código de Verificação",
        html: \`<p>Olá, \${parsed.name}.</p><p>Seu código de verificação é: <strong>\${verificationToken}</strong></p>\`,
      });
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de verificação:", mailErr);
    }

    res.json({
      success: true,
      requireVerification: true,
      email: parsed.email
    });
`;

code = code.replace(registerTarget, registerReplacement);

fs.writeFileSync('server.ts', code);
