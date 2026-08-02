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

dotenv.config();

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

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(USERS_FILE, "utf-8");
  return JSON.parse(data);
}

function saveUsers(users: any) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

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
function getCourses() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const data = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

function saveCourses(courses: any) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2), "utf-8");
}

function getLeads() {
  if (!fs.existsSync(LEADS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(LEADS_FILE, "utf-8");
  return JSON.parse(data);
}

function saveLeads(leads: any) {
  const dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
}

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET || "default-secret");
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireUser(req: any, res: any, next: any) {
  const token = req.cookies.user_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret");
    const users = getUsers();
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

function getPayments() {
  if (!fs.existsSync(PAYMENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PAYMENTS_FILE, "utf-8"));
}
function savePayments(payments: any) {
  const dir = path.dirname(PAYMENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), "utf-8");
}

function getAllProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
}
function saveAllProducts(products: any) {
  const dir = path.dirname(PRODUCTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}
function getUserRealProducts(email: string) {
  return getAllProducts().filter((p: any) => p.ownerEmail === email && !p.isSample);
}

function seedSampleProducts(email: string) {
  const products = getAllProducts();
  const samples = [
    { name: "Cimento CP II 50 kg (exemplo)", costPrice: 32.20, salePrice: 42.0 },
    { name: "Tijolo Cerâmico 9x19x19 (exemplo)", costPrice: 0.87, salePrice: 1.50 },
    { name: "Argamassa AC-II 20 kg (exemplo)", costPrice: 19.30, salePrice: 28.0 },
    { name: "Tinta Acrílica Branca 18 L (exemplo)", costPrice: 172.50, salePrice: 240.0 },
    { name: "Tubo PVC Soldável 25 mm (3 m) (exemplo)", costPrice: 18.50, salePrice: 26.0 },
  ];
  samples.forEach(s => {
    products.push({
      id: crypto.randomUUID(),
      ownerEmail: email,
      ...s,
      isSample: true,
      createdAt: new Date().toISOString()
    });
  });
  saveAllProducts(products);
}

// API Routes

// Admin routes (protected)
app.get("/api/admin/courses", requireAuth, (req, res) => {
  const courses = getCourses();
  res.json(courses);
});

app.post("/api/admin/courses", requireAuth, (req, res) => {
  const courses = getCourses();
  const newCourse = req.body;
  courses.push(newCourse);
  saveCourses(courses);
  res.json(newCourse);
});

app.put("/api/admin/courses/:slug", requireAuth, (req, res) => {
  const courses = getCourses();
  const index = courses.findIndex((c: any) => c.slug === req.params.slug);
  if (index !== -1) {
    courses[index] = req.body;
    saveCourses(courses);
    res.json(courses[index]);
  } else {
    res.status(404).json({ error: "Course not found" });
  }
});

app.delete("/api/admin/courses/:slug", requireAuth, (req, res) => {
  let courses = getCourses();
  courses = courses.filter((c: any) => c.slug !== req.params.slug);
  saveCourses(courses);
  res.json({ success: true });
});

app.get("/api/admin/leads", requireAuth, (req, res) => {
  const leads = getLeads();
  res.json(leads);
});

app.delete("/api/admin/leads", requireAuth, (req, res) => {
  const { timestamps } = req.body;
  if (!Array.isArray(timestamps)) {
    return res.status(400).json({ error: "Invalid data" });
  }
  let leads = getLeads();
  leads = leads.filter((lead: any) => !timestamps.includes(lead.timestamp));
  saveLeads(leads);
  res.json({ success: true });
});

// Public courses list route
app.get("/api/courses", (req, res) => {
  const courses = getCourses();
  const list = courses.map((c: any) => ({
    slug: c.slug,
    courseName: c.courseName,
    description: c.description,
    moduleCount: c.modules?.length || 0
  }));
  res.json(list);
});

// Public course route
app.get("/api/courses/:slug", (req, res) => {
  const courses = getCourses();
  const course = courses.find((c: any) => c.slug === req.params.slug);
  if (course) {
    res.json(course);
  } else {
    res.status(404).json({ error: "Course not found" });
  }
});

// Public lead route
app.post("/api/leads", (req, res) => {
  const leads = getLeads();
  const newLead = {
    ...req.body,
    timestamp: new Date().toISOString()
  };
  leads.push(newLead);
  saveLeads(leads);
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

    const users = getUsers();
    
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
    saveUsers(users);

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
          text: `Olá ${name},\n\nObrigado por se cadastrar!\n\nPor favor, ative sua conta e defina sua senha clicando no link: ${verificationLink}\n\nAtenciosamente,\nEquipe Vírgula Contábil`,
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

app.get("/api/verify/:token", (req, res) => {
  const users = getUsers();
  const user = users.find((u: any) => u.activationToken === req.params.token);
  if (user) {
    res.json({ success: true, user: { name: user.name, email: user.email } });
  } else {
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
});

app.post("/api/verify", async (req, res) => {
  const { token, password } = req.body;
  const users = getUsers();
  
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
      saveUsers(users);
      // seedSampleProducts(users[userIndex].email); // Removido para iniciar zerado
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
        process.env.JWT_SECRET || "default-secret",
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

    const users = getUsers();
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
      process.env.JWT_SECRET || "default-secret",
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

// Admin Routes for Users
app.get("/api/admin/users", requireAuth, (req, res) => {
  const users = getUsers().map((u: any) => {
    const { passwordHash, activationToken, ...user } = u;
    return user;
  });
  res.json(users);
});

app.delete("/api/admin/users/:email", requireAuth, (req, res) => {
  let users = getUsers();
  const emailToDelete = req.params.email;
  users = users.filter((u: any) => u.email !== emailToDelete);
  saveUsers(users);
  res.json({ success: true });
});

app.post("/api/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const users = getUsers();
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
    saveUsers(users);
    
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

    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "E-mail não encontrado." });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    users[userIndex].resetToken = resetToken;
    saveUsers(users);

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
          text: `Olá ${users[userIndex].name},\n\nPara redefinir sua senha, clique no link a seguir: ${resetLink}\n\nAtenciosamente,\nEquipe Vírgula Contábil`,
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

    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.resetToken === token);
    
    if (userIndex === -1) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);
    
    users[userIndex].passwordHash = newPasswordHash;
    users[userIndex].resetToken = null; // consume token
    saveUsers(users);
    
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
        payment_settings: {
          accepted_payment_methods: ["credit_card", "pix"],
          credit_card_settings: {
            operation_type: "auth_and_capture",
            installments_setup: { interest_type: "simple" },
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

    const payments = getPayments();
    payments.push({
      orderCode,
      email: user.email,
      planId: plan.id,
      paymentLinkId: data.id,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    savePayments(payments);

    res.json({ url: data.url });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    res.status(500).json({ error: "Erro interno ao criar checkout" });
  }
});

app.post("/api/webhooks/pagarme", async (req: any, res) => {
  try {
    const secret = process.env.PAGARME_WEBHOOK_SECRET;
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

    if (event.type === "order.paid") {
      const orderCode = event.data?.code;
      const payments = getPayments();
      const payment = payments.find((p: any) => p.orderCode === orderCode);

      if (payment) {
        const plan = PLANS[payment.planId as PlanId];
        const users = getUsers();
        const idx = users.findIndex((u: any) => u.email === payment.email);

        if (idx !== -1 && plan) {
          users[idx].plan = plan.id;
          users[idx].productLimit = plan.productLimit;
          users[idx].proSince = new Date().toISOString();
          saveUsers(users);

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
        savePayments(payments);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Pagar.me:", error);
    res.status(200).json({ received: true, error: true });
  }
});

function checkProductLimit(req: any, res: any, next: any) {
  const user = req.currentUser;
  const limit = user.plan === 'ilimitado' ? Infinity : (user.productLimit || 7);
  
  const current = getUserRealProducts(user.email).length;
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

app.post("/api/products", requireUser, checkProductLimit, (req: any, res) => {
  const products = getAllProducts();
  const newProduct = { ...req.body, ownerEmail: req.currentUser.email, id: crypto.randomUUID() };
  products.push(newProduct);
  saveAllProducts(products);
  res.json(newProduct);
});

app.get("/api/products", requireUser, (req: any, res) => {
  res.json(getAllProducts().filter((p: any) => p.ownerEmail === req.currentUser.email));
});

import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post(
  "/api/products/import",
  requireUser,
  requireExcelImport,
  upload.single("file"),
  (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const products = getAllProducts();
      const imported: any[] = [];
      const errors: any[] = [];

      rows.forEach((row, i) => {
        const nome = row.nome || row.Nome || row.produto || row.Produto;
        const precoCusto = row.preco_custo ?? row["Preço de Custo"] ?? row.custo;
        const precoVenda = row.preco_venda ?? row["Preço de Venda"] ?? row.preco;

        if (!nome || precoCusto == null) {
          errors.push({ linha: i + 2, motivo: "Faltando nome ou preço de custo" });
          return;
        }

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

      saveAllProducts(products);

      res.json({ success: true, importedCount: imported.length, imported, errors });
    } catch (error) {
      console.error("Erro ao importar planilha:", error);
      res.status(500).json({ error: "Erro ao processar a planilha." });
    }
  }
);

app.post("/api/admin/users/:email/plan", requireAuth, (req, res) => {
  const users = getUsers();
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
  saveUsers(users);

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
        const courses = getCourses();
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
