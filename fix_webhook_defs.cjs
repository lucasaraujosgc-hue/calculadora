const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newDefs = `
async function getWebhookEvents() { return await getStore('webhook_events'); }
async function saveWebhookEvents(events: any) { await saveStore('webhook_events', events); }
`;
if (!code.includes("async function getWebhookEvents()")) {
  code = code.replace(/async function getUsers\(\)/, newDefs + "async function getUsers()");
}

fs.writeFileSync('server.ts', code);
