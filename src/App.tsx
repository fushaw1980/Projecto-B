/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, memo, useMemo, useRef, Fragment } from 'react';
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
  AlertCircle,
  X,
  Plus,
  Car,
  Sparkles,
  Utensils,
  Smartphone,
  Monitor,
  PartyPopper,
  Baby,
  Scissors,
  Hammer,
  Home,
  Share2,
  DownloadCloud,
  Shield,
  Map,
  Thermometer,
  Wind,
  Waves,
  Bath,
  Tv,
  Palette,
  Bell,
  AlarmClock,
  Share2
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
  limit,
  addDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const NOTIFICATION_ICON = "https://img.icons8.com/3d-fluency/512/wrench.png";
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3';

const shortenUrl = async (url: string) => {
  try {
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      return await response.text();
    }
  } catch (err) {
    console.error('TinyURL error:', err);
  }
  return url;
};

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom SVG Markers for a professional look
const createCustomMarker = (type: 'job' | 'provider' | 'user') => {
  const colors = {
    job: '#10B981',
    provider: '#E65100',
    user: '#3B82F6'
  };
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full blur-[2px] opacity-20" style="background-color: ${colors[type]}"></div>
        <div class="relative w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center" style="background-color: ${colors[type]}">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
        <div class="absolute -bottom-1 w-1.5 h-1.5 rotate-45" style="background-color: ${colors[type]}"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 24],
    popupAnchor: [0, -20]
  });
};

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

const handleFirestoreError = (error: any, operation: OperationType, path: string | null = null) => {
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

// --- Notification Service ---
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

const sendLocalNotification = (title: string, options: NotificationOptions & { data?: { url?: string, jobId?: string } }) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { ...options, icon: NOTIFICATION_ICON });
  
  n.onclick = () => {
    window.focus();
    if (options.data?.jobId) {
      // Logic to open specific job
      const event = new CustomEvent('open-job', { detail: options.data.jobId });
      window.dispatchEvent(event);
    }
    n.close();
  };

  // Also try sound
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.play().catch(() => {});
  } catch(e) {}
};
// --- Map Components ---
const MapView = ({ jobs = [], providers = [], userPos, t }: { jobs?: Job[], providers?: Provider[], userPos: [number, number], t: any }) => {
  const [mapType, setMapType] = useState('streets');

  return (
    <div className="w-full h-[65vh] rounded-[3rem] overflow-hidden border-4 border-white shadow-premium relative z-10 group mt-4">
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-natural-line/50 shadow-premium flex items-center gap-2 pointer-events-none transition-transform group-hover:scale-105">
          <Sparkles className="w-4 h-4 text-natural-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-natural-heading">Explorar arredores</span>
        </div>
        <div className="bg-natural-accent text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider self-start shadow-sm shadow-orange-200">
          {providers.length} {t.verified || 'Verificados'}
        </div>
      </div>
      
      <MapContainer center={userPos} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        {mapType === 'streets' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Imagery &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        <ChangeView center={userPos} />
        <MapControls userPos={userPos} setMapType={setMapType} mapType={mapType} />
        
        {providers.map(p => (
          <Marker 
            key={p.id} 
            position={[userPos[0] + (Math.random() - 0.5) * 0.012, userPos[1] + (Math.random() - 0.5) * 0.012]} 
            icon={createCustomMarker('provider')}
          >
            <Popup className="premium-popup">
              <div className="p-3 min-w-[160px]">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-natural-line/30">
                  <div className="w-10 h-10 rounded-2xl bg-natural-surface border border-natural-line overflow-hidden shadow-sm">
                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="font-black text-sm text-natural-heading leading-none mb-1">{p.name}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-black text-natural-heading">{p.rating}</span>
                      <span className="text-[9px] font-bold text-natural-muted">({p.jobs} jobs)</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-natural-accent" />
                    <p className="font-black text-[10px] text-natural-accent uppercase tracking-wider">{p.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-natural-muted" />
                    <p className="text-[10px] text-natural-muted font-bold">{p.bairro}</p>
                  </div>
                </div>
                <button className="w-full mt-3 bg-natural-accent text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-sm hover:scale-105 active:scale-95 transition-all">
                  Ver Perfil
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {jobs.filter(j => j.lat && j.lng).map(job => (
          <Marker key={job.id} position={[job.lat!, job.lng!]} icon={createCustomMarker('job')}>
            <Popup className="premium-popup">
              <div className="p-3 min-w-[140px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="font-black text-[10px] text-green-600 uppercase tracking-widest">Biscate Aberto</p>
                </div>
                <p className="font-black text-lg text-natural-heading leading-none mb-1">{job.amount} MT</p>
                <p className="font-bold text-[10px] text-natural-muted mb-2 uppercase tracking-tight">{job.category}</p>
                <div className="bg-natural-surface p-2 rounded-xl border border-natural-line/50">
                  <p className="text-[10px] text-natural-heading font-medium line-clamp-3 italic opacity-80">"{job.description}"</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <Marker position={userPos} icon={createCustomMarker('user')}>
          <Popup className="premium-popup">
            <div className="p-2 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[min(3px,0.2em)] text-blue-600 text-center">Você está aqui</p>
              <div className="w-full h-[1px] bg-blue-100" />
              <p className="text-[9px] text-center font-bold text-natural-muted">Pesquisando profissionais próximos...</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

interface Provider {
  id: string;
  name: string;
  category: string;
  bairro: string;
  rating: number;
  verified: boolean;
  level: number;
  jobs: number;
  phone: string;
  photo: string;
  portfolio: string[];
}

interface Job {
  id: string;
  providerId: string;
  clientId: string;
  category: string;
  amount: number;
  description?: string;
  status: string;
  transactionId?: string;
  payoutTransactionId?: string;
  photoBefore?: string;
  photoAfter?: string;
  panicAlert?: boolean;
  createdAt: any;
  updatedAt?: any;
  lat?: number;
  lng?: number;
}

// --- Components ---

const StatusBadge = memo(({ status, panic, t }: { status: string, panic?: boolean, t: any }) => {
  if (panic) return <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-red-600 text-white animate-pulse shadow-sm shadow-red-200">🚨 {t.panicAlertLabel}</span>;
  
  const map: Record<string, { label: string, color: string, emoji: string }> = {
    'AGUARDANDO_DEPOSITO': { label: t.statusWaiting, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', emoji: '🟡' },
    'VALIDACAO_PENDENTE': { label: t.statusValidating, color: 'bg-orange-50 text-orange-700 border-orange-200', emoji: '🟠' },
    'PAGO': { label: t.statusPaid, color: 'bg-indigo-50 text-indigo-700 border-indigo-200', emoji: '📘' },
    'EM_CURSO': { label: t.statusInProgress, color: 'bg-blue-50 text-blue-700 border-blue-200', emoji: '🔵' },
    'FINALIZADO': { label: t.statusReview, color: 'bg-purple-50 text-purple-700 border-purple-200', emoji: '🟣' },
    'CONCLUIDO': { label: t.statusCompleted, color: 'bg-green-50 text-green-700 border-green-200', emoji: '🟢' },
    'CANCELADO': { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200', emoji: '🔴' }
  };
  const s = map[status] || { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200', emoji: '⚪' };
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full border ${s.color}`}>{s.emoji} {s.label}</span>;
});

const PwaGuideModal = memo(({ onShow, onClose }: { onShow: boolean, onClose: () => void }) => {
  if (!onShow) return null;
  const isIframe = window.self !== window.top;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-[3rem] shadow-premium overflow-hidden border-4 border-white"
      >
        <div className="p-8">
          <div className="w-20 h-20 bg-natural-surface rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-premium border border-natural-line overflow-hidden">
             <img src={NOTIFICATION_ICON} alt="Mozbiscates" className="w-full h-full object-cover scale-110" />
          </div>
          
          <h2 className="text-2xl font-black text-center text-natural-heading italic mb-4">Instale o App Pro</h2>
          
          <div className="space-y-4 mb-8">
            {isIframe ? (
              <div className="bg-natural-accent/5 p-5 rounded-3xl border border-natural-accent/10">
                <p className="text-xs font-bold text-natural-heading uppercase tracking-widest mb-3 opacity-60">Passo 1:</p>
                <div className="flex items-center gap-4 text-sm font-black text-natural-heading">
                  <div className="w-10 h-10 bg-natural-accent rounded-xl flex items-center justify-center text-white shrink-0">1</div>
                  <p>Clique no botão <span className="text-natural-accent">"Abrir em nova aba" ↗️</span> no topo da página.</p>
                </div>
                <div className="h-4" />
                <p className="text-xs font-bold text-natural-heading uppercase tracking-widest mb-3 opacity-60">Passo 2:</p>
                <div className="flex items-center gap-4 text-sm font-black text-natural-heading">
                  <div className="w-10 h-10 bg-natural-accent rounded-xl flex items-center justify-center text-white shrink-0">2</div>
                  <p>Na nova aba, clique no banner de instalação ou no menu do seu navegador.</p>
                </div>
              </div>
            ) : (
             <div className="bg-natural-surface p-5 rounded-3xl border border-natural-line">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-natural-line shrink-0">📱</div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tighter mb-1">No Android (Chrome)</h4>
                    <p className="text-[11px] text-natural-muted font-bold">Menu (⋮) {'>'} Instalar App</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-natural-line shrink-0">🍎</div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tighter mb-1">No iPhone (Safari)</h4>
                    <p className="text-[11px] text-natural-muted font-bold">Partilhar (⎋) {'>'} Ecrã Principal</p>
                  </div>
                </div>
             </div>
            )}
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-natural-heading text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-natural-ink transition-colors shadow-premium"
          >
            Entendi
          </button>
        </div>
      </motion.div>
    </div>
  );
});

const FeeBreakdown = ({ amount, t }: { amount: number, t: any }) => {
  const fee = amount * 0.1;
  const net = amount - fee;
  return (
    <div className="bg-natural-surface/50 border border-natural-line rounded-2xl p-4 mt-2 space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-natural-muted">
        <span>Valor do Serviço</span>
        <span className="text-natural-heading">{amount} MT</span>
      </div>
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-red-500">
        <span>Taxa do App (10%)</span>
        <span>- {fee.toFixed(0)} MT</span>
      </div>
      <div className="pt-2 border-t border-natural-line flex justify-between text-[10px] font-black uppercase tracking-widest text-natural-accent">
        <span>Tu Recebes</span>
        <span className="text-sm italic">{net.toFixed(0)} MT</span>
      </div>
    </div>
  );
};

const CommunityRules = ({ t }: { t: any }) => (
  <div className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] mt-8 shadow-sm">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 bg-natural-surface rounded-xl"><AlertCircle className="w-5 h-5 text-natural-accent" /></div>
      <h3 className="font-black text-natural-heading uppercase tracking-tighter italic">Informações Importantes</h3>
    </div>
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-1.5 h-1.5 bg-natural-accent rounded-full mt-1.5 flex-shrink-0" />
        <p className="text-[11px] font-bold text-natural-muted leading-snug">
          <b>Pagamentos Rápidos:</b> Saques M-Pesa são processados manualmente em até 24h após a conclusão.
        </p>
      </div>
      <div className="flex gap-3">
        <div className="w-1.5 h-1.5 bg-natural-accent rounded-full mt-1.5 flex-shrink-0" />
        <p className="text-[11px] font-bold text-natural-muted leading-snug">
          <b>Fotos Obrigatórias:</b> Envie sempre a foto do "antes" (ao chegar) e "depois" (ao terminar) para libertar o pagamento.
        </p>
      </div>
      <div className="flex gap-3">
        <div className="w-1.5 h-1.5 bg-natural-accent rounded-full mt-1.5 flex-shrink-0" />
        <p className="text-[11px] font-bold text-natural-muted leading-snug">
          <b>Segurança:</b> Use o botão de ajuda 🚨 em caso de qualquer problema no local. O Moderador entrará em contacto.
        </p>
      </div>
    </div>
  </div>
);

const WorkerWallet = ({ t }: { t: any }) => (
  <div className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] mt-6 shadow-sm overflow-hidden relative">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Package className="w-12 h-12 text-natural-accent" />
    </div>
    <div className="flex items-center justify-between mb-4 relative z-10">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-natural-surface rounded-xl"><Zap className="w-5 h-5 text-natural-accent" /></div>
        <h3 className="font-black text-natural-heading uppercase tracking-tighter italic">Minha Carteira</h3>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest">Saldo</p>
        <p className="text-2xl font-black text-natural-heading italic leading-none">0 MT</p>
      </div>
    </div>
    <div className="bg-natural-surface p-4 rounded-2xl border border-natural-line relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black text-natural-muted uppercase tracking-widest mb-1">Receber Via</p>
          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">M-Pesa</div>
            <p className="text-sm font-black text-natural-heading font-mono tracking-tight">841060800</p>
          </div>
        </div>
        <div className="bg-natural-line h-8 w-[1px]" />
        <div className="text-right">
           <p className="text-[9px] font-black text-natural-muted uppercase tracking-widest mb-1">Estado</p>
           <span className="text-[8px] font-black uppercase text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
             <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Verificado
           </span>
        </div>
      </div>
    </div>
    <p className="text-[9px] font-bold text-natural-muted mt-4 italic leading-tight">
      * Os pagamentos são processados para este número automaticamente após cada biscate concluído.
    </p>
  </div>
);

const WithdrawalManagement = ({ jobs, onAction, t }: { jobs: Job[], onAction: (j: Job, a: string) => void, t: any }) => {
  const pending = jobs.filter(j => j.status === 'VALIDACAO_PENDENTE');
  const payouts = jobs.filter(j => j.status === 'CONCLUIDO' && !j.payoutTransactionId);

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] shadow-sm">
        <h3 className="text-lg font-black text-natural-heading mb-4 italic">🏦 Depósitos a Validar ({pending.length})</h3>
        <div className="space-y-4">
          {pending.map(j => (
            <div key={j.id} className="p-4 bg-natural-surface rounded-2xl border border-natural-line flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-natural-muted uppercase">{j.category}</p>
                <p className="text-xs font-bold">M-Pesa: <span className="font-mono text-natural-accent">{j.transactionId}</span></p>
                <p className="text-[10px] font-bold text-natural-muted">{j.amount} MT</p>
              </div>
              <button 
                onClick={() => onAction(j, 'VALIDATE_PAYMENT')}
                className="bg-natural-accent text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-accent-glow"
              >
                Validar
              </button>
            </div>
          ))}
          {pending.length === 0 && <p className="text-xs font-bold text-natural-muted text-center py-4 italic">Nenhum depósito pendente</p>}
        </div>
      </div>

      <div className="bg-white border-2 border-red-100 p-6 rounded-[2.5rem] shadow-sm">
        <h3 className="text-lg font-black text-natural-heading mb-4 italic">💸 Pagamentos aos Biscateiros ({payouts.length})</h3>
        <div className="space-y-4">
          {payouts.map(j => (
            <div key={j.id} className="p-4 bg-red-50/30 rounded-2xl border border-red-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-natural-muted uppercase">Biscateiro ID: {j.providerId}</p>
                <p className="text-sm font-black text-natural-heading">{(j.amount * 0.9).toFixed(0)} MT</p>
                <p className="text-[8px] font-bold text-red-600 uppercase italic">M-Pesa Destino: 841060800</p>
              </div>
              <button 
                onClick={() => onAction(j, 'MARK_AS_PAID')}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm shadow-red-200"
              >
                Marcar Pago
              </button>
            </div>
          ))}
          {payouts.length === 0 && <p className="text-xs font-bold text-natural-muted text-center py-4 italic">Nenhum pagamento p/ trabalhador pendente</p>}
        </div>
      </div>
    </div>
  );
};

const StatsHeader = ({ data, t }: { data: any, t: any }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      <div className="bg-white border-2 border-natural-line p-5 rounded-[2.5rem] shadow-premium flex flex-col items-center justify-center text-center">
        <p className="text-3xl font-black text-natural-heading leading-none italic">{data.jobs || 0}</p>
        <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.jobsDone || 'Biscates'}</p>
      </div>
      <div className="bg-natural-accent p-5 rounded-[2.5rem] shadow-accent-glow flex flex-col items-center justify-center text-center text-white">
        <p className="text-3xl font-black leading-none italic">{data.level || 1}</p>
        <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">{t.level || 'Nível'}</p>
      </div>
    </div>
  );
};

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
    garanteDirecto: "Mozbiscates",
    garanteDesc: "Grave o seu problema. O Mozbiscates garante que o trabalho será feito ou o dinheiro volta.",
    userSupport: "Apoio ao Utilizador",
    helpTitle: "Apoio ao Utilizador",
    helpSub: "Problemas com o pagamento ou com o biscate?",
    whatsappLine: "Linha Mozbiscates",
    whatsappDesc: "Fale com o Moderador para validar o seu depósito manualmente.",
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
    setReminder: "Definir Lembrete",
    reminderSet: "Lembrete definido para",
    remindMe: "Lembrar-me em",
    reminderNotice: "Lembrete de Trabalho",
    reminderBody: "O seu trabalho está prestes a começar ou tem um prazo próximo!",
    m15: "15 min antes",
    h1: "1 hora antes",
    h2: "2 horas antes",
    d1: "1 dia antes",
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
    catPedreiro: "Pedreiro",
    catPintor: "Pintor Profissional",
    catGerais: "Serviços Gerais",
    catLimpeza: "Limpeza",
    catMotorista: "Motorista Particular",
    catDiarista: "Diarista / Doméstica",
    catCozinheiro: "Cozinheiro(a) a Domicílio",
    catManicure: "Manicure / Pedicure",
    catEsteticista: "Esteticista / Beleza",
    catReparacaoTelemoveis: "Reparação de Telemóveis",
    catSuporteTI: "Suporte Técnico de TI",
    catFotografo: "Fotógrafo(a)",
    catOrganizadorEventos: "Organizador(a) de Eventos",
    catBabysitter: "Babysitter",
    catGuarda: "Segurança / Guarda",
    catJardineiro: "Jardineiro",
    catAlfaiate: "Alfaiate / Costureira",
    catMarceneiro: "Marceneiro / Carpinteiro",
    catSoldador: "Soldador",
    catFrio: "Técnico de AC / Frio",
    catPiscineiro: "Piscineiro",
    catLavaCar: "Lavagem de Carros",
    catAntenas: "Instalador de Antenas",
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
    notificationTitle: "Novo Biscate Disponível! 🔨",
    notificationBody: "Novo serviço na sua área",
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
    garanteDirecto: "Mozbiscates",
    garanteDesc: "Record your problem. Mozbiscates ensures the work is done or your money back.",
    userSupport: "User Support",
    helpTitle: "User Support",
    helpSub: "Problems with payment or the job?",
    whatsappLine: "Mozbiscates Line",
    whatsappDesc: "Talk with the Moderator to validate your deposit manually.",
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
    setReminder: "Set Reminder",
    reminderSet: "Reminder set for",
    remindMe: "Remind me in",
    reminderNotice: "Job Reminder",
    reminderBody: "Your job is about to start or has an approaching deadline!",
    m15: "15 min before",
    h1: "1 hour before",
    h2: "2 hours before",
    d1: "1 day before",
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
    catPedreiro: "Mason",
    catPintor: "Professional Painter",
    catGerais: "General Services",
    catLimpeza: "Cleaning",
    catMotorista: "Private Driver",
    catDiarista: "Daily Charwoman / Maid",
    catCozinheiro: "Home Cook / Chef",
    catManicure: "Manicure / Pedicure",
    catEsteticista: "Beautician / Beauty",
    catReparacaoTelemoveis: "Phone Repair",
    catSuporteTI: "IT Technical Support",
    catFotografo: "Photographer",
    catOrganizadorEventos: "Event Organizer",
    catBabysitter: "Babysitter",
    catGuarda: "Security Guard",
    catJardineiro: "Gardener",
    catAlfaiate: "Tailor / Seamstress",
    catMarceneiro: "Carpenter",
    catSoldador: "Welder",
    catFrio: "AC / Cooling Tech",
    catPiscineiro: "Pool Cleaner",
    catLavaCar: "Car Wash",
    catAntenas: "Antenna Installer",
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
    garanteDirecto: "Mozbiscates",
    garanteDesc: "Orekave exiphika anyu. Mozbiscates onnasuwela wi muteko onnimaka.",
    userSupport: "Nikhavelo kookhalihera",
    helpTitle: "Nikhavelo kookhalihera",
    helpSub: "Exiphika ni oliha wala muteko?",
    whatsappLine: "WhatsApp Mozbiscates",
    whatsappDesc: "Olavule ni Moderator wi osuwelie musurukhu anyu.",
    talkWhatsapp: "Olavule ni WhatsApp",
    whyUse: "Exeeni ephariwa muteko Garante?",
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
    setReminder: "Opaka Lembrete",
    reminderSet: "Lembrete opakiwa ni",
    remindMe: "Okituupuxerya ni",
    reminderNotice: "Lembrete wa Muteko",
    reminderBody: "Muteko anyu onnaatama opacerya!",
    m15: "minuto 15",
    h1: "ewora 1",
    h2: "ewora 2",
    d1: "nihiku 1",
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
    catPintor: "Namuteko wa Opinta",
    catSoldador: "Namuteko wa Soldador",
    catFrio: "Namuteko wa Frio",
    catGuarda: "Guarda / Segurança",
    catJardineiro: "Namuteko wa Jardim",
    catAlfaiate: "Namuteko wa Alfaiate",
    catMarceneiro: "Namuteko wa Madeira",
    catPiscineiro: "Namuteko wa Piscina",
    catLavaCar: "Namuteko wa Lava Jato",
    catAntenas: "Namuteko wa Antena",
    catGerais: "Miteko sikina",
    catLimpeza: "Omalihera",
    catMotorista: "Namuteko wa Karu",
    catDiarista: "Namuteko wa Vate",
    catCozinheiro: "Namuteko wa Owapeya",
    catManicure: "Namuteko wa Mata",
    catEsteticista: "Namuteko wa Oreera",
    catReparacaoTelemoveis: "Namuteko wa Telemóvel",
    catSuporteTI: "Namuteko wa Computador",
    catFotografo: "Namuteko wa Efoto",
    catOrganizadorEventos: "Namuteko wa Festa",
    catBabysitter: "Namuteko wa Amwane",
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

const JobChat = memo(({ jobId, currentUser, t }: { jobId: string, currentUser: any, t: any }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'jobs', jobId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Chat error:", err));
    return () => unsubscribe();
  }, [jobId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      await addDoc(collection(db, 'jobs', jobId, 'messages'), {
        senderId: currentUser.uid,
        text,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  return (
    <div className="flex flex-col h-64 bg-natural-surface rounded-2xl overflow-hidden border border-natural-line">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {messages.map((m, i) => {
          const isMe = m.senderId === currentUser.uid;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-2 rounded-xl text-[10px] font-bold ${isMe ? 'bg-natural-accent text-white shadow-accent-glow' : 'bg-white text-natural-heading'}`}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2 bg-white flex gap-2 border-t border-natural-line">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder={t.message}
          className="flex-1 bg-natural-surface rounded-xl px-3 py-2 text-[10px] outline-none"
        />
        <button onClick={sendMessage} className="bg-natural-accent text-white p-2 rounded-xl active:scale-95 transition-transform">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

const ReviewModal = memo(({ providerId, onFinish, t }: { providerId: string, onFinish: () => void, t: any }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        providerId,
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      onFinish();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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
        className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow active:scale-95 transition-transform"
      >
        {submitting ? t.submitting : t.finalizeAll}
      </button>
    </div>
  );
});

const JobReminder = memo(({ jobId, jobTitle, t }: { jobId: string, jobTitle: string, t: any }) => {
  const [reminders, setReminders] = useState<any[]>(() => {
    const saved = localStorage.getItem('mozbiscates-reminders');
    return saved ? JSON.parse(saved) : [];
  });
  const [showOptions, setShowOptions] = useState(false);

  const addReminder = (type: string, ms: number) => {
    const remindAt = Date.now() + ms;
    const newReminder = {
      id: Math.random().toString(36).substr(2, 9),
      jobId,
      jobTitle,
      remindAt,
      type,
      notified: false
    };
    const updated = [...reminders, newReminder];
    setReminders(updated);
    localStorage.setItem('mozbiscates-reminders', JSON.stringify(updated));
    setShowOptions(false);
  };

  const jobReminders = reminders.filter(r => r.jobId === jobId);

  return (
    <div className="relative mt-3 pt-3 border-t border-natural-line/50">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {jobReminders.map(r => (
            <div key={r.id} className="flex items-center gap-1.5 bg-natural-surface px-2.5 py-1 rounded-full border border-natural-line">
              <AlarmClock className="w-3 h-3 text-natural-accent" />
              <span className="text-[9px] font-black text-natural-muted uppercase tracking-tighter">
                {t[r.type]}
              </span>
            </div>
          ))}
        </div>
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${showOptions ? 'bg-natural-accent text-white' : 'bg-natural-surface text-natural-accent hover:bg-natural-accent/5'}`}
        >
          <Bell className="w-3 h-3" /> {t.setReminder}
        </button>
      </div>

      <AnimatePresence>
        {showOptions && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3"
          >
            <div className="grid grid-cols-2 gap-2 bg-natural-surface p-3 rounded-2xl border border-natural-line">
              <button onClick={() => addReminder('m15', 15 * 60000)} className="text-[10px] font-bold p-2 bg-white rounded-xl border border-natural-line hover:border-natural-accent transition-colors">
                {t.m15}
              </button>
              <button onClick={() => addReminder('h1', 60 * 60000)} className="text-[10px] font-bold p-2 bg-white rounded-xl border border-natural-line hover:border-natural-accent transition-colors">
                {t.h1}
              </button>
              <button onClick={() => addReminder('h2', 120 * 60000)} className="text-[10px] font-bold p-2 bg-white rounded-xl border border-natural-line hover:border-natural-accent transition-colors">
                {t.h2}
              </button>
              <button onClick={() => addReminder('d1', 24 * 60 * 60000)} className="text-[10px] font-bold p-2 bg-white rounded-xl border border-natural-line hover:border-natural-accent transition-colors">
                {t.d1}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const JobCard = memo(({ job, role, onAction, t, currentUser }: { job: Job, role: string, onAction: (j: Job, a: string, d?: any) => void, t: any, currentUser: any }) => {
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
           <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-xl transition-all ${showChat ? 'bg-natural-accent text-white shadow-accent-glow' : 'bg-natural-surface text-natural-accent'}`}>
             <MessageSquare className="w-4 h-4" />
           </button>
           <StatusBadge status={job.status} panic={job.panicAlert} t={t} />
        </div>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
            <JobChat jobId={job.id} currentUser={currentUser} t={t} />
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

      {role !== 'admin' && job.status !== 'CONCLUIDO' && (
        <JobReminder jobId={job.id} jobTitle={job.category} t={t} />
      )}

      {role === 'worker' && <FeeBreakdown amount={job.amount} t={t} />}

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
    const dateStr = j.createdAt ? new Date(j.createdAt).toISOString().split('T')[0] : '';
    
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
              {j.payoutTransactionId && (
                <div className="mt-4 p-3 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <p className="text-[8px] font-black text-red-600 uppercase">Saque Enviado (M-Pesa)</p>
                  </div>
                  <p className="font-mono text-[9px] font-black text-red-700">DEST: 841060800</p>
                </div>
              )}
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
      let msg = err.message;
      if (msg.includes('operation-not-allowed')) {
        msg = "O login por E-mail ainda não foi ativado no Firebase Console. Por favor, ative 'Email/Password' em Authentication > Sign-in method.";
      }
      setError(t.authError + ' (' + msg + ')');
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
            {mode === 'login' ? (t.login || 'Login') : mode === 'register' ? (t.register || 'Registar') : (t.resetPassword || 'Redefinir')}
          </h1>
          <p className="text-natural-muted font-bold text-sm tracking-wide opacity-70">Mozbiscates PRO</p>
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
    <header className="fixed top-0 left-0 right-0 z-[200] bg-white/70 backdrop-blur-xl border-b border-natural-line/40 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-natural-accent rounded-xl flex items-center justify-center shadow-accent-glow rotate-2 transition-transform hover:rotate-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-base text-natural-heading tracking-tighter italic leading-none uppercase">Moz</h1>
            <p className="text-[10px] font-black text-natural-accent tracking-[0.1em] leading-none mt-0.5 uppercase">Biscates</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['pt', 'en', 'em'].map(l => (
            <button 
              key={l} 
              onClick={() => setLang(l as any)}
              className={`w-8 h-8 flex items-center justify-center text-[10px] font-black uppercase rounded-xl border-2 transition-all ${lang === l ? 'bg-natural-accent border-natural-accent text-white shadow-sm' : 'bg-white border-natural-line text-natural-muted hover:border-natural-accent/30'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-orange-50/50 to-transparent -z-10 blur-3xl opacity-50" />
        
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8, ease: "easeOut" }}
           className="max-w-4xl mx-auto text-center space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-white border border-natural-line/50 px-4 py-2 rounded-full shadow-premium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted">{t.tagline}</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-natural-heading tracking-tighter leading-[0.85] italic">
            {(String(t.heroTitle || '')).split(' ').map((w: string, i: number) => (w === 'Melhor' || w === 'Best' || w === 'Mulupale') ? <span key={i} className="text-natural-accent drop-shadow-sm">{w} </span> : <Fragment key={i}>{w} </Fragment>)}
          </h1>

          <p className="text-xl md:text-2xl text-natural-muted font-medium max-w-2xl mx-auto leading-relaxed">
            {t.heroSub}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={onGetStarted}
              className="group relative bg-natural-accent text-white px-12 py-6 rounded-3xl font-black text-xl shadow-accent-glow hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-4 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">{t.getStarted}</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform relative z-10" />
            </button>
            <button className="bg-white text-natural-heading border-2 border-natural-line px-12 py-6 rounded-3xl font-black text-xl hover:bg-natural-surface hover:border-natural-accent/30 transition-all active:scale-95">
              Explorar Mapa
            </button>
          </div>
        </motion.div>
      </section>

      {/* Social Proof / Stats */}
      <section className="bg-white py-12 border-y border-natural-line overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 flex justify-around items-center">
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">1.2k+</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.jobsDone || 'Biscates'}</p>
          </div>
          <div className="h-8 w-px bg-natural-line"></div>
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">M-Pesa</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.mpesaIntegrated || 'Integrado'}</p>
          </div>
          <div className="h-8 w-px bg-natural-line"></div>
          <div className="text-center">
            <p className="text-3xl font-black text-natural-heading leading-none">V-AI</p>
            <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mt-1">{t.verified || 'Verificado'}</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          <motion.div 
            whileHover={{ y: -10 }}
            className="bg-white p-10 rounded-[3rem] border border-natural-line/50 shadow-premium group transition-all"
          >
            <div className="w-16 h-16 bg-orange-50 rounded-[1.5rem] flex items-center justify-center text-natural-accent mb-8 group-hover:scale-110 transition-transform shadow-inner-glow">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-natural-heading mb-4 tracking-tighter italic whitespace-nowrap">{t.safePayment}</h3>
            <p className="text-natural-muted font-medium text-lg leading-relaxed">
              {t.safePaymentDesc}
            </p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -10 }}
            className="bg-white p-10 rounded-[3rem] border border-natural-line/50 shadow-premium group transition-all"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 mb-8 group-hover:scale-110 transition-transform shadow-inner-glow">
              <User className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-natural-heading mb-4 tracking-tighter italic whitespace-nowrap">{t.idVerified}</h3>
            <p className="text-natural-muted font-medium text-lg leading-relaxed">
              {t.idVerifiedDesc}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Map Section */}
      <section className="bg-[#1A1715] text-white py-32 px-6 rounded-t-[5rem] -mt-12 group">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4">
             <div className="inline-block p-3 bg-natural-accent/10 border border-natural-accent/20 rounded-2xl mb-4">
               <MapPin className="w-8 h-8 text-natural-accent" />
             </div>
             <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter leading-none">{t.availableMoz}</h2>
             <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Cidades com cobertura oficial</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {['Maputo City', 'Matola', 'Beira', 'Nampula', 'Tete'].map((city, i) => (
              <motion.span 
                key={city}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="px-8 py-4 border border-white/10 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:border-natural-accent/50 transition-all cursor-default shadow-sm"
              >
                {city}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-natural-heading text-white/40 py-10 text-center text-[10px] font-black uppercase tracking-[0.4em]">
        © 2024 Mozbiscates • {t.securityFirst}
      </footer>
    </div>
  );
};

const RoleSelection = ({ onSelect, onBack, lang, setLang, t, currentUser, isAdminEmail }: { onSelect: (role: 'client' | 'worker' | 'admin') => void, onBack: () => void, lang: string, setLang: (l: any) => void, t: any, currentUser: FirebaseUser | null, isAdminEmail: boolean }) => {
  return (
    <div className="fixed inset-0 bg-natural-bg z-[120] flex flex-col items-center justify-center p-8 text-center overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-500">
      <button onClick={onBack} className="absolute top-10 left-10 text-natural-muted font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
         ← {t.back}
      </button>
      <div className="w-20 h-20 bg-natural-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-natural-accent/20 text-white mb-8">
        <TrendingUp className="w-10 h-10" />
      </div>
      <h1 className="text-4xl font-black text-natural-heading mb-4 tracking-tight leading-none italic">{(String(t.chooseProfile || '')).split(' ').map((w: string, i: number) => i === 2 ? <Fragment key={i}><br/>{w}</Fragment> : <Fragment key={i}>{w} </Fragment>)}</h1>
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

        {isAdminEmail && (
          <button onClick={() => onSelect('admin')} className="p-4 rounded-2xl flex items-center justify-center gap-2 text-natural-muted font-black border border-dashed border-natural-line mt-4 hover:bg-natural-surface transition-colors active:scale-95">
            <User className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-[0.2em] pt-0.5">{t.adminPanel}</span>
          </button>
        )}
      </div>
    </div>
  );
};

const WorkerProfileForm = ({ onSave, t }: { onSave: (data: { name: string, category: string, photo: string, biPhoto: string, biSelfie: string, verified: boolean, portfolio: string[] }) => void, t: any }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Serviços Gerais');
  const [photo, setPhoto] = useState<string | null>(null);
  const [biPhoto, setBiPhoto] = useState<string | null>(null);
  const [biSelfie, setBiSelfie] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<string[]>([]);
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

  const addPortfolio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && portfolio.length < 3) {
      const reader = new FileReader();
      reader.onloadend = () => setPortfolio([...portfolio, reader.result as string]);
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
          verified: true,
          portfolio
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
         <h2 className="text-4xl font-black text-natural-heading mb-3 tracking-tighter italic">{(String(t.bePro || '')).split(' ').map((w: string, i: number) => i === 2 ? <span key={i} className="text-natural-accent underline">{w}</span> : <Fragment key={i}>{w} </Fragment>)}</h2>
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
              <option value="Motorista Particular">{t.catMotorista}</option>
              <option value="Diarista / Doméstica">{t.catDiarista}</option>
              <option value="Cozinheiro(a) a Domicílio">{t.catCozinheiro}</option>
              <option value="Manicure / Pedicure">{t.catManicure}</option>
              <option value="Esteticista / Beleza">{t.catEsteticista}</option>
              <option value="Reparação de Telemóveis">{t.catReparacaoTelemoveis}</option>
              <option value="Suporte Técnico de TI">{t.catSuporteTI}</option>
              <option value="Fotógrafo(a)">{t.catFotografo}</option>
              <option value="Organizador(a) de Eventos">{t.catOrganizadorEventos}</option>
              <option value="Babysitter">{t.catBabysitter}</option>
              <option value="Serviços Gerais">{t.catGerais}</option>
            </select>
          </div>
        </div>

        {/* Verification Section */}
        <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-dashed border-amber-200">
          <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-4 italic flex items-center gap-2">
            <Lock className="w-4 h-4" /> Segurança: Verificação Obrigatória
          </p>
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

        {/* Portfolio Section */}
        <div className="bg-white border-2 border-natural-line p-6 rounded-[2rem] shadow-sm">
           <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mb-4 italic">Portfolio / Trabalhos Anteriores</p>
           <div className="flex gap-4">
              {portfolio.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-natural-line">
                   <img src={img} alt="" className="w-full h-full object-cover" />
                   <button onClick={() => setPortfolio(portfolio.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-600 shadow-sm">
                      <X className="w-3 h-3" />
                   </button>
                </div>
              ))}
              {portfolio.length < 3 && (
                <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-natural-line flex flex-col items-center justify-center cursor-pointer hover:bg-natural-surface transition-colors">
                   <Plus className="w-6 h-6 text-natural-muted opacity-40 mb-1" />
                   <span className="text-[8px] font-black uppercase text-natural-muted">Adicionar</span>
                   <input type="file" className="hidden" accept="image/*" onChange={addPortfolio} />
                </label>
              )}
           </div>
           <p className="text-[8px] text-natural-muted font-bold mt-3 leading-tight">Adicione até 3 fotos dos seus melhores biscates.</p>
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
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    className={`bg-white p-5 rounded-[2.5rem] border-2 shadow-premium mb-4 relative overflow-hidden group cursor-pointer hover:border-natural-accent transition-all border-l-8 ${provider.verified ? 'border-l-natural-success' : 'border-l-natural-accent'}`}
    onClick={() => onSelect(provider)}
  >
    <div className="absolute top-4 right-4 z-20">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          const shareUrl = `${window.location.origin}${window.location.pathname}?workerId=${provider.id}`;
          shortenUrl(shareUrl).then(short => {
            navigator.clipboard.writeText(short);
            alert("Link do perfil encurtado e copiado!");
          });
        }}
        className="p-2 bg-natural-surface rounded-full hover:bg-natural-accent hover:text-white transition-colors"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
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
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-natural-heading leading-none text-base">{provider.name}</h4>
            {provider.level === 3 && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">Elite</span>}
          </div>
          <span className="text-[8px] font-black uppercase text-natural-success flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Ativo</span>
        </div>
        <p className="text-[10px] font-black text-natural-accent uppercase tracking-[0.15em] mb-3">{provider.category}</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] font-black bg-natural-surface px-2.5 py-1 rounded-xl"><Star className="w-3.5 h-3.5 text-natural-accent fill-natural-accent" /> {provider.rating}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-natural-muted font-bold uppercase tracking-tight opacity-70"><MapPin className="w-3.5 h-3.5" /> {provider.bairro}</div>
        </div>
      </div>
    </div>

    {provider.portfolio && provider.portfolio.length > 0 && (
      <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {provider.portfolio.map((img, i) => (
          <div key={i} className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-natural-line flex-shrink-0 shadow-sm transition-transform group-hover:scale-105" style={{ transitionDelay: `${i * 100}ms` }}>
            <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>
    )}
  </motion.div>
));

const CategoryButton = memo(({ icon: Icon, label, active, onClick, isTop, ...props }: { icon: any, label: string, active: boolean, onClick: () => void, isTop?: boolean, [key: string]: any }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center justify-center p-5 rounded-[2.5rem] transition-all border-2 group relative overflow-hidden ${
      active 
        ? 'bg-natural-accent text-white border-natural-accent shadow-lg scale-105' 
        : 'bg-white text-natural-muted border-natural-line hover:border-natural-accent/20 shadow-sm'
    }`}
  >
    {isTop && !active && (
      <div className="absolute top-2 right-2 bg-natural-accent/10 text-natural-accent text-[6px] font-black px-1.5 py-0.5 rounded-full border border-natural-accent/20 uppercase tracking-tighter z-10">
        TOP
      </div>
    )}
    <div className={`p-3 rounded-2xl mb-3 transition-colors ${active ? 'bg-white/20' : 'bg-natural-surface'}`}>
      <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-natural-accent'}`} />
    </div>
    <span className={`text-[9px] font-black uppercase tracking-wider text-center leading-tight ${active ? 'text-white' : 'text-natural-heading'}`}>{label}</span>
  </button>
));

// --- Map Logic ---
const MapControls = ({ userPos, setMapType, mapType }: { userPos: [number, number], setMapType: (t: string) => void, mapType: string }) => {
  const map = useMap();
  
  return (
    <div className="absolute bottom-10 right-6 z-[1000] flex flex-col gap-3">
      <button 
        onClick={() => map.flyTo(userPos, 15)}
        className="w-14 h-14 bg-white rounded-2xl shadow-premium border border-natural-line/50 flex items-center justify-center text-natural-heading hover:text-natural-accent transition-colors active:scale-90"
        title="Minha Localização"
      >
        <MapPin className="w-6 h-6" />
      </button>
      <button 
        onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
        className="w-14 h-14 bg-white rounded-2xl shadow-premium border border-natural-line/50 flex items-center justify-center text-natural-heading hover:text-natural-accent transition-colors active:scale-90 overflow-hidden group"
      >
        {mapType === 'streets' ? (
          <div className="flex flex-col items-center">
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[7px] font-black uppercase">Sat</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span className="text-[7px] font-black uppercase">Map</span>
          </div>
        )}
      </button>
    </div>
  );
};

const BAIRROS_LIST = [
  "Alto Maé", "Sommerschield", "Costa do Sol", "Triunfo", "Polana Caniço", "Polana Cimento", 
  "Central", "Museu", "Coop", "Malhangalene", "Maxaquene", "Chamanculo", "Mafalala", 
  "Xipamanine", "Aeroporto", "Mavalane", "Hulene", "Laulane", "Ferroviário", "Mahlazine", 
  "25 de Junho", "Jardim", "Luis Cabral", "Inhagoia", "George Dimitrov", "Benfica", 
  "Bagamoyo", "Zimpeto", "Albasine", "Kumbeza", "Marracuene", "Michafutene", "Matola Cidade", 
  "Matola Gare", "Liberdade", "Fomento", "Machava", "Nkobe", "Bedene", "Kongolote", 
  "Intaka", "T3", "Sikwama", "Singatela", "Ndlavela", "Bunhiça", "Infulene", "Trevo", 
  "Tchumene", "Malhampsene", "Mussumbuluco", "Matola Rio", "Belo Horizonte", "Boane", 
  "Umbeluzi", "Ponta Gêa", "Maquinino", "Chaimite", "Munhava", "Goto", "Estoril", 
  "Macuti", "Manga", "Matacuane", "Muatala", "Muhala", "Murrapaniua", "Namicopo", 
  "Napipine", "Carrupeia", "Francisco Manyanga", "Mateus Sansão Muthemba", "Chingodzi", 
  "Icidua", "Sangariveira", "Coalane", "Chuabo Dembe", "Paquitequete", "Cariacó", 
  "Natite", "Alto Gingone", "Vilankulo", "Inhambane Cidade", "Maxixe", "Chokwé", "Xai-Xai"
];

const STATIC_CATEGORIES = (t: any) => [
  { icon: Zap, label: t.catElectricista },
  { icon: Droplets, label: t.catCanalizador },
  { icon: Thermometer, label: t.catFrio },
  { icon: Shield, label: t.catGuarda },
  { icon: Map, label: t.catJardineiro },
  { icon: Scissors, label: t.catAlfaiate },
  { icon: Hammer, label: t.catMarceneiro },
  { icon: Wrench, label: t.catMecanico },
  { icon: Palette, label: t.catPintor },
  { icon: Wind, label: t.catPedreiro },
  { icon: LayoutGrid, label: t.catLimpeza },
  { icon: Car, label: t.catMotorista },
  { icon: Home, label: t.catDiarista },
  { icon: Utensils, label: t.catCozinheiro },
  { icon: Smartphone, label: t.catReparacaoTelemoveis },
  { icon: Monitor, label: t.catSuporteTI },
  { icon: Camera, label: t.catFotografo },
  { icon: Waves, label: t.catPiscineiro },
  { icon: Bath, label: t.catLavaCar },
  { icon: Tv, label: t.catAntenas },
  { icon: Package, label: t.catGerais }
];

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-natural-bg flex items-center justify-center p-10 text-center">
          <div>
            <div className="w-20 h-20 bg-natural-accent rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">!</div>
            <h1 className="text-2xl font-black text-natural-heading mb-4 italic">Ops! Algo correu mal.</h1>
            <p className="text-natural-muted font-bold mb-8">Ocorreu um erro inesperado na aplicação.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-natural-accent text-white px-8 py-4 rounded-3xl font-black shadow-accent-glow"
            >
              Reiniciar App
            </button>
          </div>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="min-h-screen bg-natural-bg font-sans">
      <MainApp />
    </div>
  );
}

function MainApp() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'auth' | 'roles' | 'app'>('landing');
  const [role, setRole] = useState<'client' | 'worker' | 'admin' | null>(null);
  const [tab, setTab] = useState<'explore' | 'jobs' | 'help'>('explore');
  const [jobs, setJobs] = useState<Job[]>([]);
  const lastJobCountRef = useRef<number>(0);
  const [notification, setNotification] = useState<{title: string, body: string} | null>(null);
  const [alertCategory, setAlertCategory] = useState<string>('Todos');
  const [category, setCategory] = useState<string>('');
  const [bairro, setBairro] = useState<string>('');
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const [showBairroSuggestions, setShowBairroSuggestions] = useState(false);
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
  const [userLocation, setUserLocation] = useState<[number, number]>([-25.9692, 32.5732]); // Maputo Default
  const [exploreViewMode, setExploreViewMode] = useState<'list' | 'map'>('list');
  const [hasNewJobNotify, setHasNewJobNotify] = useState(false);

  const t = translations[lang] || translations.pt;
  const isAdminEmail = currentUser?.email === 'fushawshaw@gmail.com' || currentUser?.email === 'wanderj419@gmail.com';
  const categories = useMemo(() => {
    if (!t) return [];
    return STATIC_CATEGORIES(t);
  }, [t]);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');

  useEffect(() => {
    // Detect standalone mode
    const checkIsInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      const isStoredInstalled = localStorage.getItem('pwa-installed') === 'true';
      setIsInstalled(isStandalone || isStoredInstalled);
    };

    checkIsInstalled();

    const triggerPrompt = async (prompt: any) => {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setInstallPrompt(null);
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch (e) {
        console.error("Auto-install failed:", e);
      }
    };

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      setShowAutoPrompt(false);
      console.log('PWA was installed');
    });

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Automatically show our custom prompt after a small delay if not installed
      if (!isInstalled) {
        setTimeout(() => {
          setShowAutoPrompt(true);
          const isIframe = window.self !== window.top;
          if (!isIframe) triggerPrompt(e);
        }, 3000);
      }
    };

    const customHandler = (e: any) => {
      console.log('custom pwa-prompt-available event fired');
      setInstallPrompt(e.detail);
      setTimeout(() => setShowAutoPrompt(true), 3000);
    };

    const installedHandler = () => {
      console.log('App was installed');
      setIsInstalled(true);
      setInstallPrompt(null);
      (window as any).deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('pwa-prompt-available', customHandler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-prompt-available', customHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const [showPwaGuide, setShowPwaGuide] = useState(false);

  const handleInstallClick = async () => {
    const isIframe = window.self !== window.top;
    
    if (isIframe) {
      setShowPwaGuide(true);
      setShowAutoPrompt(false);
      return;
    }

    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          setInstallPrompt(null);
          setIsInstalled(true);
          setShowAutoPrompt(false);
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch (err) {
        console.error('Error during installation prompt:', err);
      }
    } else {
      setShowPwaGuide(true);
      setShowAutoPrompt(false);
    }
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'Mozbiscates',
      text: 'Encontre profissionais em Moçambique com o Mozbiscates!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setNotification({
          title: "Link Copiado",
          body: "O link do app foi copiado para o seu clipboard!"
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      console.log('Share failed', err);
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  useEffect(() => {
    const checkReminders = () => {
      const saved = localStorage.getItem('mozbiscates-reminders');
      if (!saved) return;
      
      const reminders = JSON.parse(saved);
      const now = Date.now();
      let changed = false;

      const updated = reminders.map((r: any) => {
        if (!r.notified && now >= r.remindAt) {
          sendLocalNotification(t.reminderNotice, {
            body: `${r.jobTitle}: ${t.reminderBody}`,
            data: { jobId: r.jobId }
          });
          changed = true;
          return { ...r, notified: true };
        }
        return r;
      });

      if (changed) {
        localStorage.setItem('mozbiscates-reminders', JSON.stringify(updated));
      }
    };

    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [t]);

  useEffect(() => {
    if (view === 'app' && role) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          },
          (err) => console.error("Location error:", err),
          { enableHighAccuracy: true }
        );
      }
    }
  }, [view, role]);

  useEffect(() => {
    if (view === 'app' && role === 'worker' && jobs.length > 0) {
      const pendingJobs = jobs.filter(j => j.status === 'AGUARDANDO_DEPOSITO' || j.status === 'VALIDACAO_PENDENTE');
      if (pendingJobs.length > lastJobCountRef.current) {
        const latestJob = pendingJobs[pendingJobs.length - 1];
        sendLocalNotification("Nova Oportunidade!", {
          body: `Um novo biscate de ${latestJob.category} foi publicado perto de ti!`,
          icon: NOTIFICATION_ICON
        });
        setHasNewJobNotify(true);
      }
      lastJobCountRef.current = pendingJobs.length;
    }
  }, [jobs, role, view]);

  useEffect(() => {
    const userCategory = userData?.category;
    const userBairro = userData?.bairro;
    
    if (view === 'app' && role === 'worker' && currentUser && userCategory) {
      // Listen for new jobs matching category
      // Note: Firestore doesn't support inequality on one field and equality on another easily without index
      // We will filter bairro client-side or use a composite query if possible
      // Since 'open' status might be different from 'AGUARDANDO_DEPOSITO', we listen for AGUARDANDO_DEPOSITO which are newly created jobs
      const q = query(
        collection(db, 'jobs'),
        where('category', '==', userCategory),
        where('status', '==', 'AGUARDANDO_DEPOSITO'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      let isFirstSync = true;
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isFirstSync && !snapshot.empty) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const jobId = change.doc.id;
              
              // Filter by bairro
              if (userBairro && data.bairro && data.bairro !== userBairro) return;

              // Filter by providerId if it's a direct booking
              if (data.providerId && data.providerId !== currentUser.uid) return;

              const now = new Date();
              const jobTime = data.createdAt?.toDate();
              if (jobTime && (now.getTime() - jobTime.getTime() < 60000)) {
                const firstName = String(userData?.fullName || '').split(' ')[0] || '';
                
                let msgTitle = '';
                if (lang === 'en') {
                  msgTitle = firstName ? `Hey ${firstName}, great news! 🌟` : 'Great news! 🌟';
                } else if (lang === 'em') {
                  msgTitle = firstName ? `Ei ${firstName}, michuho yapha! 🌟` : 'Michuho yapha! 🌟';
                } else {
                  msgTitle = firstName ? `Olá ${firstName}, boas notícias! 🌟` : 'Boas notícias! 🌟';
                }

                let msgBody = '';
                if (lang === 'en') {
                  msgBody = `A new job of ${data.category} just arrived in ${data.bairro || 'your area'}!`;
                } else if (lang === 'em') {
                  msgBody = `Muteko musha wa ${data.category} ohikhuma vano vaphaphia: ${data.bairro || 'anyu'}`;
                } else {
                  msgBody = `Um novo biscate de ${data.category} acaba de chegar em ${data.bairro || 'sua área'}!`;
                }

                setNotification({
                  title: msgTitle,
                  body: msgBody
                });
                
                try {
                  const audio = new Audio(NOTIFICATION_SOUND);
                  audio.volume = 0.4;
                  audio.play().catch(() => console.log('Som bloqueado'));
                } catch (err) {
                  console.error('Erro ao tocar som:', err);
                }

                if (Notification.permission === 'granted') {
                  sendLocalNotification(msgTitle, {
                    body: msgBody,
                    data: { jobId: jobId }
                  });
                }

                setTimeout(() => setNotification(null), 12000);
              }
            }
          });
        }
        isFirstSync = false;
      }, (error) => {
        console.error("Firestore onSnapshot error:", error);
      });

      return () => unsubscribe();
    }
  }, [view, role, currentUser?.uid, userData?.category, userData?.bairro, lang, userData?.fullName]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const isAdmin = user.email === 'fushawshaw@gmail.com' || user.email === 'wanderj419@gmail.com';
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            if (isAdmin) {
              setRole('admin');
              setView('app');
              if (data.role !== 'admin') {
                await updateDoc(doc(db, 'users', user.uid), { role: 'admin' }).catch(() => {});
              }
            } else if (data.role) {
              setRole(data.role);
              setView('app');
            } else {
              setRole(null);
              setView('roles');
            }
          } else {
            if (isAdmin) {
              setRole('admin');
              setView('app');
            } else {
              setRole(null);
              setView('roles');
            }
          }
        } catch (err) {
          setRole(null);
          setView('roles');
        }
      } else {
        setUserData(null);
        setRole(null);
        setView('landing');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const fetchReviews = async (pid: string) => {
    const res = await fetch(`/api/providers/${pid}/reviews`);
    if (res.ok) setProviderReviews(await res.json());
  };

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    fetchReviews(p.id);
  };

  const [rawProviders, setRawProviders] = useState<Provider[]>([]);

  useEffect(() => {
    if (!currentUser || role !== 'client') return;
    const q = query(collection(db, 'users'), where('role', '==', 'worker'), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawProviders(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [currentUser?.uid, role]);

  const filteredProviders = useMemo(() => {
    let data = [...rawProviders];
    if (category && category !== 'Todos') {
      data = data.filter((p: any) => p.category?.toLowerCase().includes(category.toLowerCase()));
    }
    if (bairro) {
      data = data.filter((p: any) => p.bairro?.toLowerCase().includes(bairro.toLowerCase()));
    }
    if (onlyVerified) {
      data = data.filter((p: any) => p.verified);
    }
    if (minRating > 0) {
      data = data.filter((p: any) => p.rating >= minRating);
    }
    return data;
  }, [rawProviders, category, bairro, onlyVerified, minRating]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerId = params.get('workerId');
    if (workerId && rawProviders.length > 0) {
      const p = rawProviders.find(p => p.id === workerId);
      if (p) {
        handleSelectProvider(p);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [rawProviders]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'jobs'),
      where(role === 'client' ? 'clientId' : 'providerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      if (role === 'worker' && snap.docChanges().length > 0) {
        snap.docChanges().forEach(change => {
           if (change.type === 'added') {
             const job = change.doc.data();
             if (alertCategory === 'Todos' || job.category?.includes(alertCategory)) {
                setNotification({
                  title: t.notificationTitle,
                  body: `${t.notificationBody}: ${job.category} - ${job.amount} MT`
                });
                setTimeout(() => setNotification(null), 5000);
             }
           }
        });
      }
      setJobs(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'jobs'));
    return () => unsubscribe();
  }, [currentUser, role, alertCategory, t]);

  const [bookingAmount, setBookingAmount] = useState('500');
  const [bookingDesc, setBookingDesc] = useState('');
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenJob = (e: any) => {
      const jobId = e.detail;
      setTab('jobs');
      setFocusedJobId(jobId);
      // Auto-clear focus after some time
      setTimeout(() => setFocusedJobId(null), 10000);
    };

    window.addEventListener('open-job', handleOpenJob);
    return () => window.removeEventListener('open-job', handleOpenJob);
  }, []);

  useEffect(() => {
    if (focusedJobId && tab === 'jobs') {
      const el = document.getElementById(`job-${focusedJobId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedJobId, tab]);

  const handleStartBiscate = async (p: Provider) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'jobs'), {
        providerId: p.id,
        category: p.category,
        clientId: currentUser.uid,
        clientName: userData?.fullName || 'Cliente',
        providerName: p.name,
        bairro: userData?.bairro || bairro || '',
        amount: Number(bookingAmount),
        description: bookingDesc,
        status: 'AGUARDANDO_DEPOSITO',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lat: userLocation[0],
        lng: userLocation[1]
      });
      setSelectedProvider(null);
      setTab('jobs');
      setBookingAmount('500');
      setBookingDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'jobs');
    }
  };

  const handleSMSBooking = (p: Provider) => {
    const msg = `Ola ${p.name}, preciso de um ${p.category} no meu bairro. Meu ID de cliente e CLIENTE_TESTE. Aguardo retorno para orcamento.`;
    window.location.href = `sms:${p.phone}?body=${encodeURIComponent(msg)}`;
  };

  const handleCreateProfile = async (providerData: any) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        fullName: providerData.name,
        role: 'worker',
        category: providerData.category,
        photo: providerData.photo,
        biPhoto: providerData.biPhoto,
        biSelfie: providerData.biSelfie,
        verified: true,
        portfolio: providerData.portfolio || [],
        email: currentUser.email,
        level: 1,
        jobs: 0,
        createdAt: serverTimestamp()
      }, { merge: true });
      setTab('jobs');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
    }
  };

  const handleJobAction = async (job: Job, action: string, data: any = {}) => {
    const jobRef = doc(db, 'jobs', job.id);
    let update: any = { updatedAt: serverTimestamp() };

    switch (action) {
      case 'PAY':
        update.status = 'VALIDACAO_PENDENTE';
        update.transactionId = data.txId;
        break;
      case 'START':
        update.status = 'EM_CURSO';
        update.photoBefore = data.photo;
        break;
      case 'FINISH':
        update.status = 'FINALIZADO';
        update.photoAfter = data.photo;
        break;
      case 'CONFIRM_CLIENT':
        update.status = 'CONCLUIDO';
        const workerRef = doc(db, 'users', job.providerId);
        await updateDoc(workerRef, { jobs: increment(1) });
        break;
      case 'VALIDATE_PAYMENT':
        update.status = 'PAGO';
        break;
      case 'MARK_AS_PAID':
        update.payoutTransactionId = 'CONFIRMED_' + Date.now();
        break;
      case 'PANIC':
        update.panicAlert = true;
        update.panicLocation = data.location;
        break;
    }

    try {
      await updateDoc(jobRef, update);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `jobs/${job.id}`);
    }
  };

  // --- Rendering Logic ---

  if (authLoading) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-natural-accent animate-spin" />
          <p className="text-natural-muted font-black text-[10px] uppercase tracking-widest animate-pulse">Carregando Biscate...</p>
        </div>
      </div>
    );
  }

  // Views that don't need app layout
  if (view === 'landing') return <LandingPage onGetStarted={() => setView('auth')} lang={lang} setLang={setLang} t={t} />;
  if (view === 'auth') return <AuthScreen onAuthSuccess={() => setView('roles')} t={t} lang={lang} />;
  
  if (view === 'roles' || (view === 'app' && !role)) {
    return <RoleSelection onSelect={handleRoleSelection} onBack={() => setView('landing')} lang={lang} setLang={setLang} t={t} currentUser={currentUser} isAdminEmail={isAdminEmail} />;
  }

  // From here on, view === 'app' and role is defined
  if (role === 'worker' && !userData?.category) {
    return (
      <div className="min-h-screen bg-natural-bg p-6 flex flex-col items-center">
        <header className="w-full py-6 flex justify-between items-center mb-10">
          <h1 className="font-black italic text-xl">Mozbiscates</h1>
          <button onClick={handleLogout} className="text-natural-muted font-black text-[10px] uppercase">{t.logout || 'Sair'}</button>
        </header>
        <WorkerProfileForm onSave={handleCreateProfile} t={t} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg text-natural-ink font-sans flex flex-col items-center selection:bg-natural-accent selection:text-white pb-24">
      <PwaGuideModal onShow={showPwaGuide} onClose={() => setShowPwaGuide(false)} />
      
      <div className="w-full max-w-md bg-natural-bg min-h-screen flex flex-col relative overflow-hidden">
        
        {/* In-App Notification Toast */}
        <AnimatePresence>
          {showAutoPrompt && !isInstalled && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-28 left-6 right-6 z-[200] md:max-w-md md:left-auto"
            >
              <div className="bg-white rounded-[2.5rem] shadow-premium border-4 border-white p-6 flex flex-col gap-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-natural-accent/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-natural-accent/10 transition-colors" />
                
                <div className="flex items-center gap-5">
                  <div className="w-18 h-18 bg-white rounded-[1.5rem] flex items-center justify-center shadow-premium flex-shrink-0 rotate-3 group-hover:rotate-0 transition-transform overflow-hidden border border-natural-line">
                    <img src={NOTIFICATION_ICON} alt="Mozbiscates" className="w-full h-full object-cover scale-110" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-natural-heading italic tracking-tighter leading-none mb-2">Mozbiscates PRO</h3>
                    <p className="text-[11px] text-natural-muted font-bold leading-tight opacity-80 uppercase tracking-widest text-balance">Adicione o app oficial à sua tela inicial para acesso instantâneo.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowAutoPrompt(false)}
                    className="flex-1 bg-natural-surface text-natural-muted py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-natural-line/30 active:scale-95 transition-all"
                  >
                    Ignorar
                  </button>
                  <button 
                    onClick={handleInstallClick}
                    className="flex-[2] bg-natural-accent text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-accent-glow hover:scale-105 active:scale-95 transition-all"
                  >
                    Instalar Agora
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {notification && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 20, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-0 left-6 right-6 z-[100] max-w-sm mx-auto"
            >
              <div className="bg-natural-heading text-white p-5 rounded-[2.5rem] shadow-2xl border-2 border-natural-accent flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-natural-accent">
                  <img src={NOTIFICATION_ICON} alt="Equipa" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm italic leading-tight mb-1">{notification.title}</p>
                  <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider leading-relaxed">{notification.body}</p>
                </div>
                <button onClick={() => setNotification(null)} className="text-white opacity-40 hover:opacity-100 p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-natural-line px-5 py-4 flex items-center justify-between">
          <div onClick={() => { setRole(null); setView('landing'); }} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-10 h-10 bg-natural-surface rounded-xl flex items-center justify-center shadow-md transition-transform group-hover:rotate-6 active:scale-90 overflow-hidden border border-natural-line">
               <img src={NOTIFICATION_ICON} alt="Mozbiscates" className="w-full h-full object-cover scale-110" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black text-natural-heading tracking-tight leading-none uppercase">Moz</h1>
              <p className="text-[9px] font-black text-natural-accent tracking-[0.1em] leading-none mt-0.5 uppercase">Biscates</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isInstalled && (
              <button 
                onClick={handleInstallClick}
                className="bg-natural-surface border-2 border-natural-line px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-natural-muted hover:border-natural-accent hover:text-natural-accent transition-all active:scale-95 shadow-sm"
              >
                {t.download || 'Baixar App'}
              </button>
            )}

            <button 
              onClick={handleShareApp}
              className="w-10 h-10 bg-natural-surface rounded-xl flex items-center justify-center text-natural-muted hover:bg-natural-accent/10 hover:text-natural-accent transition-all active:scale-90"
              title="Partilhar App"
            >
              <Share2 className="w-5 h-5" />
            </button>

            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-white border-2 border-natural-line text-natural-muted rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm active:scale-95 group"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <nav className="flex px-6 items-center gap-10 my-4 overflow-x-auto no-scrollbar scroll-smooth bg-white py-2">
          <button onClick={() => setTab('explore')} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 ${tab === 'explore' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-30'}`}>
            COMEÇAR
          </button>
          <button onClick={() => { setTab('jobs'); if(role === 'admin') setAdminView('active'); }} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 ${tab === 'jobs' && (role !== 'admin' || adminView === 'active') ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-30'}`}>
            BISCATES
          </button>
          {role === 'admin' && (
            <button onClick={() => { setTab('jobs'); setAdminView('history'); }} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 ${tab === 'jobs' && adminView === 'history' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-30'}`}>
              ADMIN
            </button>
          )}
        </nav>

        {tab === 'explore' ? (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-300">
             {role !== 'worker' ? (
               <div className="px-6 py-10">
                 <h2 className="text-4xl font-black text-natural-heading mb-8 tracking-tighter leading-none italic">{(String(t.welcome || 'O que vamos resolver hoje?')).split(' ').map((w: string, i: number) => i === 3 ? <span key={i} className="text-natural-accent">{w} </span> : <Fragment key={i}>{w} </Fragment>)}</h2>
                 
                 <div className="bg-white border-2 border-natural-line p-5 rounded-[2.5rem] mb-12 shadow-premium flex flex-col gap-4 relative">
                    <div className="flex items-center gap-4 relative">
                      <Search className="text-natural-accent w-6 h-6" />
                      <input 
                        type="text" 
                        placeholder={t.searchCategory} 
                        className="w-full bg-transparent outline-none font-black text-natural-heading placeholder:text-natural-muted/50"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        onFocus={() => setShowCatSuggestions(true)}
                      />
                      {showCatSuggestions && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-natural-line mt-2 rounded-2xl shadow-2xl z-[60] max-h-48 overflow-y-auto">
                          {categories.filter(c => c.label.toLowerCase().includes((category || '').toLowerCase())).map(c => (
                            <div 
                              key={c.label}
                              onClick={() => { setCategory(c.label); setShowCatSuggestions(false); }}
                              className="px-4 py-3 hover:bg-natural-accent/10 cursor-pointer font-bold text-xs flex items-center gap-3"
                            >
                              <c.icon className="w-4 h-4 text-natural-accent" />
                              {c.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-4 border-t border-natural-line relative">
                      <MapPin className="text-natural-accent w-5 h-5" />
                      <input 
                        type="text" 
                        placeholder={t.allBairros}
                        className="w-full bg-transparent outline-none font-bold text-xs text-natural-heading placeholder:text-natural-muted/50"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        onFocus={() => setShowBairroSuggestions(true)}
                      />
                      {showBairroSuggestions && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-natural-line mt-2 rounded-2xl shadow-2xl z-[60] max-h-48 overflow-y-auto">
                          {BAIRROS_LIST.filter(b => b.toLowerCase().includes((bairro || '').toLowerCase())).map(b => (
                            <div 
                              key={b}
                              onClick={() => { setBairro(b); setShowBairroSuggestions(false); }}
                              className="px-4 py-3 hover:bg-natural-accent/10 cursor-pointer font-bold text-xs"
                            >
                              {b}
                            </div>
                          ))}
                        </div>
                      )}
                      {(showCatSuggestions || showBairroSuggestions) && (
                        <div className="fixed inset-0 z-50" onClick={() => { setShowCatSuggestions(false); setShowBairroSuggestions(false); }} />
                      )}
                    </div>
                 </div>

                  <div className="grid grid-cols-3 gap-3 mb-12">
                    {categories.slice(0, 3).map((c, i) => (
                      <CategoryButton 
                        key={c.label} 
                        icon={c.icon} 
                        label={c.label} 
                        active={category === c.label} 
                        onClick={() => setCategory(c.label)} 
                        isTop={i < 3}
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
                    <div className="flex bg-natural-surface p-1 rounded-xl">
                      <button 
                        onClick={() => setExploreViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exploreViewMode === 'list' ? 'bg-white shadow-sm text-natural-accent' : 'text-natural-muted opacity-60'}`}
                      >
                        Lista
                      </button>
                      <button 
                        onClick={() => setExploreViewMode('map')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exploreViewMode === 'map' ? 'bg-white shadow-sm text-natural-accent' : 'text-natural-muted opacity-60'}`}
                      >
                        Mapa
                      </button>
                    </div>
                  </div>

                  {exploreViewMode === 'map' && (
                    <div className="mb-10 animate-in fade-in zoom-in-95 duration-500">
                      <MapView 
                        providers={role === 'client' ? filteredProviders : []} 
                        jobs={role === 'worker' ? jobs : []} 
                        userPos={userLocation} 
                        t={t} 
                      />
                    </div>
                  )}

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
                   {filteredProviders.map(p => <ProviderCard key={p.id} provider={p} onSelect={handleSelectProvider} />)}
                 </div>
               </div>
             ) : (
               <WorkerProfileForm onSave={handleCreateProfile} t={t} />
             )}
          </div>
        ) : (
          <main className="flex-1 p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {tab !== 'help' && (tab === 'jobs' || role === 'admin') ? (
              <>
                {role === 'worker' && userData && <StatsHeader data={userData} t={t} />}
                 <div className="mb-8 p-6 bg-natural-surface rounded-[2.5rem] border-2 border-natural-line border-dashed text-center">
                    <h2 className="text-3xl font-black text-natural-heading tracking-tighter mb-1 italic">{(String(t.jobsTitle || '')).split(' ').map((w: string, i: number) => (w === 'Confiança' || w === 'Trust' || w === 'Onikhwa') ? <span key={i} className="text-natural-accent">{w}</span> : <Fragment key={i}>{w} </Fragment>)}</h2>
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
                            { id: 'Pedreiro', label: t.catPedreiro },
                            { id: 'Limpeza', label: t.catLimpeza },
                            { id: 'Motorista', label: t.catMotorista },
                            { id: 'Diarista', label: t.catDiarista },
                            { id: 'Cozinheiro', label: t.catCozinheiro },
                            { id: 'Manicure', label: t.catManicure },
                            { id: 'Esteticista', label: t.catEsteticista },
                            { id: 'Reparação Telemóveis', label: t.catReparacaoTelemoveis },
                            { id: 'Suporte TI', label: t.catSuporteTI },
                            { id: 'Fotógrafo', label: t.catFotografo },
                            { id: 'Organizador Eventos', label: t.catOrganizadorEventos },
                            { id: 'Babysitter', label: t.catBabysitter },
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
                  {role === 'worker' && <WorkerWallet t={t} />}
                  {role === 'worker' && <CommunityRules t={t} />}
                  {role === 'admin' && <WithdrawalManagement jobs={jobs} onAction={handleJobAction} t={t} />}

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
                        providers={rawProviders} 
                        searchTerm={paymentSearch} 
                        dateFilter={paymentDate} 
                        t={t}
                      />
                   </div>
                 ) : (
                   jobs.length > 0 ? (
                    <div className="space-y-4">
                      {jobs.map(j => (
                        <div key={j.id} id={`job-${j.id}`} className={focusedJobId === j.id ? 'ring-4 ring-natural-accent ring-offset-4 rounded-[2rem] animate-pulse transition-all duration-1000' : ''}>
                          <JobCard job={j} role={role!} onAction={handleJobAction} t={t} currentUser={currentUser} />
                        </div>
                      ))}
                    </div>
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
              <div className="px-4 py-8 space-y-8 animate-in zoom-in-95 duration-300">
                 <div className="text-center mb-12">
                   <div className="w-24 h-24 bg-natural-accent/10 rounded-full flex items-center justify-center mx-auto mb-6"><Heart className="w-12 h-12 text-natural-accent fill-natural-accent/20" /></div>
                   <h2 className="text-4xl font-black text-natural-heading tracking-tighter mb-2 italic">{(String(t.helpTitle || '')).split(' ').map((w: string, i: number) => (w === 'Utilizador' || w === 'Support' || w === 'Anikhwe') ? <span key={i} className="text-natural-accent">{w} </span> : <Fragment key={i}>{w} </Fragment>)}</h2>
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
                    <div className="flex justify-between items-start">
                      <h3 className="text-2xl font-black text-natural-heading leading-tight mb-1">{selectedProvider.name}</h3>
                      <button 
                        onClick={() => {
                          const shareUrl = `${window.location.origin}${window.location.pathname}?workerId=${selectedProvider.id}`;
                          shortenUrl(shareUrl).then(short => {
                            navigator.clipboard.writeText(short);
                            alert("Link do perfil encurtado e copiado!");
                          });
                        }}
                        className="p-2.5 bg-natural-surface rounded-2xl border border-natural-line hover:bg-natural-accent hover:text-white transition-all active:scale-90"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
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
          <div onClick={() => setTab('explore')} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'explore' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <LayoutGrid className="w-7 h-7 mb-1" />
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{t.navHome}</span>
          </div>
          <div onClick={() => setTab('jobs')} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'jobs' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <div className="relative">
              <MessageSquare className="w-7 h-7 mb-1" />
              {jobs.some(j => (role === 'client' && j.status === 'FINALIZADO') || (role === 'worker' && j.status === 'PAGO') || (role === 'admin' && j.status === 'VALIDACAO_PENDENTE')) && (
                <div className="absolute -right-1 -top-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{role === 'admin' ? t.navPending : t.navJobs}</span>
          </div>
          <div onClick={() => setTab('help')} className={`flex flex-col items-center cursor-pointer transition-all ${tab === 'help' ? 'text-natural-accent scale-110' : 'text-natural-muted opacity-60'}`}>
            <Heart className="w-7 h-7 mb-1" />
            <span className="text-[9px] font-black uppercase tracking-tighter pt-0.5">{t.navHelp}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
