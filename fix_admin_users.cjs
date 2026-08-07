const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetUsersRoute = `app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const allUsers = await db.select().from(users);
  res.json(allUsers.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    plan: u.planId,
    createdAt: u.createdAt
  })));
});`;

const replacementUsersRoute = `import { desc } from "drizzle-orm";
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
  const allLeads = await db.select().from(leads);
  const phoneMap = new Map();
  allLeads.forEach(l => {
    if (l.email && l.phone) phoneMap.set(l.email.toLowerCase(), l.phone);
  });
  
  res.json(allUsers.map(u => ({
    name: u.name,
    email: u.email,
    phone: phoneMap.get(u.email.toLowerCase()) || '',
    role: u.role,
    plan: u.planId === 'free' ? '' : u.planId,
    createdAt: u.createdAt
  })));
});`;

code = code.replace(targetUsersRoute, replacementUsersRoute);
fs.writeFileSync('server.ts', code);
