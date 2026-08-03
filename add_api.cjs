const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Products API extensions
const productsApi = `
app.put("/api/products/:id", requireUser, async (req: any, res: any) => {
  const products = await getAllProducts();
  const idx = products.findIndex((p: any) => p.id === req.params.id && p.ownerEmail === req.currentUser.email);
  if (idx === -1) return res.status(404).json({ error: "Produto não encontrado" });
  
  products[idx] = { ...products[idx], ...req.body, id: products[idx].id, ownerEmail: req.currentUser.email };
  await saveAllProducts(products);
  res.json({ success: true, product: products[idx] });
});

app.delete("/api/products/:id", requireUser, async (req: any, res: any) => {
  const products = await getAllProducts();
  const idx = products.findIndex((p: any) => p.id === req.params.id && p.ownerEmail === req.currentUser.email);
  if (idx === -1) return res.status(404).json({ error: "Produto não encontrado" });
  
  products.splice(idx, 1);
  await saveAllProducts(products);
  res.json({ success: true });
});
`;

if (!code.includes('app.put("/api/products/:id"')) {
  code = code.replace(/app\.get\("\/api\/products", requireUser, async \(req: any, res\) => \{[\s\S]*?\}\);/, match => match + '\n' + productsApi);
}

// Fixed Costs API
const fixedCostsDefs = `
async function getFixedCosts() { return await getStore('fixed_costs'); }
async function saveFixedCosts(costs: any) { await saveStore('fixed_costs', costs); }
`;
if (!code.includes('async function getFixedCosts()')) {
  code = code.replace(/async function getWebhookEvents\(\) \{/, fixedCostsDefs + "async function getWebhookEvents() {");
}

const fixedCostsApi = `
app.get("/api/fixed-costs", requireUser, async (req: any, res: any) => {
  const costs = await getFixedCosts();
  res.json(costs.filter((c: any) => c.ownerEmail === req.currentUser.email));
});

app.post("/api/fixed-costs", requireUser, async (req: any, res: any) => {
  const costs = await getFixedCosts();
  const newCost = { ...req.body, ownerEmail: req.currentUser.email, id: req.body.id || crypto.randomUUID() };
  costs.push(newCost);
  await saveFixedCosts(costs);
  res.json({ success: true, cost: newCost });
});

app.put("/api/fixed-costs/:id", requireUser, async (req: any, res: any) => {
  const costs = await getFixedCosts();
  const idx = costs.findIndex((c: any) => c.id === req.params.id && c.ownerEmail === req.currentUser.email);
  if (idx === -1) return res.status(404).json({ error: "Custo não encontrado" });
  
  costs[idx] = { ...costs[idx], ...req.body, id: costs[idx].id, ownerEmail: req.currentUser.email };
  await saveFixedCosts(costs);
  res.json({ success: true, cost: costs[idx] });
});

app.delete("/api/fixed-costs/:id", requireUser, async (req: any, res: any) => {
  const costs = await getFixedCosts();
  const idx = costs.findIndex((c: any) => c.id === req.params.id && c.ownerEmail === req.currentUser.email);
  if (idx === -1) return res.status(404).json({ error: "Custo não encontrado" });
  
  costs.splice(idx, 1);
  await saveFixedCosts(costs);
  res.json({ success: true });
});
`;

if (!code.includes('app.get("/api/fixed-costs"')) {
  code = code.replace(/app\.get\("\/api\/products", requireUser, async \(req: any, res\) => \{[\s\S]*?\}\);/, match => match + '\n' + fixedCostsApi);
}

fs.writeFileSync('server.ts', code);
