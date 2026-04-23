/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  Search, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Star, 
  Wrench, 
  Zap, 
  Droplets, 
  User, 
  Camera, 
  MessageSquare,
  Mic,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  Heart,
  Package,
  Mail,
  Lock,
  Loader2,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// --- Types ---
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null) => {
  const authInfo = auth.currentUser ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || '',
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerInfo: auth.currentUser.providerData.map(p => ({
      providerId: p.providerId,
      displayName: p.displayName || '',
      email: p.email || ''
    }))
  } : {
    userId: 'anonymous',
    email: '',
    emailVerified: false,
    isAnonymous: true,
    providerInfo: []
  };

  const errorInfo: FirestoreErrorInfo = {
    error: error.message || 'Unknown error',
    operationType: operation,
    path,
    authInfo
  };

  throw new Error(JSON.stringify(errorInfo));
};
interface Provider {
  id: number;
  name: string;
  category: string;
  bairro: string;
  rating: number;
  verified: boolean;
  level: number;
  jobs: number;
  phone: string;
  photo: string;
  portfolio: { before: string, after: string }[];
}

interface Job {
  id: string;
  providerId: number;
  clientId: string;
  category: string;
  amount: number;
  description?: string;
  status: string;
  transactionId?: string;
  photoBefore?: string;
  photoAfter?: string;
  panicAlert?: boolean;
  createdAt: string;
}

// --- Components ---

const StatusBadge = memo(({ status, panic, t }: { status: string, panic?: boolean, t: any }) => {
  if (panic) return <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-red-600 text-white animate-pulse">{t.panicAlertLabel}</span>;
  
  const map: Record<string, { label: string, color: string }> = {
    'AGUARDANDO_DEPOSITO': { label: t.statusWaiting, color: 'bg-yellow-100 text-yellow-700' },
    'VALIDACAO_PENDENTE': { label: t.statusValidating, color: 'bg-orange-100 text-orange-700' },
    'PAGO': { label: t.statusPaid, color: 'bg-blue-100 text-blue-700' },
    'EM_CURSO': { label: t.statusInProgress, color: 'bg-green-100 text-green-700' },
    'FINALIZADO': { label: t.statusReview, color: 'bg-purple-100 text-purple-700' },
    'CONCLUIDO': { label: t.statusCompleted, color: 'bg-gray-200 text-gray-700' }
  };
  const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  return <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${s.color}`}>{s.label}</span>;
});

// --- translations ---
const translations = {
  pt: {
    welcome: "O que vamos resolver hoje?",
    start: "Começar",
    jobs: "Biscates",
    history: "Histórico",
    wallet: "Carteira",
    profile: "Perfil",
    chat: "Conversa",
    rating: "Avaliação",
    completed: "Concluído",
    help: "Apoio",
    home: "Início",
    pending: "Pendente",
    back: "Voltar",
    recording: "Gravando...",
    recordAudio: "Gravar Áudio",
    searchCategory: "Pesquisar categoria...",
    allBairros: "Todos os Bairros",
    verified: "Verificados",
    clear: "Limpar",
    proAvailable: "Profissionais Disponíveis",
    nearYou: "Perto de si",
    getStarted: "Começar Agora",
    chooseProfile: "Escolha o seu Perfil",
    howToUse: "Como deseja utilizar a plataforma hoje?",
    iAmClient: "Sou Cliente",
    needHelp: "Preciso de ajuda em casa",
    iAmWorker: "Sou Biscateiro",
    wantEarn: "Quero ganhar dinheiro",
    adminPanel: "Painel do Garante (Eu)",
    tagline: "Confiança e Rapidez em Moçambique",
    heroTitle: "Encontre o Melhor Biscateiro Agora.",
    heroSub: "A primeira plataforma de Moçambique com pagamento em custódia e verificação por Identidade AI.",
    securityFirst: "Segurança em Primeiro Lugar",
    safePayment: "Pagamento Seguro",
    safePaymentDesc: "O seu dinheiro fica guardado connosco. Só libertamos para o trabalhador quando você confirmar que o serviço foi bem feito.",
    idVerified: "Identidade Verificada",
    idVerifiedDesc: "Todos os prestadores passam por uma auditoria de BI e Selfie via Inteligência Artificial.",
    availableMoz: "Disponível em Toda Moçambique",
    bePro: "Seja um Pró",
    securityMax: "Segurança máxima: Perfil verificado por IA para maior confiança.",
    idVerification: "Verificação de Identidade (Obrigatório)",
    photoId: "Foto do BI",
    selfieId: "Selfie com BI",
    photoDesc: "Suas fotos não são públicas. São usadas apenas para assegurar a identidade ao cliente que o contrata.",
    finalizeReg: "Finalizar Registo",
    validating: "Validando...",
    basicData: "Dados Básicos",
    fullName: "Nome Completo",
    category: "Categoria",
    elite: "Elite",
    level: "Nível",
    jobsDone: "Biscates",
    portfolio: "Prova de Qualidade (Portfólio)",
    combineService: "Combinar Serviço",
    payAmount: "Quanto pretende pagar? (MT)",
    whatNeedsDone: "O que precisa ser feito?",
    recentReviews: "Avaliações Recentes",
    noReviews: "Sem comentários ainda",
    orderSms: "Pedir via SMS",
    bookApp: "Reservar via App",
    garanteDirecto: "Garante Directo",
    garanteDesc: "Grave o seu problema. O Garante garante que o trabalho será feito ou o dinheiro volta.",
    userSupport: "Apoio ao Utilizador",
    helpTitle: "Apoio ao Utilizador",
    helpSub: "Problemas com o pagamento ou com o biscate?",
    whatsappLine: "Linha Directa WhatsApp",
    whatsappDesc: "Fale directamente com o Moderador para validar o seu depósito manualmente.",
    talkWhatsapp: "Falar no WhatsApp",
    whyUse: "Porquê usar o Garante?",
    why1: "O seu dinheiro não vai para o trabalhador antes do serviço estar pronto.",
    why2: "Fotos do Antes e Depois provam o trabalho realizado.",
    nothingHere: "Tudo limpo por aqui.",
    startFirst: "Seja o primeiro a iniciar um biscate!",
    navHome: "Início",
    navJobs: "Biscates",
    navPending: "Pendente",
    navHelp: "Apoio",
    jobsTitle: "Gestão de Confiança",
    jobAlerts: "Alertas",
    trackingPanel: "Painel de Acompanhamento",
    jobOf: "Biscate de",
    amount: "Valor",
    code: "Cód.",
    sendMpesa: "Envie",
    to: "para",
    andPasteCode: "e cole o código:",
    confirmDeposit: "Confirmar Depósito",
    approvePayment: "Aprovar Pagamento",
    validateTransaction: "Validar Transação",
    checkIn: "Fazer Check-in (Foto Antes)",
    checkOut: "Fazer Check-out (Foto Depois)",
    finishReview: "Concluir & Avaliar",
    paymentSecureDone: "Pagamento Seguro Concluído",
    helpButton: "Botão de Ajuda (Emergência)",
    message: "Mensagem...",
    rateService: "Avalie o Serviço",
    howWasWork: "O que achou do trabalho?",
    submitting: "Enviando...",
    finalizeAll: "Finalizar Tudo",
    before: "Antes",
    after: "Depois",
    catElectricista: "Electricista Profissional",
    catCanalizador: "Canalizador",
    catMecanico: "Mecânico de Auto",
    catPedreiro: "Pedreiro / Pintor",
    catGerais: "Serviços Gerais",
    catLimpeza: "Limpeza",
    all: "Todos",
    mpesaIntegrated: "Integrado",
    statusWaiting: "Aguardando M-Pesa",
    statusValidating: "Em Validação (Adm)",
    statusPaid: "Pagamento Seguro",
    statusInProgress: "Trabalho em Curso",
    statusReview: "Revisão do Cliente",
    statusCompleted: "Concluído",
    panicAlertLabel: "🚨 Alerta de Ajuda",
    balance: "Saldo",
    active: "Ativo",
    nameOrId: "Pesquisar nome ou ID",
    receipt: "Recibo",
    finalValue: "Valor Final",
    provider: "Prestador",
    completionDate: "Data de Conclusão",
    noPayments: "Nenhum pagamento concluído ainda",
    notificationTitle: "Novo Biscate Disponível! 🚀",
    notificationBody: "Disponível em Maputo",
    versionLabel: "v1.5 PRO",
    verificationError: "A verificação falhou. Verifique as fotos.",
    connectionError: "Erro ao conectar com o serviço de segurança.",
    login: "Entrar",
    register: "Registar",
    email: "E-mail",
    password: "Palavra-passe",
    forgotPassword: "Esqueceu a palavra-passe?",
    resetPassword: "Redefinir Senha",
    sendResetLink: "Enviar Link de Recuperação",
    alreadyHaveAccount: "Já tem conta? Entre aqui",
    dontHaveAccount: "Não tem conta? Registe-se",
    authError: "Erro de autenticação. Verifique os dados.",
    resetSent: "Link de recuperação enviado para o seu e-mail.",
    signingIn: "Entrando...",
    signingUp: "Registando...",
    logout: "Sair"
  },
  en: {
    welcome: "What are we solving today?",
    start: "Start",
    jobs: "Jobs",
    history: "History",
    wallet: "Wallet",
    profile: "Profile",
    chat: "Chat",
    rating: "Rating",
    completed: "Completed",
    help: "Support",
    home: "Home",
    pending: "Pending",
    back: "Back",
    recording: "Recording...",
    recordAudio: "Record Audio",
    searchCategory: "Search category...",
    allBairros: "All Neighborhoods",
    verified: "Verified",
    clear: "Clear",
    proAvailable: "Available Professionals",
    nearYou: "Near you",
    getStarted: "Get Started Now",
    chooseProfile: "Choose your Profile",
    howToUse: "How do you want to use the platform today?",
    iAmClient: "I am a Client",
    needHelp: "I need help at home",
    iAmWorker: "I am a Worker",
    wantEarn: "I want to earn money",
    adminPanel: "Admin Panel",
    tagline: "Trust and Speed in Mozambique",
    heroTitle: "Find the Best Worker Now.",
    heroSub: "The first platform in Mozambique with escrow payment and AI Identity verification.",
    securityFirst: "Security First",
    safePayment: "Safe Payment",
    safePaymentDesc: "Your money stays with us. We only release it to the worker when you confirm the service is well done.",
    idVerified: "ID Verified",
    idVerifiedDesc: "All providers go through an ID and Selfie audit via Artificial Intelligence.",
    availableMoz: "Available in All Mozambique",
    bePro: "Be a Pro",
    securityMax: "Maximum security: AI-verified profile for greater trust.",
    idVerification: "Identity Verification (Required)",
    photoId: "ID Photo",
    selfieId: "Selfie with ID",
    photoDesc: "Your photos are not public. They are used only for client security.",
    finalizeReg: "Finalize Registration",
    validating: "Validating...",
    basicData: "Basic Data",
    fullName: "Full Name",
    category: "Category",
    elite: "Elite",
    level: "Level",
    jobsDone: "Jobs",
    portfolio: "Quality Proof (Portfolio)",
    combineService: "Combine Service",
    payAmount: "How much do you intend to pay? (MT)",
    whatNeedsDone: "What needs to be done?",
    recentReviews: "Recent Reviews",
    noReviews: "No reviews yet",
    orderSms: "Order via SMS",
    bookApp: "Book via App",
    garanteDirecto: "Garante Directo",
    garanteDesc: "Record your problem. Garante ensures the work is done or your money back.",
    userSupport: "User Support",
    helpTitle: "User Support",
    helpSub: "Problems with payment or the job?",
    whatsappLine: "WhatsApp Direct Line",
    whatsappDesc: "Talk directly with the Moderator to validate your deposit manually.",
    talkWhatsapp: "Talk on WhatsApp",
    whyUse: "Why use Garante?",
    why1: "Your money doesn't go to the worker before the service is ready.",
    why2: "Before and After photos prove the work performed.",
    nothingHere: "All clean here.",
    startFirst: "Be the first to start a job!",
    navHome: "Home",
    navJobs: "Jobs",
    navPending: "Pending",
    navHelp: "Help",
    jobsTitle: "Trust Management",
    jobAlerts: "Alerts",
    trackingPanel: "Tracking Panel",
    jobOf: "Job by",
    amount: "Amount",
    code: "Code",
    sendMpesa: "Send",
    to: "to",
    andPasteCode: "and paste the code:",
    confirmDeposit: "Confirm Deposit",
    approvePayment: "Approve Payment",
    validateTransaction: "Validate Transaction",
    checkIn: "Check-in (Photo Before)",
    checkOut: "Check-out (Photo After)",
    finishReview: "Finish & Rate",
    paymentSecureDone: "Secure Payment Completed",
    helpButton: "Help Button (Emergency)",
    message: "Message...",
    rateService: "Rate Service",
    howWasWork: "What did you think of the work?",
    submitting: "Sending...",
    finalizeAll: "Finalize All",
    before: "Before",
    after: "After",
    catElectricista: "Professional Electrician",
    catCanalizador: "Plumber",
    catMecanico: "Auto Mechanic",
    catPedreiro: "Mason / Painter",
    catGerais: "General Services",
    catLimpeza: "Cleaning",
    all: "All",
    mpesaIntegrated: "Integrated",
    statusWaiting: "Waiting for M-Pesa",
    statusValidating: "In Validation (Admin)",
    statusPaid: "Secure Payment",
    statusInProgress: "Work in Progress",
    statusReview: "Client Review",
    statusCompleted: "Completed",
    panicAlertLabel: "🚨 Help Alert",
    balance: "Balance",
    active: "Active",
    nameOrId: "Search name or ID",
    receipt: "Receipt",
    finalValue: "Final Value",
    provider: "Provider",
    completionDate: "Completion Date",
    noPayments: "No completed payments yet",
    notificationTitle: "New Job Available! 🚀",
    notificationBody: "Available in Maputo",
    versionLabel: "v1.5 PRO",
    verificationError: "Verification failed. Check photos.",
    connectionError: "Error connecting to security service.",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    resetPassword: "Reset Password",
    sendResetLink: "Send Recovery Link",
    alreadyHaveAccount: "Already have an account? Login",
    dontHaveAccount: "Don't have an account? Register",
    authError: "Authentication error. Please check your data.",
    resetSent: "Recovery link sent to your email.",
    signingIn: "Signing in...",
    signingUp: "Signing up...",
    logout: "Logout"
  },
  em: {
    welcome: "Exiphika ninla okhwele?",
    start: "Opacerya",
    jobs: "Miteko",
    history: "Ovikere",
    wallet: "Muthithu",
    profile: "Ova",
    chat: "Omaloli",
    rating: "Ovaha",
    completed: "Omalihera",
    help: "Nikhavelo",
    home: "Opacerya",
    pending: "Olokelela",
    back: "Otthikela",
    recording: "Orekavar...",
    recordAudio: "Orekavar Masu",
    searchCategory: "Ophavela muteko...",
    allBairros: "Mabairro Otheene",
    verified: "Osuweliwa",
    clear: "Okulula",
    proAvailable: "Anamakhalano Otheene",
    nearYou: "Vakhiviru",
    getStarted: "Opacerya Nanano",
    chooseProfile: "Othanla Maroho Anyu",
    howToUse: "Munaphavela okhalihera hayi?",
    iAmClient: "Miya ki Cliente",
    needHelp: "Kinaphavela nikhavelo vate",
    iAmWorker: "Miya ki Namuteko",
    wantEarn: "Kinaphavela ophavela musurukhu",
    adminPanel: "Painel wa Garante",
    tagline: "Osuweliwa ni Otthapa o Moçambique",
    heroTitle: "Ophavele Namuteko Mulupale Nanano.",
    heroSub: "Plataforma yoopacerya o Moçambique ni musurukhu woosareya.",
    securityFirst: "Osuweliwa Vohipacerya",
    safePayment: "Oliha Woosareya",
    safePaymentDesc: "Musurukhu anyu onnakhala ni hiyo. Onnavahiwa namuteko mmanle owerya muteko.",
    idVerified: "ID Osuweliwa",
    idVerifiedDesc: "Anamuteko otheene annasuweliwa ni Inteligência Artificial.",
    availableMoz: "Otheene o Moçambique",
    bePro: "Okhale Pró",
    securityMax: "Osuweliwa mulupale.",
    idVerification: "Osuweliwa wa Identidade",
    photoId: "Efoto ya BI",
    selfieId: "Selfie ni BI",
    photoDesc: "Efoto anyu khasihuliwa. Sinnaphariwa muteko wa osuweliwa paahi.",
    finalizeReg: "Omalihera Orephela",
    validating: "Osuweliwa...",
    basicData: "Ihantisi Saamuthitta",
    fullName: "Nsina Notheene",
    category: "Muteko",
    elite: "Elite",
    level: "Nível",
    jobsDone: "Miteko",
    portfolio: "Osuweliwa wa Muteko",
    combineService: "Olavula sa Muteko",
    payAmount: "Munaphavela oliha axeni? (MT)",
    whatNeedsDone: "Exiphika enaphavela opakiwa?",
    recentReviews: "Olavula sa Anamuteko",
    noReviews: "Khativo mulavulo",
    orderSms: "Ovekela ni SMS",
    bookApp: "Oraveya ni App",
    garanteDirecto: "Garante Directo",
    garanteDesc: "Orekave exiphika anyu. Garante onnasuwela wi muteko onnimaka.",
    userSupport: "Nikhavelo kookhalihera",
    helpTitle: "Nikhavelo kookhalihera",
    helpSub: "Exiphika ni oliha wala muteko?",
    whatsappLine: "WhatsApp Directo",
    whatsappDesc: "Olavule ni Moderator wi osuwelie musurukhu anyu.",
    talkWhatsapp: "Olavule ni WhatsApp",
    whyGarante: "Exeeni ephariwa muteko Garante?",
    why1: "Musurukhu anyu khonvahiwa namuteko muteko ohipakiwe.",
    why2: "Efoto ya Ohipacerya ni ya Omalihera sinnasuweliwa muteko.",
    nothingHere: "Otheene khweene.",
    startFirst: "Okhale oopacerya opaka miteko!",
    navHome: "Opacerya",
    navJobs: "Miteko",
    navPending: "Olokelela",
    navHelp: "Nikhavelo",
    jobsTitle: "Osuweliwa wa Muteko",
    jobAlerts: "Osuweliwa",
    trackingPanel: "Painel wa Muteko",
    jobOf: "Muteko wa",
    amount: "Musurukhu",
    code: "Número",
    sendMpesa: "Oveha",
    to: "wa",
    andPasteCode: "ni orephela código:",
    confirmDeposit: "Omalihera Musurukhu",
    approvePayment: "Ovaha Musurukhu",
    validateTransaction: "Osuweliwa wa Musurukhu",
    checkIn: "Check-in (Efoto Hero)",
    checkOut: "Check-out (Efoto Omalihera)",
    finishReview: "Omalihera ni Ovaha Star",
    paymentSecureDone: "Musurukhu Omala Woosareya",
    helpButton: "Nikhavelo na Emergência",
    message: "Masu...",
    rateService: "Ovaha Star",
    howWasWork: "Munupuwela exeeni sa muteko?",
    submitting: "Oveha...",
    finalizeAll: "Omalihera Otheene",
    before: "Hero",
    after: "Omalihera",
    catElectricista: "Namuteko wa Electrizista",
    catCanalizador: "Namuteko wa Maasi",
    catMecanico: "Namuteko wa Karu",
    catPedreiro: "Namuteko wa Inupa",
    catGerais: "Miteko sikina",
    catLimpeza: "Omalihera",
    all: "Otheene",
    mpesaIntegrated: "Omaloli",
    statusWaiting: "Olihelela M-Pesa",
    statusValidating: "Osuweliwa (Adm)",
    statusPaid: "Oliha Woosareya",
    statusInProgress: "Muteko Onnapakiwa",
    statusReview: "Othokorera wa Cliente",
    statusCompleted: "Omalihera",
    panicAlertLabel: "🚨 Nikhavelo nanano",
    balance: "Muthithu",
    active: "Ophariwa",
    nameOrId: "Ophavela nsina wala ID",
    receipt: "Recibo",
    finalValue: "Musurukhu wa Omalihera",
    provider: "Namuteko",
    completionDate: "Nihiku na Omalihera",
    noPayments: "Khativo musurukhu omalihiwe",
    notificationTitle: "Muteko Nakhalano! 🚀",
    notificationBody: "Ovira o Maputo",
    versionLabel: "v1.5 PRO",
    verificationError: "Osuweliwa khonaweryeyaka. Ovehe efoto.",
    connectionError: "Osuweliwa ni muteko wa osuweliwa.",
    login: "Ovolowa",
    register: "Orephela",
    email: "Email",
    password: "Senha",
    forgotPassword: "Mulihiyale senha?",
    resetPassword: "Oturuka Senha",
    sendResetLink: "Oveha Link wa Nikhavelo",
    alreadyHaveAccount: "Mookhalano conta? Ovolowe",
    dontHaveAccount: "Khamookhalano conta? Orephele",
    authError: "Erro wa ovolowa. Ovehe ihantisi.",
    resetSent: "Link wa nikhavelo onnevehiwa wa email anyu.",
    signingIn: "Ovolowa...",
    signingUp: "Orephela...",
    logout: "Okhuma"
  }
};

// --- Components ---

const JobChat = ({ jobId, sender, t }: { jobId: string, sender: string, t: any }) => {
  const [messages, setMessages] = useState<{ sender: string, text: string, time: string }[]>([]);
  const [input, setInput] = useState('');

  const fetchChat = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/chat`);
    if (res.ok) setMessages(await res.json());
  }, [jobId]);

  useEffect(() => {
    fetchChat();
    const inv = setInterval(fetchChat, 2000);
    return () => clearInterval(inv);
  }, [fetchChat]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await fetch(`/api/jobs/${jobId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, text: input })
    });
    setInput('');
    fetchChat();
  };

  return (
    <div className="flex flex-col h-64 bg-natural-surface rounded-2xl overflow-hidden border border-natural-line">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === sender ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-2 rounded-xl text-[10px] font-bold ${m.sender === sender ? 'bg-natural-accent text-white' : 'bg-white text-natural-ink'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 bg-white flex gap-2 border-t border-natural-line">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder={t.message}
          className="flex-1 bg-natural-surface rounded-xl px-3 py-2 text-[10px] outline-none"
        />
        <button onClick={sendMessage} className="bg-natural-accent text-white p-2 rounded-xl">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ReviewModal = ({ providerId, onFinish, t }: { providerId: number, onFinish: () => void, t: any }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await fetch(`/api/providers/${providerId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment })
    });
    onFinish();
  };

  return (
    <div className="p-6 bg-white rounded-[2.5rem] border-2 border-natural-accent shadow-premium animate-in fade-in zoom-in duration-300">
      <h3 className="text-lg font-black mb-4">{t.rateService}</h3>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => setRating(s)} className={`p-2 rounded-xl transition-all ${s <= rating ? 'bg-orange-100 text-natural-accent' : 'bg-natural-surface text-natural-muted'}`}>
            <Star className={`w-6 h-6 ${s <= rating ? 'fill-natural-accent' : ''}`} />
          </button>
        ))}
      </div>
      <textarea 
        placeholder={t.howWasWork}
        className="w-full p-4 bg-natural-surface border border-natural-line rounded-2xl h-24 text-xs font-bold outline-none mb-6"
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <button 
        disabled={submitting}
        onClick={submit}
        className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow"
      >
        {submitting ? t.submitting : t.finalizeAll}
      </button>
    </div>
  );
};

const JobCard = memo(({ job, role, onAction, t }: { job: Job, role: string, onAction: (j: Job, a: string, d?: any) => void, t: any }) => {
  const [txId, setTxId] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const sendPanic = () => {
    if (confirm("Deseja enviar um Alerta de Ajuda ao Garante? Sua localização será partilhada.")) {
      onAction(job, 'PANIC', { location: 'Location simulation' });
    }
  };

  if (showReview) return <ReviewModal providerId={job.providerId} onFinish={() => onAction(job, 'CONFIRM_CLIENT')} t={t} />;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border-2 p-5 rounded-3xl shadow-premium mb-4 transition-all ${job.panicAlert ? 'border-red-500 bg-red-50/10' : 'border-natural-line'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">{t.jobOf}</p>
          <h4 className="font-bold text-natural-heading">{job.category}</h4>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-xl transition-all ${showChat ? 'bg-natural-accent text-white' : 'bg-natural-surface text-natural-accent'}`}>
             <MessageSquare className="w-4 h-4" />
           </button>
           <StatusBadge status={job.status} panic={job.panicAlert} t={t} />
        </div>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
            <JobChat jobId={job.id} sender={role} t={t} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mb-6 text-center">
         <div className="flex-1 bg-natural-surface p-3 rounded-2xl">
            <p className="text-[10px] font-bold text-natural-muted uppercase mb-1">{t.amount}</p>
            <p className="font-black text-natural-heading leading-none">{job.amount} MT</p>
         </div>
         <div className="flex-1 bg-natural-surface p-3 rounded-2xl">
            <p className="text-[10px] font-bold text-natural-muted uppercase mb-1">{t.code}</p>
            <p className="font-mono text-[10px] font-bold leading-none bg-white py-1 rounded px-2 border border-natural-line">#{job.id}</p>
         </div>
      </div>

      {job.description && !showChat && (
        <div className="mb-6 p-4 bg-white border border-natural-line rounded-2xl italic text-xs text-natural-heading">
          "{job.description}"
        </div>
      )}

      {/* --- Panic Button (Worker only) --- */}
      {role === 'worker' && job.status === 'EM_CURSO' && (
        <button onClick={sendPanic} className="w-full bg-red-50 text-red-600 border-2 border-red-200 font-black py-3 rounded-2xl flex items-center justify-center gap-2 mb-4 hover:bg-red-100 transition-colors">
          <Heart className="w-4 h-4 fill-red-600" /> {t.helpButton}
        </button>
      )}

      {/* --- Client: Submit ID --- */}
      {role === 'client' && job.status === 'AGUARDANDO_DEPOSITO' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-xs font-medium text-yellow-800">
             {t.sendMpesa} <b>{job.amount} MT</b> {t.to} <b>870324189</b> {t.andPasteCode}
          </div>
          <input 
            type="text" placeholder="Código M-Pesa"
            className="w-full p-4 border border-natural-line rounded-2xl outline-none font-mono text-sm uppercase"
            value={txId} onChange={(e) => setTxId(e.target.value)}
          />
          <button 
            disabled={!txId}
            onClick={() => { onAction(job, 'SUBMIT_PAYMENT', { txId }); setTxId(''); }}
            className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl disabled:opacity-50"
          >
            {t.confirmDeposit}
          </button>
        </div>
      )}

      {/* --- Admin: Validate --- */}
      {role === 'admin' && job.status === 'VALIDACAO_PENDENTE' && (
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3">
          <p className="text-xs font-bold text-orange-800 uppercase">{t.validateTransaction}</p>
          <p className="font-mono text-sm bg-white p-3 rounded-xl border border-orange-200">{job.transactionId}</p>
          <button 
            onClick={() => onAction(job, 'ADMIN_APPROVE')}
            className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl"
          >
            {t.approvePayment}
          </button>
        </div>
      )}

      {/* --- Worker: Actions --- */}
      {role === 'worker' && job.status === 'PAGO' && (
        <button onClick={() => onAction(job, 'CHECK_IN')} className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
          <Camera className="w-5 h-5" /> {t.checkIn}
        </button>
      )}
      {role === 'worker' && job.status === 'EM_CURSO' && (
        <button onClick={() => onAction(job, 'CHECK_OUT')} className="w-full bg-natural-success text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {t.checkOut}
        </button>
      )}

      {/* --- Client: Confirm Finish --- */}
      {role === 'client' && job.status === 'FINALIZADO' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] font-black uppercase text-center mb-1">{t.before}</p>
              <img src={job.photoBefore} alt="" className="w-full h-24 object-cover rounded-xl border border-natural-line" />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase text-center mb-1">{t.after}</p>
              <img src={job.photoAfter} alt="" className="w-full h-24 object-cover rounded-xl border-2 border-natural-success" />
            </div>
          </div>
          <button onClick={() => setShowReview(true)} className="w-full bg-natural-success text-white font-black py-4 rounded-2xl shadow-lg shadow-green-100">
            {t.finishReview}
          </button>
        </div>
      )}

      {job.status === 'CONCLUIDO' && (
        <div className="text-center py-2 text-natural-success font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {t.paymentSecureDone}
        </div>
      )}
    </motion.div>
  );
});

const PaymentHistory = memo(({ jobs, providers, searchTerm, dateFilter, t }: { jobs: Job[], providers: Provider[], searchTerm: string, dateFilter: string, t: any }) => {
  const filtered = jobs.filter(j => {
    if (j.status !== 'CONCLUIDO') return false;
    const provider = providers.find(p => p.id === j.providerId);
    const dateStr = new Date(j.createdAt).toISOString().split('T')[0];
    
    const matchesSearch = !searchTerm || 
      j.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (provider && provider.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDate = !dateFilter || dateStr === dateFilter;
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2.5rem] border-2 border-dashed border-natural-line">
           <Package className="w-12 h-12 text-natural-muted mx-auto mb-4 opacity-20" />
           <p className="text-[10px] font-black text-natural-muted uppercase tracking-[0.2em]">{t.noPayments}</p>
        </div>
      ) : (
        filtered.map(j => {
          const provider = providers.find(p => p.id === j.providerId);
          return (
            <motion.div 
              key={j.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-[2.5rem] border-2 border-natural-line shadow-premium"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">{t.receipt}</p>
                  <h4 className="font-mono text-[10px] font-bold bg-natural-surface px-2 py-0.5 rounded border border-natural-line inline-block">#{j.id}</h4>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">{t.finalValue}</p>
                  <p className="font-black text-lg text-natural-success tracking-tighter">{j.amount} MT</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t-2 border-dashed border-natural-surface">
                <div className="flex-1">
                  <p className="text-[8px] font-black text-natural-muted uppercase mb-0.5">{t.provider}</p>
                  <p className="text-xs font-black text-natural-heading">{provider?.name || 'Sistema'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-natural-muted uppercase mb-0.5">{t.completionDate}</p>
                  <p className="text-[10px] font-bold text-natural-heading">{new Date(j.createdAt).toLocaleDateString('pt-MZ')}</p>
                </div>
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
});

const AuthScreen = ({ onAuthSuccess, t, lang }: { onAuthSuccess: (user: FirebaseUser) => void, t: any, lang: string }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(res.user);
      } else if (mode === 'register') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess(res.user);
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setMessage(t.resetSent);
        setTimeout(() => setMode('login'), 3000);
      }
    } catch (err: any) {
      setError(t.authError + ' (' + err.message + ')');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-natural-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-natural-accent/20 text-white mx-auto mb-6">
            <TrendingUp className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-natural-heading tracking-tight italic mb-2">
            {mode === 'login' ? t.login : mode === 'register' ? t.register : t.resetPassword}
          </h1>
          <p className="text-natural-muted font-bold text-sm tracking-wide opacity-70">Biscate Directo PRO</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
            <input 
              type="email" 
              required
              placeholder={t.email}
              className="w-full pl-12 pr-6 py-5 bg-white border-2 border-natural-line rounded-3xl outline-none focus:border-natural-accent transition-all font-bold text-sm"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
              <input 
                type="password" 
                required
                placeholder={t.password}
                className="w-full pl-12 pr-6 py-5 bg-white border-2 border-natural-line rounded-3xl outline-none focus:border-natural-accent transition-all font-bold text-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black border border-red-100">
               <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-black border border-green-100">
               <CheckCircle2 className="w-4 h-4 shrink-0" /> {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-natural-accent text-white font-black py-5 rounded-3xl shadow-accent-glow hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? t.login : mode === 'register' ? t.register : t.sendResetLink}
          </button>
        </form>

        <div className="mt-8 space-y-4 text-center">
          {mode === 'login' ? (
            <>
              <button 
                onClick={() => setMode('forgot')}
                className="text-[10px] font-black text-natural-accent uppercase tracking-widest block mx-auto underline"
              >
                {t.forgotPassword}
              </button>
              <button 
                onClick={() => setMode('register')}
                className="text-[10px] font-black text-natural-muted uppercase tracking-widest block mx-auto py-2"
              >
                {t.dontHaveAccount}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setMode('login')}
              className="text-[10px] font-black text-natural-accent uppercase tracking-widest block mx-auto py-2 underline"
            >
              {t.alreadyHaveAccount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const LandingPage = ({ onGetStarted, lang, setLang, t }: { onGetStarted: () => void, lang: string, setLang: (l: any) => void, t: any }) => {
  return (
    <div className="min-h-screen bg-natural-bg font-sans selection:bg-natural-accent/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-md border-b border-natural-line px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-natural-accent rounded-lg flex items-center justify-center text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="font-black text-lg tracking-tighter italic">Biscate Directo</span>
        </div>
        <div className="flex gap-3">
          {['pt', 'en', 'em'].map(l => (
            <button 
              key={l} 
              onClick={() => setLang(l as any)}
              className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border-2 transition-all ${lang === l ? 'bg-natural-accent border-natural-accent text-white' : 'bg-white border-natural-line text-natural-muted'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 max-w-4xl mx-auto text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6 }}
        >
          <span className="text-natural-accent font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">{t.tagline}</span>
          <h1 className="text-5xl md:text-7xl font-black text-natural-heading mb-6 tracking-tight leading-[0.9] italic">
            {t.heroTitle.split(' ').map((w: string, i: number) => (w === 'Melhor' || w === 'Best' || w === 'Mulupale') ? <span key={i} className="text-natural-accent">{w} </span> : <React.Fragment key={i}>{w} </React.Fragment>)}
          </h1>
          <p className="text-natural-muted font-bold text-lg mb-10 max-w-2xl mx-auto leading-tight opacity-80">
            {t.heroSub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onGetStarted}
              className="bg-natural-accent text-white px-10 py-5 rounded-full font-black text-xl shadow-2xl shadow-natural-accent/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {t.getStarted} <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Social Proof / Stats */}
      <section className="bg-white py-12 border-y border-natural-line overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 flex justify-around items-center">
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">1.2k+</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.jobsDone}</p>
          </div>
          <div className="h-8 w-px bg-natural-line"></div>
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">M-Pesa</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.mpesaIntegrated}</p>
          </div>
          <div className="h-8 w-px bg-natural-line"></div>
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">V-AI</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.verified}</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[3rem] border border-natural-line shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-natural-accent mb-6">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black mb-3">{t.safePayment}</h3>
            <p className="text-natural-muted font-bold text-sm leading-relaxed">
              {t.safePaymentDesc}
            </p>
          </div>
          <div className="bg-white p-8 rounded-[3rem] border border-natural-line shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black mb-3">{t.idVerified}</h3>
            <p className="text-natural-muted font-bold text-sm leading-relaxed">
              {t.idVerifiedDesc}
            </p>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="bg-natural-heading text-white py-24 px-6 rounded-t-[4rem]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-8 italic tracking-tighter">{t.availableMoz}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['Maputo City', 'Matola', 'Beira', 'Nampula', 'Tete'].map(city => (
              <span key={city} className="px-6 py-2 border border-white/20 rounded-full font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors cursor-default">
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-natural-heading text-white/40 py-10 text-center text-[10px] font-black uppercase tracking-[0.4em]">
        © 2024 Biscate Directo • {t.securityFirst}
      </footer>
    </div>
  );
};

const RoleSelection = ({ onSelect, onBack, lang, setLang, t }: { onSelect: (role: 'client' | 'worker' | 'admin') => void, onBack: () => void, lang: string, setLang: (l: any) => void, t: any }) => (
  <div className="fixed inset-0 bg-natural-bg z-[120] flex flex-col items-center justify-center p-8 text-center overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-500">
    <button onClick={onBack} className="absolute top-10 left-10 text-natural-muted font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
       ← {t.back}
    </button>
    <div className="w-20 h-20 bg-natural-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-natural-accent/20 text-white mb-8">
      <TrendingUp className="w-10 h-10" />
    </div>
    <h1 className="text-4xl font-black text-natural-heading mb-4 tracking-tight leading-none italic">{t.chooseProfile.split(' ').map((w: string, i: number) => i === 2 ? <React.Fragment key={i}><br/>{w}</React.Fragment> : <React.Fragment key={i}>{w} </React.Fragment>)}</h1>
    <p className="text-natural-muted font-bold mb-10 max-w-xs leading-tight">{t.howToUse}</p>
    
    <div className="grid gap-3 w-full max-w-sm">
      <button onClick={() => onSelect('client')} className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] flex flex-col items-center hover:border-natural-accent transition-all group active:scale-95 shadow-sm">
        <Search className="w-8 h-8 text-natural-accent mb-2 group-hover:scale-110 transition-transform" />
        <span className="font-black text-natural-heading uppercase tracking-widest text-sm">{t.iAmClient}</span>
        <span className="text-[10px] text-natural-muted mt-1 italic leading-none">{t.needHelp}</span>
      </button>

      <button onClick={() => onSelect('worker')} className="bg-natural-accent p-6 rounded-[2.5rem] flex flex-col items-center shadow-xl shadow-natural-accent/20 active:scale-95 transition-all text-white group">
        <Wrench className="w-8 h-8 mb-2 group-hover:rotate-12 transition-transform" />
        <span className="font-black tracking-widest uppercase text-sm">{t.iAmWorker}</span>
        <span className="text-[10px] text-orange-50 mt-1 italic leading-none">{t.wantEarn}</span>
      </button>

      <button onClick={() => onSelect('admin')} className="p-4 rounded-2xl flex items-center justify-center gap-2 text-natural-muted font-black border border-dashed border-natural-line mt-4 hover:bg-natural-surface transition-colors active:scale-95">
        <User className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-[0.2em] pt-0.5">{t.adminPanel}</span>
      </button>
    </div>
  </div>
);

const WorkerProfileForm = ({ onSave, t }: { onSave: (data: { name: string, category: string, photo: string, biPhoto: string, biSelfie: string, verified: boolean }) => void, t: any }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Serviços Gerais');
  const [photo, setPhoto] = useState<string | null>(null);
  const [biPhoto, setBiPhoto] = useState<string | null>(null);
  const [biSelfie, setBiSelfie] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = (callback: (res: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = async () => {
    if (!biPhoto || !biSelfie) return;
    
    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch('/api/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biPhoto, biSelfie })
      });
      
      const analysis = await res.json();
      
      if (analysis.valid) {
        onSave({ 
          name: analysis.nameOnId || name, 
          category, 
          photo: photo || '', 
          biPhoto, 
          biSelfie, 
          verified: true 
        });
      } else {
        setError(analysis.reason || t.verificationError);
      }
    } catch (err) {
      setError(t.connectionError);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 pb-32">
      <div className="mb-10 text-center">
         <h2 className="text-4xl font-black text-natural-heading mb-3 tracking-tighter italic">{t.bePro.split(' ').map((w: string, i: number) => i === 2 ? <span key={i} className="text-natural-accent underline">{w}</span> : <React.Fragment key={i}>{w} </React.Fragment>)}</h2>
         <p className="text-natural-muted font-bold text-sm leading-tight px-4 opacity-80">{t.securityMax}</p>
      </div>
      <div className="space-y-6 max-w-sm mx-auto">
        {/* Photo Upload */}
        <div className="flex flex-col items-center mb-6">
          <label className="relative cursor-pointer group">
            <div className="w-24 h-24 rounded-full bg-natural-surface border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative">
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-natural-muted opacity-30" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input type="file" className="hidden" accept="image/*" capture="user" onChange={handleCapture(setPhoto)} />
          </label>
          <p className="text-[10px] font-black uppercase text-natural-muted tracking-widest mt-2">{t.profile}</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-natural-muted tracking-[0.25em] ml-2">{t.basicData}</label>
          <div className="bg-white border-2 border-natural-line p-5 rounded-[1.5rem] flex items-center gap-4 shadow-sm focus-within:border-natural-accent transition-colors">
            <User className="text-natural-accent w-6 h-6" />
            <input 
              type="text" 
              placeholder={t.fullName} 
              className="w-full outline-none font-black text-natural-heading bg-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="bg-white border-2 border-natural-line p-5 rounded-[1.5rem] shadow-sm">
            <select 
              className="w-full outline-none font-black text-natural-heading bg-transparent appearance-none"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Electricista Profissional">{t.catElectricista}</option>
              <option value="Canalizador">{t.catCanalizador}</option>
              <option value="Mecânico de Auto">{t.catMecanico}</option>
              <option value="Pedreiro / Pintor">{t.catPedreiro}</option>
              <option value="Limpeza Profissional">{t.catLimpeza}</option>
              <option value="Serviços Gerais">{t.catGerais}</option>
            </select>
          </div>
        </div>

        {/* Verification Section */}
        <div className="bg-natural-surface p-6 rounded-[2rem] border-2 border-dashed border-natural-line">
          <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mb-4 italic">{t.idVerification}</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="cursor-pointer">
              <div className="h-28 bg-white rounded-xl border border-natural-line flex flex-col items-center justify-center overflow-hidden relative group">
                {biPhoto ? (
                  <img src={biPhoto} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <TrendingUp className="w-6 h-6 text-natural-muted opacity-40 mb-2" />
                    <span className="text-[8px] font-black uppercase text-center px-2">{t.photoId}</span>
                  </>
                )}
                <div className="absolute inset-0 bg-natural-accent/10 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                   <Camera className="text-natural-accent w-6 h-6" />
                </div>
              </div>
              <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleCapture(setBiPhoto)} />
            </label>
            <label className="cursor-pointer">
              <div className="h-28 bg-white rounded-xl border border-natural-line flex flex-col items-center justify-center overflow-hidden relative group">
                {biSelfie ? (
                  <img src={biSelfie} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Star className="w-6 h-6 text-natural-muted opacity-40 mb-2" />
                    <span className="text-[8px] font-black uppercase text-center px-2">{t.selfieId}</span>
                  </>
                )}
                <div className="absolute inset-0 bg-natural-accent/10 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                   <Camera className="text-natural-accent w-6 h-6" />
                </div>
              </div>
              <input type="file" className="hidden" accept="image/*" capture="user" onChange={handleCapture(setBiSelfie)} />
            </label>
          </div>
          <p className="text-[8px] text-natural-muted font-bold mt-3 text-center leading-tight">{t.photoDesc}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-center border border-red-100 animate-bounce">
            ⚠️ {error}
          </div>
        )}

        <button 
          onClick={handleFinalize} 
          disabled={!name || !biPhoto || !biSelfie || isValidating}
          className="w-full bg-natural-accent text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-natural-accent/40 text-xl uppercase tracking-widest mt-6 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-4"
        >
          {isValidating ? (
            <>
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
              <span>{t.validating}</span>
            </>
          ) : (
            t.finalizeReg
          )}
        </button>
      </div>
    </motion.div>
  );
};

const ProviderCard = memo(({ provider, onSelect }: { provider: Provider, onSelect: (p: Provider) => void }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    className={`bg-white p-5 rounded-[2.5rem] border-2 shadow-premium mb-4 relative overflow-hidden group cursor-pointer hover:border-natural-accent transition-all border-l-8 ${provider.verified ? 'border-l-natural-success' : 'border-l-natural-accent'}`}
    onClick={() => onSelect(provider)}
  >
    <div className="flex gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-[1.5rem] bg-natural-surface overflow-hidden flex-shrink-0 border-2 border-white shadow-inner">
          <img src={provider.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        {provider.verified && (
          <div className="absolute -right-2 -bottom-2 bg-natural-success text-white p-1.5 rounded-full border-2 border-white shadow-accent-glow">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex-1 py-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h4 className="font-black text-natural-heading leading-none text-base">{provider.name}</h4>
          {provider.level === 3 && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">Elite</span>}
        </div>
        <p className="text-[10px] font-black text-natural-accent uppercase tracking-[0.15em] mb-3">{provider.category}</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] font-black bg-natural-surface px-2.5 py-1 rounded-xl"><Star className="w-3.5 h-3.5 text-natural-accent fill-natural-accent" /> {provider.rating}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-natural-muted font-bold uppercase tracking-tight opacity-70"><MapPin className="w-3.5 h-3.5" /> {provider.bairro}</div>
        </div>
      </div>
    </div>
  </motion.div>
));

const CategoryButton = ({ icon: Icon, label, active, onClick, ...props }: { icon: any, label: string, active: boolean, onClick: () => void, [key: string]: any }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[2rem] transition-all border-2 ${
    active ? 'bg-natural-accent text-white border-natural-accent shadow-xl scale-110' : 'bg-white text-natural-muted border-natural-line hover:border-natural-accent shadow-sm'
  }`}>
    <Icon className={`w-8 h-8 mb-2 ${active ? 'text-white' : 'text-natural-accent'}`} />
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'auth' | 'roles' | 'app'>('landing');
  const [role, setRole] = useState<'client' | 'worker' | 'admin' | null>(null);
  const [tab, setTab] = useState<'explore' | 'jobs' | 'help'>('explore');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastJobCount, setLastJobCount] = useState<number>(0);
  const [notification, setNotification] = useState<{title: string, body: string} | null>(null);
  const [alertCategory, setAlertCategory] = useState<string>('Todos');
  const [category, setCategory] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');
  const [lang, setLang] = useState<'pt' | 'en' | 'em'>('pt');
  const [balance, setBalance] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [adminView, setAdminView] = useState<'active' | 'history'>('active');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [providerReviews, setProviderReviews] = useState<{rating: number, comment: string, date: string}[]>([]);

  const t = translations[lang];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole(data.role || null);
            if (data.role) setView('app');
            else setView('roles');
          } else {
            setView('roles');
          }
        } catch (err) {
          setView('roles');
        }
      } else {
        setView('landing');
        setRole(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []); // Remove view dependency to prevent loops, only run on mount and auth changes

  const handleRoleSelection = async (r: 'client' | 'worker' | 'admin') => {
    if (!currentUser) return;
    setRole(r);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        role: r,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setView('app');
    } catch (err) {
      setView('app'); // Fallback to app even if save fails (for demo)
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const fetchReviews = async (pid: number) => {
    const res = await fetch(`/api/providers/${pid}/reviews`);
    if (res.ok) setProviderReviews(await res.json());
  };

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    fetchReviews(p.id);
  };

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch(`/api/providers?category=${category}&minRating=${minRating}&verified=${onlyVerified}&bairro=${bairro}`);
      const data = await res.json();
      setProviders(data);
      if (role === 'worker') {
        const me = data.find((p: any) => p.name.includes("Muchanga")); // Mocking self as worker
        if (me) setBalance(me.balance);
      }
    } catch (err) { }
  }, [category, minRating, onlyVerified, bairro, role]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs`);
      const data = await res.json();
      
      // Notification Logic: If new jobs appeared and user is a worker
      if (role === 'worker' && data.length > lastJobCount && lastJobCount > 0) {
        const newestJob = data[data.length - 1];
        
        // Filter by preference
        if (alertCategory === 'Todos' || newestJob.category.includes(alertCategory)) {
          setNotification({
            title: t.notificationTitle,
            body: `${t.notificationBody}: ${newestJob.category} - ${newestJob.amount} MT`
          });
          setTimeout(() => setNotification(null), 5000);
        }
      }
      
      setJobs(data);
      setLastJobCount(data.length);
    } catch (err) { }
  }, [role, lastJobCount, alertCategory, t]);

  useEffect(() => {
    if (role === 'client' || role === 'admin') fetchProviders();
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchProviders, fetchJobs, role]);

  const [bookingAmount, setBookingAmount] = useState('500');
  const [bookingDesc, setBookingDesc] = useState('');

  const handleStartBiscate = async (p: Provider) => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        providerId: p.id, 
        category: p.category, 
        clientId: 'me',
        amount: Number(bookingAmount),
        description: bookingDesc
      })
    });
    if (res.ok) {
      setSelectedProvider(null);
      setTab('jobs');
      setBookingAmount('500');
      setBookingDesc('');
      fetchJobs();
    }
  };

  const handleSMSBooking = (p: Provider) => {
    const msg = `Ola ${p.name}, preciso de um ${p.category} no meu bairro. Meu ID de cliente e CLIENTE_TESTE. Aguardo retorno para orcamento.`;
    window.location.href = `sms:${p.phone}?body=${encodeURIComponent(msg)}`;
  };

  const handleCreateProfile = async (providerData: any) => {
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerData)
    });
    if (res.ok) {
      setTab('jobs');
      fetchProviders();
    }
  };

  const handleJobAction = async (job: Job, action: string, data: any = {}) => {
    await fetch(`/api/jobs/${job.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data })
    });
    fetchJobs();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-natural-accent animate-spin" />
      </div>
    );
  }

  if (view === 'landing') return <LandingPage onGetStarted={() => setView('auth')} lang={lang} setLang={setLang} t={t} />;
  
  if (view === 'auth') return <AuthScreen onAuthSuccess={() => setView('roles')} t={t} lang={lang} />;

  if (view === 'roles') return <RoleSelection onSelect={handleRoleSelection} onBack={() => setView('landing')} lang={lang} setLang={setLang} t={t} />;

  const categories = [
    { icon: Zap, label: t.catElectricista },
    { icon: Droplets, label: t.catCanalizador },
    { icon: Wrench, label: t.catMecanico },
    { icon: Package, label: t.catGerais },
    { icon: Camera, label: t.catPedreiro },
    { icon: LayoutGrid, label: t.catLimpeza }
  ];

  return (
    <div className="min-h-screen bg-natural-bg text-natural-ink font-sans flex flex-col items-center selection:bg-natural-accent selection:text-white pb-24">
      <div className="w-full max-w-md bg-natural-bg min-h-screen flex flex-col relative overflow-hidden">
        
        {/* In-App Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 20, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-0 left-6 right-6 z-[100] max-w-sm mx-auto"
            >
              <div className="bg-natural-heading text-white p-5 rounded-[2rem] shadow-2xl border-2 border-natural-accent flex items-center gap-4">
                <div className="w-12 h-12 bg-natural-accent rounded-2xl flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm italic leading-none mb-1">{notification.title}</p>
                  <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{notification.body}</p>
                </div>
                <button onClick={() => setNotification(null)} className="text-white opacity-40 hover:opacity-100">
                  <Heart className="w-5 h-5 rotate-45" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="sticky top-0 z-50 bg-natural-bg/90 backdrop-blur-xl border-b border-natural-line px-6 py-5 flex items-center justify-between">
          <div onClick={() => { setRole(null); setView('landing'); }} className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 bg-natural-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-natural-accent/20 italic font-black">B</div>
            <div>
              <h1 className="text-xl font-black text-natural-heading tracking-tighter italic leading-none">Biscate Directo</h1>
              <div className="flex gap-2 mt-1">
                {['pt', 'en', 'em'].map(l => (
                  <button 
                    key={l} 
                    onClick={() => setLang(l as any)}
                    className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${lang === l ? 'bg-natural-accent text-white' : 'text-natural-muted bg-natural-surface'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {role === 'worker' && (
              <div className="text-right">
                <p className="text-[7px] font-black text-natural-muted uppercase tracking-widest leading-none">{t.balance}</p>
                <p className="text-[12px] font-black text-natural-success tracking-tighter">{balance} MT</p>
              </div>
            )}
            <div className="bg-white border-2 border-natural-line px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-sm font-black text-[9px] uppercase text-natural-success">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {t.versionLabel}
            </div>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-white border-2 border-natural-line rounded-2xl flex items-center justify-center text-natural-muted hover:text-red-500 hover:border-red-500 transition-all shadow-sm active:scale-95"
              title={t.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <nav className="flex px-6 items-center gap-6 my-6 overflow-x-auto no-scrollbar scroll-smooth">
          <button onClick={() => setTab('explore')} className={`text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap pb-1.5 border-b-4 ${tab === 'explore' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-50'}`}>
            {t.start}
          </button>
          <button onClick={() => setTab('jobs')} className={`text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap pb-1.5 border-b-4 ${tab === 'jobs' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-50'}`}>
            {t.jobs}
          </button>
          {role === 'admin' && (
            <button onClick={() => setAdminView('history')} className="text-[10px] font-black uppercase tracking-[0.25em] text-natural-muted opacity-50 pb-1.5">
              Admin
            </button>
          )}
        </nav>

        {tab === 'explore' && role !== 'admin' ? (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
             {role === 'client' ? (
               <div className="px-6 py-10">
                 <h2 className="text-4xl font-black text-natural-heading mb-8 tracking-tighter leading-none italic">{t.welcome.split(' ').map((w: string, i: number) => i === 3 ? <span key={i} className="text-natural-accent">{w} </span> : <React.Fragment key={i}>{w} </React.Fragment>)}</h2>
                 
                 <div className="bg-white border-2 border-natural-line p-5 rounded-[2.5rem] mb-12 shadow-premium flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Search className="text-natural-accent w-6 h-6" />
                      <input 
                        type="text" 
                        placeholder={t.searchCategory} 
                        className="w-full bg-transparent outline-none font-black text-natural-heading placeholder:text-natural-muted/50"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-4 border-t border-natural-line">
                      <MapPin className="text-natural-accent w-5 h-5" />
                      <select 
                        className="w-full bg-transparent outline-none font-bold text-xs text-natural-heading appearance-none"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                      >
                        <option value="">{t.allBairros}</option>
                        <option value="Polana">Polana Caniço</option>
                        <option value="Malhangalene">Malhangalene</option>
                        <option value="Zimpeto">Zimpeto</option>
                        <option value="Inhagoia">Inhagoia</option>
                        <option value="Mafalala">Mafalala</option>
                        <option value="George">George Dimitrov</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-3 gap-3 mb-12">
                   {categories.slice(0, 3).map(c => (
                      <CategoryButton 
                        key={c.label} 
                        icon={c.icon} 
                        label={c.label} 
                        active={category === c.label} 
                        onClick={() => setCategory(c.label)} 
                      />
                    ))}
                 </div>
                 <div className="bg-natural-success rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden mb-12 group">
                   <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-1">{t.garanteDirecto}</h3>
                    <p className="text-green-50 text-xs mb-6 font-medium opacity-90 leading-tight">{t.garanteDesc}</p>
                    <button onMouseDown={() => setIsRecording(true)} onMouseUp={() => setIsRecording(false)} className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl ${isRecording ? 'bg-red-500 text-white scale-95' : 'bg-white text-natural-success hover:scale-[1.02]'}`}>
                      <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} /> <span className="uppercase tracking-widest text-sm">{isRecording ? t.recording : t.recordAudio}</span>
                    </button>
                   </div>
                   <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
                 </div>
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-natural-heading text-lg italic">{t.proAvailable}</h3>
                    <span className="text-[10px] font-black text-natural-muted uppercase opacity-40 italic">{t.nearYou}</span>
                 </div>

                 {/* Filters */}
                 <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                    <button 
                      onClick={() => setOnlyVerified(!onlyVerified)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${onlyVerified ? 'bg-natural-success border-natural-success text-white' : 'bg-white border-natural-line text-natural-muted'}`}
                    >
                      {t.verified} {onlyVerified ? '✓' : ''}
                    </button>
                    {[4, 4.5].map(r => (
                      <button 
                        key={r}
                        onClick={() => setMinRating(minRating === r ? 0 : r)}
                        className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${minRating === r ? 'bg-natural-accent border-natural-accent text-white' : 'bg-white border-natural-line text-natural-muted'}`}
                      >
                        {r}+ <Star className={`w-2.5 h-2.5 inline-block ml-1 ${minRating === r ? 'fill-white' : 'fill-natural-accent'}`} />
                      </button>
                    ))}
                    <button 
                      onClick={() => { setMinRating(0); setOnlyVerified(false); setCategory(''); }}
                      className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-natural-surface border-2 border-natural-line text-natural-muted"
                    >
                      {t.clear}
                    </button>
                 </div>

                 <div className="grid gap-4">
                   {providers.map(p => <ProviderCard key={p.id} provider={p} onSelect={handleSelectProvider} />)}
                 </div>
               </div>
             ) : (
               <WorkerProfileForm onSave={handleCreateProfile} t={t} />
             )}
          </div>
        ) : (
          <main className="flex-1 p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tab === 'jobs' || role === 'admin' ? (
              <>
                 <div className="mb-8 p-6 bg-natural-surface rounded-[2.5rem] border-2 border-natural-line border-dashed text-center">
                    <h2 className="text-3xl font-black text-natural-heading tracking-tighter mb-1 italic">{t.jobsTitle.split(' ').map((w: string, i: number) => (w === 'Confiança' || w === 'Trust' || w === 'Onikhwa') ? <span key={i} className="text-natural-accent">{w}</span> : <React.Fragment key={i}>{w} </React.Fragment>)}</h2>
                    <p className="text-xs font-bold text-natural-muted uppercase tracking-widest">
                      {role === 'worker' ? `${t.jobAlerts}: ${alertCategory}` : t.trackingPanel}
                    </p>
                    
                      {role === 'worker' && (
                        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar justify-center">
                          {[
                            { id: 'Todos', label: t.all },
                            { id: 'Electricista', label: t.catElectricista },
                            { id: 'Canalizador', label: t.catCanalizador },
                            { id: 'Mecânico', label: t.catMecanico },
                            { id: 'Gerais', label: t.catGerais }
                          ].map(cat => (
                            <button 
                              key={cat.id}
                              onClick={() => setAlertCategory(cat.id)}
                              className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase border-2 transition-all shrink-0 ${alertCategory === cat.id ? 'bg-natural-accent border-natural-accent text-white shadow-lg' : 'bg-white border-natural-line text-natural-muted'}`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      )}

                    {role === 'admin' && (
                      <div className="mt-6 flex bg-white p-1 rounded-2xl border-2 border-natural-line">
                        <button 
                          onClick={() => setAdminView('active')}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${adminView === 'active' ? 'bg-natural-accent text-white' : 'text-natural-muted'}`}
                        >
                          {t.active}
                        </button>
                        <button 
                          onClick={() => setAdminView('history')}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${adminView === 'history' ? 'bg-natural-accent text-white' : 'text-natural-muted'}`}
                        >
                          {t.history}
                        </button>
                      </div>
                    )}
                 </div>
                 {role === 'admin' && adminView === 'history' ? (
                   <div className="space-y-6">
                      <div className="grid gap-3">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-muted" />
                          <input 
                            type="text" 
                            placeholder={t.nameOrId}
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-natural-line rounded-2xl outline-none text-sm font-medium focus:border-natural-accent transition-colors"
                            value={paymentSearch}
                            onChange={(e) => setPaymentSearch(e.target.value)}
                          />
                        </div>
                        <input 
                          type="date"
                          className="w-full px-4 py-4 bg-white border-2 border-natural-line rounded-2xl outline-none text-sm font-black uppercase focus:border-natural-accent transition-colors"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                      <PaymentHistory 
                        jobs={jobs} 
                        providers={providers} 
                        searchTerm={paymentSearch} 
                        dateFilter={paymentDate} 
                        t={t}
                      />
                   </div>
                 ) : (
                   jobs.length > 0 ? (
                    jobs.map(j => <JobCard key={j.id} job={j} role={role!} onAction={handleJobAction} t={t} />)
                  ) : (
                    <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-natural-line group">
                      <div className="w-20 h-20 bg-natural-surface rounded-full flex items-center justify-center mx-auto mb-6 group-hover:rotate-12 transition-transform"><Package className="w-10 h-10 text-natural-muted" /></div>
                      <p className="font-black text-natural-heading text-xl mb-1">{t.nothingHere}</p>
                      <p className="text-xs text-natural-muted font-bold uppercase tracking-widest leading-loose">{t.startFirst}</p>
                    </div>
                  )
                 )}
              </>
            ) : (
              <div className="px-4 py-8 space-y-8 animate-in zoom-in-95 duration-500">
                 <div className="text-center mb-12">
                   <div className="w-24 h-24 bg-natural-accent/10 rounded-full flex items-center justify-center mx-auto mb-6"><Heart className="w-12 h-12 text-natural-accent fill-natural-accent/20" /></div>
                   <h2 className="text-4xl font-black text-natural-heading tracking-tighter mb-2 italic">{t.helpTitle.split(' ').map((w: string, i: number) => (w === 'Utilizador' || w === 'Support' || w === 'Anikhwe') ? <span key={i} className="text-natural-accent">{w} </span> : <React.Fragment key={i}>{w} </React.Fragment>)}</h2>
                   <p className="text-natural-muted font-bold text-sm">{t.helpSub}</p>
                 </div>
                 <div className="grid gap-4">
                    <div className="bg-white p-6 rounded-[2rem] border-2 border-natural-line shadow-sm">
                       <h4 className="font-black text-natural-heading mb-2 uppercase tracking-wide">{t.whatsappLine}</h4>
                       <p className="text-sm text-natural-muted font-medium mb-6 leading-relaxed">{t.whatsappDesc}</p>
                       <a 
                         href="https://wa.me/258870324189" 
                         target="_blank" 
                         rel="noreferrer"
                         className="w-full bg-green-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-green-200 active:scale-95 transition-transform"
                       >
                         <MessageSquare className="w-6 h-6" /> {t.talkWhatsapp}
                       </a>
                    </div>
                   <div className="bg-natural-surface p-8 rounded-[2.5rem] border-2 border-natural-line">
                      <h4 className="font-black text-natural-heading text-center mb-6 uppercase tracking-widest text-xs">{t.whyUse}</h4>
                      <div className="space-y-6">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-natural-line shrink-0"><CheckCircle2 className="w-5 h-5 text-natural-success" /></div>
                          <p className="text-xs font-bold text-natural-heading leading-relaxed pt-1">{t.why1}</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-natural-line shrink-0"><Camera className="w-5 h-5 text-natural-accent" /></div>
                          <p className="text-xs font-bold text-natural-heading leading-relaxed pt-1">{t.why2}</p>
                        </div>
                      </div>
                   </div>
                 </div>
              </div>
            )}
          </main>
        )}

        <AnimatePresence>
          {selectedProvider && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProvider(null)} className="fixed inset-0 bg-natural-heading/70 backdrop-blur-xl z-[60]" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 20, stiffness: 150 }} className="fixed bottom-0 left-0 right-0 bg-natural-bg rounded-t-[3.5rem] z-[70] px-8 pt-10 pb-12 shadow-2xl max-w-md mx-auto overflow-y-auto max-h-[90vh]">
                <div className="flex gap-6 mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-[2rem] bg-white overflow-hidden border-2 border-natural-line shadow-md">
                      <img src={selectedProvider.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    {selectedProvider.verified && (
                      <div className="absolute -right-2 -bottom-2 bg-natural-success text-white p-1.5 rounded-full border-2 border-white shadow-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 py-1">
                    <h3 className="text-2xl font-black text-natural-heading leading-tight mb-1">{selectedProvider.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="font-black text-natural-accent text-[8px] uppercase tracking-[0.2em]">{selectedProvider.category}</span>
                       <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${selectedProvider.level === 3 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                         Nível {selectedProvider.level} {selectedProvider.level === 3 ? 'Elite' : selectedProvider.level === 2 ? 'Pro' : 'Iniciante'}
                       </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-natural-muted"><Star className="w-3 h-3 text-natural-accent fill-natural-accent" /> {selectedProvider.rating} • {selectedProvider.jobs} Biscates</div>
                  </div>
                </div>

                {/* Portfolio Mosaic */}
                {selectedProvider.portfolio && selectedProvider.portfolio.length > 0 && (
                  <div className="mb-8 overflow-hidden">
                    <p className="text-[10px] font-black text-natural-muted uppercase tracking-[0.2em] mb-4 italic">{t.portfolio}</p>
                    <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                      {selectedProvider.portfolio.map((p, idx) => (
                        <div key={idx} className="shrink-0 w-48 space-y-2">
                           <div className="relative h-32 rounded-2xl overflow-hidden border border-natural-line">
                              <img src={p.after} className="w-full h-full object-cover" />
                              <div className="absolute bottom-2 right-2 bg-natural-success/90 text-white text-[8px] font-black px-2 py-1 rounded">{t.after}</div>
                           </div>
                           <div className="relative h-20 rounded-xl overflow-hidden border border-natural-line grayscale opacity-60">
                              <img src={p.before} className="w-full h-full object-cover" />
                              <div className="absolute bottom-2 right-2 bg-natural-heading/90 text-white text-[8px] font-black px-2 py-1 rounded">{t.before}</div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white p-6 rounded-[2rem] mb-8 border-2 border-natural-line">
                   <p className="text-[10px] font-black text-natural-muted uppercase mb-4 tracking-[0.25em]">{t.combineService}</p>
                   <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-bold text-natural-muted uppercase ml-2 mb-1 block">{t.payAmount}</label>
                        <input 
                          type="number" 
                          className="w-full p-4 bg-natural-surface border-2 border-natural-line rounded-2xl outline-none font-black text-natural-heading focus:border-natural-accent transition-colors"
                          value={bookingAmount}
                          onChange={(e) => setBookingAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-natural-muted uppercase ml-2 mb-1 block">{t.whatNeedsDone}</label>
                        <textarea 
                          placeholder="Ex: Trocar tomada da sala..."
                          className="w-full p-4 bg-natural-surface border-2 border-natural-line rounded-2xl outline-none text-sm font-medium text-natural-heading focus:border-natural-accent h-24 resize-none"
                          value={bookingDesc}
                          onChange={(e) => setBookingDesc(e.target.value)}
                        />
                      </div>
                   </div>
                </div>

                {/* Reviews Section */}
                <div className="mb-8 p-6 bg-natural-surface rounded-[2rem] border-2 border-natural-line">
                  <p className="text-[10px] font-black text-natural-muted uppercase tracking-[0.25em] mb-4 italic">{t.recentReviews}</p>
                  {providerReviews.length === 0 ? (
                    <p className="text-[10px] font-bold text-natural-muted uppercase text-center py-4 opacity-50 tracking-widest">{t.noReviews}</p>
                  ) : (
                    <div className="space-y-4">
                      {providerReviews.map((r, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-natural-line/50 shadow-sm transition-all hover:shadow-md">
                          <div className="flex gap-1 mb-2">
                             {Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="w-3 h-3 text-natural-accent fill-natural-accent" />)}
                          </div>
                          <p className="text-[11px] font-bold text-natural-heading leading-tight mb-2 tracking-tight">"{r.comment}"</p>
                          <p className="text-[8px] font-black text-natural-muted uppercase">{new Date(r.date).toLocaleDateString(lang === 'pt' ? 'pt-MZ' : 'en-US')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleSMSBooking(selectedProvider)} className="flex-1 bg-white border-2 border-natural-line text-natural-muted font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-2 hover:border-natural-accent transition-all active:scale-95">
                    <MessageSquare className="w-5 h-5 text-natural-accent" /> <span className="text-xs uppercase">{t.orderSms}</span>
                  </button>
                  <button onClick={() => handleStartBiscate(selectedProvider)} className="flex-[2] bg-natural-accent text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-natural-accent/30 uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-transform">
                    {t.bookApp}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t-2 border-natural-line z-50 px-10 py-5 flex justify-between items-center max-w-md mx-auto rounded-t-[3rem] shadow-[0_-15px_50px_rgba(45,41,38,0.1)]">
          <div onClick={() => { if(role !== 'admin') setTab('explore'); }} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'explore' && role !== 'admin' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <LayoutGrid className="w-7 h-7 mb-1" />
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{t.navHome}</span>
          </div>
          <div onClick={() => setTab('jobs')} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'jobs' || role === 'admin' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <div className="relative">
              <MessageSquare className="w-7 h-7 mb-1" />
              {jobs.some(j => (role === 'client' && j.status === 'FINALIZADO') || (role === 'worker' && j.status === 'PAGO') || (role === 'admin' && j.status === 'VALIDACAO_PENDENTE')) && (
                <div className="absolute -right-1 -top-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{role === 'admin' ? t.navPending : t.navJobs}</span>
          </div>
          <div onClick={() => { if(role !== 'admin') setTab('help'); }} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'help' && role !== 'admin' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <Heart className="w-7 h-7 mb-1" />
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{t.navHelp}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
