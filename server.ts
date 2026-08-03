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
import { store } from "./src/db/schema.js";
import { eq, sql } from "drizzle-orm";

async function getStore(key: string): Promise<any[]> {
  try {
    const res = await db.select().from(store).where(eq(store.key, key));
    return res.length > 0 ? (res[0].value as any[]) : [];
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



async function getFixedCosts() { return await getStore('fixed_costs'); }
async function saveFixedCosts(costs: any) { await saveStore('fixed_costs', costs); }
async function getWebhookEvents() { return await getStore('webhook_events'); }
async function saveWebhookEvents(events: any) { await saveStore('webhook_events', events); }
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



dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development_only";


const app = express();
const PORT = 3000;

app.use(express.json({ 
  limit: "50mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(cookieParser());

const DATA_FILE = path.join(process.cwd(), "data", "courses.json");
const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

// Nodemailer transport setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


// Simple helper to read/write JSON
// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

async function requireUser(req: any, res: any, next: any) {
  const token = req.cookies.user_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    const users = await getUsers();
    const user = users.find((u: any) => u.email === payload.email);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
    req.currentUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

export const PLANS = {
  basico: {
    id: "basico",
    name: "Básico",
    priceCents: 949,
    productLimit: 20,
    excelImport: false,
    consultingCall: false
  },
  intermediario: {
    id: "intermediario",
    name: "Intermediário",
    priceCents: 2749,
    productLimit: 80,
    excelImport: true,
    consultingCall: false
  },
  ilimitado: {
    id: "ilimitado",
    name: "Ilimitado",
    priceCents: 5990,
    productLimit: Number.MAX_SAFE_INTEGER,
    excelImport: true,
    consultingCall: true
  }
} as const;

export type PlanId = keyof typeof PLANS;

const PAYMENTS_FILE = path.join(process.cwd(), "data", "payments.json");
const PRODUCTS_FILE = path.join(process.cwd(), "data", "products.json");




// API Routes

// Admin routes (protected)
app.get("/api/admin/courses", requireAuth, async (req, res) => {
  const courses = await getCourses();
  res.json(courses);
});

app.post("/api/admin/courses", requireAuth, async (req, res) => {
  const courses = await getCourses();
  const newCourse = req.body;
  courses.push(newCourse);
  await saveCourses(courses);
  res.json(newCourse);
});

app.put("/api/admin/courses/:slug", requireAuth, async (req, res) => {
  const courses = await getCourses();
  const index = courses.findIndex((c: any) => c.slug === req.params.slug);
  if (index !== -1) {
    courses[index] = req.body;
    await saveCourses(courses);
    res.json(courses[index]);
  } else {
    res.status(404).json({ error: "Course not found" });
  }
});

app.delete("/api/admin/courses/:slug", requireAuth, async (req, res) => {
  let courses = await getCourses();
  courses = courses.filter((c: any) => c.slug !== req.params.slug);
  await saveCourses(courses);
  res.json({ success: true });
});

app.get("/api/admin/leads", requireAuth, async (req, res) => {
  const leads = await getLeads();
  res.json(leads);
});

app.delete("/api/admin/leads", requireAuth, async (req, res) => {
  const { timestamps } = req.body;
  if (!Array.isArray(timestamps)) {
    return res.status(400).json({ error: "Invalid data" });
  }
  let leads = await getLeads();
  leads = leads.filter((lead: any) => !timestamps.includes(lead.timestamp));
  await saveLeads(leads);
  res.json({ success: true });
});

// Public courses list route
app.get("/api/courses", async (req, res) => {
  const courses = await getCourses();
  const list = courses.map((c: any) => ({
    slug: c.slug,
    courseName: c.courseName,
    description: c.description,
    moduleCount: c.modules?.length || 0
  }));
  res.json(list);
});

// Public course route
app.get("/api/courses/:slug", async (req, res) => {
  const courses = await getCourses();
  const course = courses.find((c: any) => c.slug === req.params.slug);
  if (course) {
    res.json(course);
  } else {
    res.status(404).json({ error: "Course not found" });
  }
});

// Public lead route
app.post("/api/leads", async (req, res) => {
  const leads = await getLeads();
  const newLead = {
    ...req.body,
    timestamp: new Date().toISOString()
  };
  leads.push(newLead);
  await saveLeads(leads);
  res.json(newLead);
});

// Registration route
app.post("/api/register", async (req, res) => {
  try {
    const { name, phone } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Preencha todos os campos." });
    }

    const users = await getUsers();
    
    // Verify if user already exists
    if (users.find((u: any) => u.email === email)) {
      return res.status(400).json({ error: "E-mail já cadastrado" });
    }

    const activationToken = crypto.randomBytes(20).toString('hex');
    
    const newUser = { 
      name, 
      email, 
      phone,
      passwordHash: null,
      role: 'user',
      isActivated: false,
      activationToken,
      plan: null,
      productLimit: 0,
      proSince: null,
      timestamp: new Date().toISOString() 
    };
    
    users.push(newUser);
    await saveUsers(users);

    // Prepare email
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const fromName = process.env.SMTP_FROM_NAME || "Cadastro - Vírgula Contábil";
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
      
      const appHost = req.get('host') || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const verificationLink = `${protocol}://${appHost}/verify?token=${activationToken}`;
      
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: "Ative sua conta e crie sua senha - Vírgula Contábil",
          text: `Olá ${name},

Obrigado por se cadastrar!

Por favor, ative sua conta e defina sua senha clicando no link: ${verificationLink}

Atenciosamente,
Equipe Vírgula Contábil`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #10b981; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">Bem-vindo à Vírgula Contábil</h2>
              </div>
              <div style="padding: 30px;">
                <p>Olá <strong>${name}</strong>,</p>
                <p>Obrigado por se cadastrar na nossa plataforma.</p>
                <p>Para começar a utilizar todas as ferramentas, por favor ative sua conta e defina sua senha clicando no botão abaixo:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ativar e Criar Senha</a>
                </div>
                <p>Ou acesse pelo link: <a href="${verificationLink}">${verificationLink}</a></p>
                <br/>
                <p>Atenciosamente,</p>
                <p><strong>Equipe Vírgula Contábil</strong></p>
              </div>
            </div>
          `
        });
        console.log("Activation email sent to", email);
      } catch (emailError) {
        console.error("Failed to send activation email:", emailError);
      }
    }

    res.json({ success: true, message: 'Usuário cadastrado com sucesso. Verifique seu e-mail para ativar a conta e criar sua senha.' });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/verify/:token", async (req, res) => {
  const users = await getUsers();
  const user = users.find((u: any) => u.activationToken === req.params.token);
  if (user) {
    res.json({ success: true, user: { name: user.name, email: user.email } });
  } else {
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
});

app.post("/api/verify", async (req, res) => {
  const { token, password } = req.body;
  const users = await getUsers();
  
  const userIndex = users.findIndex((u: any) => u.activationToken === token);
  
  if (userIndex !== -1) {
    if (!password) {
      return res.status(400).json({ error: "Senha é obrigatória." });
    }
    
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      users[userIndex].passwordHash = passwordHash;
      users[userIndex].isActivated = true;
      users[userIndex].activationToken = null;
      await saveUsers(users);
      // await seedSampleProducts(users[userIndex].email); // Removido para iniciar zerado
      res.json({ success: true, message: 'Conta ativada com sucesso!' });
    } catch (err) {
      res.status(500).json({ error: "Erro ao salvar senha." });
    }
  } else {
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    
    // Check if it's admin
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const adminToken = jwt.sign(
        { email: process.env.ADMIN_EMAIL, role: 'admin' },
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
        user: { name: 'Admin', email: process.env.ADMIN_EMAIL, role: 'admin', isActivated: true }
      });
    }

    const users = await getUsers();
    const user = users.find((u: any) => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    
    if (!user.passwordHash) {
      return res.status(401).json({ error: "Sua conta ainda não foi ativada ou não tem senha. Verifique seu e-mail." });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    
    if (!user.isActivated) {
      return res.status(403).json({ error: "Sua conta ainda não foi ativada. Verifique seu e-mail." });
    }
    
    // Exclude passwordHash before sending
    const { passwordHash, activationToken, ...userWithoutSensitiveData } = user;
    
    const token = jwt.sign(
      { email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie("user_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.json({ success: true, user: userWithoutSensitiveData });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/me", requireUser, async (req: any, res: any) => {
  const users = await getUsers();
  const user = users.find((u: any) => u.email === req.currentUser.email);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const { passwordHash, activationToken, ...userWithoutSensitiveData } = user;
  res.json({ success: true, user: userWithoutSensitiveData });
});

// Admin Routes for Users
app.get("/api/admin/users", requireAuth, async (req, res) => {
  const users = (await getUsers()).map((u: any) => {
    const { passwordHash, activationToken, ...user } = u;
    return user;
  });
  res.json(users);
});

app.delete("/api/admin/users/:email", requireAuth, async (req, res) => {
  let users = await getUsers();
  const emailToDelete = req.params.email;
  users = users.filter((u: any) => u.email !== emailToDelete);
  await saveUsers(users);
  res.json({ success: true });
});

app.post("/api/change-password", requireUser, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const email = req.currentUser.email; // get email from authenticated user
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    
    const user = users[userIndex];
    
    if (!user.passwordHash) {
      return res.status(400).json({ error: "Usuário sem senha cadastrada" });
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    users[userIndex].passwordHash = newPasswordHash;
    await saveUsers(users);
    
    res.json({ success: true, message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });

    const users = await getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "E-mail não encontrado." });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    users[userIndex].resetTokenHash = resetTokenHash;
    users[userIndex].resetTokenExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
    await saveUsers(users);

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const fromName = process.env.SMTP_FROM_NAME || "Recuperação de Senha - Vírgula Contábil";
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
      
      const appHost = req.get('host') || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const resetLink = `${protocol}://${appHost}/reset-password?token=${resetToken}`;
      
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: email,
          subject: "Recuperação de Senha - Vírgula Contábil",
          text: `Olá ${users[userIndex].name},

Para redefinir sua senha, clique no link a seguir: ${resetLink}

Atenciosamente,
Equipe Vírgula Contábil`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #10b981; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">Recuperação de Senha</h2>
              </div>
              <div style="padding: 30px;">
                <p>Olá <strong>${users[userIndex].name}</strong>,</p>
                <p>Recebemos uma solicitação para redefinir sua senha na plataforma Vírgula Contábil.</p>
                <p>Para criar uma nova senha, clique no botão abaixo:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Redefinir Senha</a>
                </div>
                <p>Ou acesse pelo link: <a href="${resetLink}">${resetLink}</a></p>
                <p>Se você não solicitou esta alteração, apenas ignore este e-mail.</p>
                <br/>
                <p>Atenciosamente,</p>
                <p><strong>Equipe Vírgula Contábil</strong></p>
              </div>
            </div>
          `
        });
      } catch (mailError) {
        console.error("Mail send error:", mailError);
      }
    }
    
    res.json({ success: true, message: "Instruções de recuperação enviadas para seu e-mail." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Dados incompletos." });

    const users = await getUsers();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const userIndex = users.findIndex((u: any) => u.resetTokenHash === tokenHash && u.resetTokenExpiresAt > Date.now());
    
    if (userIndex === -1) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);
    
    users[userIndex].passwordHash = newPasswordHash;
    users[userIndex].resetTokenHash = undefined;
    users[userIndex].resetTokenExpiresAt = undefined;
    await saveUsers(users);
    
    res.json({ success: true, message: "Senha redefinida com sucesso." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/checkout/upgrade", requireUser, async (req: any, res) => {
  try {
    const user = req.currentUser;
    const planId = req.body.planId as PlanId;

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: "Plano inválido." });
    }
    if (user.plan === planId) {
      return res.status(400).json({ error: `Você já está no plano ${plan.name}.` });
    }

    const orderCode = `${plan.id.toUpperCase()}-${user.email}-${Date.now()}`;

    const pagarmeRes = await fetch(`${process.env.PAGARME_API_URL}/paymentlinks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${process.env.PAGARME_SECRET_KEY}:`).toString("base64")
      },
      body: JSON.stringify({
        type: "order",
        name: `Plano ${plan.name} - ${user.email}`,
        order_code: orderCode,
        max_paid_sessions: 1,
        checkout_settings: {
          success_url: `${req.protocol}://${req.get("host")}/`
        },
        payment_settings: {
          accepted_payment_methods: ["credit_card", "pix"],
          credit_card_settings: {
            operation_type: "auth_and_capture",
            installments: [{ number: 1, total: plan.priceCents }]
          },
          pix_settings: { expires_in: 3600 }
        },
        cart_settings: {
          items: [{ amount: plan.priceCents, name: `Plano ${plan.name}`, default_quantity: 1 }]
        }
      })
    });

    const data: any = await pagarmeRes.json();
    if (!pagarmeRes.ok) {
      console.error("Erro Pagar.me:", data);
      return res.status(502).json({ error: "Falha ao criar checkout na Pagar.me" });
    }

    const payments = await getPayments();
    payments.push({
      orderCode,
      email: user.email,
      planId: plan.id,
      paymentLinkId: data.id,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    await savePayments(payments);

    res.json({ url: data.url });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    res.status(500).json({ error: "Erro interno ao criar checkout" });
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
      if (!signature) {
        return res.status(401).json({ error: "Assinatura ausente" });
      }
      const payload = req.rawBody || JSON.stringify(req.body);
      
      const sha1 = crypto.createHmac('sha1', secret).update(payload).digest('hex');
      const sha256 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      
      const isValid = signature === `sha1=${sha1}` || 
                      signature === `sha256=${sha256}` || 
                      signature === sha1 || 
                      signature === sha256;
                      
      if (!isValid) {
        console.error("Assinatura Pagar.me inválida.");
        return res.status(401).json({ error: "Assinatura inválida" });
      }
    }

    const event = req.body;
    const eventId = event.id;

    if (eventId) {
      const webhookEvents = await getWebhookEvents();
      if (webhookEvents.find((e: any) => e.eventId === eventId)) {
        return res.json({ success: true, message: "Evento já processado." });
      }
      
      webhookEvents.push({
        id: crypto.randomUUID(),
        eventId: eventId,
        eventType: event.type,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });
      await saveWebhookEvents(webhookEvents);
    }


    if (event.type === "order.paid") {
      const orderCode = event.data?.code;
      const payments = await getPayments();
      const payment = payments.find((p: any) => p.orderCode === orderCode);

      if (payment) {
        const plan = PLANS[payment.planId as PlanId];
        const users = await getUsers();
        const idx = users.findIndex((u: any) => u.email === payment.email);

        if (idx !== -1 && plan) {
          users[idx].plan = plan.id;
          users[idx].productLimit = plan.productLimit;
          users[idx].proSince = new Date().toISOString();
          await saveUsers(users);

          // Plano Ilimitado inclui call de consultoria — avisa o time
          if (plan.consultingCall && process.env.SMTP_HOST) {
            await transporter.sendMail({
              from: `"Vírgula Contábil" <${process.env.SMTP_FROM_EMAIL}>`,
              to: process.env.SALES_TEAM_EMAIL,
              subject: `Nova assinatura Ilimitado - agendar consultoria: ${users[idx].email}`,
              text: `O usuário ${users[idx].name} (${users[idx].email}) comprou o plano Ilimitado e tem direito a uma call de consultoria. Entre em contato para agendar.`
            });
          }
        }

        payment.status = "paid";
        await savePayments(payments);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Pagar.me:", error);
    res.status(200).json({ received: true, error: true });
  }
});

async function checkProductLimit(req: any, res: any, next: any) {
  const user = req.currentUser;
  const limit = user.plan === 'ilimitado' ? Infinity : (user.productLimit || 7);
  
  const current = (await getUserRealProducts(user.email)).length;
  if (current >= limit) {
    return res.status(403).json({
      error: `Limite de ${limit} produtos atingido. Faça upgrade para cadastrar mais.`,
      upgradeRequired: true
    });
  }
  next();
}

function requireExcelImport(req: any, res: any, next: any) {
  const plan = PLANS[req.currentUser.plan as PlanId];
  if (!plan?.excelImport) {
    return res.status(403).json({
      error: "Import via Excel é exclusivo dos planos Intermediário e Ilimitado.",
      upgradeRequired: true
    });
  }
  next();
}

app.post("/api/products", requireUser, checkProductLimit, async (req: any, res) => {
  const products = await getAllProducts();
  const newProduct = { ...req.body, ownerEmail: req.currentUser.email, id: crypto.randomUUID() };
  products.push(newProduct);
  await saveAllProducts(products);
  res.json(newProduct);
});

app.get("/api/products", requireUser, async (req: any, res) => {
  res.json((await getAllProducts()).filter((p: any) => p.ownerEmail === req.currentUser.email));
});

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


import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post(
  "/api/products/import",
  requireUser,
  requireExcelImport,
  upload.single("file"),
  async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const products = await getAllProducts();
      const userProducts = products.filter((p: any) => p.ownerEmail === req.currentUser.email && !p.isSample);
      const currentCount = userProducts.length;
      const limit = req.currentUser.plan === 'ilimitado' ? Infinity : (req.currentUser.productLimit || 7);
      
      const imported: any[] = [];
      const errors: any[] = [];
      const validRows: any[] = [];

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

      if (currentCount + validRows.length > limit) {
        return res.status(403).json({
          error: `Limite excedido. Você possui ${currentCount} produtos de um limite de ${limit}. A planilha contém ${validRows.length} produtos válidos. A importação não pode ser realizada.`
        });
      }

      validRows.forEach(row => {
        const { nome, precoCusto, precoVenda } = row;

        const product = {
          id: crypto.randomUUID(),
          ownerEmail: req.currentUser.email,
          name: nome,
          costPrice: Number(precoCusto),
          salePrice: precoVenda != null ? Number(precoVenda) : null,
          importedAt: new Date().toISOString()
        };
        products.push(product);
        imported.push(product);
      });

      await saveAllProducts(products);

      res.json({ success: true, importedCount: imported.length, imported, errors });
    } catch (error) {
      console.error("Erro ao importar planilha:", error);
      res.status(500).json({ error: "Erro ao processar a planilha." });
    }
  }
);

app.post("/api/admin/users/:email/plan", requireAuth, async (req, res) => {
  const users = await getUsers();
  const user = users.find((u: any) => u.email === req.params.email);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  const planId = req.body.planId as PlanId;
  const plan = PLANS[planId];
  if (!plan) {
    return res.status(400).json({ error: "Plano inválido." });
  }

  user.plan = plan.id;
  user.productLimit = plan.productLimit;
  user.proSince = new Date().toISOString();
  await saveUsers(users);

  res.json({ success: true, plan: plan.id });
});

// Vite middleware for development
async function setupVite() {
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "custom", // Use custom so Vite doesn't serve the HTML itself
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Serve static assets, but skip index.html so our catch-all below can handle it
    app.use(express.static(distPath, { index: false }));
  }

  // Catch-all route to serve index.html with injected SEO tags
  app.use("*", async (req, res, next) => {
    // Skip API routes and static files with extensions
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

      // Identify if we're on a course page (/slug)
      const urlParts = req.originalUrl.split("?")[0].split("/");
      let title = "Vírgula Contábil - Calculadora";
      let description = "Calculadoras de precificação e simulação financeira para clientes Vírgula Contábil.";
      let ogImage = "https://www.virgulacontabil.com.br/wp-content/uploads/2026/04/favicon.png"; // Fallback image

      if (urlParts.length >= 2 && urlParts[1] && urlParts[1] !== "admin") {
        const slug = urlParts[1];
        const courses = await getCourses();
        const course = courses.find((c: any) => c.slug === slug);
        if (course) {
          title = `${course.courseName} - Vírgula Contábil`;
          if (course.description) {
            description = course.description;
          }
        }
      }

      // Inject SEO tags
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

      // Replace existing title or inject before </head>
      template = template.replace(/<title>.*?<\/title>/, metaTags);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e: any) {
      if (vite) {
        vite.ssrFixStacktrace(e);
      }
      next(e);
    }
  });

  app.listen(PORT, "0.0.0.0", async () => {
    try { await db.execute(sql`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value JSONB NOT NULL)`); } catch (err) { console.error("Database connection failed on startup. Is DATABASE_URL correct?", err); }

    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
