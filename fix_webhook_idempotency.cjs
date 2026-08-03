const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// We need to add getWebhookEvents and saveWebhookEvents near the others
const getStoreDefs = `async function getStore(key: string): Promise<any[]> {`;
if (!code.includes("getWebhookEvents()")) {
  const newDefs = `async function getWebhookEvents() { return await getStore('webhook_events'); }
async function saveWebhookEvents(events: any) { await saveStore('webhook_events', events); }
`;
  code = code.replace(/async function getCourses\(\)/, newDefs + "async function getCourses()");
}

const webhookStart = `app.post("/api/webhook/pagarme", async (req: any, res) => {`;
const webhookNew = `app.post("/api/webhook/pagarme", async (req: any, res) => {
  try {
    const secret = process.env.PAGARME_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !secret) {
      console.error("PAGARME_WEBHOOK_SECRET não configurado em produção.");
      return res.status(500).json({ error: "Configuração do servidor inválida para processar webhooks." });
    }
    if (secret) {
      const signature = req.headers['x-hub-signature'] || req.headers['hub-signature'] || req.headers['x-pagarme-webhook-signature'];
      if (!signature) {
        return res.status(401).json({ error: "Assinatura ausente" });
      }
      const payload = req.rawBody || JSON.stringify(req.body);
      
      const sha1 = crypto.createHmac('sha1', secret).update(payload).digest('hex');
      const sha256 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      
      const isValid = signature === \`sha1=\${sha1}\` || 
                      signature === \`sha256=\${sha256}\` || 
                      signature === sha1 || 
                      signature === sha256;
                      
      if (!isValid) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }
    }
    
    // Idempotency check
    const eventId = req.body.id;
    if (eventId) {
      const webhookEvents = await getWebhookEvents();
      if (webhookEvents.find((e: any) => e.eventId === eventId)) {
        return res.json({ success: true, message: "Evento já processado." });
      }
      
      webhookEvents.push({
        id: crypto.randomUUID(),
        eventId: eventId,
        eventType: req.body.type,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });
      await saveWebhookEvents(webhookEvents);
    }
`;

// we need to replace the beginning of the webhook up to `const payload = req.rawBody`
// Let's just find the webhook route name from grep first.
