import express from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./src/db/index.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { users, products, fixedCosts, payments, courses, leads, webhookEvents, snapshots, store,
  fiscalDocuments, fiscalItems, fiscalProductLinks, variableExpenses, pricingStrategies } from "./src/db/schema.js";
import { eq, and, gte, lte, desc, asc, inArray } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { ErroNotaFiscal, direcaoDaNota, lerNotaFiscal, normalizarDescricao, somenteDigitos } from "./src/domain/fiscal/nfe.js";
import { sugerirVinculos } from "./src/domain/fiscal/sugestoes.js";
import AdmZip from "adm-zip";
import { aplicarVinculos, resumirPorProdutoPeriodo, type ItemComContexto } from "./src/domain/fiscal/agregacao.js";
import { estimarElasticidade } from "./src/domain/elasticidade/index.js";

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
  basico: { id: "basico", name: "Básico", description: "Para quem está começando", priceCents: 949, productLimit: 20, excelImport: false, consultingCall: false },
  intermediario: { id: "intermediario", name: "Intermediário", description: "Para negócios em crescimento", priceCents: 2749, productLimit: 80, excelImport: true, consultingCall: false },
  ilimitado: { id: "ilimitado", name: "Ilimitado", description: "Acesso total e suporte", priceCents: 5990, productLimit: Number.MAX_SAFE_INTEGER, excelImport: true, consultingCall: true }
} as const;
export type PlanId = keyof typeof PLANS;

// --- Free mode toggle ---
// Lets us take the paid option off the table temporarily (everyone gets
// unlimited access) without deleting any of the payment code, so it can be
// switched back on later. Users who register (or already exist) while this
// is enabled are granted the 'ilimitado' plan directly in the database, so
// they stay grandfathered with unlimited access even after free mode ends.
const FREE_MODE_KEY = "freeMode";

async function isFreeModeEnabled(): Promise<boolean> {
  const rows = await db.select().from(store).where(eq(store.key, FREE_MODE_KEY));
  return !!(rows[0]?.value as any)?.enabled;
}

// Público: lets the frontend know whether paid plans are currently active,
// so it can hide pricing/checkout/limit nags during a free period.
app.get("/api/settings", async (req, res) => {
  res.json({ freeModeEnabled: await isFreeModeEnabled() });
});

// Público: única fonte de verdade sobre preços/limites dos planos, consumida
// pela tela de preços no frontend para evitar duplicar (e desalinhar) esses
// valores em dois lugares.
app.get("/api/plans", (req, res) => {
  res.json(Object.values(PLANS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    productLimit: p.productLimit >= Number.MAX_SAFE_INTEGER ? null : p.productLimit,
    excelImport: p.excelImport,
    consultingCall: p.consultingCall
  })));
});

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

// --- Admin User Data Management ---
app.get("/api/admin/users/:userId/products", requireAdmin, async (req: any, res) => {
  const list = await db.select().from(products).where(and(eq(products.userId, req.params.userId), eq(products.isSample, false)));
  res.json(list.map(p => ({
    id: p.id,
    nome: p.name,
    cmv: p.costPrice,
    vendasProjetadas: p.projectedSales,
    imposto: p.imposto || 0,
    taxaCartao: p.taxaCartao || 0,
    comissao: p.comissao || 0,
    margem: p.margem || 0,
    precoFixo: p.precoFixo || 0,
    percentualRateio: p.percentualRateio || 0,
    modoPrecificacao: p.modoPrecificacao || 'margem'
  })));
});

app.post("/api/admin/users/:userId/products", requireAdmin, async (req: any, res) => {
  const p = req.body;
  const inserted = await db.insert(products).values({
    userId: req.params.userId,
    name: p.nome,
    costPrice: p.cmv,
    salePrice: p.precoFixo || 0,
    projectedSales: p.vendasProjetadas || 0,
    isSample: false,
    imposto: p.imposto || 0,
    taxaCartao: p.taxaCartao || 0,
    comissao: p.comissao || 0,
    margem: p.margem || 0,
    precoFixo: p.precoFixo || 0,
    percentualRateio: p.percentualRateio || 0,
    modoPrecificacao: p.modoPrecificacao || 'margem'
  }).returning();
  
  const c = inserted[0];
  res.json({ success: true, product: {
    id: c.id, nome: c.name, cmv: c.costPrice, vendasProjetadas: c.projectedSales,
    imposto: c.imposto || 0, taxaCartao: c.taxaCartao || 0, comissao: c.comissao || 0,
    margem: c.margem || 0, precoFixo: c.precoFixo || 0, percentualRateio: c.percentualRateio || 0,
    modoPrecificacao: c.modoPrecificacao || 'margem'
  }});
});

app.delete("/api/admin/users/:userId/products/:id", requireAdmin, async (req: any, res) => {
  await db.delete(products).where(and(eq(products.id, req.params.id as any), eq(products.userId, req.params.userId)));
  res.json({ success: true });
});

app.get("/api/admin/users/:userId/fixed-costs", requireAdmin, async (req: any, res) => {
  const list = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, req.params.userId));
  res.json(list.map(c => ({ id: c.id, nome: c.name, valor: c.amount })));
});

app.post("/api/admin/users/:userId/fixed-costs", requireAdmin, async (req: any, res) => {
  const inserted = await db.insert(fixedCosts).values({
    userId: req.params.userId,
    name: req.body.nome,
    amount: req.body.valor
  }).returning();
  const c = inserted[0];
  res.json({ success: true, cost: { id: c.id, nome: c.name, valor: c.amount } });
});

app.delete("/api/admin/users/:userId/fixed-costs/:id", requireAdmin, async (req: any, res) => {
  await db.delete(fixedCosts).where(and(eq(fixedCosts.id, req.params.id as any), eq(fixedCosts.userId, req.params.userId)));
  res.json({ success: true });
});


app.get("/api/admin/leads", requireAdmin, async (req, res) => {
  const allLeads = await db.select().from(leads);
  res.json(allLeads);
});

// --- User management (used by AdminPanel.tsx) ---

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
  const allLeads = await db.select().from(leads);
  const phoneMap = new Map();
  allLeads.forEach(l => {
    if (l.email && l.phone) phoneMap.set(l.email.toLowerCase(), l.phone);
  });
  
  res.json(allUsers.map(u => ({
    id: u.id,
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

app.post("/api/admin/settings/free-mode", requireAdmin, async (req, res) => {
  const enabled = !!req.body?.enabled;
  await db.insert(store)
    .values({ key: FREE_MODE_KEY, value: { enabled } })
    .onConflictDoUpdate({ target: store.key, set: { value: { enabled } } });

  if (enabled) {
    // Grandfather every current registrant with unlimited access so they
    // keep it even after payments are turned back on.
    await db.update(users).set({ planId: "ilimitado" }).where(eq(users.role, "user"));
  }

  res.json({ success: true, freeModeEnabled: enabled });
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

// CNPJ (14) ou CPF (11), guardado sempre só com os dígitos — é ele que diz,
// na importação de XML, se a nota é de compra ou de venda.
const documentoSchema = z.string()
  .transform(v => v.replace(/\D/g, ""))
  .refine(v => v.length === 11 || v.length === 14, "Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)");
const registerSchema = z.object({ name: z.string().min(2, "Nome muito curto"), email: z.string().email("E-mail inválido"), phone: z.string().min(8, "Telefone muito curto"), taxId: documentoSchema.optional(), password: z.string().min(6, "Senha muito curta") });
const loginSchema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Senha obrigatória") });

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await db.select().from(users).where(eq(users.email, parsed.email));
    if (existing.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const isBootstrapAdmin = !!process.env.ADMIN_EMAIL && parsed.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
    const freeMode = await isFreeModeEnabled();

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser = await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: isBootstrapAdmin ? 'admin' : 'user',
      // While free mode is on, new registrants are granted 'ilimitado'
      // directly so they stay grandfathered once payments come back.
      planId: (isBootstrapAdmin || freeMode) ? 'ilimitado' : 'free',
      taxId: parsed.taxId ?? null,
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
  res.json({ email: req.currentUser.email, name: req.currentUser.name, plan: req.currentUser.planId, role: req.currentUser.role, id: req.currentUser.id, taxId: req.currentUser.taxId || null });
});

// O CNPJ/CPF precisa poder ser preenchido depois do cadastro: quem já tinha
// conta antes da importação de XML não passou por esse campo.
app.put("/api/me", requireUser, async (req: any, res) => {
  try {
    const bruto = String(req.body.taxId ?? "").trim();
    const taxId = bruto === "" ? null : documentoSchema.parse(bruto);
    const atualizado = await db.update(users)
      .set({ taxId, updatedAt: new Date() })
      .where(eq(users.id, req.currentUser.id))
      .returning();
    const u = atualizado[0];
    res.json({ success: true, user: { email: u.email, name: u.name, plan: u.planId, role: u.role, id: u.id, taxId: u.taxId || null } });
  } catch (err: any) {
    const msgs = err.errors ? err.errors.map((e: any) => e.message).join(", ") : (err.message || "Erro ao salvar o documento");
    res.status(400).json({ error: msgs });
  }
});

// ---------------------------------------------------------------------------
// Despesas variáveis personalizadas
// ---------------------------------------------------------------------------
//
// Cada empresa tem as suas: uma paga frete, outra paga taxa de marketplace,
// outra embala presente. Antes tudo isso ia para o campo único "Outros", que
// somava no preço sem dizer de onde vinha.
//
// Toda rota aqui filtra por `userId` na consulta E na cláusula de escrita, então
// a lista de um usuário é invisível — e inalterável — para qualquer outro. Um
// id de despesa de outra conta simplesmente não encontra linha para atualizar.

// ---------------------------------------------------------------------------
// Estratégias de margem
// ---------------------------------------------------------------------------
//
// Poucas faixas nomeadas no lugar de uma margem solta por produto. O lojista
// não precisa decidir "que margem leva o parafuso" trezentas vezes; decide uma
// vez o que é produto de atração e o que é produto de margem, e ajusta a
// política mexendo na faixa.
//
// Como as despesas variáveis, tudo aqui é filtrado por `userId`.

const NOME_ESTRATEGIA_MAX = 30;
const MAX_ESTRATEGIAS = 8;

/**
 * As faixas com que toda conta começa. São um ponto de partida editável, não
 * uma regra: o usuário renomeia, muda os percentuais, cria e apaga.
 */
const ESTRATEGIAS_PADRAO = [
  // 0% existe para o caso de venda a preço de custo (brinde, item de combo,
  // queima de estoque) sem obrigar o usuário a cair em "Personalizado".
  { name: "Sem margem", margem: 0, piso: 0, cor: "rose" },
  // O piso só vem preenchido na faixa de atração: é lá que o desconto costuma
  // ir longe demais. Nas outras nasce zerado, para o usuário decidir.
  { name: "Atração", margem: 10, piso: 5, cor: "sky" },
  { name: "Padrão", margem: 20, piso: 0, cor: "slate" },
  { name: "Margem alta", margem: 30, piso: 0, cor: "emerald" },
];

function mapearEstrategia(e: typeof pricingStrategies.$inferSelect) {
  return { id: e.id, nome: e.name, margem: e.margem, piso: e.piso, cor: e.cor, posicao: e.position };
}

/**
 * Lê as faixas do usuário, criando as três padrão na primeira vez.
 *
 * Semear na leitura (e não no cadastro) faz as contas que já existiam antes
 * desta funcionalidade ganharem as faixas sem precisar de migração de dados.
 * Uma corrida entre duas abas cai no índice único (userId, name) — daí o
 * catch, que simplesmente relê o que a outra aba criou.
 */
async function estrategiasDoUsuario(userId: string) {
  const existentes = await db.select().from(pricingStrategies)
    .where(eq(pricingStrategies.userId, userId))
    .orderBy(asc(pricingStrategies.position), asc(pricingStrategies.createdAt));
  if (existentes.length > 0) return existentes;

  try {
    await db.insert(pricingStrategies).values(
      ESTRATEGIAS_PADRAO.map((e, i) => ({ userId, name: e.name, margem: e.margem, piso: e.piso, cor: e.cor, position: i }))
    );
  } catch {
    // Outra requisição semeou primeiro; a releitura abaixo resolve.
  }

  return db.select().from(pricingStrategies)
    .where(eq(pricingStrategies.userId, userId))
    .orderBy(asc(pricingStrategies.position), asc(pricingStrategies.createdAt));
}

function nomeEstrategiaValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const nome = valor.trim().replace(/\s+/g, " ");
  if (!nome || nome.length > NOME_ESTRATEGIA_MAX) return null;
  return nome;
}

/** Margem alvo aceita: de 0 a 99%. Em 100% o preço não fecha (divisão por zero). */
function margemValida(valor: unknown): number | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null;
  return n;
}

/**
 * Piso aceito: de 0 até a própria margem alvo.
 *
 * Piso acima da margem seria uma faixa que nasce violando o próprio limite —
 * todo produto dela apareceria em alerta desde o primeiro dia.
 */
function pisoValido(valor: unknown, margemAlvo: number): number | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > margemAlvo) return null;
  return n;
}

app.get("/api/pricing-strategies", requireUser, async (req: any, res) => {
  const lista = await estrategiasDoUsuario(req.currentUser.id);
  res.json(lista.map(mapearEstrategia));
});

app.post("/api/pricing-strategies", requireUser, async (req: any, res) => {
  const nome = nomeEstrategiaValido(req.body?.nome ?? req.body?.name);
  if (!nome) return res.status(400).json({ error: `Informe um nome de até ${NOME_ESTRATEGIA_MAX} caracteres.` });

  const margem = margemValida(req.body?.margem);
  if (margem === null) return res.status(400).json({ error: "A margem precisa ficar entre 0% e 99%." });

  const existentes = await estrategiasDoUsuario(req.currentUser.id);
  if (existentes.length >= MAX_ESTRATEGIAS) {
    return res.status(400).json({ error: `Você já tem ${MAX_ESTRATEGIAS} estratégias. Remova alguma para criar outra.` });
  }
  if (existentes.some(e => e.name.toLowerCase() === nome.toLowerCase())) {
    return res.status(409).json({ error: `Você já tem uma estratégia chamada "${nome}".` });
  }

  const piso = pisoValido(req.body?.piso ?? 0, margem);
  if (piso === null) {
    return res.status(400).json({ error: "O piso precisa ficar entre 0% e a margem alvo da estratégia." });
  }

  const [criada] = await db.insert(pricingStrategies).values({
    userId: req.currentUser.id,
    name: nome,
    margem,
    piso,
    cor: typeof req.body?.cor === "string" ? req.body.cor : "slate",
    position: existentes.length,
  }).returning();

  res.json({ success: true, estrategia: mapearEstrategia(criada) });
});

app.put("/api/pricing-strategies/:id", requireUser, async (req: any, res) => {
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (req.body?.nome !== undefined || req.body?.name !== undefined) {
    const nome = nomeEstrategiaValido(req.body?.nome ?? req.body?.name);
    if (!nome) return res.status(400).json({ error: `Informe um nome de até ${NOME_ESTRATEGIA_MAX} caracteres.` });
    const outras = await estrategiasDoUsuario(req.currentUser.id);
    if (outras.some(e => e.id !== req.params.id && e.name.toLowerCase() === nome.toLowerCase())) {
      return res.status(409).json({ error: `Você já tem uma estratégia chamada "${nome}".` });
    }
    patch.name = nome;
  }

  // A margem e o piso se validam um contra o outro, então precisamos saber
  // como a faixa vai ficar DEPOIS deste patch, não como ela está hoje.
  const atuais = await estrategiasDoUsuario(req.currentUser.id);
  const atual = atuais.find(e => e.id === req.params.id);
  if (!atual) return res.status(404).json({ error: "Estratégia não encontrada" });

  let margemFinal = atual.margem;
  if (req.body?.margem !== undefined) {
    const margem = margemValida(req.body.margem);
    if (margem === null) return res.status(400).json({ error: "A margem precisa ficar entre 0% e 99%." });
    patch.margem = margem;
    margemFinal = margem;
  }

  if (req.body?.piso !== undefined) {
    const piso = pisoValido(req.body.piso, margemFinal);
    if (piso === null) {
      return res.status(400).json({ error: "O piso precisa ficar entre 0% e a margem alvo da estratégia." });
    }
    patch.piso = piso;
  } else if (patch.margem !== undefined && atual.piso > margemFinal) {
    // Baixar a margem abaixo do piso existente deixaria a faixa incoerente:
    // o piso desce junto.
    patch.piso = margemFinal;
  }

  if (typeof req.body?.cor === "string") patch.cor = req.body.cor;

  const atualizada = await db.update(pricingStrategies).set(patch)
    .where(and(
      eq(pricingStrategies.id, req.params.id as any),
      eq(pricingStrategies.userId, req.currentUser.id),
    )).returning();

  if (atualizada.length === 0) return res.status(404).json({ error: "Estratégia não encontrada" });
  res.json({ success: true, estrategia: mapearEstrategia(atualizada[0]) });
});

app.delete("/api/pricing-strategies/:id", requireUser, async (req: any, res) => {
  const userId = req.currentUser.id;

  const removida = await db.transaction(async (tx: any) => {
    const alvo = await tx.select().from(pricingStrategies)
      .where(and(eq(pricingStrategies.id, req.params.id as any), eq(pricingStrategies.userId, userId)));
    if (alvo.length === 0) return null;

    // Os produtos que seguiam esta faixa viram "Personalizado" com a margem que
    // a faixa tinha — o preço deles não muda no momento da exclusão, que é o
    // que evita um susto de reprecificação em massa por um clique.
    await tx.update(products)
      .set({ estrategiaId: null, margem: alvo[0].margem, updatedAt: new Date() })
      .where(and(eq(products.userId, userId), eq(products.estrategiaId, req.params.id as any)));

    await tx.delete(pricingStrategies)
      .where(and(eq(pricingStrategies.id, req.params.id as any), eq(pricingStrategies.userId, userId)));
    return alvo[0];
  });

  if (!removida) return res.status(404).json({ error: "Estratégia não encontrada" });
  res.json({ success: true });
});

const NOME_DESPESA_MAX = 40;

function nomeDespesaValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const nome = valor.trim().replace(/\s+/g, " ");
  if (!nome || nome.length > NOME_DESPESA_MAX) return null;
  return nome;
}

function mapearDespesa(d: typeof variableExpenses.$inferSelect) {
  return { id: d.id, nome: d.name, posicao: d.position };
}

app.get("/api/variable-expenses", requireUser, async (req: any, res) => {
  const lista = await db.select().from(variableExpenses)
    .where(eq(variableExpenses.userId, req.currentUser.id))
    .orderBy(asc(variableExpenses.position), asc(variableExpenses.createdAt));
  res.json(lista.map(mapearDespesa));
});

app.post("/api/variable-expenses", requireUser, async (req: any, res) => {
  const nome = nomeDespesaValido(req.body?.nome ?? req.body?.name);
  if (!nome) {
    return res.status(400).json({ error: `Informe um nome de até ${NOME_DESPESA_MAX} caracteres.` });
  }

  const existentes = await db.select().from(variableExpenses)
    .where(eq(variableExpenses.userId, req.currentUser.id));

  // Um teto por usuário: cada despesa vira uma coluna no Mix, e além disso a
  // tabela deixa de caber na tela.
  if (existentes.length >= 12) {
    return res.status(400).json({ error: "Você já tem 12 despesas variáveis. Remova alguma para criar outra." });
  }
  if (existentes.some(d => d.name.toLowerCase() === nome.toLowerCase())) {
    return res.status(409).json({ error: `Você já tem uma despesa chamada "${nome}".` });
  }

  const [criada] = await db.insert(variableExpenses).values({
    userId: req.currentUser.id,
    name: nome,
    position: existentes.length,
  }).returning();

  res.json({ success: true, despesa: mapearDespesa(criada) });
});

app.put("/api/variable-expenses/:id", requireUser, async (req: any, res) => {
  const nome = nomeDespesaValido(req.body?.nome ?? req.body?.name);
  if (!nome) {
    return res.status(400).json({ error: `Informe um nome de até ${NOME_DESPESA_MAX} caracteres.` });
  }

  const conflito = await db.select().from(variableExpenses)
    .where(eq(variableExpenses.userId, req.currentUser.id));
  if (conflito.some(d => d.id !== req.params.id && d.name.toLowerCase() === nome.toLowerCase())) {
    return res.status(409).json({ error: `Você já tem uma despesa chamada "${nome}".` });
  }

  const atualizada = await db.update(variableExpenses)
    .set({ name: nome, updatedAt: new Date() })
    .where(and(
      eq(variableExpenses.id, req.params.id as any),
      eq(variableExpenses.userId, req.currentUser.id),
    )).returning();

  if (atualizada.length === 0) return res.status(404).json({ error: "Despesa não encontrada" });
  res.json({ success: true, despesa: mapearDespesa(atualizada[0]) });
});

app.delete("/api/variable-expenses/:id", requireUser, async (req: any, res) => {
  // Os percentuais gravados em cada produto ficam onde estão: sem a definição,
  // o motor de preço já para de somá-los, e recriar a despesa com o mesmo id
  // não é possível — mas manter o dado evita perder tudo por um clique errado
  // quando a exclusão é desfeita pelo banco.
  const removidas = await db.delete(variableExpenses).where(and(
    eq(variableExpenses.id, req.params.id as any),
    eq(variableExpenses.userId, req.currentUser.id),
  )).returning({ id: variableExpenses.id });

  // Sem linha apagada, o id não é deste usuário (ou já não existe). Responder
  // "sucesso" aqui faria a tela de quem tentou apagar a despesa de outra conta
  // remover o item da lista dela como se tivesse funcionado.
  if (removidas.length === 0) return res.status(404).json({ error: "Despesa não encontrada" });
  res.json({ success: true });
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

// --- Snapshots ---
app.get("/api/snapshots", requireUser, async (req: any, res) => {
  try {
    const list = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.userId, req.currentUser.id))
      .orderBy(desc(snapshots.createdAt))
      .limit(12);
    res.json(list);
  } catch (error) {
    console.error("Erro ao buscar snapshots:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

app.post("/api/snapshots", requireUser, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    // Pega os produtos e custos atuais do banco
    const userProducts = await db.select().from(products).where(eq(products.userId, userId));
    const userCosts = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
    const custoFixoTotal = userCosts.reduce((a, b) => a + b.amount, 0);

    // Tenta encontrar um snapshot deste mês para atualizar, ou cria novo
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // label ex: "Agosto/2026"
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const label = `${months[now.getMonth()]}/${now.getFullYear()}`;

    const existing = await db
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.userId, userId),
          gte(snapshots.createdAt, startOfMonth)
        )
      )
      .orderBy(desc(snapshots.createdAt))
      .limit(1);

    if (existing.length > 0) {
      // Update
      const updated = await db.update(snapshots)
        .set({
          produtos: userProducts,
          custosFixos: userCosts,
          custoFixoTotal,
          label
        })
        .where(eq(snapshots.id, existing[0].id))
        .returning();
      res.json(updated[0]);
    } else {
      // Insert
      const inserted = await db.insert(snapshots)
        .values({
          userId,
          produtos: userProducts,
          custosFixos: userCosts,
          custoFixoTotal,
          label
        })
        .returning();
      res.json(inserted[0]);
    }
  } catch (error) {
    console.error("Erro ao salvar snapshot:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

async function checkProductLimit(req: any, res: any, next: any) {
  if (await isFreeModeEnabled()) return next();
  const plan = PLANS[req.currentUser.planId as PlanId] || PLANS.basico;
  const userProducts = await db.select().from(products).where(and(eq(products.userId, req.currentUser.id), eq(products.isSample, false)));
  if (userProducts.length >= plan.productLimit) {
    return res.status(403).json({ error: `Limite do plano atingido (${plan.productLimit} produtos). Faço o upgrade para cadastrar mais.` });
  }
  next();
}

/**
 * Forma como o produto trafega para o cliente. Existe uma vez só porque as
 * quatro rotas de produto devolviam recortes diferentes do mesmo registro — e a
 * do PUT devolvia menos campos do que a do GET, fazendo a tela perder valores
 * depois de salvar.
 */
function mapearProduto(p: typeof products.$inferSelect) {
  return {
    id: p.id,
    nome: p.name,
    cmv: p.costPrice,
    precoVenda: p.salePrice,
    vendasProjetadas: p.projectedSales,
    imposto: p.imposto || 0,
    taxaCartao: p.taxaCartao || 0,
    comissao: p.comissao || 0,
    margem: p.margem || 0,
    precoIdeal: p.precoIdeal || 0,
    precoFixo: p.precoFixo || 0,
    percentualRateio: p.percentualRateio || 0,
    modoPrecificacao: p.modoPrecificacao || 'margem',
    despesasVariaveis: (p.despesasVariaveis as Record<string, number>) || {},
    estrategiaId: p.estrategiaId ?? null,
    chaveFiscal: p.chaveFiscal ?? null,
    isSample: p.isSample,
  };
}

/**
 * Campos graváveis de um produto, a partir do corpo da requisição.
 *
 * `salePrice` é o preço de venda do cadastro e `precoFixo` é o preço que o
 * usuário travou na tela de precificação. São coisas diferentes: o sync antigo
 * gravava `precoFixo ?? precoVenda` em `salePrice`, e como `??` só cai para o
 * próximo em null/undefined, todo produto no modo 'margem' (precoFixo = 0)
 * tinha o preço de cadastro zerado no primeiro sync — o que desabilitava de vez
 * o botão "Restaurar valor de venda do cadastro".
 */
function camposDoProduto(body: any) {
  const despesas = body.despesasVariaveis;
  return {
    name: body.nome ?? body.name ?? "Novo Produto",
    costPrice: Number(body.cmv ?? body.custo ?? body.costPrice ?? 0) || 0,
    salePrice: Number(body.precoVenda ?? body.salePrice ?? 0) || 0,
    projectedSales: Number(body.vendasProjetadas ?? body.projectedSales ?? 0) || 0,
    imposto: Number(body.imposto ?? 0) || 0,
    taxaCartao: Number(body.taxaCartao ?? 0) || 0,
    comissao: Number(body.comissao ?? 0) || 0,
    margem: Number(body.margem ?? 0) || 0,
    precoIdeal: Number(body.precoIdeal ?? 0) || 0,
    precoFixo: Number(body.precoFixo ?? 0) || 0,
    percentualRateio: Number(body.percentualRateio ?? 0) || 0,
    modoPrecificacao: body.modoPrecificacao === 'preco' ? 'preco' : 'margem',
    despesasVariaveis: (despesas && typeof despesas === 'object' && !Array.isArray(despesas))
      ? despesas as Record<string, number>
      : {},
    // String vazia vira null: é o que a tela manda quando o usuário escolhe
    // "Personalizado" no seletor de estratégia.
    estrategiaId: typeof body.estrategiaId === 'string' && body.estrategiaId ? body.estrategiaId : null,
  };
}

app.get("/api/products", requireUser, async (req: any, res) => {
  // Ordem explícita: sem ela o Postgres devolve na ordem física das linhas, e a
  // lista do usuário embaralhava a cada reload.
  const myProducts = await db.select().from(products)
    .where(eq(products.userId, req.currentUser.id))
    .orderBy(asc(products.createdAt), asc(products.id));
  res.json(myProducts.map(mapearProduto));
});

/**
 * Salva o mix inteiro de uma vez, vindo da tela de Preços em Lote.
 *
 * A versão anterior apagava TODOS os produtos do usuário e reinseria a lista.
 * Isso gerava um id novo para cada produto a cada salvamento, enquanto o
 * cliente seguia com os ids antigos em memória — cliente e banco divergiam no
 * primeiro caractere digitado, e qualquer coisa que referenciasse produto por
 * id passava a apontar para o vazio no reload seguinte. Além disso, duas
 * digitações próximas disparavam dois delete-all concorrentes sobre a mesma
 * tabela.
 *
 * Agora é uma conciliação: atualiza quem já existe (mantendo o id), insere quem
 * é novo e remove só o que sumiu da lista.
 */
app.post("/api/products/sync", requireUser, async (req: any, res) => {
  try {
    const incomingProducts = req.body;
    if (!Array.isArray(incomingProducts)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const userId = req.currentUser.id;

    await db.transaction(async (tx: any) => {
      const existentes = await tx.select({ id: products.id }).from(products)
        .where(and(eq(products.userId, userId), eq(products.isSample, false)));
      const idsExistentes = new Set<string>(existentes.map((p: any) => String(p.id)));

      const idsMantidos = new Set<string>();

      for (const p of incomingProducts) {
        const campos = camposDoProduto(p);
        const id = typeof p?.id === "string" ? p.id : null;

        if (id && idsExistentes.has(id)) {
          idsMantidos.add(id);
          await tx.update(products)
            .set({ ...campos, updatedAt: new Date() })
            .where(and(eq(products.id, id), eq(products.userId, userId)));
          continue;
        }

        // Produto que ainda não existe no banco (criado offline, ou vindo do
        // modo visitante depois do login). O id local não serve como id do
        // banco, então nasce um novo e a resposta devolve a lista conciliada
        // para o cliente adotar os ids de verdade.
        const [criado] = await tx.insert(products)
          .values({ userId, ...campos, isSample: false })
          .returning({ id: products.id });
        idsMantidos.add(criado.id);
      }

      const removidos: string[] = [...idsExistentes].filter(id => !idsMantidos.has(id));
      if (removidos.length > 0) {
        await tx.delete(products)
          .where(and(eq(products.userId, userId), inArray(products.id, removidos)));
      }
    });

    const atualizados = await db.select().from(products)
      .where(eq(products.userId, userId))
      .orderBy(asc(products.createdAt), asc(products.id));

    res.json({ success: true, products: atualizados.map(mapearProduto) });
  } catch (error) {
    res.status(500).json({ error: "Erro ao sincronizar produtos" });
  }
});

app.post("/api/products", requireUser, checkProductLimit, async (req: any, res) => {
  const newProduct = await db.insert(products).values({
    userId: req.currentUser.id,
    ...camposDoProduto(req.body),
    isSample: false
  }).returning();

  res.json({ success: true, product: mapearProduto(newProduct[0]) });
});
app.put("/api/products/:id", requireUser, async (req: any, res) => {
  const updated = await db.update(products)
    .set({ ...camposDoProduto(req.body), updatedAt: new Date() })
    .where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id))).returning();
  if (updated.length > 0) {
    res.json({ success: true, product: mapearProduto(updated[0]) });
  } else res.status(404).json({ error: "Produto não encontrado" });
});
app.delete("/api/products/:id", requireUser, async (req: any, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) {
     // If it's not a valid UUID, just return success (likely a local-only sample item)
     return res.json({ success: true, warning: 'Invalid UUID format ignored' });
  }
  await db.delete(products).where(and(eq(products.id, req.params.id as any), eq(products.userId, req.currentUser.id)));
  res.json({ success: true });
});

async function requireExcelImport(req: any, res: any, next: any) {
  if (await isFreeModeEnabled()) return next();
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
      const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo ?? row.cmv ?? row["Custo Variável"] ?? row.custo_variavel;
      const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;
      const vendasProjetadas = row.vendas_projetadas ?? row["Vendas Projetadas"] ?? row.vendas ?? row.projetadas ?? 0;
      
      if (!nome) {
        errors.push({ linha: i + 2, motivo: "Faltando nome do produto" });
        return;
      }
      
      const parsedCusto = precoCusto != null && !isNaN(Number(precoCusto)) ? Number(precoCusto) : 0;
      const parsedVenda = precoVenda != null && !isNaN(Number(precoVenda)) ? Number(precoVenda) : 0;
      
      validRows.push({nome, precoCusto: parsedCusto, precoVenda: parsedVenda, vendasProjetadas});
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
        salePrice: Number(row.precoVenda),
        projectedSales: row.vendasProjetadas != null ? Number(row.vendasProjetadas) : 0,
        imposto: 0,
        taxaCartao: 0,
        comissao: 0,
        margem: 0,
        precoIdeal: Number(row.precoVenda),
        precoFixo: Number(row.precoVenda),
        percentualRateio: 0,
        modoPrecificacao: Number(row.precoVenda) > 0 ? 'preco' : 'margem',
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

// Limpa todos os produtos de um usuário (mesmo efeito do "Limpar Todos" da aba Custos Variáveis,
// só que acionado pelo admin de dentro de "Gerenciar Dados do Cliente")
app.delete("/api/admin/users/:userId/products", requireAdmin, async (req: any, res) => {
  try {
    await db.delete(products).where(and(eq(products.userId, req.params.userId), eq(products.isSample, false)));
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao limpar produtos (admin):", error);
    res.status(500).json({ error: "Erro ao limpar produtos do usuário." });
  }
});

// Importa uma planilha de produtos para um usuário específico, em nome do admin.
// Reaproveita o mesmo parser de /api/products/import, mas sem checar o limite do plano
// do cliente, já que é uma ação deliberada do admin.
app.post("/api/admin/users/:userId/products/import", requireAdmin, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const validRows: any[] = [];
    const errors: any[] = [];
    rows.forEach((row, i) => {
      const nome = row.nome || row.Nome || row.produto || row.Produto;
      const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo ?? row.cmv ?? row["Custo Variável"] ?? row.custo_variavel;
      const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;
      const vendasProjetadas = row.vendas_projetadas ?? row["Vendas Projetadas"] ?? row.vendas ?? row.projetadas ?? 0;

      if (!nome) {
        errors.push({ linha: i + 2, motivo: "Faltando nome do produto" });
        return;
      }

      const parsedCusto = precoCusto != null && !isNaN(Number(precoCusto)) ? Number(precoCusto) : 0;
      const parsedVenda = precoVenda != null && !isNaN(Number(precoVenda)) ? Number(precoVenda) : 0;

      validRows.push({ nome, precoCusto: parsedCusto, precoVenda: parsedVenda, vendasProjetadas });
    });

    const imported = [];
    for (const row of validRows) {
      const inserted = await db.insert(products).values({
        userId: req.params.userId,
        name: row.nome,
        costPrice: Number(row.precoCusto),
        salePrice: Number(row.precoVenda),
        projectedSales: row.vendasProjetadas != null ? Number(row.vendasProjetadas) : 0,
        imposto: 0,
        taxaCartao: 0,
        comissao: 0,
        margem: 0,
        precoIdeal: Number(row.precoVenda),
        precoFixo: Number(row.precoVenda),
        percentualRateio: 0,
        modoPrecificacao: Number(row.precoVenda) > 0 ? 'preco' : 'margem',
        isSample: false
      }).returning();
      imported.push(inserted[0]);
    }
    res.json({ success: true, importedCount: imported.length, imported, errors });
  } catch (error) {
    console.error("Erro ao importar planilha (admin):", error);
    res.status(500).json({ error: "Erro ao processar a planilha." });
  }
});

// ---------------------------------------------------------------------------
// Importação de XML de NF-e
//
// A empresa envia os XMLs de compra e de venda misturados; quem separa é o
// CNPJ/CPF cadastrado: se ela é a emitente da nota, é venda; se é a
// destinatária, é compra. Tudo é gravado com a competência (AAAA-MM) da data de
// emissão, porque o mesmo produto muda de preço de um mês para o outro.
// ---------------------------------------------------------------------------

// Um .zip com as notas de um mês inteiro passa fácil dos 5 MB de um XML avulso.
const TAMANHO_MAXIMO_ARQUIVO = 60 * 1024 * 1024;
const MAXIMO_ARQUIVOS = 300;
/** Tetos de descompactação, para um zip malicioso não estourar a memória. */
const MAXIMO_ENTRADAS_POR_ZIP = 3000;
const MAXIMO_BYTES_DESCOMPACTADOS = 300 * 1024 * 1024;

const uploadXml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO, files: MAXIMO_ARQUIVOS },
});

/** Um XML a processar, já com o nome que o usuário vai ver em caso de erro. */
interface ArquivoParaLer {
  nome: string;
  conteudo: string;
}

function ehZip(nome: string, buffer: Buffer): boolean {
  if (/\.zip$/i.test(nome)) return true;
  // Assinatura "PK\x03\x04": vale quando o navegador manda o mimetype errado.
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Abre um .zip e devolve os XMLs de dentro, inclusive os que estão em subpastas.
 *
 * Nada é gravado em disco — as entradas são lidas para a memória —, então não há
 * risco de path traversal. O que é preciso limitar é o tamanho descompactado,
 * para um arquivo pequeno de propósito não virar gigabytes na memória.
 */
function extrairXmlsDoZip(nomeZip: string, buffer: Buffer): {
  arquivos: ArquivoParaLer[];
  ignoradas: { arquivo: string; motivo: string }[];
} {
  const arquivos: ArquivoParaLer[] = [];
  const ignoradas: { arquivo: string; motivo: string }[] = [];

  let entradas: any[];
  try {
    entradas = new AdmZip(buffer).getEntries();
  } catch {
    return { arquivos, ignoradas: [{ arquivo: nomeZip, motivo: "Não foi possível abrir o .zip. Ele pode estar corrompido ou protegido por senha." }] };
  }

  let bytes = 0;
  let lidas = 0;
  let outrosFormatos = 0;

  for (const entrada of entradas) {
    if (entrada.isDirectory) continue;
    const caminho = String(entrada.entryName || "");
    // Lixo que o macOS coloca dentro dos zips.
    if (caminho.startsWith("__MACOSX/") || caminho.split("/").pop()?.startsWith("._")) continue;

    if (!/\.xml$/i.test(caminho)) {
      if (/\.zip$/i.test(caminho)) {
        ignoradas.push({ arquivo: `${nomeZip} › ${caminho}`, motivo: "Zip dentro de zip não é aberto. Descompacte antes de enviar." });
      } else {
        outrosFormatos += 1;
      }
      continue;
    }

    if (lidas >= MAXIMO_ENTRADAS_POR_ZIP) {
      ignoradas.push({ arquivo: nomeZip, motivo: `O .zip tem mais de ${MAXIMO_ENTRADAS_POR_ZIP} XMLs. Divida em partes menores.` });
      break;
    }

    const tamanho = Number(entrada.header?.size ?? 0);
    if (bytes + tamanho > MAXIMO_BYTES_DESCOMPACTADOS) {
      ignoradas.push({ arquivo: nomeZip, motivo: "O conteúdo do .zip é grande demais para ser lido de uma vez. Divida em partes menores." });
      break;
    }

    try {
      arquivos.push({ nome: `${nomeZip} › ${caminho}`, conteudo: entrada.getData().toString("utf8") });
      bytes += tamanho;
      lidas += 1;
    } catch {
      ignoradas.push({ arquivo: `${nomeZip} › ${caminho}`, motivo: "Não foi possível ler este arquivo de dentro do .zip." });
    }
  }

  if (arquivos.length === 0 && ignoradas.length === 0) {
    ignoradas.push({
      arquivo: nomeZip,
      motivo: outrosFormatos > 0
        ? `O .zip não tem nenhum XML — só ${outrosFormatos} arquivo(s) de outros formatos.`
        : "O .zip está vazio.",
    });
  }

  return { arquivos, ignoradas };
}

app.post("/api/fiscal/import", requireUser, uploadXml.array("files", 300), async (req: any, res) => {
  const documentoEmpresa = somenteDigitos(req.currentUser.taxId);
  if (documentoEmpresa.length !== 11 && documentoEmpresa.length !== 14) {
    return res.status(400).json({
      error: "Cadastre o CNPJ ou CPF da sua empresa em Minha Conta antes de importar notas.",
      faltaDocumento: true,
    });
  }

  const enviados: any[] = req.files || [];
  if (enviados.length === 0) return res.status(400).json({ error: "Nenhum arquivo enviado." });

  const importadas: any[] = [];
  const ignoradas: { arquivo: string; motivo: string }[] = [];

  // Os .zip são abertos aqui: daqui para baixo tudo é XML, venha ele solto ou de
  // dentro de um pacote.
  const arquivos: ArquivoParaLer[] = [];
  let zipsAbertos = 0;
  for (const enviado of enviados) {
    const nome = enviado.originalname || "arquivo";
    if (ehZip(nome, enviado.buffer)) {
      const extraido = extrairXmlsDoZip(nome, enviado.buffer);
      arquivos.push(...extraido.arquivos);
      ignoradas.push(...extraido.ignoradas);
      if (extraido.arquivos.length > 0) zipsAbertos += 1;
      continue;
    }
    if (!/\.xml$/i.test(nome)) {
      ignoradas.push({ arquivo: nome, motivo: "Formato não aceito. Envie o XML da nota ou um .zip com os XMLs dentro." });
      continue;
    }
    arquivos.push({ nome, conteudo: enviado.buffer.toString("utf8") });
  }

  if (arquivos.length === 0) {
    return res.json({
      success: true,
      importadas: [],
      ignoradas,
      totalImportadas: 0,
      totalIgnoradas: ignoradas.length,
      totalCompras: 0,
      totalVendas: 0,
      zipsAbertos,
      xmlsLidos: 0,
    });
  }

  // As chaves já gravadas evitam recontar a mesma nota em uma reimportação.
  const jaImportadas = new Set(
    (await db.select({ chave: fiscalDocuments.chave })
      .from(fiscalDocuments)
      .where(eq(fiscalDocuments.userId, req.currentUser.id)))
      .map((d: any) => d.chave)
  );

  for (const arquivo of arquivos) {
    const nomeArquivo = arquivo.nome;
    try {
      const nota = lerNotaFiscal(arquivo.conteudo);
      if (jaImportadas.has(nota.chave)) {
        ignoradas.push({ arquivo: nomeArquivo, motivo: "Nota já importada antes." });
        continue;
      }
      const { direcao, motivo } = direcaoDaNota(nota, documentoEmpresa);

      await db.transaction(async (tx: any) => {
        const inserida = await tx.insert(fiscalDocuments).values({
          userId: req.currentUser.id,
          chave: nota.chave,
          direcao,
          modelo: nota.modelo,
          numero: nota.numero,
          serie: nota.serie,
          dataEmissao: new Date(nota.dataEmissao),
          competencia: nota.competencia,
          naturezaOperacao: nota.naturezaOperacao,
          emitenteDoc: nota.emitente.doc || null,
          emitenteNome: nota.emitente.nome,
          destinatarioDoc: nota.destinatario.doc || null,
          destinatarioNome: nota.destinatario.nome,
          valorTotal: nota.valorTotal,
          nomeArquivo,
        }).returning();

        const documentId = inserida[0].id;
        for (const item of nota.itens) {
          await tx.insert(fiscalItems).values({
            documentId,
            userId: req.currentUser.id,
            direcao,
            competencia: nota.competencia,
            numero: item.numero,
            codigo: item.codigo,
            ean: item.ean,
            descricao: item.descricao,
            ncm: item.ncm,
            cfop: item.cfop,
            unidade: item.unidade,
            unidadeComercial: item.unidadeComercial,
            quantidadeComercial: item.quantidadeComercial,
            fatorConversao: item.fatorConversao,
            convertidoPorEmbalagem: item.convertidoPorEmbalagem,
            natureza: item.natureza,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorProduto: item.valorProduto,
            desconto: item.desconto,
            frete: item.frete,
            seguro: item.seguro,
            outros: item.outros,
            icms: item.icms,
            icmsSt: item.icmsSt,
            ipi: item.ipi,
            pis: item.pis,
            cofins: item.cofins,
            valorLiquido: item.valorLiquido,
            chaveProduto: item.chaveProduto,
            eanComercial: item.eanComercial,
            origemChave: item.origemChave,
          });
        }
      });

      jaImportadas.add(nota.chave);
      importadas.push({
        chave: nota.chave,
        numero: nota.numero,
        direcao,
        motivo,
        competencia: nota.competencia,
        itens: nota.itens.length,
        valorTotal: nota.valorTotal,
      });
    } catch (err: any) {
      const motivo = err instanceof ErroNotaFiscal ? err.message : "Não foi possível ler este XML.";
      ignoradas.push({ arquivo: nomeArquivo, motivo });
    }
  }

  // Um zip com centenas de notas geraria uma resposta enorme; a tela só precisa
  // dos totais e de uma amostra do que não entrou.
  const LIMITE_DETALHE = 200;
  res.json({
    success: true,
    importadas: importadas.slice(0, LIMITE_DETALHE),
    ignoradas: ignoradas.slice(0, LIMITE_DETALHE),
    totalImportadas: importadas.length,
    totalIgnoradas: ignoradas.length,
    totalCompras: importadas.filter(n => n.direcao === "compra").length,
    totalVendas: importadas.filter(n => n.direcao === "venda").length,
    zipsAbertos,
    xmlsLidos: arquivos.length,
  });
});

/** Resumo por produto e competência, que alimenta a análise de preços. */
app.get("/api/fiscal/resumo", requireUser, async (req: any, res) => {
  const de = typeof req.query.de === "string" && /^\d{4}-\d{2}$/.test(req.query.de) ? req.query.de : undefined;
  const ate = typeof req.query.ate === "string" && /^\d{4}-\d{2}$/.test(req.query.ate) ? req.query.ate : undefined;

  const filtros: any[] = [eq(fiscalItems.userId, req.currentUser.id)];
  if (de) filtros.push(gte(fiscalItems.competencia, de));
  if (ate) filtros.push(lte(fiscalItems.competencia, ate));

  const linhas = await db.select().from(fiscalItems).where(and(...filtros));

  const itens: ItemComContexto[] = linhas.map((l: any) => ({
    direcao: l.direcao,
    competencia: l.competencia,
    item: {
      numero: l.numero,
      codigo: l.codigo || "",
      ean: l.ean || "",
      descricao: l.descricao,
      ncm: l.ncm || "",
      cfop: l.cfop || "",
      unidade: l.unidade || "",
      quantidade: l.quantidade,
      valorUnitario: l.valorUnitario,
      unidadeComercial: l.unidadeComercial || "",
      quantidadeComercial: l.quantidadeComercial,
      unidadeTributavel: l.convertidoPorEmbalagem ? (l.unidade || "") : "",
      quantidadeTributavel: l.convertidoPorEmbalagem ? l.quantidade : 0,
      eanTributavel: l.convertidoPorEmbalagem ? (l.ean || "") : "",
      eanComercial: l.eanComercial || "",
      chaveComercial: l.eanComercial || normalizarDescricao(l.descricao),
      fatorConversao: l.fatorConversao,
      convertidoPorEmbalagem: l.convertidoPorEmbalagem,
      valorProduto: l.valorProduto,
      desconto: l.desconto,
      frete: l.frete,
      seguro: l.seguro,
      outros: l.outros,
      icms: l.icms,
      icmsSt: l.icmsSt,
      ipi: l.ipi,
      pis: l.pis,
      cofins: l.cofins,
      natureza: l.natureza,
      valorLiquido: l.valorLiquido,
      valorUnitarioLiquido: l.quantidade > 0 ? l.valorLiquido / l.quantidade : 0,
      chaveProduto: l.chaveProduto,
      origemChave: l.origemChave,
    },
  }));

  const vinculos = await db.select().from(fiscalProductLinks)
    .where(eq(fiscalProductLinks.userId, req.currentUser.id));

  // Nada é aplicado sem o usuário confirmar — nem o que veio da unidade
  // tributável da nota. Vínculos entre produtos diferentes (manual/sugestão)
  // são resolvidos por `aplicarVinculos`; as conversões de embalagem declaradas
  // na nota são tratadas item a item logo abaixo, porque o parser já converteu.
  const confirmados = vinculos.filter((v: any) => v.status === "confirmado" && v.origem !== "nota");
  const conversoesConfirmadas = new Map<string, any>();
  for (const v of vinculos) {
    if (v.origem === "nota" && v.status === "confirmado") conversoesConfirmadas.set(v.chaveOrigem, v);
  }

  /** Quantidade na unidade da embalagem, antes de qualquer conversão. */
  const quantidadeNaEmbalagem = (item: any) =>
    item.quantidadeComercial > 0
      ? item.quantidadeComercial
      : (item.fatorConversao > 0 ? item.quantidade / item.fatorConversao : item.quantidade);

  const itensAjustados = itens.map(entrada => {
    const item = entrada.item;
    if (!item.convertidoPorEmbalagem) return entrada;

    const confirmada = conversoesConfirmadas.get(item.chaveComercial);
    if (confirmada) {
      // Confirmada: vale o fator que o usuário aceitou, que pode ser diferente
      // do declarado se a nota veio errada. Recalculamos a partir da quantidade
      // da embalagem para não acumular arredondamento.
      const fator = confirmada.fator > 0 ? confirmada.fator : item.fatorConversao;
      const quantidade = quantidadeNaEmbalagem(item) * fator;
      return {
        ...entrada,
        item: {
          ...item,
          quantidade,
          valorUnitario: quantidade > 0 ? item.valorProduto / quantidade : 0,
          valorUnitarioLiquido: quantidade > 0 ? item.valorLiquido / quantidade : 0,
          fatorConversao: fator,
        },
      };
    }

    // Pendente ou recusada: o item volta a ser contado na embalagem. O GTIN
    // também volta ao da embalagem — senão a embalagem e a unidade apareceriam
    // na tela com o mesmo código de barras.
    const quantidade = quantidadeNaEmbalagem(item);
    return {
      ...entrada,
      item: {
        ...item,
        chaveProduto: item.chaveComercial,
        ean: item.eanComercial,
        origemChave: (item.eanComercial ? "ean" : "descricao") as "ean" | "descricao",
        unidade: item.unidadeComercial || item.unidade,
        quantidade,
        valorUnitario: quantidade > 0 ? item.valorProduto / quantidade : 0,
        valorUnitarioLiquido: quantidade > 0 ? item.valorLiquido / quantidade : 0,
        convertidoPorEmbalagem: false,
      },
    };
  });

  const produtos = resumirPorProdutoPeriodo(aplicarVinculos(itensAjustados, confirmados as any), { de, ate });

  // Conversões que a nota declarou e ainda esperam decisão.
  const decididas = new Set<string>(vinculos.map((v: any) => v.chaveOrigem));
  const conversoesPendentes = new Map<string, any>();
  for (const { item } of itens) {
    if (!item.convertidoPorEmbalagem) continue;
    if (decididas.has(item.chaveComercial)) continue;
    if (conversoesPendentes.has(item.chaveComercial)) continue;
    conversoesPendentes.set(item.chaveComercial, {
      chaveOrigem: item.chaveComercial,
      chaveDestino: item.chaveProduto,
      fator: item.fatorConversao,
      nomeOrigem: item.descricao,
      nomeDestino: item.descricao,
      unidadeComercial: item.unidadeComercial,
      unidadeTributavel: item.unidadeTributavel || item.unidade,
    });
  }

  // O que já está na fila como conversão da nota não precisa virar sugestão por
  // semelhança de descrição: a nota traz o fator exato, é a proposta melhor.
  const jaResolvidas = new Set<string>([...decididas, ...conversoesPendentes.keys()]);
  const sugestoesNovas = sugerirVinculos(produtos, { jaResolvidas });

  // Elasticidade-preço de cada produto, do próprio histórico. A série é a mesma
  // que a tela já mostra: um ponto por competência com venda. Em boa parte dos
  // casos a resposta é "não dá para dizer", e é ela que vai para a tela — um
  // coeficiente mal estimado é pior que nenhum, porque parece preciso.
  const produtosComElasticidade = produtos.map(p => ({
    ...p,
    elasticidade: estimarElasticidade(
      p.periodos.map(per => ({
        competencia: per.competencia,
        preco: per.precoMedio,
        quantidade: per.quantidadeVendida,
      }))
    ),
  }));

  const competencias = [...new Set(linhas.map((l: any) => l.competencia))].sort();
  res.json({
    competencias,
    produtos: produtosComElasticidade,
    vinculos: vinculos.map((v: any) => ({
      id: v.id,
      chaveOrigem: v.chaveOrigem,
      chaveDestino: v.chaveDestino,
      fator: v.fator,
      status: v.status,
      origem: v.origem,
      motivo: v.motivo,
      nomeOrigem: v.nomeOrigem,
      nomeDestino: v.nomeDestino,
    })),
    sugestoes: sugestoesNovas,
    conversoesDaNota: [...conversoesPendentes.values()],
  });
});

// ---------------------------------------------------------------------------
// Vínculos entre produtos com unidades diferentes (fardo × unidade)
// ---------------------------------------------------------------------------

app.post("/api/fiscal/vinculos", requireUser, async (req: any, res) => {
  try {
    const chaveOrigem = String(req.body?.chaveOrigem ?? "").trim();
    const chaveDestino = String(req.body?.chaveDestino ?? "").trim();
    const fator = Number(req.body?.fator);

    if (!chaveOrigem || !chaveDestino) return res.status(400).json({ error: "Informe os dois produtos." });
    if (chaveOrigem === chaveDestino) return res.status(400).json({ error: "Escolha dois produtos diferentes." });
    if (!Number.isFinite(fator) || fator <= 0) return res.status(400).json({ error: "A quantidade por embalagem precisa ser maior que zero." });

    // Um vínculo de volta fecharia um ciclo (A→B e B→A) e nada seria convertido.
    const existentes = await db.select().from(fiscalProductLinks)
      .where(eq(fiscalProductLinks.userId, req.currentUser.id));
    if (existentes.some((v: any) => v.chaveOrigem === chaveDestino && v.chaveDestino === chaveOrigem)) {
      return res.status(400).json({ error: "Já existe um vínculo no sentido contrário entre esses dois produtos." });
    }

    const statusPedido = String(req.body?.status ?? "confirmado");
    const status = ["confirmado", "sugerido", "descartado"].includes(statusPedido) ? statusPedido : "confirmado";
    const origemPedida = String(req.body?.origem ?? "manual");
    const origem = ["manual", "nota", "sugestao"].includes(origemPedida) ? origemPedida : "manual";

    const valores = {
      userId: req.currentUser.id,
      chaveOrigem,
      chaveDestino,
      fator,
      status,
      origem,
      motivo: String(req.body?.motivo ?? "").trim() || null,
      nomeOrigem: String(req.body?.nomeOrigem ?? "").trim() || null,
      nomeDestino: String(req.body?.nomeDestino ?? "").trim() || null,
    };

    const salvo = await db.insert(fiscalProductLinks).values(valores)
      .onConflictDoUpdate({
        target: [fiscalProductLinks.userId, fiscalProductLinks.chaveOrigem],
        set: {
          chaveDestino, fator, status, origem,
          motivo: valores.motivo, nomeOrigem: valores.nomeOrigem, nomeDestino: valores.nomeDestino,
        },
      })
      .returning();

    res.json({ success: true, vinculo: salvo[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao salvar o vínculo." });
  }
});

app.delete("/api/fiscal/vinculos/:id", requireUser, async (req: any, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) return res.status(400).json({ error: "Identificador inválido." });
  await db.delete(fiscalProductLinks).where(and(
    eq(fiscalProductLinks.id, req.params.id as any),
    eq(fiscalProductLinks.userId, req.currentUser.id)
  ));
  res.json({ success: true });
});

/** Notas importadas, da mais recente para a mais antiga. */
app.get("/api/fiscal/documentos", requireUser, async (req: any, res) => {
  const docs = await db.select().from(fiscalDocuments)
    .where(eq(fiscalDocuments.userId, req.currentUser.id))
    .orderBy(desc(fiscalDocuments.dataEmissao));
  res.json(docs.map((d: any) => ({
    id: d.id,
    chave: d.chave,
    direcao: d.direcao,
    numero: d.numero,
    serie: d.serie,
    competencia: d.competencia,
    dataEmissao: d.dataEmissao,
    naturezaOperacao: d.naturezaOperacao,
    participante: d.direcao === "compra" ? d.emitenteNome : d.destinatarioNome,
    valorTotal: d.valorTotal,
    nomeArquivo: d.nomeArquivo,
  })));
});

app.delete("/api/fiscal/documentos/:id", requireUser, async (req: any, res) => {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(req.params.id)) return res.status(400).json({ error: "Identificador inválido." });
  await db.transaction(async (tx: any) => {
    await tx.delete(fiscalItems).where(and(
      eq(fiscalItems.documentId, req.params.id as any),
      eq(fiscalItems.userId, req.currentUser.id)
    ));
    await tx.delete(fiscalDocuments).where(and(
      eq(fiscalDocuments.id, req.params.id as any),
      eq(fiscalDocuments.userId, req.currentUser.id)
    ));
  });
  res.json({ success: true });
});

/** Apaga tudo que foi importado — útil para recomeçar do zero. */
app.delete("/api/fiscal/documentos", requireUser, async (req: any, res) => {
  await db.transaction(async (tx: any) => {
    await tx.delete(fiscalItems).where(eq(fiscalItems.userId, req.currentUser.id));
    await tx.delete(fiscalDocuments).where(eq(fiscalDocuments.userId, req.currentUser.id));
  });
  res.json({ success: true });
});

/**
 * Aplica ao cadastro de produtos os valores apurados na competência escolhida.
 * Produtos que já existem (mesmo nome) são atualizados; os que não existem são
 * criados, respeitando o limite do plano.
 */
app.post("/api/fiscal/aplicar", requireUser, async (req: any, res) => {
  try {
    const escolhas: any[] = Array.isArray(req.body?.produtos) ? req.body.produtos : [];
    if (escolhas.length === 0) return res.status(400).json({ error: "Nenhum produto selecionado." });

    const plan = PLANS[req.currentUser.planId as PlanId] || PLANS.basico;
    const existentes = await db.select().from(products)
      .where(and(eq(products.userId, req.currentUser.id), eq(products.isSample, false)));

    // O elo forte é a chave fiscal, gravada na primeira vez que este produto
    // recebeu valores de uma nota. O nome é só a rede de segurança para o que
    // foi cadastrado antes de existir chave — e é uma rede furada: renomear o
    // produto no cadastro fazia a próxima aplicação não encontrar nada e criar
    // um segundo produto, silenciosamente.
    const porChave = new Map<string, any>();
    const porNome = new Map<string, any>();
    for (const p of existentes) {
      if (p.chaveFiscal) porChave.set(p.chaveFiscal, p);
      porNome.set(String(p.name).trim().toLowerCase(), p);
    }

    let criados = 0;
    let atualizados = 0;
    const semEspaco: string[] = [];

    for (const escolha of escolhas) {
      const nome = String(escolha.nome ?? "").trim();
      if (!nome) continue;
      const cmv = Number(escolha.cmv) || 0;
      const precoVenda = Number(escolha.precoVenda) || 0;
      const vendasProjetadas = Number(escolha.vendasProjetadas) || 0;
      const chaveFiscal = String(escolha.chaveProduto ?? "").trim() || null;
      const existente = (chaveFiscal && porChave.get(chaveFiscal)) || porNome.get(nome.toLowerCase());

      if (existente) {
        // Só sobrescreve o que a importação de fato apurou: um produto sem
        // compra no período não pode zerar o CMV que já estava cadastrado.
        const patch: any = {};
        // Produto cadastrado antes de existir chave: este é o momento de
        // amarrá-lo, e a partir daqui o nome pode mudar à vontade.
        if (chaveFiscal && !existente.chaveFiscal) patch.chaveFiscal = chaveFiscal;
        if (cmv > 0) patch.costPrice = cmv;
        if (precoVenda > 0) {
          patch.salePrice = precoVenda;
          patch.precoFixo = precoVenda;
          patch.modoPrecificacao = "preco";
        }
        if (vendasProjetadas > 0) patch.projectedSales = vendasProjetadas;
        if (Object.keys(patch).length === 0) continue;
        await db.update(products).set(patch)
          .where(and(eq(products.id, existente.id), eq(products.userId, req.currentUser.id)));
        atualizados += 1;
      } else {
        if (existentes.length + criados >= plan.productLimit) {
          semEspaco.push(nome);
          continue;
        }
        const [novo] = await db.insert(products).values({
          userId: req.currentUser.id,
          name: nome,
          costPrice: cmv,
          salePrice: precoVenda,
          projectedSales: vendasProjetadas,
          precoFixo: precoVenda,
          modoPrecificacao: precoVenda > 0 ? "preco" : "margem",
          chaveFiscal,
          isSample: false,
        }).returning();
        // Entra no mapa para que a mesma chave, repetida na seleção, atualize
        // este produto em vez de criar outro.
        if (chaveFiscal) porChave.set(chaveFiscal, novo);
        porNome.set(nome.toLowerCase(), novo);
        criados += 1;
      }
    }

    res.json({ success: true, criados, atualizados, semEspaco });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao aplicar os valores das notas." });
  }
});

app.post("/api/checkout/upgrade", requireUser, async (req: any, res) => {
  try {
    if (await isFreeModeEnabled()) {
      return res.status(400).json({ error: "Pagamentos estão temporariamente desativados. Sua conta já tem acesso ilimitado gratuito no momento." });
    }
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
      console.log("Executando drizzle-kit push (sincronização do schema)...");
      execSync("npx drizzle-kit push --force", { stdio: "inherit", env: process.env });
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