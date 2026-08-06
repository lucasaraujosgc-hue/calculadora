const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const webhookRegex = /app\.post\("\/api\/webhooks\/pagarme", async \(req: any, res\) => \{[\s\S]*?(?=app\.post|\n$)/;
let webhookCode = code.match(webhookRegex)[0];

const newWebhookSignatureCheck = `      const signature = req.headers['x-hub-signature'] || req.headers['hub-signature'] || req.headers['x-pagarme-webhook-signature'];
      if (!signature) return res.status(401).json({ error: "Assinatura ausente" });
      const payload = req.rawBody || JSON.stringify(req.body);
      const parts = (signature as string).split("=");
      const providedSignature = parts.length > 1 ? parts[1] : parts[0];
      const expectedSignatureSha1 = crypto.createHmac("sha1", secret).update(payload).digest("hex");
      const expectedSignatureSha256 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (providedSignature !== expectedSignatureSha1 && providedSignature !== expectedSignatureSha256) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }`;

webhookCode = webhookCode.replace(/const signature = req\.headers\['x-hub-signature'\][\s\S]*?return res\.status\(401\)\.json\(\{ error: "Assinatura inválida" \}\);\n      \}/, newWebhookSignatureCheck + '\n    }');

// Insert email sending for ilimitado
const webhookPaidLogic = `          await db.update(users).set({ planId: payment.planId }).where(eq(users.id, payment.userId as any));`;
const webhookPaidLogicNew = `          await db.update(users).set({ planId: payment.planId }).where(eq(users.id, payment.userId as any));
          if (payment.planId === 'ilimitado') {
             try {
                const userList = await db.select().from(users).where(eq(users.id, payment.userId as any));
                if (userList.length > 0) {
                   console.log(\`✅ EMAIL ENVIADO (simulação) para vendas@virgulacontabil.com.br: O cliente \${userList[0].email} assinou o plano Ilimitado. Agende a call de consultoria.\`);
                }
             } catch (err) {}
          }`;

webhookCode = webhookCode.replace(webhookPaidLogic, webhookPaidLogicNew);

code = code.replace(webhookRegex, webhookCode);

// Add POST /api/checkout/upgrade
const checkoutRoute = `app.post("/api/checkout/upgrade", requireUser, async (req: any, res) => {
  const { planId } = req.body || {};
  const PLANS: Record<string, { name: string, priceCents: number }> = {
    basico: { name: "Básico", priceCents: 949 },
    intermediario: { name: "Intermediário", priceCents: 2749 },
    ilimitado: { name: "Ilimitado", priceCents: 5990 },
  };

  if (!planId || !(planId in PLANS)) {
    return res.status(400).json({ error: "Plano inválido." });
  }
  const plan = PLANS[planId];
  if (req.currentUser.planId === planId) {
    return res.status(400).json({ error: "Você já possui este plano." });
  }
  const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
  if (!PAGARME_SECRET_KEY) {
    return res.status(500).json({ error: "Pagamentos indisponíveis no momento." });
  }
  const PAGARME_API_URL = process.env.PAGARME_API_URL || 'https://api.pagar.me/core/v5';

  const orderCode = \`PAY-\${crypto.randomUUID()}\`;
  const [payment] = await db.insert(payments).values({
    userId: req.currentUser.id, planId, status: "pending", amount: plan.priceCents / 100, orderCode
  }).returning();

  const linkResponse = await fetch(\`\${PAGARME_API_URL}/paymentlinks\`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(\`\${PAGARME_SECRET_KEY}:\`).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "calculadora-virgula/1.0"
    },
    body: JSON.stringify({
      type: "order",
      order_code: orderCode,
      max_paid_sessions: 1,
      payment_settings: { 
        accepted_payment_methods: ["credit_card", "pix"],
        pix: { expires_in: 3600 }
      },
      cart_settings: { items: [{ name: \`Plano \${plan.name} - Calculadora Vírgula Contábil\`, amount: plan.priceCents, default_quantity: 1 }] },
      checkout_settings: {
        success_url: process.env.FRONTEND_URL ? \`\${process.env.FRONTEND_URL}/auth\` : 'http://localhost:3000/auth'
      }
    })
  });

  const linkData = await linkResponse.json();
  if (!linkResponse.ok || !linkData.url) {
    await db.update(payments).set({ status: "error" }).where(eq(payments.id, payment.id as any));
    return res.status(502).json({ error: "Não foi possível iniciar o pagamento. Tente novamente." });
  }
  await db.update(payments).set({ paymentLinkId: linkData.id }).where(eq(payments.id, payment.id as any));
  res.json({ url: linkData.url });
});

`;

code = code.replace('app.post("/api/webhooks/pagarme"', checkoutRoute + 'app.post("/api/webhooks/pagarme"');

fs.writeFileSync('server.ts', code);
