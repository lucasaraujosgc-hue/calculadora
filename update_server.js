const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const syncEndpoint = `
app.post("/api/products/sync", requireUser, async (req, res) => {
  let products = await getAllProducts();
  const userEmail = req.currentUser.email;
  
  // Remove existing real products for this user
  products = products.filter((p) => p.ownerEmail !== userEmail || p.isSample);
  
  // Check limit (only counting products in the array, excluding samples)
  const limit = req.currentUser.plan === 'ilimitado' ? Infinity : (req.currentUser.productLimit || 7);
  if (req.body.length > limit) {
    return res.status(403).json({ error: \`Limite de \${limit} produtos excedido.\` });
  }

  // Add the new products from the array
  const newProducts = req.body.map((p) => ({
    ...p,
    ownerEmail: userEmail,
    id: p.id || crypto.randomUUID()
  }));
  
  products.push(...newProducts);
  await saveAllProducts(products);
  res.json({ success: true, products: newProducts });
});
`;

if (!serverCode.includes("/api/products/sync")) {
  serverCode = serverCode.replace(
    'app.post("/api/products", requireUser, checkProductLimit, async (req: any, res) => {',
    syncEndpoint + '\napp.post("/api/products", requireUser, checkProductLimit, async (req: any, res) => {'
  );
  fs.writeFileSync('server.ts', serverCode);
  console.log('Added /api/products/sync');
} else {
  console.log('Already exists');
}
