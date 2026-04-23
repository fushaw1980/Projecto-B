import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("--- BISCATE DIRECTO STARTUP ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("CWD:", process.cwd());
console.log("DIRNAME:", __dirname);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Initialize AI safely
  const apiKey = process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  app.use(express.json({ limit: '10mb' }));

  // Debug & Health
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || 'development',
      time: new Date().toISOString()
    });
  });

  app.get("/api/debug", (req, res) => {
    const distPath = path.resolve(__dirname, 'dist');
    const distExists = fs.existsSync(distPath);
    res.json({
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      dirname: __dirname,
      distPath,
      distExists,
      distFiles: distExists ? fs.readdirSync(distPath) : []
    });
  });

  // API: Identity Verification Service (AI Automated Moderation)
  app.post("/api/verify-identity", async (req, res) => {
    const { biPhoto, biSelfie } = req.body;

    if (!biPhoto || !biSelfie) {
      return res.status(400).json({ error: "Ambas as fotos são necessárias para verificação." });
    }

    try {
      const prompt = `
        Você é um auditor de segurança sênior. Analise estas duas fotos de um processo de registo em Moçambique.
        Imagem 1: Bilhete de Identidade (BI).
        Imagem 2: Selfie do proprietário segurando o mesmo BI.

        Verifique rigorosamente:
        1. A pessoa na selfie é a mesma do documento?
        2. O BI parece autêntico (layout de Moçambique, sem distorções óbvias)?
        3. Há sinais de manipulação digital (texto sobreposto, bordas mal cortadas)?

        Responda APENAS um JSON:
        {
          "valid": boolean,
          "confidence": number,
          "reason": "string em português",
          "nameOnId": "string (nome completo extraído do BI)"
        }
      `;

      const parts: any[] = [
        { inlineData: { mimeType: "image/jpeg", data: biPhoto.split(',')[1] } },
        { inlineData: { mimeType: "image/jpeg", data: biSelfie.split(',')[1] } },
        { text: prompt }
      ];

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{"valid": false, "reason": "AI Error"}';
      const analysis = JSON.parse(jsonStr);

      res.json(analysis);
    } catch (error) {
      console.error("AI Verify Error:", error);
      res.status(500).json({ valid: false, reason: "Erro no serviço de inteligência artificial." });
    }
  });

  // API Mock for Mozambique Payments (M-Pesa / e-Mola)
  app.post("/api/payments/stk-push", (req, res) => {
    const { phone, amount, service } = req.body;
    console.log(`Triggering M-Pesa STK Push for ${phone} - Amount: ${amount} MT`);
    // In a real app, this would call the Vodacom/Movitel API
    res.json({ status: "pending", requestId: Math.random().toString(36).substring(7) });
  });

  // In-memory Database for Demo
  let jobs = [];
  let chats = {}; // { jobId: [ { sender, text, time } ] }
  let reviews = []; // { providerId, rating, comment, date }
  
  const providers = [
    { 
      id: 1, 
      name: "António Muchanga", 
      category: "Electricista", 
      bairro: "Polana Caniço", 
      rating: 4.8, 
      verified: true, 
      level: 3, // Elite
      jobs: 124, 
      phone: "840000001", 
      balance: 15400, // MT
      photo: "https://picsum.photos/seed/1/200/200",
      portfolio: [
        { before: "https://picsum.photos/seed/b1/400/300", after: "https://picsum.photos/seed/a1/400/300" },
        { before: "https://picsum.photos/seed/b2/400/300", after: "https://picsum.photos/seed/a2/400/300" }
      ]
    },
    { id: 2, name: "Isabel Sitoe", category: "Canalizadora", bairro: "Malhangalene", rating: 4.5, verified: true, level: 2, jobs: 89, phone: "840000002", balance: 8200, photo: "https://picsum.photos/seed/2/200/200", portfolio: [] },
    { id: 3, name: "Zacarias Langa", category: "Pedreiro", bairro: "Zimpeto", rating: 4.2, verified: false, level: 1, jobs: 45, phone: "840000003", balance: 0, photo: "https://picsum.photos/seed/3/200/200", portfolio: [] },
    { id: 5, name: "Mussagi Juma", category: "Serviços Gerais", bairro: "Mafalala", rating: 4.6, verified: true, level: 2, jobs: 34, phone: "840000005", balance: 4500, photo: "https://picsum.photos/seed/5/200/200", portfolio: [] },
  ];

  // API: Chat
  app.get("/api/jobs/:id/chat", (req, res) => {
    res.json(chats[req.params.id] || []);
  });

  app.post("/api/jobs/:id/chat", (req, res) => {
    const { id } = req.params;
    const { sender, text } = req.body;
    if (!chats[id]) chats[id] = [];
    const msg = { sender, text, time: new Date() };
    chats[id].push(msg);
    res.json(msg);
  });

  // API: Reviews
  app.get("/api/providers/:id/reviews", (req, res) => {
    res.json(reviews.filter(r => r.providerId === Number(req.params.id)));
  });

  app.post("/api/providers/:id/reviews", (req, res) => {
    const { rating, comment } = req.body;
    const review = { 
      providerId: Number(req.params.id), 
      rating, 
      comment, 
      date: new Date() 
    };
    reviews.push(review);
    
    // Update Provider average rating
    const p = providers.find(p => p.id === Number(req.params.id));
    if (p) {
      const pReviews = reviews.filter(r => r.providerId === p.id);
      p.rating = Number((pReviews.reduce((acc, r) => acc + r.rating, 0) / pReviews.length).toFixed(1));
    }
    
    res.json(review);
  });

  // API: Providers Management
  app.post("/api/providers", (req, res) => {
    const { name, category, photo, biPhoto, biSelfie, verified } = req.body;
    const newProvider = {
      id: providers.length + 1,
      name,
      category,
      bairro: "Cid. Maputo",
      rating: 5.0,
      verified: verified || false, 
      level: 1,
      jobs: 0,
      phone: `84${Math.floor(1000000 + Math.random() * 9000000)}`,
      balance: 0,
      photo: photo || `https://picsum.photos/seed/${providers.length + 1}/200/200`,
      biPhoto,
      biSelfie,
      portfolio: []
    };
    providers.push(newProvider);
    res.json(newProvider);
  });

  // API: Jobs Management
  app.post("/api/jobs", (req, res) => {
    const { providerId, clientId, category, amount, description } = req.body;
    const newJob = {
      id: Math.random().toString(36).substring(7),
      providerId,
      clientId,
      category,
      amount: amount || 500,
      description,
      status: "AGUARDANDO_DEPOSITO",
      transactionId: null,
      photoBefore: null,
      photoAfter: null,
      panicAlert: false,
      createdAt: new Date()
    };
    jobs.push(newJob);
    res.json(newJob);
  });

  app.get("/api/jobs", (req, res) => {
    res.json(jobs);
  });

  app.post("/api/jobs/:id/action", (req, res) => {
    const { id } = req.params;
    const { action, data } = req.body;
    const job = jobs.find(j => j.id === id);

    if (!job) return res.status(404).json({ error: "Job não encontrado" });

    switch(action) {
      case 'SUBMIT_PAYMENT':
        job.status = "VALIDACAO_PENDENTE";
        job.transactionId = data.txId;
        break;
      case 'ADMIN_APPROVE':
        job.status = "PAGO";
        break;
      case 'CHECK_IN':
        job.status = "EM_CURSO";
        job.photoBefore = data.photo || "https://picsum.photos/seed/before/400/300";
        break;
      case 'CHECK_OUT':
        job.status = "FINALIZADO";
        job.photoAfter = data.photo || "https://picsum.photos/seed/after/400/300";
        break;
      case 'CONFIRM_CLIENT':
        job.status = "CONCLUIDO";
        break;
      case 'PANIC':
        job.panicAlert = true;
        console.error(`PANIC ALERT: Job ${job.id} at location ${JSON.stringify(data.location)}`);
        break;
    }

    res.json(job);
  });

  app.get("/api/providers", (req, res) => {
    const { category, bairro, minRating, verified } = req.query;
    let filtered = providers;
    if (category) filtered = filtered.filter(p => p.category.toLowerCase().includes(category.toString().toLowerCase()));
    if (bairro) filtered = filtered.filter(p => p.bairro.toLowerCase().includes(bairro.toString().toLowerCase()));
    if (minRating) filtered = filtered.filter(p => p.rating >= parseFloat(minRating.toString()));
    if (verified === 'true') filtered = filtered.filter(p => p.verified === true);
    res.json(filtered);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV] Starting Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Determine dist path robustly
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log(`[PROD] Attempting to serve from: ${distPath}`);
    
    if (!fs.existsSync(distPath)) {
      console.error(`CRITICAL: dist directory NOT FOUND at ${distPath}`);
    }

    // Serve static files with long-term caching for assets
    app.use(express.static(distPath, {
      maxAge: '1d',
      index: false // we handle root explicitly
    }));

    // Explicitly handle root/index
    app.get(["/", "/index.html"], (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Error: dist/index.html not found. Please run 'npm run build'.");
      }
    });

    // SPA fallback
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Error: Page not found and fallback failed.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
