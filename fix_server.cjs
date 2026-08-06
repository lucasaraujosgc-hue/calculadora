const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix duplicated PLANS in /api/checkout/upgrade
const duplicatePlansRegex = /const PLANS: Record<string, \{ name: string, priceCents: number \}> = \{\n    basico: \{ name: "Básico", priceCents: 949 \},\n    intermediario: \{ name: "Intermediário", priceCents: 2749 \},\n    ilimitado: \{ name: "Ilimitado", priceCents: 5990 \},\n  \};\n\n  if \(!planId \|\| !\(planId in PLANS\)\) \{\n    return res\.status\(400\)\.json\(\{ error: "Plano inválido\." \}\);\n  \}\n  const plan = PLANS\[planId\];/g;
const duplicatePlansReplacement = `if (!planId || !(planId in PLANS)) {
    return res.status(400).json({ error: "Plano inválido." });
  }
  const plan = PLANS[planId as keyof typeof PLANS];`;
code = code.replace(duplicatePlansRegex, duplicatePlansReplacement);

// 2. Fix pix -> pix_settings
code = code.replace(/pix: \{ expires_in: 3600 \}/g, 'pix_settings: { expires_in: 3600 }');

// 3. Fix sha1/sha256 webhook validation
const webhookValidationRegex = /const expectedSignature = crypto\.createHmac\("sha1", secret\)\.update\(payload\)\.digest\("hex"\);\n      if \(providedSignature !== expectedSignature\) return res\.status\(401\)\.json\(\{ error: "Assinatura inválida" \}\);/g;
const webhookValidationReplacement = `const expectedSignatureSha1 = crypto.createHmac("sha1", secret).update(payload).digest("hex");
      const expectedSignatureSha256 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (providedSignature !== expectedSignatureSha1 && providedSignature !== expectedSignatureSha256) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }`;
code = code.replace(webhookValidationRegex, webhookValidationReplacement);

// 4. Fix email for ilimitado
const emailLogRegex = /console\.log\(\`✅ EMAIL ENVIADO \(simulação\) para vendas@virgulacontabil\.com\.br: O cliente \$\{userList\[0\]\.email\} assinou o plano Ilimitado\. Agende a call de consultoria\.\`\);/g;
const emailLogReplacement = `const salesEmail = process.env.SALES_TEAM_EMAIL || 'vendas@virgulacontabil.com.br';
                   await transporter.sendMail({
                     from: \`\${process.env.SMTP_FROM_NAME || "Vírgula Contábil"} <\${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>\`,
                     to: salesEmail,
                     subject: "Novo Plano Ilimitado - Agendar Consultoria",
                     html: \`<p>O cliente <strong>\${userList[0].name}</strong> (\${userList[0].email}) acabou de assinar o plano Ilimitado.</p><p>Por favor, entre em contato para agendar a call de consultoria.</p>\`
                   });
                   console.log(\`✅ E-mail real enviado para \${salesEmail} sobre o novo assinante Ilimitado.\`);`;
code = code.replace(emailLogRegex, emailLogReplacement);

fs.writeFileSync('server.ts', code);
