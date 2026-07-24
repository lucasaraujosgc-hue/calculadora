import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

const DATA_FILE = path.join(process.cwd(), "data", "courses.json");
const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");

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

// API Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "default-secret", {
      expiresIn: "1d",
    });
    res.cookie("admin_token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    return res.json({ success: true });
  }
  
  return res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true });
});

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
