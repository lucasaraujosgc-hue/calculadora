const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const webhookStart = `    }

    const event = req.body;`;

const webhookNew = `    }

    const event = req.body;
    const eventId = event.id;

    if (eventId) {
      const webhookEvents = await getWebhookEvents();
      if (webhookEvents.find((e: any) => e.eventId === eventId)) {
        return res.json({ success: true, message: "Evento já processado." });
      }
      
      webhookEvents.push({
        id: crypto.randomUUID(),
        eventId: eventId,
        eventType: event.type,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });
      await saveWebhookEvents(webhookEvents);
    }
`;

code = code.replace(webhookStart, webhookNew);

const getStoreDefs = `async function getStore(key: string): Promise<any[]> {`;
if (!code.includes("getWebhookEvents()")) {
  const newDefs = `async function getWebhookEvents() { return await getStore('webhook_events'); }
async function saveWebhookEvents(events: any) { await saveStore('webhook_events', events); }
`;
  code = code.replace(/async function getCourses\(\)/, newDefs + "async function getCourses()");
}

fs.writeFileSync('server.ts', code);
