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

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "super-secret-key-change-me" : null);
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET.");
}

const app = express();
app.set('trust proxy', 1);
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

// Admin routes reuse the same user_token/role system as the rest of the app
// (there is no separate admin login/cookie — a user becomes admin via the
// `role` column, see /api/register bootstrap logic below).
async function requireAdmin(req: any, res: any, next: any) {
  await requireUser(req, res, () => {
    if (req.currentUser?.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito a administradores." });
    }
    next();
  });
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

app.get("/api/admin/courses", requireAdmin, async (req, res) => {
  const allCourses = await db.select().from(courses);
  res.json(allCourses);
});
app.post("/api/admin/courses", requireAdmin, async (req, res) => {
  const newCourse = req.body;
  const inserted = await db.insert(courses).values({
    title: newCourse.courseName || newCourse.title,
    description: newCourse.description || "",
    videoUrl: newCourse.videoUrl || "",
    thumbnailUrl: newCourse.thumbnailUrl || null
  }).returning();
  res.json(inserted[0]);
});
app.put("/api/admin/courses/:id", requireAdmin, async (req, res) => {
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
app.delete("/api/admin/courses/:id", requireAdmin, async (req, res) => {
  await db.delete(courses).where(eq(courses.id, req.params.id as any));
  res.json({ success: true });
});

app.get("/api/admin/leads", requireAdmin, async (req, res) => {
  const allLeads = await db.select().from(leads);
  res.json(allLeads);
});

// --- User management (used by AdminPanel.tsx) ---
import { desc } from "drizzle-orm";
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
    plan: u.planId,
    createdAt: u.createdAt
  })));
});
app.post("/api/admin/users/:email/plan", requireAdmin, async (req, res) => {
  const planId = req.body.planId;
  if (planId !== "" && planId !== "free" && !(planId in PLANS)) {
    return res.status(400).json({ error: "Plano inválido." });
  }
  const updated = await db.update(users)
    .set({ planId: planId || "free" })
    .where(eq(users.email, req.params.email)).returning();
  if (updated.length > 0) res.json({ success: true, user: updated[0] });
  else res.status(404).json({ error: "Usuário não encontrado." });
});
app.delete("/api/admin/users/:email", requireAdmin, async (req, res) => {
  const target = await db.select().from(users).where(eq(users.email, req.params.email));
  if (target.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
  if (target[0].role === "admin") return res.status(403).json({ error: "Não é possível excluir um administrador." });
  await db.delete(users).where(eq(users.email, req.params.email));
  res.json({ success: true });
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

const registerSchema = z.object({ name: z.string().min(2, "Nome muito curto"), email: z.string().email("E-mail inválido"), phone: z.string().min(8, "Telefone muito curto"), password: z.string().min(6, "Senha muito curta") });
const loginSchema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Senha obrigatória") });

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await db.select().from(users).where(eq(users.email, parsed.email));
    if (existing.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const isBootstrapAdmin = !!process.env.ADMIN_EMAIL && parsed.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
    
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser = await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: isBootstrapAdmin ? 'admin' : 'user',
      planId: isBootstrapAdmin ? 'ilimitado' : 'free',
      verificationToken,
      isVerified: false
    }).returning();

    try {
      await db.insert(leads).values({ name: parsed.name, email: parsed.email, phone: parsed.phone });
    } catch (leadErr) {
      console.error("Erro ao registrar lead de cadastro:", leadErr);
    }

    try {
      await transporter.sendMail({
        from: `${process.env.SMTP_FROM_NAME || "Vírgula Contábil"} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: parsed.email,
        subject: "Código de Verificação",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; background-color: #ffffff;">
          <h2 style="color: #2e3440; font-size: 24px; margin-bottom: 24px; text-align: center;">Código de Verificação</h2>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">Olá, <strong>${parsed.name}</strong>.</p>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">Para concluir seu cadastro na Calculadora Vírgula Contábil, utilize o código de verificação abaixo:</p>
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: bold; color: #1a56db; letter-spacing: 8px;">${verificationToken}</span>
          </div>
          <p style="color: #4c566a; font-size: 14px; line-height: 1.5; text-align: center; margin-bottom: 0;">Se você não solicitou este código, por favor, ignore este e-mail.</p>
        </div>`,
      });
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de verificação:", mailErr);
    }

    res.json({
      success: true,
      requireVerification: true,
      email: parsed.email
    });

  } catch (err: any) {
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : (err.message || "Erro interno do servidor");
    res.status(400).json({ error: msgs, details: err.errors });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    
    // Admin login
    if (
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD &&
      email === process.env.ADMIN_EMAIL.toLowerCase() &&
      password === process.env.ADMIN_PASSWORD
    ) {
      let adminUserList = await db.select().from(users).where(eq(users.email, email));
      let adminUser;
      if (adminUserList.length === 0) {
        const passwordHash = await bcrypt.hash(password, 10);
        const inserted = await db.insert(users).values({
          name: 'Admin',
          email: email,
          passwordHash,
          role: 'admin',
          planId: 'ilimitado',
          isVerified: true,
          verificationToken: 'admin'
        }).returning();
        adminUser = inserted[0];
      } else {
        adminUser = adminUserList[0];
        if (adminUser.role !== 'admin' || adminUser.planId !== 'ilimitado') {
          const updated = await db.update(users).set({ role: 'admin', planId: 'ilimitado' }).where(eq(users.email, email)).returning();
          adminUser = updated[0];
        }
      }

      const adminToken = jwt.sign(
        { email: adminUser.email, role: 'admin' },
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      res.cookie("admin_token", adminToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      res.cookie("user_token", adminToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      return res.json({ 
        success: true, 
        user: adminUser
      });
    }

    const parsed = loginSchema.parse(req.body);
    const userList = await db.select().from(users).where(eq(users.email, parsed.email));
    if (userList.length === 0) return res.status(401).json({ error: "Credenciais inválidas." });
    const user = userList[0];
    const match = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Credenciais inválidas." });
    
    if (!user.isVerified) {
      return res.status(403).json({ error: "Conta não verificada", requireVerification: true, email: user.email });
    }

    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: "7d" });
    res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    const plan = PLANS[user.planId as PlanId] || PLANS.basico;
    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        phone: "",
        role: user.role,
        plan: user.planId,
        productLimit: plan.productLimit,
      },
    });
  } catch (err: any) {
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : (err.message || "Erro interno do servidor");
    res.status(400).json({ error: msgs, details: err.errors });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("user_token");
  res.json({ success: true });
});

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(6) });


app.post("/api/verify-code", authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "E-mail e código são obrigatórios." });
    
    const userList = await db.select().from(users).where(eq(users.email, email));
    if (userList.length === 0) return res.status(400).json({ error: "Usuário não encontrado." });
    
    const user = userList[0];
    if (user.isVerified) return res.json({ success: true, message: "Conta já verificada." });
    
    if (user.verificationToken !== code) return res.status(400).json({ error: "Código inválido." });
    
    await db.update(users).set({ isVerified: true, verificationToken: null }).where(eq(users.id, user.id));
    
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET as string, { expiresIn: "7d" });
    res.cookie("user_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    
    const plan = PLANS[user.planId as keyof typeof PLANS] || PLANS.basico;
    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        phone: "",
        role: user.role,
        plan: user.planId,
        productLimit: plan.productLimit,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

app.post("/api/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const userList = await db.select().from(users).where(eq(users.email, email));
    // Sempre responde com sucesso genérico, mesmo se o e-mail não existir,
    // para não permitir enumeração de usuários cadastrados.
    if (userList.length > 0) {
      const user = userList[0];
      const rawToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await db.update(users).set({ resetTokenHash, resetTokenExpiresAt }).where(eq(users.id, user.id));

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;
      try {
        await transporter.sendMail({
          from: `${process.env.SMTP_FROM_NAME || "Vírgula Contábil"} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
          to: user.email,
          subject: "Redefinição de senha",
          html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; background-color: #ffffff;">
          <h2 style="color: #2e3440; font-size: 24px; margin-bottom: 24px; text-align: center;">Redefinição de Senha</h2>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">Olá, <strong>${user.name}</strong>.</p>
          <p style="color: #4c566a; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha (o link expira em 1 hora):</p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${resetLink}" style="display: inline-block; background-color: #1a56db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Redefinir Minha Senha</a>
          </div>
          <p style="color: #4c566a; font-size: 14px; line-height: 1.5; text-align: center; margin-bottom: 0;">Se você não solicitou isso, por favor, ignore este e-mail. Nenhuma alteração será feita na sua conta.</p>
        </div>`,
        });
      } catch (mailErr) {
        console.error("Erro ao enviar e-mail de redefinição de senha:", mailErr);
      }
    }
    res.json({ success: true, message: "Se o e-mail existir em nossa base, enviaremos um link de redefinição." });
  } catch (err: any) {
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : (err.message || "Erro interno do servidor");
    res.status(400).json({ error: msgs, details: err.errors });
  }
});

app.post("/api/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const userList = await db.select().from(users).where(eq(users.resetTokenHash, tokenHash));
    if (userList.length === 0) return res.status(400).json({ error: "Token inválido ou expirado" });
    const user = userList[0];
    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(users).set({ passwordHash, resetTokenHash: null, resetTokenExpiresAt: null }).where(eq(users.id, user.id));
    res.json({ success: true, message: "Senha redefinida com sucesso." });
  } catch (err: any) {
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(', ') : (err.message || "Erro interno do servidor");
    res.status(400).json({ error: msgs, details: err.errors });
  }
});

app.get("/api/me", requireUser, (req: any, res) => {
  res.json({ email: req.currentUser.email, name: req.currentUser.name, plan: req.currentUser.planId, role: req.currentUser.role, id: req.currentUser.id });
});

app.get("/api/fixed-costs", requireUser, async (req: any, res) => {
  const costs = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, req.currentUser.id));
  res.json(costs.map(c => ({
    id: c.id,
    nome: c.name,
    valor: c.amount
  })));
});
app.post("/api/fixed-costs", requireUser, async (req: any, res) => {
  const newCost = await db.insert(fixedCosts).values({
    userId: req.currentUser.id,
    name: req.body.nome || req.body.name || "Novo Custo",
    amount: req.body.valor || req.body.amount || 0
  }).returning();
  const c = newCost[0];
  res.json({ success: true, cost: { id: c.id, nome: c.name, valor: c.amount } });
});
app.put("/api/fixed-costs/:id", requireUser, async (req: any, res) => {
  const updated = await db.update(fixedCosts)
    .set({
      name: req.body.nome || req.body.name,
      amount: req.body.valor || req.body.amount
    })
    .where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.currentUser.id))).returning();
  if (updated.length > 0) {
    const c = updated[0];
    res.json({ success: true, cost: { id: c.id, nome: c.name, valor: c.amount } });
  } else res.status(404).json({ error: "Custo não encontrado" });
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
  res.json(myProducts.map(p => ({
    id: p.id,
    nome: p.name,
    cmv: p.costPrice,
    precoVenda: p.salePrice,
    vendasProjetadas: p.projectedSales,
    isSample: p.isSample
  })));
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
    name: req.body.nome || req.body.name || "Novo Produto",
    costPrice: req.body.cmv || req.body.costPrice || req.body.custo || 0,
    salePrice: req.body.precoVenda || req.body.salePrice || 0,
    projectedSales: req.body.vendasProjetadas || req.body.projectedSales || 0,
    isSample: false
  }).returning();
  
  const p = newProduct[0];
  res.json({ success: true, product: {
    id: p.id,
    nome: p.name,
    cmv: p.costPrice,
    precoVenda: p.salePrice,
    vendasProjetadas: p.projectedSales,
    isSample: p.isSample
  }});
});
app.put("/api/products/:id", requireUser, async (req: any, res) => {
  const updated = await db.update(products)
    .set({
      name: req.body.nome || req.body.name,
      costPrice: req.body.cmv || req.body.costPrice,
      salePrice: req.body.precoVenda || req.body.salePrice,
      projectedSales: req.body.vendasProjetadas || req.body.projectedSales
    })
    .where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id))).returning();
  if (updated.length > 0) {
    const p = updated[0];
    res.json({ success: true, product: {
      id: p.id,
      nome: p.name,
      cmv: p.costPrice,
      precoVenda: p.salePrice,
      vendasProjetadas: p.projectedSales,
      isSample: p.isSample
    }});
  } else res.status(404).json({ error: "Produto não encontrado" });
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

app.post("/api/checkout/upgrade", requireUser, async (req: any, res) => {
  try {
    const { planId } = req.body || {};
  if (!planId || !(planId in PLANS)) {
    return res.status(400).json({ error: "Plano inválido." });
  }
  const plan = PLANS[planId as keyof typeof PLANS];
  if (req.currentUser.planId === planId) {
    return res.status(400).json({ error: "Você já possui este plano." });
  }
  const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
  if (!PAGARME_SECRET_KEY) {
    return res.status(500).json({ error: "Pagamentos indisponíveis no momento." });
  }
  const PAGARME_API_URL = process.env.PAGARME_API_URL || 'https://api.pagar.me/core/v5';

  const orderCode = `PAY-${crypto.randomUUID()}`;
  const [payment] = await db.insert(payments).values({
    userId: req.currentUser.id, planId, status: "pending", amount: plan.priceCents / 100, orderCode
  }).returning();

  const linkResponse = await fetch(`${PAGARME_API_URL}/paymentlinks`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "calculadora-virgula/1.0"
    },
    body: JSON.stringify({
      type: "order",
      order_code: orderCode,
      max_orders: 1,
      name: `Plano ${plan.name}`,
      payment_settings: { 
        accepted_payment_methods: ["credit_card", "pix"],
        pix_settings: { expires_in: 3600 },
        credit_card_settings: {
          operation_type: "auth_and_capture",
          installments: [{ number: 1, total: plan.priceCents }]
        }
      },
      cart_settings: { items: [{ name: `Plano ${plan.name} - Calculadora Vírgula Contábil`, amount: plan.priceCents, default_quantity: 1 }] },
      checkout_settings: {
        success_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/auth` : 'http://localhost:3000/auth'
      }
    })
  });

  let linkData: any = {};
  try {
    const text = await linkResponse.text();
    if (text) {
      linkData = JSON.parse(text);
    }
  } catch (e) {
    console.error("Erro ao parsear Pagar.me response", e);
  }
  
  if (!linkResponse.ok || !linkData.url) {
    console.error("Pagar.me Error:", linkResponse.status, linkData);
    await db.update(payments).set({ status: "error" }).where(eq(payments.id, payment.id as any));
    return res.status(502).json({ error: "Não foi possível iniciar o pagamento. Tente novamente." });
  }
  await db.update(payments).set({ paymentLinkId: linkData.id }).where(eq(payments.id, payment.id as any));
  res.json({ url: linkData.url });
  } catch (error: any) {
    console.error("Erro no checkout:", error);
    res.status(500).json({ error: "Erro interno no servidor de pagamentos." });
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
      const expectedSignatureSha1 = crypto.createHmac("sha1", secret).update(payload).digest("hex");
      const expectedSignatureSha256 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (providedSignature !== expectedSignatureSha1 && providedSignature !== expectedSignatureSha256) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }
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
          if (payment.planId === 'ilimitado') {
             try {
                const userList = await db.select().from(users).where(eq(users.id, payment.userId as any));
                if (userList.length > 0) {
                   const salesEmail = process.env.SALES_TEAM_EMAIL || 'vendas@virgulacontabil.com.br';
                   await transporter.sendMail({
                     from: `${process.env.SMTP_FROM_NAME || "Vírgula Contábil"} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
                     to: salesEmail,
                     subject: "Novo Plano Ilimitado - Agendar Consultoria",
                     html: `<p>O cliente <strong>${userList[0].name}</strong> (${userList[0].email}) acabou de assinar o plano Ilimitado.</p><p>Por favor, entre em contato para agendar a call de consultoria.</p>`
                   });
                   console.log(`✅ E-mail real enviado para ${salesEmail} sobre o novo assinante Ilimitado.`);
                }
             } catch (err) {}
          }
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
      let title = "Calculadora | Vírgula Contábil";
      let description = "Calculadoras de precificação e simulação financeira para clientes Vírgula Contábil.";
      const ogImage = "https://www.virgulacontabil.com.br/wp-content/uploads/2026/04/favicon.png";

      if (urlParts.length >= 2 && urlParts[1] && urlParts[1] !== "admin") {
        const slug = urlParts[1];
        try {
          const courseList = await db.select().from(courses);
          const course = courseList.find((c: any) => c.slug === slug);
          if (course) {
            title = `${course.title} - Vírgula Contábil`;
            if (course.description) {
              description = course.description;
            }
          }
        } catch (dbErr: any) {
          if (dbErr.code !== '42P01') {
            console.error("Failed to query courses for meta tags:", dbErr);
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
    // Run migrations on startup
    
    try {
      
    } catch (err) {
      console.error("Falha crítica ao rodar as migrations do banco de dados. Encerrando o processo.", err);
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      } else {
        console.error("Ambiente de desenvolvimento: O servidor continuará rodando mesmo sem conexão com o banco de dados.");
      }
    }

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

setupVite();

export { app };
