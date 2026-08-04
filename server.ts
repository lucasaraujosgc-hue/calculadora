import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./src/db/index.js";
import { users, products, fixedCosts, payments, courses, leads, webhookEvents } from "./src/db/schema.js";
import { eq, and } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET.");
}

const app = express();
const PORT = 3000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas, tente novamente mais tarde." }
});

app.use(express.json({ 
  limit: "1mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(cookieParser());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const PLANS = {
  basico: { id: "basico", name: "Básico", priceCents: 949, productLimit: 20, excelImport: false, consultingCall: false },
  intermediario: { id: "intermediario", name: "Intermediário", priceCents: 2749, productLimit: 80, excelImport: true, consultingCall: false },
  ilimitado: { id: "ilimitado", name: "Ilimitado", priceCents: 5990, productLimit: Number.MAX_SAFE_INTEGER, excelImport: true, consultingCall: true }
} as const;
export type PlanId = keyof typeof PLANS;

async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    jwt.verify(token, JWT_SECRET as string);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

async function requireUser(req: any, res: any, next: any) {
  const token = req.cookies.user_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET as string);
    const userList = await db.select().from(users).where(eq(users.email, payload.email));
    if (userList.length === 0) return res.status(401).json({ error: "Usuário não encontrado" });
    req.currentUser = userList[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

app.get("/api/admin/courses", requireAuth, async (req, res) => {
  const allCourses = await db.select().from(courses);
  res.json(allCourses);
});
app.post("/api/admin/courses", requireAuth, async (req, res) => {
  const newCourse = req.body;
  const inserted = await db.insert(courses).values({
    title: newCourse.courseName || newCourse.title,
    description: newCourse.description || "",
    videoUrl: newCourse.videoUrl || "",
    thumbnailUrl: newCourse.thumbnailUrl || null
  }).returning();
  res.json(inserted[0]);
});
app.put("/api/admin/courses/:id", requireAuth, async (req, res) => {
  const updated = await db.update(courses)
    .set({
      title: req.body.courseName || req.body.title,
      description: req.body.description,
      videoUrl: req.body.videoUrl,
      thumbnailUrl: req.body.thumbnailUrl
    })
    .where(eq(courses.id, req.params.id as any)).returning();
  if (updated.length > 0) res.json(updated[0]);
  else res.status(404).json({ error: "Course not found" });
});
app.delete("/api/admin/courses/:id", requireAuth, async (req, res) => {
  await db.delete(courses).where(eq(courses.id, req.params.id as any));
  res.json({ success: true });
});

app.get("/api/admin/leads", requireAuth, async (req, res) => {
  const allLeads = await db.select().from(leads);
  res.json(allLeads);
});

app.get("/api/courses", async (req, res) => {
  const allCourses = await db.select().from(courses);
  res.json(allCourses);
});
app.get("/api/courses/:id", async (req, res) => {
  const courseList = await db.select().from(courses).where(eq(courses.id, req.params.id as any));
  if (courseList.length > 0) res.json(courseList[0]);
  else res.status(404).json({ error: "Course not found" });
});
app.post("/api/leads", async (req, res) => {
  const newLead = await db.insert(leads).values({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone
  }).returning();
  res.json(newLead[0]);
});

const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().min(8), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await db.select().from(users).where(eq(users.email, parsed.email));
    if (existing.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const newUser = await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: 'user',
      planId: 'free',
    }).returning();
    const token = jwt.sign({ email: newUser[0].email, role: 'user' }, JWT_SECRET as string, { expiresIn: "7d" });
    res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, email: newUser[0].email, plan: newUser[0].planId });
  } catch (err: any) {
    res.status(400).json({ error: "Dados inválidos", details: err.errors });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const userList = await db.select().from(users).where(eq(users.email, parsed.email));
    if (userList.length === 0) return res.status(401).json({ error: "Credenciais inválidas." });
    const user = userList[0];
    const match = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Credenciais inválidas." });
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: "7d" });
    res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, email: user.email, plan: user.planId });
  } catch (err: any) {
    res.status(400).json({ error: "Dados inválidos", details: err.errors });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("user_token");
  res.json({ success: true });
});

app.get("/api/me", requireUser, (req: any, res) => {
  res.json({ email: req.currentUser.email, name: req.currentUser.name, plan: req.currentUser.planId, role: req.currentUser.role, id: req.currentUser.id });
});

app.get("/api/fixed-costs", requireUser, async (req: any, res) => {
  const costs = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, req.currentUser.id));
  res.json(costs);
});
app.post("/api/fixed-costs", requireUser, async (req: any, res) => {
  const newCost = await db.insert(fixedCosts).values({
    userId: req.currentUser.id,
    name: req.body.name || req.body.nome,
    amount: req.body.amount || req.body.valor || 0
  }).returning();
  res.json({ success: true, cost: newCost[0] });
});
app.put("/api/fixed-costs/:id", requireUser, async (req: any, res) => {
  const updated = await db.update(fixedCosts)
    .set({
      name: req.body.name || req.body.nome,
      amount: req.body.amount || req.body.valor
    })
    .where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.currentUser.id))).returning();
  if (updated.length > 0) res.json({ success: true, cost: updated[0] });
  else res.status(404).json({ error: "Custo não encontrado" });
});
app.delete("/api/fixed-costs/:id", requireUser, async (req: any, res) => {
  await db.delete(fixedCosts).where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.currentUser.id)));
  res.json({ success: true });
});

async function checkProductLimit(req: any, res: any, next: any) {
  const plan = PLANS[req.currentUser.planId as PlanId] || PLANS.basico;
  const userProducts = await db.select().from(products).where(and(eq(products.userId, req.currentUser.id), eq(products.isSample, false)));
  if (userProducts.length >= plan.productLimit) {
    return res.status(403).json({ error: `Limite do plano atingido (${plan.productLimit} produtos). Faço o upgrade para cadastrar mais.` });
  }
  next();
}

app.get("/api/products", requireUser, async (req: any, res) => {
  const myProducts = await db.select().from(products).where(eq(products.userId, req.currentUser.id));
  res.json(myProducts);
});

app.post("/api/products/sync", requireUser, async (req: any, res) => {
  try {
    const incomingProducts = req.body;
    if (!Array.isArray(incomingProducts)) {
      return res.status(400).json({ error: "Invalid data format" });
    }
    
    await db.transaction(async (tx: any) => {
      await tx.delete(products).where(and(eq(products.userId, req.currentUser.id), eq(products.isSample, false)));
      
      for (const p of incomingProducts) {
        await tx.insert(products).values({
          userId: req.currentUser.id,
          name: p.nome || p.name,
          costPrice: p.custo || p.costPrice || 0,
          salePrice: p.precoVenda || p.salePrice || 0,
          projectedSales: p.vendasProjetadas || p.projectedSales || 0,
          isSample: false
        });
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao sincronizar produtos" });
  }
});

app.post("/api/products", requireUser, checkProductLimit, async (req: any, res) => {
  const newProduct = await db.insert(products).values({
    userId: req.currentUser.id,
    name: req.body.name,
    costPrice: req.body.costPrice || req.body.custo || 0,
    salePrice: req.body.salePrice || req.body.precoVenda || 0,
    projectedSales: req.body.projectedSales || req.body.vendasProjetadas || 0,
    isSample: false
  }).returning();
  res.json({ success: true, product: newProduct[0] });
});
app.put("/api/products/:id", requireUser, async (req: any, res) => {
  const updated = await db.update(products)
    .set({
      name: req.body.name,
      costPrice: req.body.costPrice,
      salePrice: req.body.salePrice,
      projectedSales: req.body.projectedSales
    })
    .where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id))).returning();
  if (updated.length > 0) res.json({ success: true, product: updated[0] });
  else res.status(404).json({ error: "Produto não encontrado" });
});
app.delete("/api/products/:id", requireUser, async (req: any, res) => {
  await db.delete(products).where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id)));
  res.json({ success: true });
});

async function requireExcelImport(req: any, res: any, next: any) {
  const plan = PLANS[req.currentUser.planId as PlanId] || PLANS.basico;
  if (!plan.excelImport) {
    return res.status(403).json({ error: "Seu plano atual não permite importação via Excel." });
  }
  next();
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post("/api/products/import", requireUser, requireExcelImport, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    const userProducts = await db.select().from(products).where(and(eq(products.userId, req.currentUser.id), eq(products.isSample, false)));
    const plan = PLANS[req.currentUser.planId as PlanId] || PLANS.basico;
    
    const validRows: any[] = [];
    const errors: any[] = [];
    rows.forEach((row, i) => {
      const nome = row.nome || row.Nome || row.produto || row.Produto;
      const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo;
      const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;
      if (!nome || precoCusto == null || isNaN(Number(precoCusto))) {
        errors.push({ linha: i + 2, motivo: "Faltando nome ou preço de custo inválido" });
        return;
      }
      validRows.push({nome, precoCusto, precoVenda});
    });
    
    if (userProducts.length + validRows.length > plan.productLimit) {
      return res.status(403).json({
        error: `Limite excedido. Você possui ${userProducts.length} produtos de um limite de ${plan.productLimit}. A planilha contém ${validRows.length} produtos válidos.`
      });
    }
    
    const imported = [];
    for (const row of validRows) {
      const inserted = await db.insert(products).values({
        userId: req.currentUser.id,
        name: row.nome,
        costPrice: Number(row.precoCusto),
        salePrice: row.precoVenda != null ? Number(row.precoVenda) : 0,
        isSample: false
      }).returning();
      imported.push(inserted[0]);
    }
    res.json({ success: true, importedCount: imported.length, imported, errors });
  } catch (error) {
    console.error("Erro ao importar planilha:", error);
    res.status(500).json({ error: "Erro ao processar a planilha." });
  }
});

app.post("/api/webhooks/pagarme", async (req: any, res) => {
  try {
    const secret = process.env.PAGARME_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !secret) {
      console.error("PAGARME_WEBHOOK_SECRET não configurado em produção.");
      return res.status(500).json({ error: "Configuração do servidor inválida para processar webhooks." });
    }
    if (secret) {
      const signature = req.headers['x-hub-signature'] || req.headers['hub-signature'] || req.headers['x-pagarme-webhook-signature'];
      if (!signature) return res.status(401).json({ error: "Assinatura ausente" });
      const payload = req.rawBody || JSON.stringify(req.body);
      const parts = (signature as string).split("=");
      const providedSignature = parts.length > 1 ? parts[1] : parts[0];
      const expectedSignature = crypto.createHmac("sha1", secret).update(payload).digest("hex");
      if (providedSignature !== expectedSignature) return res.status(401).json({ error: "Assinatura inválida" });
    }

    const event = req.body;
    const eventId = event.id;

    if (eventId) {
      const existing = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId));
      if (existing.length > 0 && existing[0].status === "processed") {
        return res.json({ success: true, message: "Evento já processado." });
      }
      if (existing.length === 0) {
        await db.insert(webhookEvents).values({
          eventId,
          eventType: event.type,
          status: 'pending'
        });
      }
    }

    if (event.type === "order.paid") {
      const orderCode = event.data?.code;
      if (orderCode) {
        const paymentList = await db.select().from(payments).where(eq(payments.orderCode, orderCode));
        if (paymentList.length > 0 && paymentList[0].status !== "paid") {
          const payment = paymentList[0];
          await db.update(payments).set({ status: 'paid' }).where(eq(payments.id, payment.id as any));
          await db.update(users).set({ planId: payment.planId }).where(eq(users.id, payment.userId as any));
        }
      }
    }

    if (eventId) {
      await db.update(webhookEvents).set({ status: 'processed', processedAt: new Date() }).where(eq(webhookEvents.eventId, eventId));
    }
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Erro no webhook Pagar.me:", error);
    const eventId = req.body?.id;
    if (eventId) {
      try {
        await db.update(webhookEvents).set({ status: 'error', errorMessage: error.message }).where(eq(webhookEvents.eventId, eventId));
      } catch (err) {}
    }
    res.status(200).json({ received: true, error: true });
  }
});

async function setupVite() {
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
  }

  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/") || req.originalUrl.match(/\.[a-zA-Z0-9]+$/)) {
      return next();
    }
    try {
      let template;
      if (process.env.NODE_ENV !== "production") {
        template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
      } else {
        template = fs.readFileSync(path.resolve(process.cwd(), "dist", "index.html"), "utf-8");
      }
      
      const urlParts = req.originalUrl.split("?")[0].split("/");
      let title = "Vírgula Contábil - Calculadora";
      let description = "Calculadoras de precificação e simulação financeira para clientes Vírgula Contábil.";
      const ogImage = "https://www.virgulacontabil.com.br/wp-content/uploads/2026/04/favicon.png";

      if (urlParts.length >= 2 && urlParts[1] && urlParts[1] !== "admin") {
        const slug = urlParts[1];
        const courseList = await db.select().from(courses);
        const course = courseList.find((c: any) => c.slug === slug);
        if (course) {
          title = `${course.title} - Vírgula Contábil`;
          if (course.description) {
            description = course.description;
          }
        }
      }

      const metaTags = `
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta name="description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
      `;
      template = template.replace(/<title>.*?<\/title>/, metaTags);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e: any) {
      if (vite) {
        vite.ssrFixStacktrace(e);
      }
      next(e);
    }
  });

  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

setupVite();

export { app };
