const fs = require('fs');

// Fix CustosVariaveis.tsx: use crypto.randomUUID() instead of Date.now().toString()
let code = fs.readFileSync('src/pages/CustosVariaveis.tsx', 'utf8');
code = code.replace(
  'id: Date.now().toString(),',
  'id: crypto.randomUUID(),'
);
fs.writeFileSync('src/pages/CustosVariaveis.tsx', code);

// Fix CustosFixos.tsx
let cfCode = fs.readFileSync('src/pages/CustosFixos.tsx', 'utf8');
cfCode = cfCode.replace(
  'id: Date.now().toString(),',
  'id: crypto.randomUUID(),'
);
fs.writeFileSync('src/pages/CustosFixos.tsx', cfCode);

// Fix server.ts: handle delete with invalid uuid
let serverCode = fs.readFileSync('server.ts', 'utf8');
const deleteProductsRoute = `app.delete("/api/products/:id", requireUser, async (req: any, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) {
     // If it's not a valid UUID, just return success (likely a local-only sample item)
     return res.json({ success: true, warning: 'Invalid UUID format ignored' });
  }
  await db.delete(products).where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id)));
  res.json({ success: true });
});`;
serverCode = serverCode.replace(
  `app.delete("/api/products/:id", requireUser, async (req: any, res) => {
  await db.delete(products).where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id)));
  res.json({ success: true });
});`,
  deleteProductsRoute
);

const deleteFixedCostsRoute = `app.delete("/api/fixed-costs/:id", requireUser, async (req: any, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) {
     return res.json({ success: true, warning: 'Invalid UUID format ignored' });
  }
  await db.delete(fixedCosts).where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.currentUser.id)));
  res.json({ success: true });
});`;
serverCode = serverCode.replace(
  `app.delete("/api/fixed-costs/:id", requireUser, async (req: any, res) => {
  await db.delete(fixedCosts).where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.currentUser.id)));
  res.json({ success: true });
});`,
  deleteFixedCostsRoute
);

fs.writeFileSync('server.ts', serverCode);

