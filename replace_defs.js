import fs from 'fs';

let code = fs.readFileSync('server.ts.new', 'utf-8');

const replacements = `
import { db } from "./src/db/index.js";
import { store } from "./src/db/schema.js";
import { eq, sql } from "drizzle-orm";

async function getStore(key) {
  try {
    const res = await db.select().from(store).where(eq(store.key, key));
    return res.length > 0 ? res[0].value : [];
  } catch(e) {
    console.error("DB Get Error", e);
    return [];
  }
}

async function saveStore(key, value) {
  try {
    await db.insert(store).values({ key, value }).onConflictDoUpdate({
      target: store.key,
      set: { value }
    });
  } catch(e) {
    console.error("DB Save Error", e);
  }
}

async function getUsers() { return await getStore('users'); }
async function saveUsers(users) { await saveStore('users', users); }
async function getCourses() { return await getStore('courses'); }
async function saveCourses(courses) { await saveStore('courses', courses); }
async function getLeads() { return await getStore('leads'); }
async function saveLeads(leads) { await saveStore('leads', leads); }
async function getPayments() { return await getStore('payments'); }
async function savePayments(payments) { await saveStore('payments', payments); }
async function getAllProducts() { return await getStore('products'); }
async function saveAllProducts(products) { await saveStore('products', products); }
async function getUserRealProducts(email) { return (await getAllProducts()).filter((p) => p.ownerEmail === email && !p.isSample); }
async function seedSampleProducts(email) {
  const products = await getAllProducts();
  const samples = [
    { name: "Cimento CP II 50 kg (exemplo)", costPrice: 32.20, salePrice: 42.0 },
    { name: "Tijolo Cerâmico 9x19x19 (exemplo)", costPrice: 0.87, salePrice: 1.50 },
    { name: "Argamassa AC-II 20 kg (exemplo)", costPrice: 19.30, salePrice: 28.0 },
    { name: "Tinta Acrílica Branca 18 L (exemplo)", costPrice: 172.50, salePrice: 240.0 },
    { name: "Tubo PVC Soldável 25 mm (3 m) (exemplo)", costPrice: 18.50, salePrice: 26.0 },
  ];
  samples.forEach(s => {
    products.push({ id: crypto.randomUUID(), ownerEmail: email, ...s, isSample: true, createdAt: new Date().toISOString() });
  });
  await saveAllProducts(products);
}
`;

// It's easier to just strip lines containing the old functions.
// But some of them are multiline.
// We can use a simpler replacement:
code = code.replace(/function getUsers\(\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function saveUsers\(users: any\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function getCourses\(\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function saveCourses\(courses: any\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function getLeads\(\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function saveLeads\(leads: any\) \{[\s\S]*?\}\n\n/g, '');
code = code.replace(/function getPayments\(\) \{[\s\S]*?\}\n/g, '');
code = code.replace(/function savePayments\(payments: any\) \{[\s\S]*?\}\n/g, '');
code = code.replace(/function getAllProducts\(\) \{[\s\S]*?\}\n/g, '');
code = code.replace(/function saveAllProducts\(products: any\) \{[\s\S]*?\}\n/g, '');
code = code.replace(/function getUserRealProducts\(email: string\) \{[\s\S]*?\}\n/g, '');
code = code.replace(/function seedSampleProducts\(email: string\) \{[\s\S]*?\}\n/g, '');

code = code.replace(/(import crypto from "crypto";\n)/, '$1\n' + replacements + '\n');

// Also, add the DB table initialization on startup:
code = code.replace(/app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{/g, 'app.listen(PORT, "0.0.0.0", async () => {\\n    await db.execute(sql`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);\\n');

fs.writeFileSync('server.ts.new2', code);
