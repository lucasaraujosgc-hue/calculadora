const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const jwtValidation = `
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET.");
}
`;

code = code.replace('dotenv.config();', jwtValidation);
code = code.replace(/process\.env\.JWT_SECRET\s*\|\|\s*"default-secret"/g, 'JWT_SECRET');

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
