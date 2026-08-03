const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const webhookOld = `    const secret = process.env.PAGARME_WEBHOOK_SECRET;
    if (secret) {`;

const webhookNew = `    const secret = process.env.PAGARME_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !secret) {
      console.error("PAGARME_WEBHOOK_SECRET não configurado em produção.");
      return res.status(500).json({ error: "Configuração do servidor inválida para processar webhooks." });
    }
    if (secret) {`;

code = code.replace(webhookOld, webhookNew);
fs.writeFileSync('server.ts', code);
