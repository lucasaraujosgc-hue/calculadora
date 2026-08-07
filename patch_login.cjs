const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const userList = await db.select().from(users).where(eq(users.email, parsed.email));`;

const replacement = `app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);

    if (
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD &&
      parsed.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() &&
      parsed.password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ email: process.env.ADMIN_EMAIL, role: 'admin' }, JWT_SECRET as string, { expiresIn: "7d" });
      res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.json({
        success: true,
        user: {
          name: "Administrador",
          email: process.env.ADMIN_EMAIL,
          phone: "",
          role: "admin",
          plan: "ilimitado",
          productLimit: Infinity,
        },
      });
    }

    const userList = await db.select().from(users).where(eq(users.email, parsed.email));`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
