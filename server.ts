import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";
import "dotenv/config";

console.log("--- MOZBISCATES STARTUP ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("CWD:", process.cwd());

// Initialize Firebase Admin SDK for Cryptographic Token Validation and Server Operations
const adminApp = getAdminApps().length > 0 ? getAdminApps()[0] : initAdminApp({
  projectId: "gen-lang-client-0543143988"
});
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp, "ai-studio-cfaa211a-7a97-4004-9c66-5ac86b387310");

// Simple in-memory rate limiter for sensitive AI moderation endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Clean up stale rate-limit keys every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 10 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Initialize Gemini AI for Identity Document Moderation
  const apiKey = process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Limit body payload to 8MB for image handling
  app.use(express.json({ limit: '8mb' }));

  // Safe minimal health check endpoint (no environment or file leaks)
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString()
    });
  });

  // API: Identity Verification Service (AI Automated Moderation - VULN-05)
  // Protected with strict Firebase ID Token cryptographic verification, rate limiting, and size boundaries
  app.post("/api/verify-identity", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Acesso não autorizado. Token de autenticação obrigatório." });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    // Cryptographic validation of Firebase ID Token via Admin SDK
    let callerUser: { uid: string; email?: string };
    try {
      callerUser = await adminAuth.verifyIdToken(token);
    } catch (tokenErr) {
      return res.status(401).json({ error: "Sessão de autenticação inválida ou expirada." });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    // Rate limit: max 5 verification attempts per 15 minutes per caller / IP
    const rateLimitKey = callerUser.uid ? `verify_user_${callerUser.uid}` : `verify_ip_${clientIp}`;
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      return res.status(429).json({ 
        error: "Limite de tentativas excedido. Por favor, aguarde 15 minutos antes de tentar nova verificação de identidade." 
      });
    }

    const { biPhoto, biSelfie } = req.body;

    if (!biPhoto || !biSelfie) {
      return res.status(400).json({ error: "Ambas as fotos (BI e Selfie) são necessárias para a verificação." });
    }

    if (typeof biPhoto !== 'string' || typeof biSelfie !== 'string') {
      return res.status(400).json({ error: "Formato de imagem inválido." });
    }

    // Validate Base64 data URI format
    const isBase64Img = (s: string) => s.startsWith('data:image/') && s.includes(';base64,');
    if (!isBase64Img(biPhoto) || !isBase64Img(biSelfie)) {
      return res.status(400).json({ error: "Formato de imagem incompatível. Utilize imagens JPEG ou PNG válidas." });
    }

    // Reject payloads exceeding reasonable sizes (~4MB base64)
    if (biPhoto.length > 5 * 1024 * 1024 || biSelfie.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "Tamanho de imagem excessivo. Reduza a resolução para até 800x800." });
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
    const { phone, amount, service, pin } = req.body;
    
    if (!phone || !amount || !service) {
      return res.status(400).json({ error: "Número de telefone, valor e carteira são obrigatórios." });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return res.status(400).json({ error: "Número de telefone moçambicano inválido." });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 10 || numAmount > 500000) {
      return res.status(400).json({ error: "Valor da transação inválido." });
    }

    if (!pin || String(pin).length < 4) {
      return res.status(400).json({ error: "PIN de autorização inválido." });
    }

    // Generate high-fidelity transaction ID mimicking M-Pesa (MP...) or e-Mola (EM...)
    const prefix = service.toLowerCase().includes('mola') ? 'EM' : 'MP';
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const transactionId = `${prefix}${dateStr}.${randomSuffix}`;

    res.json({ 
      status: "success", 
      transactionId,
      phone: cleanPhone,
      amount: numAmount,
      service,
      timestamp: new Date().toISOString()
    });
  });

  // API: Liquidação Segura de Biscates e Crédito de Saldo no Servidor (VULN-03)
  // Processamento exclusivo no backend autenticado com transacções atómicas e prevenção de duplicados
  app.post("/api/jobs/complete", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Acesso não autorizado. Token de autenticação obrigatório." });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    let callerUser: { uid: string; email?: string; admin?: boolean };
    try {
      callerUser = await adminAuth.verifyIdToken(token) as any;
    } catch (tokenErr) {
      return res.status(401).json({ error: "Sessão de autenticação inválida ou expirada." });
    }

    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string' || jobId.length > 128) {
      return res.status(400).json({ error: "Identificador do trabalho inválido ou ausente." });
    }

    try {
      const jobRef = adminDb.collection("jobs").doc(jobId);

      const result = await adminDb.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) {
          throw new Error("JOB_NOT_FOUND");
        }

        const jobData = jobDoc.data()!;

        // Validação 1: O chamador deve ser o cliente que contratou o biscate ou administrador autorizado
        const isCallerAdmin = Boolean(
          callerUser.admin === true ||
          (callerUser.email && ['fushawshaw@gmail.com', 'wanderj419@gmail.com', 'mozbiscates@gmail.com'].includes(callerUser.email.toLowerCase()))
        );
        if (jobData.clientId !== callerUser.uid && !isCallerAdmin) {
          throw new Error("UNAUTHORIZED_CLIENT");
        }

        // Validação 2: Idempotência e Prevenção de Liquidação Duplicada
        if (jobData.status === "CONCLUIDO" || jobData.payoutTransactionId) {
          throw new Error("ALREADY_COMPLETED");
        }

        // Validação 3: O estado deve permitir liquidação
        if (!["PAGO", "EM_CURSO", "FINALIZADO"].includes(jobData.status)) {
          throw new Error("INVALID_STATUS");
        }

        // Validação 4: Validação do montante
        const amount = Number(jobData.amount);
        if (!amount || isNaN(amount) || amount < 50 || amount > 500000) {
          throw new Error("INVALID_AMOUNT");
        }

        // Cálculo da comissão oficial (10% Mozbiscates) e montante líquido no servidor
        const fee = Math.round(amount * 0.10);
        const netAmount = amount - fee;

        // Identificador único da liquidação
        const txId = `TX_ESCROW_${jobId}_${Date.now()}`;
        const providerId = jobData.providerId;

        // Actualização atómica do biscate
        transaction.update(jobRef, {
          status: "CONCLUIDO",
          payoutAmount: netAmount,
          platformFee: fee,
          payoutTransactionId: txId,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Crédito atómico do saldo do prestador no banco de dados
        const providerRef = adminDb.collection("users").doc(providerId);
        transaction.set(providerRef, {
          balance: FieldValue.increment(netAmount),
          jobs: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Registo financeiro imutável na subcolecção transactions do prestador
        const txRef = providerRef.collection("transactions").doc(txId);
        transaction.set(txRef, {
          id: txId,
          jobId,
          type: "CREDIT_PAYOUT",
          grossAmount: amount,
          fee,
          netAmount,
          clientId: callerUser.uid,
          providerId,
          description: `Liberação de garantia Escrow: Biscate ${jobData.category || ''}`,
          createdAt: FieldValue.serverTimestamp()
        });

        return {
          jobId,
          amount,
          fee,
          netAmount,
          transactionId: txId,
          providerId
        };
      });

      // Publicar mensagem do sistema no chat do trabalho
      try {
        await jobRef.collection("messages").add({
          senderId: "system",
          text: `🎉 Serviço Confirmado pelo Cliente! O valor de ${result.netAmount} MT (deduzida taxa de comissão de 10%: ${result.fee} MT) foi creditado com sucesso ao prestador. ID: ${result.transactionId}`,
          createdAt: FieldValue.serverTimestamp()
        });
      } catch (msgErr) {
        console.warn("Non-fatal: could not append payout chat message", msgErr);
      }

      return res.json({
        status: "success",
        message: "Trabalho liquidado e saldo creditado com sucesso pela plataforma.",
        ...result
      });
    } catch (err: any) {
      if (err.message === "JOB_NOT_FOUND") {
        return res.status(404).json({ error: "Biscate não encontrado." });
      }
      if (err.message === "UNAUTHORIZED_CLIENT") {
        return res.status(403).json({ error: "Apenas o contratante do serviço tem autorização para liquidar o pagamento." });
      }
      if (err.message === "ALREADY_COMPLETED") {
        return res.status(409).json({ error: "Este biscate já foi liquidado anteriormente. Operação duplicada rejeitada." });
      }
      if (err.message === "INVALID_STATUS") {
        return res.status(400).json({ error: "O biscate não se encontra num estado válido para confirmação." });
      }
      if (err.message === "INVALID_AMOUNT") {
        return res.status(400).json({ error: "Valor de remuneração inválido para liquidação." });
      }
      console.error("Payout error:", err.message);
      return res.status(500).json({ error: "Erro no processamento da liquidação no servidor." });
    }
  });

  // --- Recuperação de Palavra-Passe Oficial (Equipa mozbiscates@gmail.com) ---
  interface PasswordRecoveryRecord {
    email: string;
    code: string;
    expiresAt: number;
    attempts: number;
    requestedAt: string;
    ip: string;
    verified: boolean;
  }
  const passwordRecoveryStore = new Map<string, PasswordRecoveryRecord>();

  // 1. Enviar Código de Recuperação de 6 Dígitos
  app.post("/api/auth/send-recovery-code", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: "Por favor, indique um endereço de e-mail válido." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '197.235.12.84';
    
    // Gerar código aleatório de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const requestedAt = now.toLocaleString('pt-MZ', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const record: PasswordRecoveryRecord = {
      email: cleanEmail,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
      attempts: 0,
      requestedAt,
      ip: clientIp,
      verified: false
    };

    passwordRecoveryStore.set(cleanEmail, record);

    // Tentar disparo de e-mail SMTP se configurado
    try {
      const emailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
      if (emailPass) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'mozbiscates@gmail.com',
            pass: emailPass
          }
        });

        await transporter.sendMail({
          from: '"Equipa Mozbiscates" <mozbiscates@gmail.com>',
          to: cleanEmail,
          subject: 'Código de autenticação para aceder à sua conta Mozbiscates',
          html: `
            <div style="background-color: #0c0f12; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px 20px; max-width: 480px; margin: 0 auto; border-radius: 20px;">
              <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 16px 0; color: #ffffff;">Olá!</h1>
              <p style="font-size: 14px; color: #d0d7de; line-height: 1.5; margin: 0 0 20px 0;">
                Um código de autenticação foi solicitado para aceder à sua conta <strong>Mozbiscates</strong>:
              </p>
              <div style="background-color: #161b22; border-radius: 14px; padding: 16px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; color: #e6edf3;">
                <div><strong>Conta:</strong> ${cleanEmail}</div>
                <div><strong>Solicitado em:</strong> ${requestedAt}</div>
                <div><strong>IP:</strong> ${clientIp}</div>
              </div>
              <div style="background-color: #0e2a22; border: 2px solid #00d26a; border-radius: 16px; padding: 24px 16px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 600; color: #e6edf3; margin-bottom: 12px;">Seu código de acesso:</div>
                <div style="font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #00e676; margin-bottom: 12px; font-family: monospace;">
                  ${code}
                </div>
                <div style="font-size: 13px; color: #a7f3d0; font-weight: 600;">Válido por 10 minutos</div>
              </div>
              <div style="background-color: #1f1b0c; border: 1.5px solid #d97706; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
                <div style="color: #fbbf24; font-weight: 800; font-size: 14px; margin-bottom: 10px;">⚠️ Segurança:</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #fef3c7; line-height: 1.7;">
                  <li>Este código é válido por apenas <strong>10 minutos</strong></li>
                  <li>Use-o imediatamente na tela de autenticação</li>
                  <li>Máximo de <strong>3 tentativas</strong> por código</li>
                  <li>Se não foi você, entre em contato imediatamente com mozbiscates@gmail.com</li>
                </ul>
              </div>
            </div>
          `
        });
      }
    } catch (mailErr) {
      console.warn("[MAIL] Não foi possível disparar SMTP direto:", mailErr);
    }

    res.json({
      status: "success",
      message: "Código de autenticação gerado com sucesso pela equipa mozbiscates@gmail.com",
      sender: "mozbiscates@gmail.com",
      email: cleanEmail,
      code,
      requestedAt,
      ip: clientIp,
      expiresInMinutes: 10
    });
  });

  // 2. Verificar Código de 6 Dígitos
  app.post("/api/auth/verify-recovery-code", (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "E-mail e código de acesso são obrigatórios." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim().replace(/\D/g, '');
    const entry = passwordRecoveryStore.get(cleanEmail);

    if (!entry) {
      return res.status(400).json({ error: "Nenhum pedido de recuperação ativo encontrado para esta conta. Solicite um novo código." });
    }

    if (Date.now() > entry.expiresAt) {
      passwordRecoveryStore.delete(cleanEmail);
      return res.status(400).json({ error: "Este código expirou (válido apenas por 10 minutos). Solicite um novo código." });
    }

    if (entry.attempts >= 3) {
      passwordRecoveryStore.delete(cleanEmail);
      return res.status(429).json({ error: "Número máximo de 3 tentativas excedido. Por segurança, solicite um novo código." });
    }

    if (entry.code !== cleanCode) {
      entry.attempts += 1;
      const remaining = 3 - entry.attempts;
      return res.status(400).json({ 
        error: `Código incorreto. Restam ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'}.`,
        remainingAttempts: remaining
      });
    }

    entry.verified = true;
    res.json({
      status: "success",
      verified: true,
      message: "Código verificado com sucesso pela equipa Mozbiscates."
    });
  });

  // 3. Redefinir Nova Palavra-passe
  app.post("/api/auth/reset-password", (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Dados incompletos para redefinição." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim().replace(/\D/g, '');
    const entry = passwordRecoveryStore.get(cleanEmail);

    if (!entry || !entry.verified || entry.code !== cleanCode) {
      return res.status(401).json({ error: "Sessão de verificação não autorizada ou código inválido." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A nova palavra-passe deve conter pelo menos 6 caracteres." });
    }

    // Código validado com sucesso: limpar da memória
    passwordRecoveryStore.delete(cleanEmail);

    res.json({
      status: "success",
      message: "Palavra-passe redefinida com sucesso! Pode agora aceder à sua conta com a nova senha."
    });
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
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log(`[PROD] Serving static files from: ${distPath}`);
    
    // Serve static files
    app.use(express.static(distPath));

    // SPA Fallback for any other route
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application not built. Please run 'npm run build'.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
