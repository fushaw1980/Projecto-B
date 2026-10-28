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
  ArrowUpRight, 
  Star, 
  Wrench, 
  Zap, 
  Droplets, 
  User, 
  Camera, 
  MessageSquare,
  Calendar,
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
  QrCode,
  FileText,
  FileDown,
  ShieldAlert,
  Volume2,
  VolumeX,
  PhoneCall,
  ShieldCheck,
  Clock,
  Navigation,
  RefreshCw,
  RotateCcw,
  CalendarClock,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Send,
  Users,
  UserCheck,
  UserX,
  MessageSquareHeart
} from 'lucide-react';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import { compressImage } from './lib/imageOptimizer';
import { ALL_SPECIALTIES, FREQUENT_CATEGORIES } from './data/specialties';
import { ClientSecurityProfileModal } from './components/ClientSecurityProfileModal';
import { EmergencyModal } from './components/EmergencyModal';
import { AdminEmergencyMonitor } from './components/AdminEmergencyMonitor';
import { calculateHaversineDistanceKm, estimateTravelTime, getProviderCoordinates } from './lib/geoUtils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
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
  getDocs,
  setDoc, 
  updateDoc, 
  deleteField,
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
  return url;
};

import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Cached Leaflet SVG Markers to prevent recreating DOM nodes on every render loop
const MARKER_ICONS: Record<string, L.DivIcon> = {};
const getCustomMarker = (type: 'job' | 'provider' | 'user') => {
  if (!MARKER_ICONS[type]) {
    const colors = {
      job: '#10B981',
      provider: '#E65100',
      user: '#3B82F6'
    };
    MARKER_ICONS[type] = L.divIcon({
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
  }
  return MARKER_ICONS[type];
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

const sendLocalNotification = (title: string, options: NotificationOptions & { data?: { url?: string, jobId?: string, providerId?: string, type?: string } }) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Try Service Worker registration for background notifications
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        ...options,
        icon: options.icon || NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON
      });
    }).catch(() => {
      triggerWindowNotification(title, options);
    });
  } else {
    triggerWindowNotification(title, options);
  }

  // Also try alert sound
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.play().catch(() => {});
  } catch(e) {}
};

const triggerWindowNotification = (title: string, options: NotificationOptions & { data?: { url?: string, jobId?: string, providerId?: string, type?: string } }) => {
  try {
    const n = new Notification(title, { ...options, icon: options.icon || NOTIFICATION_ICON });
    n.onclick = () => {
      window.focus();
      if (options.data?.providerId) {
        const event = new CustomEvent('open-provider', { detail: options.data.providerId });
        window.dispatchEvent(event);
      } else if (options.data?.jobId) {
        const event = new CustomEvent('open-job', { detail: options.data.jobId });
        window.dispatchEvent(event);
      }
      n.close();
    };
  } catch(e) {}
};
// --- Map Components ---
interface MapViewProps {
  jobs?: Job[];
  providers?: Provider[];
  userPos: [number, number];
  t: any;
  selectedProvider?: Provider | null;
  onSelectProvider?: (p: Provider) => void;
}

const MapView = memo(({ 
  jobs = [], 
  providers = [], 
  userPos, 
  t, 
  selectedProvider,
  onSelectProvider 
}: MapViewProps) => {
  const [mapType, setMapType] = useState('streets');
  const [localSelectedProvider, setLocalSelectedProvider] = useState<Provider | null>(null);

  const activeTargetProvider = selectedProvider || localSelectedProvider;

  // Active target calculations using Haversine
  const activeTargetData = useMemo(() => {
    if (!activeTargetProvider) return null;
    const coords = getProviderCoordinates(activeTargetProvider.id, userPos);
    const distanceKm = calculateHaversineDistanceKm(userPos, coords);
    const travel = estimateTravelTime(distanceKm);
    return { coords, distanceKm, travel };
  }, [activeTargetProvider, userPos]);

  return (
    <div className="w-full h-[65vh] rounded-[3rem] overflow-hidden border-4 border-white shadow-premium relative z-10 group mt-4">
      {/* Top Map Badge */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-natural-line/50 shadow-premium flex items-center gap-2 transition-transform group-hover:scale-105">
          <Sparkles className="w-4 h-4 text-natural-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-natural-heading">Explorar arredores</span>
        </div>
        <div className="bg-natural-accent text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider self-start shadow-sm shadow-orange-200">
          {providers.length} {t.verified || 'Verificados'}
        </div>
      </div>

      {/* Floating Travel Time Estimation HUD over Map */}
      {activeTargetProvider && activeTargetData && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl border-2 border-natural-accent shadow-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-natural-accent shrink-0">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-black uppercase text-natural-heading tracking-tight truncate">
                  {activeTargetProvider.name}
                </p>
                <span className="bg-orange-50 text-natural-accent font-black text-[9px] px-1.5 py-0.5 rounded border border-orange-200 shrink-0">
                  {activeTargetData.travel.formattedDistance} (Haversine)
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-black text-natural-heading">
                <span className="flex items-center gap-1 text-slate-800" title="Carro ou Chapa urbano">
                  🚗 ~{activeTargetData.travel.carMinutes} min
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-800" title="Txopela ou Moto">
                  🛵 ~{activeTargetData.travel.motoMinutes} min
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-800" title="Caminhada a pé">
                  🚶 ~{activeTargetData.travel.walkingMinutes} min
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setLocalSelectedProvider(null)}
              className="p-2 text-natural-muted hover:text-black rounded-lg text-xs"
              title="Limpar seleção"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectProvider?.(activeTargetProvider)}
              className="px-3.5 py-2 bg-natural-accent text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-transform"
            >
              Ver Perfil
            </button>
          </div>
        </div>
      )}
      
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
        
        {/* Polyline line connecting user to selected provider */}
        {activeTargetData && (
          <Polyline 
            positions={[userPos, activeTargetData.coords]} 
            pathOptions={{ color: '#E65100', weight: 4, dashArray: '6, 8', opacity: 0.9 }} 
          />
        )}

        {providers.map(p => {
          const providerPos = getProviderCoordinates(p.id, userPos);
          const distance = calculateHaversineDistanceKm(userPos, providerPos);
          const travel = estimateTravelTime(distance);
          const isCurrentActive = activeTargetProvider?.id === p.id;

          return (
            <Marker 
              key={p.id} 
              position={providerPos} 
              icon={getCustomMarker('provider')}
              eventHandlers={{
                click: () => {
                  setLocalSelectedProvider(p);
                }
              }}
            >
              <Popup className="premium-popup">
                <div className="p-3 min-w-[200px]">
                  <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b border-natural-line/30">
                    <div className="w-10 h-10 rounded-2xl bg-natural-surface border border-natural-line overflow-hidden shadow-sm shrink-0">
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-natural-heading leading-tight truncate">{p.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-black text-natural-heading">{p.rating}</span>
                        <span className="text-[9px] font-bold text-natural-muted">({p.jobs} jobs)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3 h-3 text-natural-accent shrink-0" />
                      <p className="font-black text-[10px] text-natural-accent uppercase tracking-wider">{p.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-natural-muted shrink-0" />
                      <p className="text-[10px] text-natural-muted font-bold">
                        {p.bairro}
                      </p>
                    </div>
                  </div>

                  {/* Estimativa de Deslocação Haversine */}
                  <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-2xl mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase text-orange-900 flex items-center gap-1 tracking-wider">
                        <Clock className="w-3 h-3 text-natural-accent shrink-0" /> Tempo Estimado
                      </span>
                      <span className="text-[9px] font-black text-natural-accent font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200">
                        {travel.formattedDistance}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center mt-1.5">
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🚗 Carro</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.carMinutes}m</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🛵 Txopela</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.motoMinutes}m</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-orange-100 shadow-2xs">
                        <span className="text-[8px] font-bold text-slate-500 block">🚶 A pé</span>
                        <span className="text-[10px] font-black text-natural-heading leading-none">~{travel.walkingMinutes}m</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setLocalSelectedProvider(p);
                      onSelectProvider?.(p);
                    }}
                    className="w-full bg-natural-accent text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Ver Perfil e Contratar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {jobs.filter(j => j.lat && j.lng).map(job => (
          <Marker key={job.id} position={[job.lat!, job.lng!]} icon={getCustomMarker('job')}>
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
        
        <Marker position={userPos} icon={getCustomMarker('user')}>
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
});

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
  bookingType?: string;
  scheduledFor?: string;
  status: string;
  transactionId?: string;
  payoutAmount?: number;
  payoutTransactionId?: string;
  photoBefore?: string;
  photoAfter?: string;
  panicAlert?: boolean;
  cancellationReason?: string | null;
  previousStatus?: string;
  cancelledBy?: string;
  rescheduledAt?: any;
  rescheduleNote?: string;
  clientName?: string;
  providerName?: string;
  bairro?: string;
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
          <b>Pagamentos Rápidos:</b> Saques M-Pesa / e-Mola processados com taxa reduzida de apenas 3% em até 24h após a conclusão.
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

const WorkerWallet = ({ t, balance, userData, db, currentUser }: { t: any, balance: number, userData: any, db: any, currentUser: any }) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState<'mpesa' | 'emola'>('mpesa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');
  const [lastWithdrawalSummary, setLastWithdrawalSummary] = useState<{ rawAmt: number, fee: number, netAmt: number }>({ rawAmt: 0, fee: 0, netAmt: 0 });

  // 3% withdrawal fee
  const WITHDRAWAL_FEE_RATE = 0.03;
  const parsedAmt = parseFloat(withdrawAmount) || 0;
  const currentWithdrawFee = Math.round(parsedAmt * WITHDRAWAL_FEE_RATE * 100) / 100;
  const currentNetWithdraw = Math.max(0, Math.round((parsedAmt - currentWithdrawFee) * 100) / 100);

  // Set default phone when userData loads
  useEffect(() => {
    if (userData?.phone) {
      const clean = userData.phone.replace(/\D/g, '');
      setWithdrawPhone(clean.startsWith('258') ? clean.slice(3) : clean);
    }
  }, [userData]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setError('');
    
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 10) {
      setError('O valor mínimo de levantamento é de 10 MT.');
      return;
    }
    if (amt > 500000) {
      setError('O valor máximo por transação é de 500.000 MT.');
      return;
    }
    if (amt > balance) {
      setError(`Saldo insuficiente. O seu saldo disponível é de ${balance} MT.`);
      return;
    }
    const cleanPhone = withdrawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setError('Introduza um número de telemóvel moçambicano válido (ex: 84/85/86/87).');
      return;
    }

    const calculatedFee = Math.round(amt * WITHDRAWAL_FEE_RATE * 100) / 100;
    const netPayout = Math.max(0, Math.round((amt - calculatedFee) * 100) / 100);
    setLastWithdrawalSummary({ rawAmt: amt, fee: calculatedFee, netAmt: netPayout });

    setIsProcessing(true);
    setStep('A estabelecer ligação com gateway móvel...');
    await new Promise(r => setTimeout(r, 800));
    
    setStep('A processar levantamento com taxa reduzida de 3%...');
    await new Promise(r => setTimeout(r, 1000));

    setStep('A aguardar confirmação da rede celular...');
    await new Promise(r => setTimeout(r, 600));

    // Generate high-fidelity transaction ID
    const prefix = withdrawWallet === 'emola' ? 'EMW' : 'MPW';
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedTxId = `${prefix}${dateStr}.${randomSuffix}`;
    setTxId(generatedTxId);

    try {
      // Decrease balance in Firestore in real-time
      if (!currentUser?.uid) {
        setError("Utilizador não autenticado.");
        setIsProcessing(false);
        return;
      }
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        balance: increment(-amt)
      });
    } catch (err) {
      console.error("Error updating balance during withdrawal:", err);
      setError("Erro ao atualizar o saldo no servidor.");
      setIsProcessing(false);
      return;
    }

    setIsProcessing(false);
    setWithdrawSuccess(true);
  };

  return (
    <div className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] mt-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Package className="w-12 h-12 text-natural-accent" />
      </div>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-natural-surface rounded-xl"><Zap className="w-5 h-5 text-natural-accent" /></div>
          <div>
            <h3 className="font-black text-natural-heading uppercase tracking-tighter italic">Minha Carteira</h3>
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t.withdrawalFeeBadge || "Taxa de Saque: 3%"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest">Saldo</p>
          <p className="text-2xl font-black text-natural-heading italic leading-none">{balance} MT</p>
        </div>
      </div>
      <div className="bg-natural-surface p-4 rounded-2xl border border-natural-line relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-natural-muted uppercase tracking-widest mb-1">Receber Via</p>
            <div className="flex items-center gap-2">
              <div className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">M-Pesa</div>
              <p className="text-sm font-black text-natural-heading font-mono tracking-tight">
                {userData?.phone || 'Defina no perfil'}
              </p>
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

      {typeof window !== 'undefined' && 'Notification' in window && (
        <div className="mt-3 relative z-10">
          {Notification.permission === 'granted' ? (
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-natural-success bg-green-50/80 px-3 py-2 rounded-xl border border-green-200">
              <Bell className="w-3.5 h-3.5 text-natural-success animate-pulse" />
              <span>{t.pushNotificationsEnabled}: Alerta push automático ao creditar saldo</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                if (granted) {
                  alert("Notificações push activadas com sucesso!");
                }
              }}
              className="w-full flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-2.5 rounded-xl border border-amber-200 transition-all shadow-sm active:scale-95"
            >
              <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>{t.enablePushNotifications} (Avisos Push Automáticos)</span>
            </button>
          )}
        </div>
      )}
      
      {balance > 0 ? (
        <button
          onClick={() => {
            setShowWithdrawModal(true);
            setWithdrawAmount(balance.toString());
            setWithdrawSuccess(false);
            setError('');
          }}
          className="w-full mt-4 bg-natural-accent text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-natural-accent/95 transition-colors shadow-premium flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="w-4 h-4" /> Solicitar Levantamento Móvel (Taxa 3%)
        </button>
      ) : (
        <p className="text-[9px] font-bold text-natural-muted mt-4 italic leading-tight">
          * Os pagamentos são acumulados no seu saldo. Terá a opção de levantar com taxa de apenas 3% assim que concluir biscates.
        </p>
      )}

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#f4f4f4] max-w-xs w-full rounded-3xl overflow-hidden shadow-2xl border-2 border-neutral-300 font-sans text-neutral-800"
            >
              {!withdrawSuccess ? (
                <form onSubmit={handleWithdraw} className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-neutral-200 rounded-xl">
                        <Smartphone className="w-4 h-4 text-neutral-600" />
                      </div>
                      <div>
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Levantamento Móvel</h4>
                        <span className="text-[8px] font-bold text-emerald-600">Taxa Reduzida de 3%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWithdrawModal(false)}
                      className="text-neutral-500 hover:text-neutral-800 text-lg font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[9px] font-black uppercase tracking-wider text-center border border-red-100">
                      ⚠️ {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Wallet provider */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawWallet('mpesa')}
                        className={`py-2 px-1 border-2 rounded-2xl font-black text-[10px] transition-all flex flex-col items-center gap-0.5 ${
                          withdrawWallet === 'mpesa'
                            ? 'border-red-500 bg-red-50/20 text-red-600'
                            : 'border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400'
                        }`}
                      >
                        <span className="font-black">Vodacom M-Pesa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawWallet('emola')}
                        className={`py-2 px-1 border-2 rounded-2xl font-black text-[10px] transition-all flex flex-col items-center gap-0.5 ${
                          withdrawWallet === 'emola'
                            ? 'border-orange-500 bg-orange-50/20 text-orange-600'
                            : 'border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400'
                        }`}
                      >
                        <span className="font-black">Movitel e-Mola</span>
                      </button>
                    </div>

                    {/* Amount */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">
                          Valor a Retirar (MT)
                        </label>
                        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Taxa de Saque: 3%
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Valor"
                          max={balance}
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded-xl outline-none font-mono text-xs font-bold"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setWithdrawAmount(balance.toString())}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-natural-accent bg-natural-accent/10 px-2 py-1 rounded"
                        >
                          Máximo
                        </button>
                      </div>
                    </div>

                    {/* Fee and Net breakdown */}
                    {parsedAmt > 0 && (
                      <div className="bg-white border border-neutral-200 rounded-xl p-2.5 space-y-1.5 text-[9px]">
                        <div className="flex justify-between text-neutral-500">
                          <span>Subtotal de Saque:</span>
                          <span className="font-mono font-bold">{parsedAmt} MT</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Taxa de Saque (3%):</span>
                          <span className="font-mono">- {currentWithdrawFee} MT</span>
                        </div>
                        <div className="pt-1.5 border-t border-neutral-200 flex justify-between font-black text-neutral-900">
                          <span>Líquido na Carteira Móvel:</span>
                          <span className="font-mono text-emerald-700">{currentNetWithdraw} MT</span>
                        </div>
                      </div>
                    )}

                    {/* Phone number */}
                    <div>
                      <label className="block text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                        Número de Telemóvel (+258)
                      </label>
                      <input
                        type="tel"
                        placeholder="84xxxxxxx"
                        maxLength={9}
                        className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded-xl outline-none font-mono text-xs font-bold"
                        value={withdrawPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setWithdrawPhone(val);
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-natural-accent text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-natural-accent/95 transition-colors flex items-center justify-center gap-2 shadow-premium"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="truncate">{step}</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Levantar {parsedAmt > 0 ? `${currentNetWithdraw} MT Líquidos` : `${withdrawAmount} MT`}</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-5 text-center space-y-4">
                  <div className="mx-auto w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 animate-bounce">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-neutral-800 uppercase tracking-wider">Transferência Concluída!</h3>
                  <div className="text-[10px] text-neutral-500 font-bold leading-relaxed space-y-1">
                    <p>
                      A quantia de <span className="text-neutral-900 font-black">{lastWithdrawalSummary.netAmt} MT</span> foi enviada com sucesso para a sua carteira móvel.
                    </p>
                    <p className="text-[8px] text-emerald-600 bg-emerald-50 py-1 px-2 rounded-lg inline-block border border-emerald-200">
                      Taxa reduzida aplicada: 3% ({lastWithdrawalSummary.fee} MT)
                    </p>
                  </div>
                  
                  {/* SMS Simulation Block */}
                  <div className="bg-[#1c1c1e] text-[#f2f2f7] p-3 rounded-2xl text-left font-mono text-[8px] leading-relaxed border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-zinc-500 font-bold border-b border-zinc-800 pb-1">
                      <span>SMS: {withdrawWallet === 'mpesa' ? 'M-Pesa' : 'e-Mola'}</span>
                      <span>Agora mesmo</span>
                    </div>
                    <p className="text-white">
                      {withdrawWallet === 'mpesa' ? (
                        `Vodacom M-Pesa: Transacao ${txId} realizada com sucesso. Recebeu ${lastWithdrawalSummary.netAmt} MT de MOZBISCATES (taxa de servico de saque de 3%: ${lastWithdrawalSummary.fee} MT). O seu novo saldo M-Pesa foi atualizado.`
                      ) : (
                        `Movitel e-Mola: Transacao ${txId} realizada. Recebeu ${lastWithdrawalSummary.netAmt} MT de MOZBISCATES (taxa de saque de 3%: ${lastWithdrawalSummary.fee} MT). Obrigado por usar e-Mola.`
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawSuccess(false);
                    }}
                    className="w-full bg-neutral-800 hover:bg-neutral-900 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WorkerEarningsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3.5 rounded-2xl border-2 border-natural-line shadow-premium text-left min-w-[170px]">
        <p className="text-[10px] font-black text-natural-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-natural-accent" />
          {data.fullMonth || label}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-natural-muted font-bold text-[10px] uppercase">Acumulado:</span>
            <span className="font-black text-natural-accent font-mono">
              {Number(data.cumulativeEarnings || 0).toLocaleString('pt-MZ')} MT
            </span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-natural-surface pt-1">
            <span className="text-natural-muted font-bold text-[10px] uppercase">Neste Mês:</span>
            <span className="font-black text-natural-success font-mono">
              +{Number(data.monthlyEarnings || 0).toLocaleString('pt-MZ')} MT
            </span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-natural-surface pt-1">
            <span className="text-natural-muted font-bold text-[10px] uppercase">Biscates:</span>
            <span className="font-black text-natural-heading">
              {data.jobsCount || 0}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const WorkerEarningsChart = memo(({ jobs, userData, balance, t }: { jobs: Job[], userData: any, balance?: number, t: any }) => {
  const [chartMode, setChartMode] = useState<'accumulated' | 'monthly'>('accumulated');

  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const fullMonthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getJobDate = (job: any): Date | null => {
    if (!job.createdAt) return null;
    if (typeof job.createdAt.toDate === 'function') return job.createdAt.toDate();
    if (job.createdAt instanceof Date) return job.createdAt;
    if (job.createdAt.seconds) return new Date(job.createdAt.seconds * 1000);
    return new Date(job.createdAt);
  };

  const chartData = useMemo(() => {
    // Generate the last 6 months chronologically
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setDate(1); // prevent month-day overflow
      d.setMonth(d.getMonth() - (5 - i));
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      return {
        monthKey: `${year}-${monthStr}`,
        monthName: `${monthNames[monthIndex]}/${String(year).slice(-2)}`,
        fullMonth: `${fullMonthNames[monthIndex]} ${year}`,
        monthlyEarnings: 0,
        cumulativeEarnings: 0,
        jobsCount: 0
      };
    });

    const completed = jobs.filter(j => j.status === 'CONCLUIDO');
    let totalFromJobs = 0;

    completed.forEach(j => {
      const date = getJobDate(j);
      if (!date) return;
      const year = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${monthStr}`;

      const found = months.find(m => m.monthKey === key);
      const fee = Number(j.amount || 0) * 0.1;
      const net = Math.round(Number(j.payoutAmount ?? (Number(j.amount || 0) - fee)));

      if (found) {
        found.monthlyEarnings += net;
        found.jobsCount += 1;
        totalFromJobs += net;
      }
    });

    // If no completed jobs in collection yet but worker has an existing balance,
    // reflect their current accumulated wallet earnings in the latest month
    const currentBalance = Number(balance ?? userData?.balance ?? 0);
    if (totalFromJobs === 0 && currentBalance > 0) {
      const latestMonth = months[months.length - 1];
      latestMonth.monthlyEarnings = currentBalance;
      latestMonth.jobsCount = Number(userData?.jobs || 1);
    }

    // Compute cumulative accumulated earnings progressively
    let runningAccumulated = 0;
    months.forEach(m => {
      runningAccumulated += m.monthlyEarnings;
      m.cumulativeEarnings = runningAccumulated;
    });

    return months;
  }, [jobs, userData, balance]);

  const totalAccumulated = chartData[chartData.length - 1]?.cumulativeEarnings || 0;
  const totalJobsCompleted = chartData.reduce((acc, m) => acc + m.jobsCount, 0);
  const avgMonthly = Math.round(totalAccumulated / 6);
  const bestMonth = chartData.reduce((prev, curr) => (curr.monthlyEarnings > prev.monthlyEarnings ? curr : prev), chartData[0]);

  return (
    <div className="bg-white border-2 border-natural-line p-6 rounded-[2.5rem] mt-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <TrendingUp className="w-16 h-16 text-natural-accent" />
      </div>

      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-natural-surface rounded-xl">
              <TrendingUp className="w-5 h-5 text-natural-accent" />
            </div>
            <h3 className="font-black text-natural-heading uppercase tracking-tighter italic text-base">
              {t.workerEarningsTitle || "Ganhos Acumulados (Últimos 6 Meses)"}
            </h3>
          </div>
          <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mt-1">
            {t.workerEarningsSub || "Evolução dos rendimentos líquidos recebidos"}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-natural-surface p-1 rounded-2xl border border-natural-line self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('accumulated')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              chartMode === 'accumulated'
                ? 'bg-natural-accent text-white shadow-sm'
                : 'text-natural-muted hover:text-natural-heading'
            }`}
          >
            {t.accumulatedView || "Acumulado"}
          </button>
          <button
            type="button"
            onClick={() => setChartMode('monthly')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              chartMode === 'monthly'
                ? 'bg-natural-accent text-white shadow-sm'
                : 'text-natural-muted hover:text-natural-heading'
            }`}
          >
            {t.monthlyView || "Por Mês"}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 relative z-10">
        <div className="bg-natural-surface/80 p-3.5 rounded-2xl border border-natural-line">
          <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest mb-0.5">
            {t.totalAccumulated6M || "Total Acumulado"}
          </p>
          <p className="text-lg font-black text-natural-success italic font-mono leading-tight">
            {totalAccumulated.toLocaleString('pt-MZ')} <span className="text-[10px] font-bold not-italic">MT</span>
          </p>
          <div className="flex items-center gap-1 mt-1 text-[8px] font-black text-natural-success">
            <ArrowUpRight className="w-3 h-3" />
            <span>6 Meses</span>
          </div>
        </div>

        <div className="bg-natural-surface/80 p-3.5 rounded-2xl border border-natural-line">
          <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest mb-0.5">
            {t.monthlyAverage || "Média Mensal"}
          </p>
          <p className="text-lg font-black text-natural-heading italic font-mono leading-tight">
            {avgMonthly.toLocaleString('pt-MZ')} <span className="text-[10px] font-bold not-italic">MT</span>
          </p>
          <p className="text-[8px] font-bold text-natural-muted uppercase mt-1">
            Por mês
          </p>
        </div>

        <div className="bg-natural-surface/80 p-3.5 rounded-2xl border border-natural-line">
          <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest mb-0.5">
            {t.bestMonth || "Melhor Mês"}
          </p>
          <p className="text-lg font-black text-natural-accent italic font-mono leading-tight">
            {bestMonth.monthlyEarnings.toLocaleString('pt-MZ')} <span className="text-[10px] font-bold not-italic">MT</span>
          </p>
          <p className="text-[8px] font-black text-natural-muted uppercase mt-1">
            {bestMonth.monthName}
          </p>
        </div>

        <div className="bg-natural-surface/80 p-3.5 rounded-2xl border border-natural-line">
          <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest mb-0.5">
            Biscates Feitos
          </p>
          <p className="text-lg font-black text-natural-heading italic font-mono leading-tight">
            {totalJobsCompleted}
          </p>
          <p className="text-[8px] font-bold text-natural-muted uppercase mt-1">
            Concluídos
          </p>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="h-56 w-full text-xs font-mono relative z-10 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="workerBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B5E20" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#2E7D32" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="workerMonthlyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E65100" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#F57C00" stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E2DE" vertical={false} />
            <XAxis dataKey="monthName" stroke="#847E79" fontSize={10} fontWeight="bold" tickLine={false} />
            <YAxis 
              stroke="#847E79" 
              fontSize={9} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : `${v}`} 
            />
            <Tooltip content={<WorkerEarningsTooltip />} />
            <Bar 
              dataKey={chartMode === 'accumulated' ? 'cumulativeEarnings' : 'monthlyEarnings'} 
              name={chartMode === 'accumulated' ? (t.accumulatedView || 'Ganhos Acumulados') : (t.monthlyView || 'Ganho do Mês')} 
              fill={chartMode === 'accumulated' ? 'url(#workerBarGradient)' : 'url(#workerMonthlyGradient)'} 
              radius={[8, 8, 0, 0]} 
              maxBarSize={38} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <div className="mt-4 pt-3 border-t border-natural-surface flex items-center justify-between text-[9px] font-bold text-natural-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-natural-success animate-pulse" />
          <span>{t.earningsNetNote || "Valores líquidos creditados no seu saldo após taxa de 10% do Garante."}</span>
        </div>
        <span className="font-mono uppercase tracking-wider text-[8px] bg-natural-surface px-2 py-0.5 rounded-md border border-natural-line">
          MZ (MT)
        </span>
      </div>
    </div>
  );
});

const WithdrawalManagement = ({ jobs, providers = [], onAction, t }: { jobs: Job[], providers?: Provider[], onAction: (j: Job, a: string) => void, t: any }) => {
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
                <p className="text-xs font-bold">M-Pesa / Transação: <span className="font-mono text-natural-accent">{j.transactionId}</span></p>
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
          {payouts.map(j => {
            const provider = providers.find(p => p.id === j.providerId);
            const workerPhone = provider?.phone || 'Ver perfil do trabalhador';
            const workerName = provider?.name || j.providerName || `Prestador #${j.providerId.slice(0, 6)}`;
            const netPayout = Math.round(j.amount * 0.9);

            return (
              <div key={j.id} className="p-4 bg-red-50/30 rounded-2xl border border-red-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-natural-muted uppercase">Prestador: {workerName}</p>
                  <p className="text-sm font-black text-natural-heading">{netPayout} MT</p>
                  <p className="text-[9px] font-bold text-red-600 uppercase">M-Pesa / e-Mola: {workerPhone}</p>
                </div>
                <button 
                  onClick={() => onAction(j, 'MARK_AS_PAID')}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm shadow-red-200"
                >
                  Marcar Pago
                </button>
              </div>
            );
          })}
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
    metrics: "Métricas",
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
    listening: "A escutar... Fale agora",
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
    scheduleType: "Tipo de Agendamento",
    immediate: "Imediato (Agora)",
    scheduled: "Agendar Momento Futuro",
    scheduleDate: "Data e Hora do Serviço",
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
    whatsappDesc: "Fale com o Moderador para suporte geral, tirar dúvidas ou obter ajuda personalizada.",
    talkWhatsapp: "Falar no WhatsApp",
    customerLine: "Linha do Cliente (*777#)",
    customerLineDesc: "Disque o código interativo *777# para o apoio dinâmico ao cliente e serviços rápidos do Garante.",
    dialCustomerLine: "Discar *777#",
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
    quickReschedule: "Reagendamento Rápido",
    rescheduleUnforeseen: "Reagendar por Imprevisto",
    unforeseenNotice: "Biscate cancelado por imprevistos",
    escrowPreserved: "Garantia de pagamento e caução mantidas em segurança",
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
    logout: "Sair",
    voiceFallbackTitle: "Descreva o Problema",
    voiceFallbackDesc: "O microfone está restrito no seu navegador ou iFrame. Descreva abaixo o que precisa de resolver em poucas palavras para encontrarmos o profissional certo:",
    voiceFallbackPlaceholder: "Ex: cano roto, trocar lâmpada, limpar quintal, consertar ar condicionado...",
    voiceFallbackButton: "Analisar e Pesquisar",
    noCategoryMatched: "Pesquisando por: ",
    categoryMatched: "Encontrámos um profissional para si: ",
    qrTitle: "Código QR de Check-in",
    qrDesc: "Mostre este código QR ao prestador quando ele chegar para realizar o check-in instantâneo.",
    scanQr: "Escanear QR do Cliente",
    scanSuccess: "Check-in realizado com sucesso via QR Code!",
    scanError: "Código QR inválido para este trabalho.",
    cameraRestricted: "Acesso à câmara restrito ou indisponível. Utilize o simulador abaixo para o check-in rápido:",
    simulatedCheckin: "Simular Leitura de QR",
    cameraLoading: "Iniciando câmara...",
    qrCancel: "Cancelar",
    payoutCreditedTitle: "Saldo Creditado! 💰🎉",
    payoutCreditedBody: "O cliente confirmou o serviço finalizado. O seu saldo foi creditado com sucesso!",
    enablePushNotifications: "Activar Alertas de Saldo",
    pushNotificationsEnabled: "Alertas de Crédito Activos",
    workerEarningsTitle: "Ganhos Acumulados (Últimos 6 Meses)",
    workerEarningsSub: "Evolução dos rendimentos líquidos na sua carteira",
    accumulatedView: "Acumulado",
    monthlyView: "Por Mês",
    totalAccumulated6M: "Total Acumulado",
    monthlyAverage: "Média Mensal",
    bestMonth: "Melhor Mês",
    earningsNetNote: "Valores líquidos creditados no seu saldo após dedução da taxa de 10% da plataforma.",
    withdrawalFeeBadge: "Taxa de Saque: 3%",
    withdrawalFeeInfo: "Taxa de Saque Reduzida (3%)",
    withdrawalFeeSummary: "Taxa da Carteira Móvel (3%)",
    netWithdrawalAmount: "Valor Líquido a Receber",
    withdrawalSuccessSub: "enviada com sucesso para a sua carteira móvel após taxa reduzida de saque de 3%.",
    exportMonthlySummary: "Exportar Resumo PDF",
    monthlySummaryTitle: "Resumo Executivo Mensal & Relatório PDF",
    monthlySummarySub: "Exporte o relatório financeiro consolidado em formato PDF com os ganhos totais da plataforma, número de biscates e comissões arrecadadas.",
    selectMonth: "Selecionar Mês",
    platformTotalEarnings: "Ganhos Totais da Plataforma",
    totalBiscatesCount: "Número de Biscates",
    commissionsCollected: "Comissões Arrecadadas (10%)",
    workerNetPayouts: "Repasse aos Trabalhadores",
    generatingPdf: "A Gerar PDF...",
    pdfExportSuccess: "Resumo mensal em formato PDF exportado com sucesso!",
    noJobsInMonth: "Nenhum biscate concluído registado neste mês."
  },
  en: {
    welcome: "What are we solving today?",
    start: "Start",
    jobs: "Jobs",
    history: "History",
    metrics: "Metrics",
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
    listening: "Listening... Speak now",
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
    scheduleType: "Schedule Type",
    immediate: "Immediate (Now)",
    scheduled: "Schedule Future Date",
    scheduleDate: "Service Date & Time",
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
    whatsappDesc: "Talk with the Moderator for general support, questions, or personalized help.",
    talkWhatsapp: "Talk on WhatsApp",
    customerLine: "Customer Line (*777#)",
    customerLineDesc: "Dial the interactive *777# code for dynamic support, quick verification, or emergency help.",
    dialCustomerLine: "Dial *777#",
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
    logout: "Logout",
    voiceFallbackTitle: "Describe your Problem",
    voiceFallbackDesc: "Microphone is restricted in your browser or iFrame. Describe what you need in a few words below so we can find the right professional:",
    voiceFallbackPlaceholder: "E.g. broken pipe, fix light bulb, clean yard, service AC...",
    voiceFallbackButton: "Analyze and Search",
    noCategoryMatched: "Searching for: ",
    categoryMatched: "We found a professional for you: ",
    qrTitle: "Check-in QR Code",
    qrDesc: "Show this QR code to the provider when they arrive to perform an instant check-in.",
    scanQr: "Scan Client QR",
    scanSuccess: "Check-in successfully completed via QR Code!",
    scanError: "Invalid QR code for this job.",
    cameraRestricted: "Camera access restricted or unavailable. Use the simulator below for quick check-in:",
    simulatedCheckin: "Simulate QR Scan",
    cameraLoading: "Starting camera...",
    qrCancel: "Cancel",
    payoutCreditedTitle: "Balance Credited! 💰🎉",
    payoutCreditedBody: "The client confirmed the completed service. Your balance has been credited successfully!",
    enablePushNotifications: "Enable Balance Alerts",
    pushNotificationsEnabled: "Credit Alerts Active",
    workerEarningsTitle: "Accumulated Earnings (Last 6 Months)",
    workerEarningsSub: "Evolution of net earnings credited to your wallet",
    accumulatedView: "Accumulated",
    monthlyView: "Per Month",
    totalAccumulated6M: "Total Accumulated",
    monthlyAverage: "Monthly Average",
    bestMonth: "Best Month",
    earningsNetNote: "Net earnings credited to your balance after 10% platform fee deduction.",
    withdrawalFeeBadge: "Withdrawal Fee: 3%",
    withdrawalFeeInfo: "Reduced Withdrawal Fee (3%)",
    withdrawalFeeSummary: "Mobile Wallet Processing Fee (3%)",
    netWithdrawalAmount: "Net Amount to Receive",
    withdrawalSuccessSub: "successfully sent to your mobile wallet after reduced 3% withdrawal fee.",
    exportMonthlySummary: "Export Monthly Summary (PDF)",
    monthlySummaryTitle: "Monthly Executive Summary & PDF Report",
    monthlySummarySub: "Export consolidated financial report in PDF format with total platform earnings, completed jobs, and collected commissions.",
    selectMonth: "Select Month",
    platformTotalEarnings: "Total Platform Earnings",
    totalBiscatesCount: "Number of Biscates",
    commissionsCollected: "Commissions Collected (10%)",
    workerNetPayouts: "Worker Payouts",
    generatingPdf: "Generating PDF...",
    pdfExportSuccess: "Monthly summary PDF report exported successfully!",
    noJobsInMonth: "No completed jobs recorded in this month."
  },
  em: {
    welcome: "Exiphika ninla okhwele?",
    start: "Opacerya",
    jobs: "Miteko",
    history: "Ovikere",
    metrics: "Métricas",
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
    listening: "Osuwela... Olavule vano",
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
    scheduleType: "Oruka sa Muteko",
    immediate: "Vano-Vano (Mano)",
    scheduled: "Oraveya ohiyu",
    scheduleDate: "Eyaaha ni okathi wa Muteko",
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
    whatsappDesc: "Olavule ni Moderator wi okhalane nikhavelo na otheene ni othelele ophwanya nikhaveliherro.",
    talkWhatsapp: "Olavule ni WhatsApp",
    customerLine: "Linha do Cliente (*777#)",
    customerLineDesc: "Nikhavelo wa Cliente ni ecode *777# wi othelele ophwanya nikhaveliherro na mpuwa.",
    dialCustomerLine: "Oramela *777#",
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
    logout: "Okhuma",
    voiceFallbackTitle: "Oromola Muteko Anyu",
    voiceFallbackDesc: "Microfone onrikiha. Oromole yovila anyu vano wi mphavele namuteko ooreerela:",
    voiceFallbackPlaceholder: "E.g. cano roto, olyiha lampada, oreteha quintal...",
    voiceFallbackButton: "Olavula ni Ophavela",
    noCategoryMatched: "Noona ophavela: ",
    categoryMatched: "Niphavenle namuteko ooreerela: ",
    qrTitle: "QR Code wa Check-in",
    qrDesc: "Onyeha QR code ola wa namuteko wi opaceerye muteko vano.",
    scanQr: "Olekavar QR Code",
    scanSuccess: "Check-in omalela ni QR Code!",
    scanError: "QR Code khahiyo wooreerela muteko ola.",
    cameraRestricted: "Câmara khinaweryeya. Opharihele ehisano ela wi opacerye muteko:",
    simulatedCheckin: "Orehererya Olekavar QR",
    cameraLoading: "Ohula câmara...",
    qrCancel: "Ohiya",
    payoutCreditedTitle: "Musurukhu Oheliwa! 💰🎉",
    payoutCreditedBody: "Muthumi ohilipiha wi muteko woomala. Musurukhu anyu oheliwa mpuwa mwa carteira!",
    enablePushNotifications: "Ohula Notificações Push",
    pushNotificationsEnabled: "Notificações Sihootxe",
    workerEarningsTitle: "Musurukhu Oothukumanyiwa (Myeeri 6 Soovira)",
    workerEarningsSub: "Weemereriwa wa musurukhu anyu mwa carteira",
    accumulatedView: "Oothukumanyiwa",
    monthlyView: "Kha Mweeri",
    totalAccumulated6M: "Ootheene Oothukumanyiwa",
    monthlyAverage: "Exariya ya Mweeri",
    bestMonth: "Mweeri Wooreerela",
    earningsNetNote: "Musurukhu woopacerya oheliwa mpuwa mwa carteira anyu.",
    withdrawalFeeBadge: "Taxa ya Saque: 3%",
    withdrawalFeeInfo: "Taxa yookhulumuwa ya Saque (3%)",
    withdrawalFeeSummary: "Taxa ya Carteira Móvel (3%)",
    netWithdrawalAmount: "Musurukhu woowakheliwa",
    withdrawalSuccessSub: "ooroihiwa mpuwa mwa carteira anyu móvel ni taxa ya 3%.",
    exportMonthlySummary: "Okhula Resumo ya Mweeri (PDF)",
    monthlySummaryTitle: "Resumo ya Mweeri ni Relatório PDF",
    monthlySummarySub: "Okhula relatório ni musurukhu wotheene wa plataforma, miteko ni comissões saakheliwe.",
    selectMonth: "Othanla Mweeri",
    platformTotalEarnings: "Musurukhu Wotheene wa Plataforma",
    totalBiscatesCount: "Nummero ya Miteko",
    commissionsCollected: "Comissões Saakheliwe (10%)",
    workerNetPayouts: "Musurukhu wa Anamuteko",
    generatingPdf: "Okhuma PDF...",
    pdfExportSuccess: "Relatório ya mweeri yoopacerya okhuma ni mureerelo!",
    noJobsInMonth: "Khaavo muteko woomala mweeri yoola."
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
    if (!input.trim() || !currentUser?.uid) return;
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
          const isMe = m.senderId === currentUser?.uid;
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

const QrScannerModal = memo(({ isOpen, onClose, onScanSuccess, jobId, t }: { isOpen: boolean, onClose: () => void, onScanSuccess: () => void, jobId: string, t: any }) => {
  const [cameraError, setCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    
    setCameraError(false);
    setCameraLoading(true);

    let html5Qrcode: Html5Qrcode | null = null;
    const qrReaderId = "qr-reader-container";
    
    const timer = setTimeout(() => {
      try {
        html5Qrcode = new Html5Qrcode(qrReaderId);
        html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            const trimmed = decodedText.trim();
            let isMatch = false;
            if (trimmed === jobId) {
              isMatch = true;
            } else {
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.jobId === jobId || parsed.id === jobId) {
                  isMatch = true;
                }
              } catch (e) {
                // Ignore
              }
            }

            if (isMatch) {
              if (html5Qrcode) {
                html5Qrcode.stop().then(() => {
                  onScanSuccess();
                }).catch(err => {
                  console.warn(err);
                  onScanSuccess();
                });
              } else {
                onScanSuccess();
              }
            } else {
              alert(`${t.scanError}\n\nLido: "${decodedText}"`);
            }
          },
          (errorMessage) => {
            // Quiet debug logs
          }
        ).then(() => {
          setCameraLoading(false);
        }).catch(err => {
          console.warn("Failed starting html5-qrcode:", err);
          setCameraError(true);
          setCameraLoading(false);
        });
      } catch (e) {
        console.warn("Failed initializing html5-qrcode:", e);
        setCameraError(true);
        setCameraLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.warn("Stop on unmount failed:", err));
      }
    };
  }, [isOpen, jobId, onScanSuccess, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white text-natural-heading w-full max-w-sm rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border-4 border-white overflow-hidden font-sans text-left relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-natural-surface flex items-center justify-center text-natural-muted hover:bg-natural-line/30 transition-all active:scale-90 z-[310]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-4">
          <div className="text-[10px] font-black text-natural-success tracking-[0.2em] uppercase flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 animate-bounce" />
            <span>{t.scanQr}</span>
          </div>

          <h3 className="text-lg font-black tracking-tight leading-none">
            {t.scanQr}
          </h3>

          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border-2 border-natural-line flex flex-col items-center justify-center">
            <div id="qr-reader-container" className="absolute inset-0 w-full h-full" />
            
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white space-y-2 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-natural-success" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{t.cameraLoading}</span>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center space-y-3 z-10">
                <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
                <p className="text-[11px] font-bold leading-relaxed text-gray-300">
                  {t.cameraRestricted}
                </p>
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-left w-full">
                  <span className="block text-[8px] font-black text-white/55 tracking-widest uppercase mb-1">CÓDIGO DO TRABALHO</span>
                  <span className="font-mono text-[10px] font-black text-natural-success break-all select-all">#{jobId}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onScanSuccess();
            }}
            className="w-full bg-natural-success text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>{t.simulatedCheckin}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full bg-natural-surface hover:bg-natural-line/20 text-natural-muted py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
          >
            {t.qrCancel}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

const ReviewModal = memo(({ providerId, onFinish, t, currentUser }: { providerId: string, onFinish: () => void, t: any, currentUser?: any }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const user = currentUser || auth.currentUser;
    if (!user) {
      alert("Por favor, inicie sessão para submeter uma avaliação.");
      return;
    }
    setSubmitting(true);
    try {
      // Submits to the secure subcollection matching firestore.rules
      await addDoc(collection(db, 'users', providerId, 'reviews'), {
        authorId: user.uid,
        rating: Math.min(5, Math.max(1, rating)),
        comment: (comment || '').trim().slice(0, 1000),
        createdAt: serverTimestamp()
      });
      onFinish();
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      // Even if rules fail or on finish, proceed so the client is not permanently trapped
      onFinish();
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

const JobCard = memo(({ job, role, onAction, t, currentUser, lang = 'pt', onPanic }: { job: Job, role: string, onAction: (j: Job, a: string, d?: any) => void, t: any, currentUser: any, lang?: string, onPanic?: (job: Job) => void }) => {
  const [txId, setTxId] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Automated Payment States
  const [paymentMethod, setPaymentMethod] = useState<'auto' | 'manual'>('auto');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentWallet, setPaymentWallet] = useState<'mpesa' | 'emola'>('mpesa');
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushStep, setPushStep] = useState('');
  const [showPushOverlay, setShowPushOverlay] = useState(false);
  const [pushPin, setPushPin] = useState('');
  const [pushError, setPushError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Quick Reschedule & Cancellation for Unforeseen Events
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => {
    if (job.scheduledFor) return job.scheduledFor;
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Chuva forte / Mau tempo');
  const [customReason, setCustomReason] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  const sendPanic = () => {
    if (onPanic) {
      onPanic(job);
    } else {
      onAction(job, 'PANIC', { location: 'Localização de emergência partilhada' });
    }
  };

  if (showReview) return <ReviewModal providerId={job.providerId} onFinish={() => onAction(job, 'CONFIRM_CLIENT')} t={t} currentUser={currentUser} />;

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

      {job.bookingType === 'scheduled' && job.scheduledFor && (
        <div className="mb-6 p-4 bg-natural-surface rounded-2xl border-2 border-natural-line border-dashed flex items-center gap-3">
          <Calendar className="w-5 h-5 text-natural-accent shrink-0 animate-pulse" />
          <div className="text-left">
            <p className="text-[9px] font-black text-natural-muted uppercase tracking-wider mb-0.5">{t.scheduleDate || 'Data e Hora do Serviço'}</p>
            <p className="text-xs font-black text-natural-heading">
              {new Date(job.scheduledFor).toLocaleString(lang === 'pt' ? 'pt-MZ' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </p>
          </div>
        </div>
      )}

      {role !== 'admin' && job.status !== 'CONCLUIDO' && (
        <JobReminder jobId={job.id} jobTitle={job.category} t={t} />
      )}

      {role === 'worker' && <FeeBreakdown amount={job.amount} t={t} />}

      {/* --- Panic Button / Alarme SOS Anti-Crime (Para Ambos os Lados) --- */}
      {(job.status === 'EM_CURSO' || job.status === 'PAGO') && (
        <button 
          onClick={sendPanic} 
          className="w-full bg-red-50 text-red-600 border-2 border-red-200 hover:border-red-400 font-black py-3 rounded-2xl flex items-center justify-center gap-2 mb-4 hover:bg-red-100 transition-colors shadow-sm active:scale-98"
        >
          <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
          <span className="text-xs uppercase tracking-wider">🚨 Alarme SOS / Emergência Anti-Crime</span>
        </button>
      )}

      {/* --- Client: Submit ID (Automated STK Push & Manual tabs) --- */}
      {role === 'client' && job.status === 'AGUARDANDO_DEPOSITO' && (
        <div className="space-y-4">
          {/* Payment Method Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-natural-surface rounded-2xl border border-natural-line">
            <button
              type="button"
              onClick={() => setPaymentMethod('auto')}
              className={`py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                paymentMethod === 'auto'
                  ? 'bg-white text-natural-accent shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> ⚡ Automático
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('manual')}
              className={`py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                paymentMethod === 'manual'
                  ? 'bg-white text-natural-accent shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Manual (Referência)
            </button>
          </div>

          {paymentMethod === 'auto' ? (
            <div className="space-y-3 bg-natural-surface/30 p-4 rounded-3xl border border-natural-line">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-natural-accent" />
                <p className="text-[10px] font-black text-natural-heading uppercase tracking-wider">
                  Garante Escrow: Pagamento Instantâneo
                </p>
              </div>

              {/* Wallet Select */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentWallet('mpesa')}
                  className={`py-3 px-2 border-2 rounded-2xl font-black text-xs transition-all flex flex-col items-center gap-1 ${
                    paymentWallet === 'mpesa'
                      ? 'border-red-500 bg-red-50/20 text-red-600'
                      : 'border-natural-line bg-white text-natural-muted hover:border-natural-muted'
                  }`}
                >
                  <span className="text-xs font-black">Vodacom M-Pesa</span>
                  <span className="text-[8px] opacity-75 font-bold uppercase tracking-widest">STK Push API</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentWallet('emola')}
                  className={`py-3 px-2 border-2 rounded-2xl font-black text-xs transition-all flex flex-col items-center gap-1 ${
                    paymentWallet === 'emola'
                      ? 'border-orange-500 bg-orange-50/20 text-orange-600'
                      : 'border-natural-line bg-white text-natural-muted hover:border-natural-muted'
                  }`}
                >
                  <span className="text-xs font-black">Movitel e-Mola</span>
                  <span className="text-[8px] opacity-75 font-bold uppercase tracking-widest">STK Push API</span>
                </button>
              </div>

              {/* Phone Input */}
              <div>
                <label className="block text-[8px] font-black text-natural-muted uppercase tracking-widest mb-1">
                  Número de Telemóvel para o STK Push
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-xs font-black text-natural-muted font-mono">+258</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="84xxxxxxx"
                    maxLength={9}
                    className="w-full pl-14 pr-4 py-3.5 border border-natural-line rounded-2xl outline-none font-mono text-sm font-bold bg-white"
                    value={paymentPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPaymentPhone(val);
                    }}
                  />
                </div>
              </div>

              {/* STK Trigger Button */}
              <button
                type="button"
                disabled={paymentPhone.length < 9 || isPushLoading}
                onClick={async () => {
                  setIsPushLoading(true);
                  setPushStep('A ligar à API...');
                  await new Promise((r) => setTimeout(r, 600));
                  setPushStep('A enviar STK Push...');
                  await new Promise((r) => setTimeout(r, 800));
                  setIsPushLoading(false);
                  setShowPushOverlay(true);
                  setPushPin('');
                  setPushError('');
                }}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-premium flex items-center justify-center gap-2 ${
                  paymentWallet === 'mpesa' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isPushLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{pushStep}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white animate-pulse" />
                    <span>Solicitar STK Push ({job.amount} MT)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-xs font-medium text-yellow-800">
                 {t.sendMpesa} <b>{job.amount} MT</b> {t.to} <b>870324189</b> {t.andPasteCode}
              </div>
              <input 
                type="text" placeholder="Código M-Pesa"
                className="w-full p-4 border border-natural-line rounded-2xl outline-none font-mono text-sm uppercase font-bold"
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

          {/* SIM Card Dialogue Overlay Simulation */}
          <AnimatePresence>
            {showPushOverlay && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-[#ececec] max-w-xs w-full rounded-3xl overflow-hidden shadow-2xl border-2 border-neutral-300 font-sans text-neutral-800"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-neutral-200 rounded-lg">
                        <Smartphone className="w-4 h-4 text-neutral-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 leading-none">
                          {paymentWallet === 'mpesa' ? 'Vodacom M-Pesa' : 'Movitel e-Mola'}
                        </h4>
                        <p className="text-[8px] font-bold text-neutral-400">MozoEscrow Automated Gateway</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-neutral-200 text-[11px] font-medium leading-relaxed text-neutral-700">
                      Deseja autorizar o pagamento em custódia de <span className="text-natural-accent font-black">{job.amount} MT</span> para garantir o biscate #{job.id} de <span className="font-black text-neutral-900">{job.category}</span>?
                      <p className="mt-2 text-neutral-500 text-[9px] font-semibold">Introduza o seu PIN de 4 dígitos para confirmar a transação:</p>
                    </div>

                    <div>
                      <input
                        type="password"
                        placeholder="••••"
                        maxLength={4}
                        className="w-full text-center py-3 bg-white border border-neutral-300 rounded-xl outline-none font-mono text-2xl tracking-[0.5em] font-black"
                        value={pushPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPushPin(val);
                          setPushError('');
                        }}
                      />
                      {pushError && (
                        <p className="text-[9px] font-black text-red-500 mt-1 text-center">{pushError}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-neutral-400 justify-center">
                      <Lock className="w-3 h-3" />
                      <span>PIN protegido. Conexão encriptada local</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPushOverlay(false);
                          setPushPin('');
                        }}
                        className="py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={pushPin.length < 4 || isPushLoading}
                        onClick={async () => {
                          try {
                            setIsPushLoading(true);
                            setPushError('');
                            
                            // Call backend API to register the automatic payment transaction
                            const response = await fetch('/api/payments/stk-push', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                phone: '258' + paymentPhone,
                                amount: job.amount,
                                service: paymentWallet,
                                pin: pushPin
                              })
                            });
                            
                            const resData = await response.json();
                            setIsPushLoading(false);
                            
                            if (response.ok && resData.status === 'success') {
                              setShowPushOverlay(false);
                              setPaymentSuccess(true);
                              
                              // Automatically dispatch the automated payment status update to Firestore
                              await onAction(job, 'PAY_AUTOMATED', { txId: resData.transactionId });
                              
                              // Turn off success popup after 2.5 seconds
                              setTimeout(() => {
                                setPaymentSuccess(false);
                              }, 2500);
                            } else {
                              setPushError(resData.error || 'Erro ao processar. Tente novamente.');
                            }
                          } catch (err) {
                            setIsPushLoading(false);
                            setPushError('Erro de conexão ao servidor.');
                          }
                        }}
                        className={`py-3 ${
                          paymentWallet === 'mpesa' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
                        } text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50`}
                      >
                        {isPushLoading ? 'A Validar...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Success Overlay Animation */}
          <AnimatePresence>
            {paymentSuccess && (
              <div className="fixed inset-0 bg-natural-heading/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="bg-white p-6 rounded-[2.5rem] text-center max-w-xs w-full shadow-premium space-y-4"
                >
                  <div className="mx-auto w-12 h-12 bg-natural-success/15 rounded-full flex items-center justify-center text-natural-success animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-natural-heading">Depósito Confirmado!</h3>
                  <p className="text-[11px] text-natural-muted font-bold leading-relaxed">
                    O depósito de <span className="text-natural-heading font-black">{job.amount} MT</span> foi retido em Escrow Digital com segurança. O prestador foi notificado e já pode fazer Check-in.
                  </p>
                  <div className="bg-natural-surface p-3 rounded-2xl border border-natural-line">
                    <span className="block text-[8px] font-black text-natural-muted uppercase tracking-widest mb-1">CÓDIGO DE TRANSAÇÃO</span>
                    <span className="font-mono text-xs font-black text-natural-accent">Simulação Automática Concluída</span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
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

      {/* --- Client: Display QR Code for Worker arrival check-in --- */}
      {role === 'client' && job.status === 'PAGO' && (
        <div className="bg-natural-surface p-5 rounded-3xl border-2 border-natural-line border-dashed text-center space-y-4 mb-4">
          <div className="flex items-center justify-center gap-2 text-natural-success">
            <QrCode className="w-5 h-5 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider">{t.qrTitle}</span>
          </div>
          
          <div className="mx-auto bg-white p-4 rounded-3xl w-40 h-40 flex items-center justify-center shadow-md border border-natural-line">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(job.id)}&color=0c513f`} 
              alt="QR Check-in" 
              className="w-full h-full object-contain"
            />
          </div>
          
          <p className="text-[10px] font-bold text-natural-muted leading-relaxed max-w-xs mx-auto">
            {t.qrDesc}
          </p>
        </div>
      )}

      {/* --- Worker: Actions --- */}
      {role === 'worker' && job.status === 'PAGO' && (
        <div className="space-y-2">
          <button 
            onClick={() => setShowQrScanner(true)} 
            className="w-full bg-natural-success text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-100 hover:scale-[1.01] active:scale-95 transition-all"
          >
            <QrCode className="w-5 h-5 animate-pulse" /> {t.scanQr}
          </button>
          
          <button 
            onClick={() => onAction(job, 'CHECK_IN')} 
            className="w-full bg-natural-accent/10 hover:bg-natural-accent/20 text-natural-accent font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all"
          >
            <Camera className="w-4 h-4" /> {t.checkIn}
          </button>

          <QrScannerModal 
            isOpen={showQrScanner}
            onClose={() => setShowQrScanner(false)}
            onScanSuccess={() => {
              setShowQrScanner(false);
              onAction(job, 'CHECK_IN');
              alert(t.scanSuccess);
            }}
            jobId={job.id}
            t={t}
          />
        </div>
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

      {/* --- Biscate Cancelado por Imprevistos & Reagendamento Rápido --- */}
      {job.status === 'CANCELADO' && (
        <div className="mt-4 p-5 bg-gradient-to-br from-amber-50 via-orange-50/50 to-white border-2 border-amber-300 rounded-[2rem] shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full inline-block mb-1">
                Biscate Cancelado por Imprevisto
              </span>
              <h5 className="text-xs font-black text-natural-heading leading-tight">
                {job.cancellationReason || 'Cancelado devido a imprevistos'}
              </h5>
              <p className="text-[10px] text-amber-900/80 font-semibold mt-1 leading-snug">
                {job.transactionId || job.previousStatus === 'PAGO' ? (
                  <>🛡️ <strong>Garantia Escrow Ativa:</strong> O valor de <strong>{job.amount} MT</strong> continua em custódia segura. Pode reagendar sem efetuar novo pagamento.</>
                ) : (
                  <>As configurações do biscate ({job.category} • {job.amount} MT) foram preservadas para reagendamento rápido.</>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRescheduleModal(true)}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reagendamento Rápido</span>
          </button>
        </div>
      )}

      {/* Opção de Reportar Imprevisto para Biscates em Curso ou Aguardando */}
      {['AGUARDANDO_DEPOSITO', 'PAGO', 'EM_CURSO'].includes(job.status) && (
        <div className="mt-3 pt-3 border-t border-natural-line flex items-center justify-between">
          <span className="text-[9px] font-bold text-natural-muted">Teve chuva ou imprevistos?</span>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="text-[10px] font-black text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Cancelar para Reagendar</span>
          </button>
        </div>
      )}

      {/* Modal: Cancelar por Imprevisto */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white max-w-sm w-full p-6 rounded-[2.5rem] shadow-2xl border-2 border-amber-300 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-natural-line">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-natural-heading leading-tight">Imprevisto no Biscate</h4>
                    <p className="text-[10px] text-natural-muted font-bold">Cancelar mantendo as configurações</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-medium leading-relaxed">
                🛡️ <strong>Atenção:</strong> O valor de <strong>{job.amount} MT</strong> permanece retido em garantia Escrow. Poderá fazer o <strong>Reagendamento Rápido</strong> para qualquer outra data sem pagar novamente!
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-natural-muted">
                  Selecione o Motivo do Imprevisto:
                </label>
                {[
                  'Chuva forte / Mau tempo',
                  'Atraso no transporte / Trânsito extremo (chapa)',
                  'Corte de energia / Falta de água no local',
                  'Falta de material ou ferramentas',
                  'Imprevisto pessoal ou de saúde',
                  'Outro motivo'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReason(reason)}
                    className={`w-full p-2.5 text-left rounded-xl text-xs font-bold transition-all border ${
                      cancelReason === reason
                        ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-2xs font-black'
                        : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {reason}
                  </button>
                ))}

                {cancelReason === 'Outro motivo' && (
                  <input
                    type="text"
                    placeholder="Descreva brevemente o imprevisto..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full mt-2 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-natural-heading"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const finalReason = cancelReason === 'Outro motivo' ? (customReason.trim() || 'Outro imprevisto') : cancelReason;
                    await onAction(job, 'CANCEL_UNFORESEEN', { reason: finalReason });
                    setShowCancelModal(false);
                    setShowRescheduleModal(true);
                  }}
                  className="py-3 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Reagendamento Rápido */}
      <AnimatePresence>
        {showRescheduleModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white max-w-sm w-full p-6 rounded-[2.5rem] shadow-2xl border-2 border-emerald-400 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-natural-line">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <RefreshCw className="w-5 h-5 animate-spin-reverse" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-natural-heading leading-tight">Reagendamento Rápido</h4>
                    <p className="text-[10px] text-emerald-700 font-bold">Mesmo valor e caução mantidos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Informações Preservadas */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Biscate Original</span>
                  <span className="text-[9px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">#{job.id}</span>
                </div>
                <p className="text-xs font-black text-emerald-950 leading-tight">{job.category}</p>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-[10px] font-bold text-emerald-900">
                  <span>Valor Mantido:</span>
                  <span className="text-sm font-black text-emerald-700">{job.amount} MT</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-emerald-800 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Caução e configurações protegidas em Escrow</span>
                </div>
              </div>

              {/* Seletor de Nova Data e Hora */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-natural-muted">
                  Nova Data e Hora Pretendida *
                </label>
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-natural-line rounded-xl focus-within:border-emerald-600 focus-within:bg-white transition-all">
                  <CalendarClock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="datetime-local"
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full text-xs font-bold text-natural-heading bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* Nota / Acordo prévio */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-natural-muted">
                  Observações / Combinado prévio (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Combinado para logo pela manhã após o tempo abrir"
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  className="w-full p-3 text-xs bg-slate-50 border border-natural-line rounded-xl outline-none font-semibold text-natural-heading focus:border-emerald-600 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={!rescheduleDate || isSubmittingReschedule}
                  onClick={async () => {
                    if (!rescheduleDate) return;
                    setIsSubmittingReschedule(true);
                    try {
                      await onAction(job, 'QUICK_RESCHEDULE', {
                        newDateTime: rescheduleDate,
                        note: rescheduleNote.trim()
                      });
                      setShowRescheduleModal(false);
                    } finally {
                      setIsSubmittingReschedule(false);
                    }
                  }}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingReschedule ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
                  <p className="font-mono text-[9px] font-black text-red-700">DEST: {provider?.phone || 'M-Pesa Prestador'}</p>
                </div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
});

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-2xl border-2 border-natural-line shadow-premium text-left">
        <p className="text-[10px] font-black text-natural-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xs font-black text-natural-heading">
          {payload[0].name}: <span className="text-natural-accent font-mono">{prefix}{payload[0].value.toLocaleString('pt-MZ')}{suffix}</span>
        </p>
      </div>
    );
  }
  return null;
};

interface MonthlyReportPdfData {
  monthKey: string;
  monthLabel: string;
  totalVolume: number;
  jobsCount: number;
  commissionsCollected: number;
  workerPayouts: number;
  avgTicket: number;
  categoriesBreakdown: { category: string; count: number; volume: number; commission: number }[];
  jobsList: { id: string; title: string; category: string; amount: number; commission: number; dateStr: string; status: string }[];
  issuedAt: string;
}

const generateMonthlyPdfReport = (data: MonthlyReportPdfData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Header Banner: Brand Forest Green
  doc.setFillColor(27, 94, 32);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Accent stripe: Brand Terracotta
  doc.setFillColor(230, 81, 0);
  doc.rect(0, 26, pageWidth, 2.5, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('MOZBISCATES', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(215, 238, 220);
  doc.text('A MAIOR REDE DE PRESTAÇÃO DE SERVIÇOS RÁPIDOS DE MOÇAMBIQUE', margin, 18);

  // Top Right Header Badges
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO MENSAL OFICIAL', pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(215, 238, 220);
  doc.text('PAINEL DE AUDITORIA E GESTÃO', pageWidth - margin, 18, { align: 'right' });

  let y = 37;

  // Title section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(44, 37, 35);
  doc.text('Resumo Mensal de Desempenho e Arrecadação', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(132, 126, 121);
  doc.text(`Período de Referência: ${data.monthLabel.toUpperCase()}`, margin, y + 5.5);

  doc.setFontSize(7.5);
  doc.text(`Data de Emissão: ${data.issuedAt}`, pageWidth - margin, y + 5.5, { align: 'right' });

  y += 12;

  // 3 Primary Highlight Boxes (KPIs)
  const cardW = 57;
  const cardH = 26;
  const gap = 5.5;

  // 1. Ganhos Totais da Plataforma
  doc.setFillColor(243, 248, 243);
  doc.setDrawColor(200, 228, 205);
  doc.roundedRect(margin, y, cardW, cardH, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(27, 94, 32);
  doc.text('GANHOS TOTAIS DA PLATAFORMA', margin + 4, y + 6);
  doc.setFontSize(12.5);
  doc.text(`${data.totalVolume.toLocaleString('pt-MZ')} MT`, margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 125, 105);
  doc.text('Volume bruto transacionado', margin + 4, y + 20);

  // 2. Número de Biscates
  const c2X = margin + cardW + gap;
  doc.setFillColor(248, 246, 244);
  doc.setDrawColor(228, 222, 218);
  doc.roundedRect(c2X, y, cardW, cardH, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(44, 37, 35);
  doc.text('NÚMERO DE BISCATES', c2X + 4, y + 6);
  doc.setFontSize(12.5);
  doc.text(`${data.jobsCount} serviços`, c2X + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(132, 126, 121);
  doc.text('Biscates concluídos no mês', c2X + 4, y + 20);

  // 3. Comissões Arrecadadas
  const c3X = margin + (cardW + gap) * 2;
  doc.setFillColor(254, 246, 240);
  doc.setDrawColor(250, 215, 195);
  doc.roundedRect(c3X, y, cardW, cardH, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(230, 81, 0);
  doc.text('COMISSÕES ARRECADADAS (10%)', c3X + 4, y + 6);
  doc.setFontSize(12.5);
  doc.text(`${data.commissionsCollected.toLocaleString('pt-MZ')} MT`, c3X + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(180, 105, 75);
  doc.text('Taxa retida pela MozBiscates', c3X + 4, y + 20);

  y += cardH + 7;

  // Secondary Distribution Strip
  doc.setFillColor(248, 245, 242);
  doc.setDrawColor(230, 225, 220);
  doc.roundedRect(margin, y, contentWidth, 10.5, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(44, 37, 35);
  doc.text('DISTRIBUIÇÃO:', margin + 4, y + 6.8);
  doc.setFont('helvetica', 'normal');
  doc.text('Repasse Líquido aos Trabalhadores (90%):', margin + 28, y + 6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 94, 32);
  doc.text(`${data.workerPayouts.toLocaleString('pt-MZ')} MT`, margin + 82, y + 6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(44, 37, 35);
  doc.text('|   Ticket Médio por Biscate:', margin + 110, y + 6.8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.avgTicket.toLocaleString('pt-MZ')} MT`, margin + 148, y + 6.8);

  y += 16;

  // Section 1: Desempenho por Categoria
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(44, 37, 35);
  doc.text('1. Desempenho Consolidado por Especialidade', margin, y);
  y += 4;

  // Table header for categories
  doc.setFillColor(235, 230, 225);
  doc.rect(margin, y, contentWidth, 5.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 45, 40);
  doc.text('CATEGORIA / ESPECIALIDADE', margin + 3, y + 4.1);
  doc.text('BISCATES', margin + 72, y + 4.1);
  doc.text('VOLUME TOTAL (MT)', margin + 120, y + 4.1, { align: 'right' });
  doc.text('COMISSÃO 10% (MT)', pageWidth - margin - 3, y + 4.1, { align: 'right' });
  y += 5.8;

  if (data.categoriesBreakdown.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 135, 130);
    doc.text('Nenhum serviço registado neste período.', margin + 3, y + 5);
    y += 9;
  } else {
    data.categoriesBreakdown.forEach((cat, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(252, 250, 248);
        doc.rect(margin, y, contentWidth, 5.2, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(40, 35, 30);
      doc.text(cat.category, margin + 3, y + 3.7);
      doc.text(`${cat.count} serviço(s)`, margin + 72, y + 3.7);
      doc.setFont('helvetica', 'bold');
      doc.text(`${cat.volume.toLocaleString('pt-MZ')} MT`, margin + 120, y + 3.7, { align: 'right' });
      doc.setTextColor(230, 81, 0);
      doc.text(`${cat.commission.toLocaleString('pt-MZ')} MT`, pageWidth - margin - 3, y + 3.7, { align: 'right' });
      y += 5.2;
    });
  }

  y += 7;

  // Section 2: Registo Discriminado de Biscates Concluídos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(44, 37, 35);
  doc.text('2. Registo Discriminado de Biscates Concluídos', margin, y);
  y += 4;

  const renderJobsHeader = (currentY: number) => {
    doc.setFillColor(235, 230, 225);
    doc.rect(margin, currentY, contentWidth, 5.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(50, 45, 40);
    doc.text('TÍTULO DO BISCATE', margin + 3, currentY + 4.1);
    doc.text('CATEGORIA', margin + 75, currentY + 4.1);
    doc.text('DATA', margin + 115, currentY + 4.1);
    doc.text('VALOR BRUTO', margin + 150, currentY + 4.1, { align: 'right' });
    doc.text('COMISSÃO (10%)', pageWidth - margin - 3, currentY + 4.1, { align: 'right' });
    return currentY + 5.8;
  };

  y = renderJobsHeader(y);

  if (data.jobsList.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 135, 130);
    doc.text('Nenhum biscate individual concluído neste período.', margin + 3, y + 5);
    y += 9;
  } else {
    data.jobsList.forEach((job, idx) => {
      if (y > 270) {
        doc.setDrawColor(220, 215, 210);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(140, 135, 130);
        doc.text('MozBiscates Moçambique • Relatório Gerencial e Fiscal', margin, pageHeight - 9);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 9, { align: 'right' });

        doc.addPage();
        y = 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 114, 110);
        doc.text(`Continuação - Registo de Biscates (${data.monthLabel.toUpperCase()})`, margin, y);
        y += 4;
        y = renderJobsHeader(y);
      }

      if (idx % 2 === 0) {
        doc.setFillColor(252, 250, 248);
        doc.rect(margin, y, contentWidth, 5.2, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(40, 35, 30);
      const titleShort = (job.title || 'Biscate Concluído').length > 38 
        ? (job.title || 'Biscate Concluído').substring(0, 37) + '...' 
        : (job.title || 'Biscate Concluído');
      doc.text(titleShort, margin + 3, y + 3.7);
      doc.text(job.category || 'Geral', margin + 75, y + 3.7);
      doc.text(job.dateStr, margin + 115, y + 3.7);
      doc.setFont('helvetica', 'bold');
      doc.text(`${job.amount.toLocaleString('pt-MZ')} MT`, margin + 150, y + 3.7, { align: 'right' });
      doc.setTextColor(230, 81, 0);
      doc.text(`${job.commission.toLocaleString('pt-MZ')} MT`, pageWidth - margin - 3, y + 3.7, { align: 'right' });
      y += 5.2;
    });
  }

  // Final page footer
  doc.setDrawColor(220, 215, 210);
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 135, 130);
  doc.text('MozBiscates Moçambique • Relatório Gerencial e Fiscal • Emitido pelo Painel de Administração', margin, pageHeight - 9);
  doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 9, { align: 'right' });

  // Save the PDF file
  doc.save(`resumo-mensal-mozbiscates-${data.monthKey}.pdf`);
};

// --- FORMULÁRIO OFICIAL DE INACTIVIDADE & RETENÇÃO: "Queremos melhorar! 💙" ---
const InactivityFeedbackModal = memo(({
  isOpen,
  onClose,
  currentUser,
  userData,
  role,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  userData: any;
  role: string | null;
  onSuccess?: () => void;
}) => {
  const [usageType, setUsageType] = useState<string>('Procurava serviços.');
  const [reason, setReason] = useState<string>('Não encontrei clientes ou serviços suficientes.');
  const [improvements, setImprovements] = useState<string>('A facilidade de utilização.');
  const [returnLikelihood, setReturnLikelihood] = useState<string>('Talvez, se houver melhorias.');
  const [suggestion, setSuggestion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const usageOptions = [
    'Procurava serviços.',
    'Oferecia serviços como biscateiro.',
    'Ambas as opções.'
  ];

  const reasonOptions = [
    'Não encontrei clientes ou serviços suficientes.',
    'Tive dificuldades em utilizar a aplicação.',
    'Encontrei problemas técnicos.',
    'Tive preocupações com a segurança ou confiança.',
    'Deixei de precisar do serviço.',
    'Outro motivo.'
  ];

  const improvementOptions = [
    'A facilidade de utilização.',
    'A quantidade de clientes e serviços.',
    'A segurança e confiança.',
    'O funcionamento da aplicação.',
    'O atendimento e apoio ao utilizador.'
  ];

  const returnOptions = [
    'Sim.',
    'Talvez, se houver melhorias.',
    'Não.'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Por favor, inicie sessão para submeter o seu feedback.");
      return;
    }
    setSubmitting(true);
    setErrorMsg('');

    try {
      const feedbackId = `FB_${currentUser.uid.slice(0, 10)}_${Date.now()}`;
      const payload = {
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: userData?.fullName || currentUser.displayName || 'Utilizador Mozbiscates',
        userRole: role || userData?.role || 'client',
        usageType,
        reason,
        improvements,
        returnLikelihood,
        suggestion: (suggestion || '').trim().slice(0, 1000),
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'inactivity_feedback', feedbackId), payload);

      // Re-activate user timestamp
      await updateDoc(doc(db, 'users', currentUser.uid), {
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(() => {});

      // Record in localStorage
      try {
        localStorage.setItem(`mozbiscates_feedback_submitted_${currentUser.uid}`, 'true');
      } catch (e) {}

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro ao enviar formulário de inactividade:", err);
      setErrorMsg("Ocorreu um erro ao enviar o seu feedback. Por favor tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[2.5rem] border-2 border-natural-line shadow-2xl p-6 sm:p-8 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-natural-surface hover:bg-natural-line/40 text-natural-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-5 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-natural-accent border-2 border-natural-accent/20">
              <Sparkles className="w-10 h-10 text-natural-accent" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-natural-accent bg-natural-accent/10 px-3 py-1 rounded-full">
                MOZBISCATES
              </span>
              <h2 className="text-2xl font-black text-natural-heading tracking-tight">
                Obrigado pela tua colaboração! 💙
              </h2>
              <p className="text-sm font-medium text-natural-muted max-w-md mx-auto">
                A tua opinião é fundamental para melhorarmos a plataforma para todos os moçambicanos. A tua conta foi reativada com sucesso!
              </p>
            </div>
            <div className="pt-4 border-t border-natural-surface">
              <p className="text-xs font-black text-natural-muted uppercase tracking-wider mb-5">
                Mozbiscates — Ligamos pessoas a oportunidades.
              </p>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-natural-accent text-white font-black text-sm uppercase tracking-wider hover:bg-natural-accent/90 transition-all shadow-md"
              >
                Continuar no Mozbiscates
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {/* Header */}
            <div className="space-y-2 border-b border-natural-surface pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-natural-accent/10 text-natural-accent font-black text-[10px] uppercase tracking-widest">
                  MOZBISCATES
                </span>
                <span className="text-xs font-black text-natural-accent flex items-center gap-1">
                  💙 Queremos melhorar!
                </span>
              </div>
              <h2 className="text-2xl font-black text-natural-heading tracking-tight">
                Queremos melhorar! 💙
              </h2>
              <p className="text-xs text-natural-muted font-medium leading-relaxed">
                Olá! Notámos que já não utilizas o Mozbiscates. Gostaríamos de saber o motivo para melhorarmos a tua experiência. Leva menos de 1 minuto!
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
                {errorMsg}
              </div>
            )}

            {/* Pergunta 1 */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black text-natural-heading">
                1. Como utilizavas o Mozbiscates?
              </label>
              <div className="space-y-2">
                {usageOptions.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      usageType === opt
                        ? 'border-natural-accent bg-emerald-50/40 font-bold text-natural-heading'
                        : 'border-natural-line hover:border-natural-accent/40 bg-white text-natural-muted font-medium text-xs'
                    }`}
                  >
                    <input
                      type="radio"
                      name="usageType"
                      value={opt}
                      checked={usageType === opt}
                      onChange={() => setUsageType(opt)}
                      className="accent-natural-accent w-4 h-4"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 2 */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black text-natural-heading">
                2. Porque deixaste de utilizar a aplicação?
              </label>
              <div className="space-y-2">
                {reasonOptions.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      reason === opt
                        ? 'border-natural-accent bg-emerald-50/40 font-bold text-natural-heading'
                        : 'border-natural-line hover:border-natural-accent/40 bg-white text-natural-muted font-medium text-xs'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={opt}
                      checked={reason === opt}
                      onChange={() => setReason(opt)}
                      className="accent-natural-accent w-4 h-4"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 3 */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black text-natural-heading">
                3. O que devemos melhorar?
              </label>
              <div className="space-y-2">
                {improvementOptions.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      improvements === opt
                        ? 'border-natural-accent bg-emerald-50/40 font-bold text-natural-heading'
                        : 'border-natural-line hover:border-natural-accent/40 bg-white text-natural-muted font-medium text-xs'
                    }`}
                  >
                    <input
                      type="radio"
                      name="improvements"
                      value={opt}
                      checked={improvements === opt}
                      onChange={() => setImprovements(opt)}
                      className="accent-natural-accent w-4 h-4"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 4 */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black text-natural-heading">
                4. Voltarias a utilizar o Mozbiscates?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {returnOptions.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center justify-center p-3 rounded-2xl border-2 cursor-pointer text-center transition-all ${
                      returnLikelihood === opt
                        ? 'border-natural-accent bg-emerald-50/40 font-black text-natural-heading text-xs'
                        : 'border-natural-line hover:border-natural-accent/40 bg-white text-natural-muted font-medium text-xs'
                    }`}
                  >
                    <input
                      type="radio"
                      name="returnLikelihood"
                      value={opt}
                      checked={returnLikelihood === opt}
                      onChange={() => setReturnLikelihood(opt)}
                      className="sr-only"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 5 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-black text-natural-heading">
                  5. Que sugestão gostarias de nos dar?
                </label>
                <span className="text-[10px] text-natural-muted font-bold">
                  Resposta opcional
                </span>
              </div>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Partilhe aqui as suas ideias ou o que mais sentiu falta..."
                className="w-full p-3.5 bg-natural-surface border-2 border-natural-line rounded-2xl text-xs font-medium text-natural-heading outline-none focus:border-natural-accent transition-colors resize-none"
              />
              <div className="text-right text-[10px] text-natural-muted">
                {suggestion.length}/1000
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-natural-surface space-y-4">
              <div className="text-center">
                <p className="text-[11px] font-black text-natural-muted uppercase tracking-wider">
                  Obrigado pela tua colaboração!
                </p>
                <p className="text-[10px] font-bold text-natural-accent mt-0.5">
                  Mozbiscates — Ligamos pessoas a oportunidades.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-1/3 py-3 rounded-2xl border-2 border-natural-line font-black text-xs uppercase tracking-wider text-natural-muted hover:bg-natural-surface transition-all"
                >
                  Agora não
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-2/3 py-3 rounded-2xl bg-natural-accent text-white font-black text-xs uppercase tracking-wider hover:bg-natural-accent/90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>A enviar...</span>
                    </>
                  ) : (
                    <span>Submeter e Continuar 💙</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
});

const AdminMetrics = memo(({ 
  jobs, 
  users = [], 
  feedbacks = [], 
  onPreviewInactivityModal, 
  t 
}: { 
  jobs: Job[], 
  users?: any[], 
  feedbacks?: any[], 
  onPreviewInactivityModal?: () => void, 
  t: any 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [retentionSubTab, setRetentionSubTab] = useState<'actives' | 'inactives' | 'all' | 'overview' | 'feedbacks'>('actives');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'worker' | 'client'>('all');

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  const extractDate = (raw: any): Date | null => {
    if (!raw) return null;
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (raw instanceof Date) return raw;
    if (raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const userStats = useMemo(() => {
    const now = Date.now();
    const ninetyDaysAgo = now - NINETY_DAYS_MS;
    const totalUsers = users.length;
    let activeUsers = 0;
    let inactiveUsers = 0;
    let activeWorkers = 0;
    let inactiveWorkers = 0;
    let activeClients = 0;
    let inactiveClients = 0;

    const activeUsersList: any[] = [];
    const inactiveUsersList: any[] = [];
    const allUsersList: any[] = [];

    users.forEach((u) => {
      // 1. Direct user timestamps
      let lastActiveDate = extractDate(u.lastActiveAt) || extractDate(u.updatedAt) || extractDate(u.createdAt);

      // 2. Cross-reference activity in jobs
      let latestJobDate: Date | null = null;
      let hasActiveJob = false;
      let userJobsCount = 0;

      jobs.forEach(j => {
        const isParticipant = j.clientId === u.id || j.providerId === u.id || j.clientId === u.uid || j.providerId === u.uid;
        if (isParticipant) {
          userJobsCount++;
          if (['AGUARDANDO_DEPOSITO', 'VALIDACAO_PENDENTE', 'PAGO', 'EM_CURSO', 'FINALIZADO'].includes(j.status)) {
            hasActiveJob = true;
          }
          const jDate = extractDate((j as any).completedAt) || extractDate((j as any).updatedAt) || extractDate((j as any).createdAt);
          if (jDate && (!latestJobDate || jDate > latestJobDate)) {
            latestJobDate = jDate;
          }
        }
      });

      if (latestJobDate && (!lastActiveDate || latestJobDate > lastActiveDate)) {
        lastActiveDate = latestJobDate;
      }

      // 3. Fallback: If no date exists on document, treat as active newly registered account
      const hasKnownDate = Boolean(lastActiveDate);
      if (!lastActiveDate) {
        lastActiveDate = new Date();
      }

      const diffMs = now - lastActiveDate.getTime();
      const daysInactive = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

      // An account is inactive ONLY if it has an explicit old date (>90 days) and has no active jobs
      const isInactive = hasKnownDate && !hasActiveJob && (daysInactive > 90);
      const isActive = !isInactive;

      const userRecord = {
        ...u,
        lastActiveDate,
        daysInactive,
        isActive,
        totalJobs: userJobsCount || u.jobs || 0
      };

      allUsersList.push(userRecord);

      if (isInactive) {
        inactiveUsers++;
        if (u.role === 'worker') inactiveWorkers++;
        else inactiveClients++;
        inactiveUsersList.push(userRecord);
      } else {
        activeUsers++;
        if (u.role === 'worker') activeWorkers++;
        else activeClients++;
        activeUsersList.push(userRecord);
      }
    });

    // Sort active users: most recently active first
    activeUsersList.sort((a, b) => a.daysInactive - b.daysInactive);
    // Sort inactive users: most days inactive first
    inactiveUsersList.sort((a, b) => b.daysInactive - a.daysInactive);
    // Sort all users: active first, then by days
    allUsersList.sort((a, b) => a.daysInactive - b.daysInactive);

    const activePercent = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 100;
    const inactivePercent = totalUsers > 0 ? Math.round((inactiveUsers / totalUsers) * 100) : 0;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      activePercent,
      inactivePercent,
      totalWorkers: activeWorkers + inactiveWorkers,
      totalClients: activeClients + inactiveClients,
      activeWorkers,
      inactiveWorkers,
      activeClients,
      inactiveClients,
      activeUsersList,
      inactiveUsersList,
      allUsersList
    };
  }, [users, jobs]);

  const feedbackStats = useMemo(() => {
    const total = feedbacks.length;
    const usageCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};
    const improvementCounts: Record<string, number> = {};
    const returnCounts: Record<string, number> = {};

    feedbacks.forEach(f => {
      if (f.usageType) usageCounts[f.usageType] = (usageCounts[f.usageType] || 0) + 1;
      if (f.reason) reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1;
      if (f.improvements) improvementCounts[f.improvements] = (improvementCounts[f.improvements] || 0) + 1;
      if (f.returnLikelihood) returnCounts[f.returnLikelihood] = (returnCounts[f.returnLikelihood] || 0) + 1;
    });

    return {
      total,
      usageCounts,
      reasonCounts,
      improvementCounts,
      returnCounts
    };
  }, [feedbacks]);

  const getJobDate = (job: any) => {
    const raw = job.completedAt || job.createdAt;
    if (!raw) return null;
    if (typeof raw.toDate === 'function') {
      return raw.toDate();
    }
    if (raw instanceof Date) {
      return raw;
    }
    if (raw.seconds) {
      return new Date(raw.seconds * 1000);
    }
    return new Date(raw);
  };

  const getEmpty6Months = () => {
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      return {
        monthKey: `${year}-${monthStr}`,
        monthName: `${monthNames[monthIndex]}/${String(year).slice(-2)}`,
        jobsCount: 0,
        financialVolume: 0
      };
    }).reverse();
  };

  const realChartData = useMemo(() => {
    const months = getEmpty6Months();
    const completed = jobs.filter(j => {
      const matchesStatus = j.status === 'CONCLUIDO';
      const matchesCategory = selectedCategory === 'Todos' || j.category === selectedCategory;
      return matchesStatus && matchesCategory;
    });

    completed.forEach(j => {
      const date = getJobDate(j);
      if (!date) return;
      const year = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${monthStr}`;

      const found = months.find(m => m.monthKey === key);
      if (found) {
        found.jobsCount += 1;
        found.financialVolume += Number(j.amount || 0);
      }
    });

    return months;
  }, [jobs, selectedCategory]);

  const activeData = realChartData;

  const stats = useMemo(() => {
    const completed = jobs.filter(j => {
      const matchesStatus = j.status === 'CONCLUIDO';
      const matchesCategory = selectedCategory === 'Todos' || j.category === selectedCategory;
      return matchesStatus && matchesCategory;
    });
    const totalJobs = completed.length;
    const totalVolume = completed.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const avgValue = totalJobs > 0 ? Math.round(totalVolume / totalJobs) : 0;
    
    const activeJobsCount = jobs.filter(j => j.status !== 'CONCLUIDO' && j.status !== 'CANCELADO').length;
    const panicCount = jobs.filter(j => j.panicAlert).length;

    return {
      totalJobs,
      totalVolume,
      avgValue,
      activeJobsCount,
      panicCount
    };
  }, [jobs, selectedCategory]);

  // --- MONTHLY SUMMARY & PDF EXPORT STATE & COMPUTATIONS ---
  const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const availableMonths = useMemo(() => {
    const monthsMap: Record<string, { key: string; label: string; count: number }> = {};
    const now = new Date();

    // Generate past 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthsMap[key] = {
        key,
        label: `${MONTH_NAMES_PT[m]} de ${y}`,
        count: 0
      };
    }

    // Tally completed jobs into months
    jobs.forEach(j => {
      if (j.status === 'CONCLUIDO') {
        const d = getJobDate(j);
        if (d) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          if (!monthsMap[key]) {
            monthsMap[key] = {
              key,
              label: `${MONTH_NAMES_PT[m]} de ${y}`,
              count: 0
            };
          }
          monthsMap[key].count += 1;
        }
      }
    });

    return Object.values(monthsMap).sort((a, b) => b.key.localeCompare(a.key));
  }, [jobs]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'kpi' | 'categories' | 'jobs'>('kpi');

  const monthlyCompletedJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.status !== 'CONCLUIDO') return false;
      const d = getJobDate(j);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [jobs, selectedMonth]);

  const monthlyStats = useMemo(() => {
    const count = monthlyCompletedJobs.length;
    const totalVolume = monthlyCompletedJobs.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalCommissions = Math.round(totalVolume * 0.10);
    const workerPayouts = totalVolume - totalCommissions;
    const avgTicket = count > 0 ? Math.round(totalVolume / count) : 0;

    const catMap: Record<string, { count: number; volume: number; commission: number }> = {};
    monthlyCompletedJobs.forEach(j => {
      const cat = j.category || 'Geral';
      const amt = Number(j.amount || 0);
      const comm = Math.round(amt * 0.10);
      if (!catMap[cat]) {
        catMap[cat] = { count: 0, volume: 0, commission: 0 };
      }
      catMap[cat].count += 1;
      catMap[cat].volume += amt;
      catMap[cat].commission += comm;
    });

    const categoriesBreakdown = Object.entries(catMap).map(([category, val]) => ({
      category,
      ...val
    })).sort((a, b) => b.volume - a.volume);

    return {
      count,
      totalVolume,
      totalCommissions,
      workerPayouts,
      avgTicket,
      categoriesBreakdown
    };
  }, [monthlyCompletedJobs]);

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const currentMonthMeta = availableMonths.find(m => m.key === selectedMonth);
      const monthLabel = currentMonthMeta?.label || selectedMonth;

      const now = new Date();
      const issuedAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const jobsList = monthlyCompletedJobs.map(j => {
        const d = getJobDate(j);
        const dateStr = d 
          ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
          : '--/--/----';
        const amt = Number(j.amount || 0);
        return {
          id: j.id,
          title: j.title || `Biscate #${j.id.slice(0, 6)}`,
          category: j.category || 'Geral',
          amount: amt,
          commission: Math.round(amt * 0.10),
          dateStr,
          status: j.status
        };
      });

      generateMonthlyPdfReport({
        monthKey: selectedMonth,
        monthLabel,
        totalVolume: monthlyStats.totalVolume,
        jobsCount: monthlyStats.count,
        commissionsCollected: monthlyStats.totalCommissions,
        workerPayouts: monthlyStats.workerPayouts,
        avgTicket: monthlyStats.avgTicket,
        categoriesBreakdown: monthlyStats.categoriesBreakdown,
        jobsList,
        issuedAt
      });

      setExportSuccessMsg(`${t.pdfExportSuccess || "Resumo mensal em formato PDF exportado com sucesso!"} (${monthLabel})`);
      setTimeout(() => setExportSuccessMsg(null), 7000);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const categories = [
    { id: 'Todos', label: t.all || 'Todos' },
    { id: 'Electricista', label: t.catElectricista || 'Electricista' },
    { id: 'Canalizador', label: t.catCanalizador || 'Canalizador' },
    { id: 'Mecânico', label: t.catMecanico || 'Mecânico' },
    { id: 'Pedreiro', label: t.catPedreiro || 'Pedreiro' },
    { id: 'Limpeza', label: t.catLimpeza || 'Limpeza' },
    { id: 'Motorista', label: t.catMotorista || 'Motorista' },
    { id: 'Diarista', label: t.catDiarista || 'Diarista' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* SEÇÃO: RESUMO MENSAL DA PLATAFORMA & EXPORTAÇÃO EM PDF */}
      <div className="bg-white p-6 sm:p-7 rounded-[2.5rem] border-2 border-natural-line shadow-premium space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-natural-accent/10 text-natural-accent">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-natural-heading text-lg tracking-tight">
                  {t.monthlySummaryTitle || "Resumo Executivo Mensal & Relatório PDF"}
                </h3>
                <p className="text-[11px] text-natural-muted font-bold">
                  {t.monthlySummarySub || "Exporte o relatório financeiro consolidado em formato PDF com os ganhos totais da plataforma, número de biscates e comissões arrecadadas."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-natural-surface border border-natural-line px-3 py-2 rounded-2xl w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-natural-muted shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-black text-natural-heading outline-none cursor-pointer w-full"
              >
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.count} {m.count === 1 ? 'biscate' : 'biscates'})
                  </option>
                ))}
              </select>
            </div>

            {/* Export PDF Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-natural-accent hover:bg-natural-accent/90 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.generatingPdf || "A Gerar PDF..."}</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>{t.exportMonthlySummary || "Exportar Resumo PDF"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert if exported */}
        {exportSuccessMsg && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-natural-success/10 border border-natural-success/20 text-natural-success animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-black">{exportSuccessMsg}</span>
            </div>
            <button onClick={() => setExportSuccessMsg(null)} className="text-xs font-black opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* 3 Core Highlight KPI Cards requested: Ganhos Totais, Número de Biscates, Comissões Arrecadadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Ganhos Totais da Plataforma */}
          <div className="bg-natural-surface/50 border-2 border-natural-line rounded-2xl p-4.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-natural-success/5 rounded-full flex items-center justify-center text-natural-success">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-natural-muted mb-1 flex items-center justify-between">
                <span>{t.platformTotalEarnings || "Ganhos Totais da Plataforma"}</span>
                <span className="text-[10px] text-natural-success font-bold">Volume Bruto</span>
              </p>
              <h4 className="font-black text-2xl text-natural-success tracking-tight">
                {monthlyStats.totalVolume.toLocaleString('pt-MZ')} <span className="text-xs font-bold text-natural-muted">MT</span>
              </h4>
            </div>
            <p className="text-[10px] font-bold text-natural-muted mt-2">
              Total financeiro dos serviços no período selecionado
            </p>
          </div>

          {/* 2. Número de Biscates */}
          <div className="bg-natural-surface/50 border-2 border-natural-line rounded-2xl p-4.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-blue-500/5 rounded-full flex items-center justify-center text-blue-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-natural-muted mb-1 flex items-center justify-between">
                <span>{t.totalBiscatesCount || "Número de Biscates"}</span>
                <span className="text-[10px] text-blue-600 font-bold">Concluídos</span>
              </p>
              <h4 className="font-black text-2xl text-natural-heading tracking-tight">
                {monthlyStats.count} <span className="text-xs font-bold text-natural-muted">serviços</span>
              </h4>
            </div>
            <p className="text-[10px] font-bold text-natural-muted mt-2">
              Trabalhos confirmados pelo cliente neste mês
            </p>
          </div>

          {/* 3. Comissões Arrecadadas */}
          <div className="bg-orange-50/60 border-2 border-orange-200/80 rounded-2xl p-4.5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-natural-accent/10 rounded-full flex items-center justify-center text-natural-accent">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-natural-accent mb-1 flex items-center justify-between">
                <span>{t.commissionsCollected || "Comissões Arrecadadas"}</span>
                <span className="px-2 py-0.5 rounded-full bg-natural-accent text-white text-[9px] font-black">10%</span>
              </p>
              <h4 className="font-black text-2xl text-natural-accent tracking-tight">
                {monthlyStats.totalCommissions.toLocaleString('pt-MZ')} <span className="text-xs font-bold">MT</span>
              </h4>
            </div>
            <p className="text-[10px] font-bold text-natural-muted mt-2">
              Receita retida pela taxa da MozBiscates
            </p>
          </div>
        </div>

        {/* Secondary Financial Information Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-natural-surface border border-natural-line text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-natural-success"></span>
            <span className="text-natural-muted font-bold">
              {t.workerNetPayouts || "Repasse Líquido aos Trabalhadores (90%)"}:
            </span>
            <span className="font-black text-natural-success font-mono">
              {monthlyStats.workerPayouts.toLocaleString('pt-MZ')} MT
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-natural-muted font-bold">Ticket Médio por Biscate:</span>
            <span className="font-black text-natural-heading font-mono">
              {monthlyStats.avgTicket.toLocaleString('pt-MZ')} MT
            </span>
          </div>
        </div>

        {/* Tabs for Preview: Overview, Categories Breakdown, Individual Jobs List */}
        <div className="pt-2 border-t border-natural-line/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewTab('kpi')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                  previewTab === 'kpi'
                    ? 'bg-natural-heading text-white shadow-sm'
                    : 'bg-natural-surface text-natural-muted hover:text-natural-heading'
                }`}
              >
                Resumo Geral
              </button>
              <button
                onClick={() => setPreviewTab('categories')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                  previewTab === 'categories'
                    ? 'bg-natural-heading text-white shadow-sm'
                    : 'bg-natural-surface text-natural-muted hover:text-natural-heading'
                }`}
              >
                Por Especialidade ({monthlyStats.categoriesBreakdown.length})
              </button>
              <button
                onClick={() => setPreviewTab('jobs')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                  previewTab === 'jobs'
                    ? 'bg-natural-heading text-white shadow-sm'
                    : 'bg-natural-surface text-natural-muted hover:text-natural-heading'
                }`}
              >
                Lista de Biscates ({monthlyStats.count})
              </button>
            </div>

            <p className="text-[10px] font-bold text-natural-muted hidden sm:block">
              {availableMonths.find(m => m.key === selectedMonth)?.label}
            </p>
          </div>

          {previewTab === 'categories' && (
            <div className="border border-natural-line rounded-2xl overflow-hidden">
              {monthlyStats.categoriesBreakdown.length === 0 ? (
                <div className="p-6 text-center text-natural-muted text-xs font-bold">
                  {t.noJobsInMonth || "Nenhum biscate concluído registado neste mês."}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-natural-surface border-b border-natural-line text-[9px] font-black text-natural-muted uppercase">
                      <th className="p-3">Categoria</th>
                      <th className="p-3 text-center">Biscates</th>
                      <th className="p-3 text-right">Volume (MT)</th>
                      <th className="p-3 text-right">Comissão 10% (MT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-natural-line/60">
                    {monthlyStats.categoriesBreakdown.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-natural-surface/40">
                        <td className="p-3 font-black text-natural-heading">{cat.category}</td>
                        <td className="p-3 text-center font-bold text-natural-muted">{cat.count}</td>
                        <td className="p-3 text-right font-mono font-bold text-natural-heading">{cat.volume.toLocaleString('pt-MZ')} MT</td>
                        <td className="p-3 text-right font-mono font-black text-natural-accent">{cat.commission.toLocaleString('pt-MZ')} MT</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {previewTab === 'jobs' && (
            <div className="border border-natural-line rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              {monthlyCompletedJobs.length === 0 ? (
                <div className="p-6 text-center text-natural-muted text-xs font-bold">
                  {t.noJobsInMonth || "Nenhum biscate concluído registado neste mês."}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-natural-surface border-b border-natural-line text-[9px] font-black text-natural-muted uppercase sticky top-0">
                      <th className="p-3">Título / Serviço</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Data</th>
                      <th className="p-3 text-right">Valor (MT)</th>
                      <th className="p-3 text-right">Comissão 10%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-natural-line/60">
                    {monthlyCompletedJobs.map((j) => {
                      const d = getJobDate(j);
                      const amt = Number(j.amount || 0);
                      const comm = Math.round(amt * 0.10);
                      return (
                        <tr key={j.id} className="hover:bg-natural-surface/40">
                          <td className="p-3 font-black text-natural-heading">
                            {j.title || `Biscate #${j.id.slice(0, 6)}`}
                          </td>
                          <td className="p-3 text-natural-muted font-bold">{j.category}</td>
                          <td className="p-3 text-natural-muted font-mono text-[11px]">
                            {d ? d.toLocaleDateString('pt-MZ') : '--/--/----'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-natural-heading">
                            {amt.toLocaleString('pt-MZ')} MT
                          </td>
                          <td className="p-3 text-right font-mono font-black text-natural-accent">
                            {comm.toLocaleString('pt-MZ')} MT
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {previewTab === 'kpi' && (
            <div className="p-4 rounded-2xl bg-natural-surface/60 border border-natural-line text-xs space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-natural-muted font-bold">
                  O ficheiro PDF gerado incluirá cabeçalho oficial MozBiscates, discriminativo de todas as transações, desempenho detalhado por especialidade e validação fiscal.
                </span>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-4 py-1.5 rounded-xl bg-natural-accent text-white font-black text-[10px] uppercase tracking-wider shrink-0 hover:bg-natural-accent/90"
                >
                  Descarregar PDF do Mês
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-[2.5rem] border-2 border-natural-line shadow-premium space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-black text-natural-heading text-lg tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-natural-accent" /> Painel de Analytics Geral
            </h3>
            <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mt-0.5">
              Métricas reais de desempenho da plataforma
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-natural-surface">
          <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest mb-2">Filtrar Gráficos por Especialidade</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase border transition-all shrink-0 ${
                  selectedCategory === cat.id 
                    ? 'bg-natural-accent border-natural-accent text-white shadow-md' 
                    : 'bg-white border-natural-line text-natural-muted hover:border-natural-accent/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: MÉTRICAS DE COMUNIDADE, ACTIVOS & INACTIVOS (90 DIAS / 3 MESES) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-black text-natural-heading text-lg tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-natural-accent" /> Comunidade & Retenção de Utilizadores
            </h3>
            <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mt-0.5">
              Métricas de utilizadores activos e inactivos (prazo de 90 dias / 3 meses)
            </p>
          </div>
          {onPreviewInactivityModal && (
            <button
              onClick={onPreviewInactivityModal}
              className="px-4 py-2 rounded-2xl bg-emerald-50 border-2 border-natural-accent/30 text-natural-accent font-black text-xs uppercase tracking-wider hover:bg-natural-accent hover:text-white transition-all flex items-center gap-2 shadow-sm"
            >
              <MessageSquareHeart className="w-4 h-4" />
              <span>Testar Formulário "Queremos melhorar! 💙"</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Pessoas */}
          <button
            type="button"
            onClick={() => setRetentionSubTab('all')}
            className={`p-5 rounded-[2rem] border-2 shadow-premium flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer ${
              retentionSubTab === 'all'
                ? 'bg-natural-surface/60 border-natural-heading ring-2 ring-natural-heading/20'
                : 'bg-white border-natural-line hover:border-natural-heading/40'
            }`}
          >
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-natural-accent/10 rounded-full flex items-center justify-center text-natural-accent group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Total de Pessoas</p>
              <h4 className="font-black text-2xl text-natural-heading tracking-tighter">
                {userStats.totalUsers}
              </h4>
            </div>
            <p className="text-[8px] text-natural-muted font-bold uppercase mt-3">
              {userStats.totalClients} Clientes • {userStats.totalWorkers} Biscateiros
            </p>
          </button>

          {/* Card 2: Activos (90 dias) */}
          <button
            type="button"
            onClick={() => setRetentionSubTab('actives')}
            className={`p-5 rounded-[2rem] border-2 shadow-premium flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer ${
              retentionSubTab === 'actives'
                ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/30'
                : 'bg-white border-natural-line hover:border-emerald-500/50'
            }`}
          >
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[8px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Activos (&le; 90 dias)</p>
              <h4 className="font-black text-2xl text-emerald-700 tracking-tighter">
                {userStats.activeUsers} <span className="text-xs font-bold text-natural-muted">({userStats.activePercent}%)</span>
              </h4>
            </div>
            <p className="text-[8px] text-emerald-700 font-bold uppercase mt-3">
              Com actividade nos últimos 3 meses
            </p>
          </button>

          {/* Card 3: Inactivos (+90 dias) */}
          <button
            type="button"
            onClick={() => setRetentionSubTab('inactives')}
            className={`p-5 rounded-[2rem] border-2 shadow-premium flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer ${
              retentionSubTab === 'inactives'
                ? 'bg-amber-50/70 border-amber-600 ring-2 ring-amber-500/30'
                : 'bg-white border-natural-line hover:border-amber-500/50'
            }`}
          >
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">Inactivos (&gt; 90 dias)</p>
              <h4 className="font-black text-2xl text-amber-700 tracking-tighter">
                {userStats.inactiveUsers} <span className="text-xs font-bold text-natural-muted">({userStats.inactivePercent}%)</span>
              </h4>
            </div>
            <p className="text-[8px] text-amber-700 font-bold uppercase mt-3">
              Sem actividade há mais de 3 meses
            </p>
          </button>

          {/* Card 4: Feedbacks Recebidos */}
          <button
            type="button"
            onClick={() => setRetentionSubTab('feedbacks')}
            className={`p-5 rounded-[2rem] border-2 shadow-premium flex flex-col justify-between relative overflow-hidden group text-left transition-all cursor-pointer ${
              retentionSubTab === 'feedbacks'
                ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/30'
                : 'bg-white border-natural-line hover:border-blue-500/50'
            }`}
          >
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <MessageSquareHeart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[8px] font-black text-blue-700 uppercase tracking-widest leading-none mb-1">Pesquisas Recebidas</p>
              <h4 className="font-black text-2xl text-blue-700 tracking-tighter">
                {feedbackStats.total}
              </h4>
            </div>
            <p className="text-[8px] text-blue-700 font-bold uppercase mt-3">
              Respostas "Queremos melhorar! 💙"
            </p>
          </button>
        </div>

        {/* Painel Interativo de Retenção & Inactividade */}
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-natural-line shadow-premium space-y-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-natural-surface pb-4">
            <div>
              <h4 className="font-black text-natural-heading text-base flex items-center gap-2">
                <MessageSquareHeart className="w-5 h-5 text-natural-accent" /> Gestão de Comunidade, Activos & Retenção
              </h4>
              <p className="text-[10px] text-natural-muted font-bold mt-0.5">
                Controlo em tempo real de utilizadores activos (&le;90 dias) e inactivos (&gt;90 dias / 3 meses)
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 bg-natural-surface p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setRetentionSubTab('actives')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                  retentionSubTab === 'actives' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-natural-muted hover:text-emerald-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Activos ({userStats.activeUsers})
              </button>
              <button
                type="button"
                onClick={() => setRetentionSubTab('inactives')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                  retentionSubTab === 'inactives' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-natural-muted hover:text-amber-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Inactivos ({userStats.inactiveUsers})
              </button>
              <button
                type="button"
                onClick={() => setRetentionSubTab('all')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  retentionSubTab === 'all' 
                    ? 'bg-natural-heading text-white shadow-sm' 
                    : 'text-natural-muted hover:text-natural-heading'
                }`}
              >
                Todos ({userStats.totalUsers})
              </button>
              <button
                type="button"
                onClick={() => setRetentionSubTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  retentionSubTab === 'overview' 
                    ? 'bg-natural-heading text-white shadow-sm' 
                    : 'text-natural-muted hover:text-natural-heading'
                }`}
              >
                Motivos & Análise
              </button>
              <button
                type="button"
                onClick={() => setRetentionSubTab('feedbacks')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  retentionSubTab === 'feedbacks' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-natural-muted hover:text-blue-700'
                }`}
              >
                Respostas ({feedbackStats.total})
              </button>
            </div>
          </div>

          {retentionSubTab === 'overview' && (
            <div className="space-y-6 text-left">
              {/* Barra de Retenção Geral */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-natural-heading">Taxa de Actividade da Plataforma (90 dias)</span>
                  <span className="text-emerald-700">{userStats.activePercent}% Activos ({userStats.activeUsers} de {userStats.totalUsers})</span>
                </div>
                <div className="w-full h-3 bg-natural-surface rounded-full overflow-hidden flex">
                  <div style={{ width: `${userStats.activePercent}%` }} className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" />
                  <div style={{ width: `${userStats.inactivePercent}%` }} className="h-full bg-amber-400 rounded-r-full transition-all duration-500" />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-natural-muted uppercase tracking-wider">
                  <span>Activos (&le;90 dias): {userStats.activeUsers}</span>
                  <span className="text-amber-700">Inactivos (&gt;90 dias): {userStats.inactiveUsers} ({userStats.inactivePercent}%)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* 2. Porque deixaste de utilizar? */}
                <div className="p-4 bg-natural-surface/40 rounded-2xl border border-natural-line space-y-3">
                  <h5 className="text-xs font-black text-natural-heading uppercase tracking-wide">
                    2. Principais Motivos de Inactividade
                  </h5>
                  {Object.keys(feedbackStats.reasonCounts).length === 0 ? (
                    <p className="text-xs text-natural-muted font-medium py-4 text-center">
                      Ainda não foram submetidas respostas suficientes.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {Object.entries(feedbackStats.reasonCounts).map(([reason, count]) => {
                        const pct = Math.round((Number(count) / (feedbackStats.total || 1)) * 100);
                        return (
                          <div key={reason} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-natural-heading">
                              <span className="truncate pr-2">{reason}</span>
                              <span className="text-natural-accent shrink-0 font-mono">{String(count)} ({pct}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%` }} className="h-full bg-natural-accent rounded-full" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. O que devemos melhorar? */}
                <div className="p-4 bg-natural-surface/40 rounded-2xl border border-natural-line space-y-3">
                  <h5 className="text-xs font-black text-natural-heading uppercase tracking-wide">
                    3. Áreas de Melhoria Mais Solicitadas
                  </h5>
                  {Object.keys(feedbackStats.improvementCounts).length === 0 ? (
                    <p className="text-xs text-natural-muted font-medium py-4 text-center">
                      Aguardando submissões dos utilizadores.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {Object.entries(feedbackStats.improvementCounts).map(([improvement, count]) => {
                        const pct = Math.round((Number(count) / (feedbackStats.total || 1)) * 100);
                        return (
                          <div key={improvement} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-natural-heading">
                              <span className="truncate pr-2">{improvement}</span>
                              <span className="text-blue-600 shrink-0 font-mono">{String(count)} ({pct}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%` }} className="h-full bg-blue-500 rounded-full" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Voltarias a utilizar? */}
              <div className="p-4 bg-natural-surface/40 rounded-2xl border border-natural-line space-y-3">
                <h5 className="text-xs font-black text-natural-heading uppercase tracking-wide">
                  4. Propensão de Regresso dos Inactivos ("Voltarias a utilizar o Mozbiscates?")
                </h5>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Sim</p>
                    <h6 className="text-lg font-black text-emerald-700">
                      {feedbackStats.returnCounts['Sim.'] || 0}
                    </h6>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 text-center">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">Talvez com melhorias</p>
                    <h6 className="text-lg font-black text-amber-700">
                      {feedbackStats.returnCounts['Talvez, se houver melhorias.'] || 0}
                    </h6>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-red-200 text-center">
                    <p className="text-[10px] font-bold text-red-600 uppercase">Não</p>
                    <h6 className="text-lg font-black text-red-600">
                      {feedbackStats.returnCounts['Não.'] || 0}
                    </h6>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABELA DE UTILIZADORES: ACTIVOS, INACTIVOS OU TODOS */}
          {['actives', 'inactives', 'all'].includes(retentionSubTab) && (() => {
            const currentList = retentionSubTab === 'actives' 
              ? userStats.activeUsersList 
              : retentionSubTab === 'inactives' 
                ? userStats.inactiveUsersList 
                : userStats.allUsersList;

            // Filtro por papel (worker, client, all)
            const roleFiltered = currentList.filter(u => {
              if (userRoleFilter === 'worker') return u.role === 'worker';
              if (userRoleFilter === 'client') return u.role === 'client';
              return true;
            });

            // Filtro por termo de pesquisa
            const filteredUsers = roleFiltered.filter(u => {
              if (!userSearchTerm.trim()) return true;
              const term = userSearchTerm.toLowerCase();
              const name = (u.fullName || u.name || '').toLowerCase();
              const email = (u.email || '').toLowerCase();
              const phone = (u.phone || '').toLowerCase();
              const category = (u.category || '').toLowerCase();
              const loc = (u.bairro || u.district || u.city || '').toLowerCase();
              return name.includes(term) || email.includes(term) || phone.includes(term) || category.includes(term) || loc.includes(term);
            });

            return (
              <div className="space-y-4 text-left">
                {/* Barra de Pesquisa e Filtros */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-natural-surface/40 p-3 rounded-2xl border border-natural-line">
                  {/* Campo de Busca */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-natural-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder={`Pesquisar ${retentionSubTab === 'actives' ? 'activos' : retentionSubTab === 'inactives' ? 'inactivos' : 'utilizadores'} por nome, email, telefone...`}
                      className="w-full bg-white pl-10 pr-8 py-2 rounded-xl text-xs border border-natural-line focus:outline-none focus:border-natural-accent font-medium text-natural-heading placeholder:text-natural-muted/70"
                    />
                    {userSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setUserSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-natural-muted hover:text-natural-heading text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtro de Papel */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUserRoleFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        userRoleFilter === 'all' 
                          ? 'bg-natural-heading text-white shadow-sm' 
                          : 'bg-white border border-natural-line text-natural-muted hover:text-natural-heading'
                      }`}
                    >
                      Todos ({currentList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRoleFilter('worker')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        userRoleFilter === 'worker' 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-white border border-natural-line text-natural-muted hover:text-orange-600'
                      }`}
                    >
                      Biscateiros ({currentList.filter(u => u.role === 'worker').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRoleFilter('client')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        userRoleFilter === 'client' 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-white border border-natural-line text-natural-muted hover:text-blue-700'
                      }`}
                    >
                      Clientes ({currentList.filter(u => u.role === 'client').length})
                    </button>
                  </div>
                </div>

                {/* Banner Contextual do Estado */}
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between ${
                  retentionSubTab === 'actives' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : retentionSubTab === 'inactives' 
                      ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                      : 'bg-natural-surface text-natural-heading border border-natural-line'
                }`}>
                  <div className="flex items-center gap-2">
                    {retentionSubTab === 'actives' && <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {retentionSubTab === 'inactives' && <UserX className="w-4 h-4 text-amber-600 shrink-0" />}
                    {retentionSubTab === 'all' && <Users className="w-4 h-4 text-natural-heading shrink-0" />}
                    <span>
                      {retentionSubTab === 'actives' && '🟢 Utilizadores Activos: registo, trabalho ou presença recente nos últimos 90 dias (3 meses).'}
                      {retentionSubTab === 'inactives' && '⚠️ Utilizadores Inactivos: sem actividade há mais de 90 dias (elegíveis para pesquisa de retenção).'}
                      {retentionSubTab === 'all' && '👥 Todos os Utilizadores: visão global de biscateiros e clientes da plataforma.'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black shrink-0 ml-2">
                    {filteredUsers.length} de {currentList.length}
                  </span>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center bg-natural-surface/30 rounded-2xl text-xs font-bold text-natural-muted space-y-1">
                    <p className="text-natural-heading font-black">Nenhum utilizador encontrado com os filtros actuais.</p>
                    <p className="text-[10px]">Tenta alterar os termos de pesquisa ou selecionar outro filtro de papel.</p>
                  </div>
                ) : (
                  <div className="border border-natural-line rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-natural-surface border-b border-natural-line text-[9px] font-black text-natural-muted uppercase">
                          <th className="p-3">Utilizador</th>
                          <th className="p-3">Papel / Categoria</th>
                          <th className="p-3">Estado & Actividade</th>
                          <th className="p-3">Contacto / WhatsApp</th>
                          <th className="p-3">Biscates / Saldo</th>
                          <th className="p-3">Última Actividade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-natural-line/60 bg-white">
                        {filteredUsers.slice(0, 100).map((u) => {
                          const waPhone = (u.phone || '').replace(/\D/g, '');
                          const waNum = waPhone ? (waPhone.startsWith('258') ? waPhone : `258${waPhone}`) : null;
                          const waMessage = encodeURIComponent(
                            u.isActive 
                              ? `Olá ${u.fullName || ''}! Tudo bem? Contactamos a partir da equipa Mozbiscates.` 
                              : `Olá ${u.fullName || ''}! Notámos que não tem utilizado o Mozbiscates recentemente. Como podemos ajudar?`
                          );

                          return (
                            <tr key={u.id || u.uid} className="hover:bg-natural-surface/30 transition-colors">
                              <td className="p-3 font-bold text-natural-heading">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                    u.isActive 
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}>
                                    {(u.fullName || u.email || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="leading-tight truncate max-w-[140px] font-black">{u.fullName || 'Sem nome'}</p>
                                      {u.verified && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-natural-accent shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-natural-muted font-normal truncate max-w-[160px]">
                                      {u.email || (u.id || u.uid || '').slice(0, 12)}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                <div className="space-y-0.5">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    u.role === 'worker' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {u.role === 'worker' ? 'Biscateiro' : 'Cliente'}
                                  </span>
                                  {u.category && (
                                    <p className="text-[10px] font-bold text-natural-muted truncate max-w-[120px]">
                                      {u.category}
                                    </p>
                                  )}
                                </div>
                              </td>

                              <td className="p-3">
                                {u.isActive ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>
                                      Activo {u.daysInactive === 0 ? '(Hoje)' : u.daysInactive === 1 ? '(Ontem)' : `(há ${u.daysInactive}d)`}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>Inactivo (+{u.daysInactive}d)</span>
                                  </div>
                                )}
                              </td>

                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-natural-muted text-[11px]">
                                    {u.phone || 'Sem telefone'}
                                  </span>
                                  {waNum && (
                                    <a
                                      href={`https://wa.me/${waNum}?text=${waMessage}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-colors"
                                      title="Enviar mensagem WhatsApp"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </td>

                              <td className="p-3">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-natural-heading text-[11px]">
                                    {u.totalJobs || 0} {u.totalJobs === 1 ? 'biscate' : 'biscates'}
                                  </p>
                                  {u.role === 'worker' && u.balance !== undefined && (
                                    <p className="text-[10px] font-mono text-natural-accent font-black">
                                      {Number(u.balance || 0).toLocaleString('pt-MZ')} MT
                                    </p>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 text-natural-muted text-[10px]">
                                <div className="space-y-0.5">
                                  <p className="font-medium">
                                    {u.lastActiveDate ? u.lastActiveDate.toLocaleDateString('pt-MZ') : 'Desconhecida'}
                                  </p>
                                  <p className="text-[9px] text-natural-muted/80">
                                    {u.bairro || u.city || 'Moçambique'}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {retentionSubTab === 'feedbacks' && (
            <div className="space-y-3 text-left">
              {feedbacks.length === 0 ? (
                <div className="p-8 text-center bg-natural-surface/30 rounded-2xl text-xs font-bold text-natural-muted">
                  Nenhum questionário "Queremos melhorar! 💙" submetido até ao momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {feedbacks.map((f) => (
                    <div key={f.id} className="p-4 rounded-2xl border-2 border-natural-line bg-white shadow-sm space-y-3 text-left">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-natural-accent bg-natural-accent/10 px-2 py-0.5 rounded-full">
                            {f.userRole === 'worker' ? 'Biscateiro' : 'Cliente'}
                          </span>
                          <h6 className="font-black text-xs text-natural-heading mt-1">
                            {f.userName || f.userEmail || 'Utilizador'}
                          </h6>
                        </div>
                        <span className="text-[10px] font-mono text-natural-muted">
                          {f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toLocaleDateString('pt-MZ') : 'Recente'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <p><strong className="text-natural-heading">Uso:</strong> <span className="text-natural-muted">{f.usageType}</span></p>
                        <p><strong className="text-natural-heading">Motivo:</strong> <span className="text-amber-700 font-bold">{f.reason}</span></p>
                        <p><strong className="text-natural-heading">Melhoria:</strong> <span className="text-blue-700">{f.improvements}</span></p>
                        <p><strong className="text-natural-heading">Voltaria:</strong> <span className="text-natural-heading font-black">{f.returnLikelihood}</span></p>
                        {f.suggestion && (
                          <div className="mt-2 p-2.5 rounded-xl bg-natural-surface text-[11px] italic text-natural-heading border border-natural-line/60">
                            "{f.suggestion}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border-2 border-natural-line shadow-premium flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-12 h-12 bg-natural-success/5 rounded-full flex items-center justify-center text-natural-success group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Volume Processado</p>
            <h4 className="font-black text-2xl text-natural-success tracking-tighter">
              {stats.totalVolume.toLocaleString('pt-MZ')} <span className="text-xs">MT</span>
            </h4>
          </div>
          <p className="text-[8px] text-natural-muted font-bold uppercase mt-3">Biscates Concluídos</p>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-natural-line shadow-premium flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-12 h-12 bg-natural-accent/5 rounded-full flex items-center justify-center text-natural-accent group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Biscates Concluídos</p>
            <h4 className="font-black text-2xl text-natural-heading tracking-tighter">
              {stats.totalJobs}
            </h4>
          </div>
          <p className="text-[8px] text-natural-muted font-bold uppercase mt-3">Transações de Sucesso</p>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-natural-line shadow-premium flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-12 h-12 bg-blue-500/5 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Ticket Médio</p>
            <h4 className="font-black text-2xl text-natural-heading tracking-tighter">
              {stats.avgValue.toLocaleString('pt-MZ')} <span className="text-xs">MT</span>
            </h4>
          </div>
          <p className="text-[8px] text-natural-muted font-bold uppercase mt-3">Valor Médio por Biscate</p>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-natural-line shadow-premium flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-12 h-12 bg-orange-500/5 rounded-full flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          </div>
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Atividade Corrente</p>
            <h4 className="font-black text-2xl text-natural-heading tracking-tighter">
              {stats.activeJobsCount}
            </h4>
          </div>
          <p className="text-[8px] text-natural-muted font-bold uppercase mt-3">
            {stats.panicCount > 0 ? (
              <span className="text-red-600 font-black animate-pulse">🚨 {stats.panicCount} SOS Alertas</span>
            ) : (
              "Biscates ativos no momento"
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-natural-line shadow-premium space-y-4">
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Volume Financeiro Total</p>
            <h4 className="font-black text-sm text-natural-heading">Volume de Transações Concluídas (MT)</h4>
          </div>

          <div className="h-64 w-full text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1B5E20" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2DE" vertical={false} />
                <XAxis dataKey="monthName" stroke="#847E79" fontSize={9} tickLine={false} />
                <YAxis stroke="#847E79" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip content={<CustomTooltip prefix="" suffix=" MT" />} />
                <Area type="monotone" dataKey="financialVolume" name="Volume Total" stroke="#1B5E20" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-natural-line shadow-premium space-y-4">
          <div>
            <p className="text-[8px] font-black text-natural-muted uppercase tracking-widest leading-none mb-1">Quantidade de Serviços</p>
            <h4 className="font-black text-sm text-natural-heading">Número de Biscates Concluídos</h4>
          </div>

          <div className="h-64 w-full text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2DE" vertical={false} />
                <XAxis dataKey="monthName" stroke="#847E79" fontSize={9} tickLine={false} />
                <YAxis stroke="#847E79" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip prefix="" suffix=" biscates" />} />
                <Bar dataKey="jobsCount" name="Quantidade" fill="#E65100" radius={[10, 10, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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

  // Estados específicos para Recuperação de Palavra-passe Oficial (mozbiscates@gmail.com)
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'code' | 'password' | 'success'>('email');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryData, setRecoveryData] = useState<{
    code: string;
    requestedAt: string;
    ip: string;
    email: string;
    sender: string;
  } | null>(null);
  const [recoveryAttemptsLeft, setRecoveryAttemptsLeft] = useState(3);
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Temporizador de 10 minutos (600s) para o código OTP
  useEffect(() => {
    let interval: any = null;
    if (mode === 'forgot' && recoveryStep === 'code' && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, recoveryStep, secondsRemaining]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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

  // 1. Enviar código de recuperação pela equipa mozbiscates@gmail.com
  const handleSendRecoveryCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!email || !email.includes('@')) {
        setError('Por favor, introduza um e-mail válido.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/send-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar código de autenticação.');
      }

      setRecoveryData({
        code: data.code,
        requestedAt: data.requestedAt,
        ip: data.ip,
        email: data.email,
        sender: data.sender || 'mozbiscates@gmail.com'
      });
      setRecoveryAttemptsLeft(3);
      setSecondsRemaining(600);
      setRecoveryCode('');
      setRecoveryStep('code');
      setMessage('Código de acesso gerado e enviado pela equipa mozbiscates@gmail.com.');
    } catch (err: any) {
      setError(err.message || 'Falha ao solicitar código de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Validar código de recuperação de 6 dígitos
  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (secondsRemaining <= 0) {
      setError('Este código expirou (tempo limite de 10 minutos). Solicite um novo código.');
      return;
    }

    const cleanCode = recoveryCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setError('O código de acesso deve ter exatamente 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.remainingAttempts !== undefined) {
          setRecoveryAttemptsLeft(data.remainingAttempts);
        }
        throw new Error(data.error || 'Código de acesso inválido.');
      }

      setRecoveryStep('password');
      setMessage('Código validado com sucesso! Crie agora a sua nova palavra-passe.');
    } catch (err: any) {
      setError(err.message || 'Erro ao validar código.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Atualizar para a nova palavra-passe
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('A nova palavra-passe deve conter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As palavras-passe não coincidem. Por favor, verifique.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: recoveryCode.replace(/\D/g, ''),
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir a palavra-passe.');
      }

      setRecoveryStep('success');
      setMessage(data.message || 'Palavra-passe alterada com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir palavra-passe.');
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = () => {
    if (!email) return 'Utilizador';
    const namePart = email.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  return (
    <div className="min-h-screen bg-natural-bg flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-500">
      <div className={`w-full ${mode === 'forgot' && recoveryStep === 'code' ? 'max-w-xl' : 'max-w-md'} transition-all`}>
        
        {/* Top Header Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-natural-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-natural-accent/20 text-white mx-auto mb-4 hover:rotate-3 transition-transform">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-natural-heading tracking-tight italic mb-1">
            {mode === 'login' ? (t.login || 'Login') : mode === 'register' ? (t.register || 'Registar') : 'Recuperar Acesso'}
          </h1>
          <p className="text-natural-muted font-bold text-xs tracking-wider uppercase opacity-75">
            {mode === 'forgot' ? 'Canal Oficial: mozbiscates@gmail.com' : 'Mozbiscates PRO'}
          </p>
        </div>

        {/* FEEDBACK MESSAGES */}
        {error && (
          <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-200 animate-in fade-in">
             <AlertCircle className="w-4 h-4 shrink-0 text-red-500" /> {error}
          </div>
        )}

        {message && (
          <div className="mb-4 flex items-center gap-2 p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200 animate-in fade-in">
             <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> {message}
          </div>
        )}

        {/* LOGIN / REGISTER MODE */}
        {mode !== 'forgot' && (
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
              <input 
                type="email" 
                required
                placeholder={t.email}
                className="w-full pl-12 pr-6 py-4 bg-white border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-bold text-sm shadow-sm"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={t.password}
                className="w-full pl-12 pr-12 py-4 bg-white border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-bold text-sm shadow-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-natural-muted hover:text-natural-heading transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? t.login : t.register}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD MODE (mozbiscates@gmail.com) */}
        {mode === 'forgot' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            {/* ETAPA 1: DIGITAR E-MAIL */}
            {recoveryStep === 'email' && (
              <form onSubmit={handleSendRecoveryCode} className="space-y-4 bg-white p-6 rounded-3xl border-2 border-natural-line/80 shadow-premium">
                <div className="flex items-center gap-2.5 p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-[11px] font-bold border border-emerald-200">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>O código será enviado diretamente da nossa equipa oficial <strong>mozbiscates@gmail.com</strong> (sem NoReply).</span>
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
                  <input 
                    type="email" 
                    required
                    placeholder="Introduza o seu e-mail cadastrado"
                    className="w-full pl-12 pr-6 py-4 bg-natural-bg/50 border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-bold text-sm"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Código Oficial (mozbiscates@gmail.com)
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ETAPA 2: EXIBIÇÃO DO E-MAIL (CARD FIEL AO SCREENSHOT) + VALIDAÇÃO DO CÓDIGO */}
            {recoveryStep === 'code' && recoveryData && (
              <div className="space-y-6">
                
                {/* CARTÃO GMAIL EM MODO ESCURO FIEL AO SCREENSHOT DO UTILIZADOR */}
                <div className="bg-[#0c0f12] text-white rounded-3xl p-5 sm:p-7 border border-white/10 shadow-2xl relative overflow-hidden font-sans">
                  
                  {/* Barra Superior estilo Gmail */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5 text-slate-400 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-natural-accent flex items-center justify-center text-white text-[10px] font-black">
                        M
                      </div>
                      <span className="font-bold text-slate-200">Equipa Mozbiscates</span>
                      <span className="text-[10px] text-emerald-400 font-mono">&lt;mozbiscates@gmail.com&gt;</span>
                    </div>
                    <span className="bg-emerald-950/80 text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-700/50">
                      Oficial
                    </span>
                  </div>

                  {/* Saudação e introdução fiel ao Screenshot */}
                  <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                    Olá, {getUserDisplayName()}!
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed mb-5">
                    Um código de autenticação foi solicitado para aceder à sua conta <strong className="text-white">Mozbiscates</strong>:
                  </p>

                  {/* Caixa de detalhes da conta fiel ao Screenshot */}
                  <div className="bg-[#161b22] rounded-2xl p-4 mb-5 text-xs text-slate-300 font-sans space-y-1.5 border border-white/5">
                    <div><strong className="text-white">Conta:</strong> {recoveryData.email}</div>
                    <div><strong className="text-white">Solicitado em:</strong> {recoveryData.requestedAt}</div>
                    <div><strong className="text-white">IP:</strong> {recoveryData.ip}</div>
                  </div>

                  {/* Bloco Central do Código em Verde Neon (Exato ao Screenshot) */}
                  <div className="bg-[#0e2a22] border-2 border-[#00d26a] rounded-2xl p-5 sm:p-6 text-center mb-5 shadow-[0_0_30px_rgba(0,210,106,0.18)]">
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 mb-2">
                      Seu código de acesso:
                    </p>
                    <div className="text-3xl sm:text-4xl font-mono font-black tracking-[0.35em] text-[#00e676] select-all my-2">
                      {recoveryData.code.split('').join(' ')}
                    </div>
                    <p className="text-xs font-semibold text-emerald-300 mt-2">
                      Válido por 10 minutos
                    </p>
                  </div>

                  {/* Bloco de Segurança Amarelo/Dourado Fiel ao Screenshot */}
                  <div className="bg-[#1f1b0c] border border-amber-600/70 rounded-2xl p-4 sm:p-5 text-left text-xs mb-4">
                    <div className="text-amber-400 font-extrabold flex items-center gap-1.5 mb-2.5 text-[13px]">
                      <span>⚠️</span> Segurança:
                    </div>
                    <ul className="space-y-1.5 text-amber-100/90 text-[12px] leading-relaxed pl-1">
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-black">•</span>
                        <span>Este código é válido por apenas <strong>10 minutos</strong></span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-black">•</span>
                        <span>Use-o imediatamente na tela de autenticação</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-black">•</span>
                        <span>Máximo de <strong>3 tentativas</strong> por código (Restam {recoveryAttemptsLeft})</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-black">•</span>
                        <span>Se não foi você, entre em contato imediatamente com mozbiscates@gmail.com</span>
                      </li>
                    </ul>
                  </div>

                  {/* Ação rápida para preencher o código com 1 clique */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                    <span className="text-slate-400 text-[11px]">Enviado pela equipa oficial</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryCode(recoveryData.code);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 rounded-xl font-black text-[11px] transition-all active:scale-95 shadow-sm"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {codeCopied ? 'Código Preenchido!' : 'Inserir Código Abaixo'}
                    </button>
                  </div>
                </div>

                {/* FORMULÁRIO DE CONFIRMAÇÃO DO CÓDIGO */}
                <form onSubmit={handleVerifyRecoveryCode} className="bg-white p-6 rounded-3xl border-2 border-natural-line/80 shadow-premium space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-natural-muted pb-1">
                    <span className="flex items-center gap-1 text-natural-heading">
                      <Clock className="w-4 h-4 text-natural-accent animate-pulse" />
                      Expira em: <span className="font-mono text-natural-accent font-black text-sm">{formatTimer(secondsRemaining)}</span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      recoveryAttemptsLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      Tentativas: {recoveryAttemptsLeft}/3
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-natural-heading mb-2">
                      Código de Autenticação (6 Dígitos)
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
                      <input 
                        type="text" 
                        maxLength={6}
                        required
                        placeholder="Ex: 780640"
                        className="w-full pl-12 pr-6 py-4 bg-natural-bg/50 border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-mono font-black text-center text-2xl tracking-[0.3em] text-natural-heading"
                        value={recoveryCode}
                        onChange={e => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading || secondsRemaining <= 0}
                    className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verificar Código de Acesso'}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep('email')}
                      className="text-[11px] font-bold text-natural-muted hover:text-natural-heading"
                    >
                      Alterar E-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendRecoveryCode()}
                      disabled={loading}
                      className="text-[11px] font-black text-natural-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Reenviar novo código
                    </button>
                  </div>
                </form>

              </div>
            )}

            {/* ETAPA 3: DEFINIR NOVA PALAVRA-PASSE */}
            {recoveryStep === 'password' && (
              <form onSubmit={handleResetPassword} className="bg-white p-6 rounded-3xl border-2 border-natural-line/80 shadow-premium space-y-4">
                <div className="text-center pb-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-natural-heading text-lg">Nova Palavra-passe</h3>
                  <p className="text-xs text-natural-muted font-bold">Defina a nova chave de acesso para a conta {email}</p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Nova Palavra-passe (mín. 6 caracteres)"
                      className="w-full pl-12 pr-12 py-4 bg-natural-bg/50 border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-bold text-sm"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-natural-muted hover:text-natural-heading"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-accent" />
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Confirmar Nova Palavra-passe"
                      className="w-full pl-12 pr-6 py-4 bg-natural-bg/50 border-2 border-natural-line rounded-2xl outline-none focus:border-natural-accent transition-all font-bold text-sm"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Atualizar Palavra-passe'}
                </button>
              </form>
            )}

            {/* ETAPA 4: SUCESSO COMPLETO */}
            {recoveryStep === 'success' && (
              <div className="bg-white p-8 rounded-3xl border-2 border-emerald-200 text-center space-y-5 shadow-premium">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-natural-heading mb-1">Palavra-passe Atualizada!</h3>
                  <p className="text-xs text-natural-muted font-bold leading-relaxed">
                    A sua conta foi protegida e a nova palavra-passe foi guardada com sucesso pela equipa mozbiscates@gmail.com.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRecoveryStep('email');
                    setPassword('');
                  }}
                  className="w-full bg-natural-accent text-white font-black py-4 rounded-2xl shadow-accent-glow hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  Fazer Login Agora
                </button>
              </div>
            )}

          </div>
        )}

        {/* BOTTOM SWITCH BUTTONS */}
        <div className="mt-8 space-y-3 text-center">
          {mode === 'login' ? (
            <>
              <button 
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setRecoveryStep('email');
                  setError('');
                  setMessage('');
                }}
                className="text-[11px] font-black text-natural-accent uppercase tracking-widest block mx-auto underline hover:opacity-80 transition-opacity"
              >
                {t.forgotPassword || 'Esqueceu a palavra-passe?'}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setMessage('');
                }}
                className="text-[11px] font-black text-natural-muted uppercase tracking-widest block mx-auto py-2 hover:text-natural-heading transition-colors"
              >
                {t.dontHaveAccount || 'Não tem conta? Registar'}
              </button>
            </>
          ) : (
            <button 
              type="button"
              onClick={() => {
                setMode('login');
                setRecoveryStep('email');
                setError('');
                setMessage('');
              }}
              className="text-[11px] font-black text-natural-accent uppercase tracking-widest block mx-auto py-2 underline hover:opacity-80 transition-opacity"
            >
              {t.alreadyHaveAccount || 'Já tem conta? Fazer Login'}
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

const WorkerProfileForm = ({ onSave, t }: { onSave: (data: { name: string, category: string, photo: string, biPhoto: string, biSelfie: string, verified: boolean, portfolio: string[], nuit?: string, emergencyContactName?: string, emergencyContactPhone?: string, specialty?: string }) => void, t: any }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electricista Profissional');
  const [nuit, setNuit] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [biPhoto, setBiPhoto] = useState<string | null>(null);
  const [biSelfie, setBiSelfie] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return [];
    const q = specialtySearch.toLowerCase();
    return ALL_SPECIALTIES.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.categoryGroup.toLowerCase().includes(q)
    );
  }, [specialtySearch]);

  const handleCapture = (callback: (res: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      setError(null);
      try {
        const compressed = await compressImage(file, 800, 800, 0.72);
        callback(compressed);
      } catch (err) {
        setError('Erro ao processar imagem. Tente uma foto menor.');
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const addPortfolio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && portfolio.length < 3) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(file, 800, 800, 0.7);
        setPortfolio(prev => [...prev, compressed]);
      } catch (err) {
        setError('Erro ao comprimir foto do portfólio.');
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleFinalize = async () => {
    if (!biPhoto || !biSelfie) return;
    
    setIsValidating(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/verify-identity', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
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
          portfolio,
          nuit: nuit.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          specialty: category
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
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-black text-natural-heading mb-2 tracking-tight italic">
           {(String(t.bePro || '')).split(' ').map((w: string, i: number) => i === 2 ? <span key={i} className="text-natural-accent underline">{w}</span> : <Fragment key={i}>{w} </Fragment>)}
         </h2>
         <p className="text-natural-muted font-bold text-xs leading-tight px-4 opacity-80">{t.securityMax}</p>
      </div>

      <div className="space-y-6 max-w-sm mx-auto">
        {/* Photo Upload */}
        <div className="flex flex-col items-center mb-4">
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

        {/* Dados Básicos */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-natural-muted tracking-[0.25em] ml-2">{t.basicData}</label>
          
          <div className="bg-white border-2 border-natural-line p-4 rounded-2xl flex items-center gap-3 shadow-sm focus-within:border-natural-accent transition-colors">
            <User className="text-natural-accent w-5 h-5 shrink-0" />
            <input 
              type="text" 
              placeholder={t.fullName} 
              className="w-full outline-none font-bold text-sm text-natural-heading bg-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Campo NUIT (Opcional) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center px-2">
              <label className="text-[10px] font-black uppercase text-natural-muted tracking-[0.2em]">NUIT</label>
              <span className="text-[9px] font-bold text-natural-muted italic">Opcional</span>
            </div>
            <div className="bg-white border-2 border-natural-line p-4 rounded-2xl flex items-center gap-3 shadow-sm focus-within:border-natural-accent transition-colors">
              <FileText className="text-natural-accent w-5 h-5 shrink-0" />
              <input 
                type="text" 
                placeholder="Número de NUIT (ex: 123456789)" 
                className="w-full outline-none font-bold text-sm text-natural-heading bg-transparent"
                value={nuit}
                onChange={(e) => setNuit(e.target.value)}
              />
            </div>
            <p className="text-[9px] text-natural-muted px-2">Adicionar o NUIT confere maior credibilidade tributária e profissional a clientes.</p>
          </div>
        </div>

        {/* Seleção e Pesquisa de Especialização */}
        <div className="space-y-3 bg-white border-2 border-natural-line p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase text-natural-muted tracking-[0.2em]">Especialidade / Ofício</label>
            <span className="text-[9px] font-black text-natural-accent bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              {category}
            </span>
          </div>

          {/* Categorias mais frequentadas em destaque */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-natural-muted mb-2 block">
              Mais Frequentadas (Clique para escolher):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                    category === cat 
                      ? 'bg-natural-accent text-white shadow-sm' 
                      : 'bg-natural-surface border border-natural-line text-natural-heading hover:border-natural-accent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pesquisa Dinâmica de Especialidades */}
          <div className="space-y-1.5 pt-2 border-t border-natural-line">
            <span className="text-[9px] font-black uppercase tracking-wider text-natural-muted block">
              Pesquisar Todas as Especialidades:
            </span>
            <div className="bg-natural-surface border border-natural-line p-2.5 rounded-xl flex items-center gap-2 focus-within:border-natural-accent focus-within:bg-white transition-colors">
              <Search className="w-4 h-4 text-natural-muted shrink-0" />
              <input
                type="text"
                placeholder="Ex: Ar Condicionado, Soldador, DStv, Costureiro..."
                value={specialtySearch}
                onChange={(e) => setSpecialtySearch(e.target.value)}
                className="w-full outline-none text-xs font-semibold text-natural-heading bg-transparent"
              />
              {specialtySearch && (
                <button type="button" onClick={() => setSpecialtySearch('')} className="text-natural-muted hover:text-black">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Resultados da Pesquisa */}
            {filteredSpecialties.length > 0 && specialtySearch && (
              <div className="bg-white border border-natural-line rounded-xl max-h-40 overflow-y-auto p-1 shadow-lg space-y-0.5">
                {filteredSpecialties.slice(0, 10).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCategory(item.name);
                      setSpecialtySearch('');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-natural-surface flex items-center justify-between text-natural-heading"
                  >
                    <span>{item.name}</span>
                    <span className="text-[8px] text-natural-muted uppercase font-normal">{item.categoryGroup}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contacto de Confiança para Alarme SOS Anti-Crime */}
        <div className="p-4 bg-red-50/70 border-2 border-red-200 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-red-900">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider">Contacto de Confiança (Alarme Anti-Crime SOS)</span>
          </div>
          <p className="text-[9px] text-red-800 leading-tight">
            Parente ou amigo que receberá sua localização exata caso você acione o botão de emergência durante um serviço.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nome do parente"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-red-200 rounded-xl outline-none"
            />
            <input
              type="tel"
              placeholder="Telefone / WhatsApp"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-red-200 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Verification Section */}
        <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-dashed border-amber-200">
          <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-4 italic flex items-center gap-2">
            <Lock className="w-4 h-4" /> Segurança: Verificação Obrigatória de BI
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
        <div className="bg-white border-2 border-natural-line p-5 rounded-[2rem] shadow-sm">
           <p className="text-[10px] font-black text-natural-muted uppercase tracking-widest mb-3 italic">Portfolio / Trabalhos Anteriores</p>
           <div className="flex gap-3">
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
           <p className="text-[8px] text-natural-muted font-bold mt-2 leading-tight">Adicione até 3 fotos dos seus melhores biscates (otimizadas automaticamente).</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-center border border-red-100">
            ⚠️ {error}
          </div>
        )}

        <button 
          onClick={handleFinalize} 
          disabled={!name || !biPhoto || !biSelfie || isValidating || isCompressing}
          className="w-full bg-natural-accent text-white font-black py-5 rounded-[2rem] shadow-xl shadow-natural-accent/30 text-lg uppercase tracking-widest mt-4 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isValidating || isCompressing ? (
            <>
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <span>{isCompressing ? 'Otimizando Fotos...' : t.validating}</span>
            </>
          ) : (
            t.finalizeReg
          )}
        </button>
      </div>
    </motion.div>
  );
};

const ProviderCard = memo(({ provider, onSelect, userPos }: { provider: Provider, onSelect: (p: Provider) => void, userPos?: [number, number] }) => {
  const travel = useMemo(() => {
    if (!userPos) return null;
    const coords = getProviderCoordinates(provider.id, userPos);
    const dist = calculateHaversineDistanceKm(userPos, coords);
    return estimateTravelTime(dist);
  }, [provider.id, userPos]);

  return (
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
            if (navigator.clipboard) {
              navigator.clipboard.writeText(shareUrl).then(() => {
                alert("Link do perfil copiado para a área de transferência!");
              }).catch(() => {
                alert(`Link do perfil: ${shareUrl}`);
              });
            } else {
              alert(`Link do perfil: ${shareUrl}`);
            }
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
          <p className="text-[10px] font-black text-natural-accent uppercase tracking-[0.15em] mb-2.5">{provider.category}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black bg-natural-surface px-2.5 py-1 rounded-xl"><Star className="w-3.5 h-3.5 text-natural-accent fill-natural-accent" /> {provider.rating}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-natural-muted font-bold uppercase tracking-tight opacity-70"><MapPin className="w-3.5 h-3.5" /> {provider.bairro}</div>
            {travel && (
              <div className="flex items-center gap-1 text-[10px] font-black text-orange-950 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-xl" title="Tempo estimado pelo Haversine">
                <Clock className="w-3 h-3 text-natural-accent shrink-0" />
                <span>{travel.formattedDistance} ({travel.primaryEtaText})</span>
              </div>
            )}
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
  );
});

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
  const [securityData, setSecurityData] = useState<any>(null);
  const combinedUserData = useMemo(() => ({ ...(userData || {}), ...(securityData || {}) }), [userData, securityData]);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'auth' | 'roles' | 'app'>('landing');
  const [role, setRole] = useState<'client' | 'worker' | 'admin' | null>(null);
  const [tab, setTab] = useState<'explore' | 'jobs' | 'help'>('explore');
  const [jobs, setJobs] = useState<Job[]>([]);
  const lastJobCountRef = useRef<number>(0);
  const previousJobStatusesRef = useRef<Record<string, string>>({});
  const hasInitialJobsLoadedRef = useRef<boolean>(false);
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
  const [voiceFallbackOpen, setVoiceFallbackOpen] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [adminView, setAdminView] = useState<'active' | 'history' | 'metrics' | 'alerts'>('active');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [providerReviews, setProviderReviews] = useState<{rating: number, comment: string, date: string}[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([-25.9692, 32.5732]); // Maputo Default
  const [exploreViewMode, setExploreViewMode] = useState<'list' | 'map'>('list');
  const [hasNewJobNotify, setHasNewJobNotify] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeEmergencyJob, setActiveEmergencyJob] = useState<any>(null);
  const [showClientProfileModal, setShowClientProfileModal] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [inactivityFeedbacks, setInactivityFeedbacks] = useState<any[]>([]);

  const t = translations[lang] || translations.pt;
  const isAdminEmail = currentUser?.email === 'fushawshaw@gmail.com' || currentUser?.email === 'wanderj419@gmail.com' || currentUser?.email === 'mozbiscates@gmail.com';
  const categories = useMemo(() => {
    if (!t) return [];
    return STATIC_CATEGORIES(t);
  }, [t]);

  const classifyIssueText = (text: string): string => {
    if (!text) return '';
    const lowerText = text.toLowerCase();
    
    const mapping = [
      { label: t.catElectricista, keywords: ['electricista', 'eletricista', 'fio', 'tomada', 'luz', 'energia', 'curto', 'disjuntor', 'lâmpada', 'lampada', 'choque', 'gerador', 'fiação', 'aparelho'] },
      { label: t.catCanalizador, keywords: ['canalizador', 'torneira', 'cano', 'vazamento', 'água', 'agua', 'infiltração', 'infiltracao', 'esgoto', 'pia', 'bacia', 'chuveiro', 'tubo', 'bomba'] },
      { label: t.catFrio, keywords: ['frio', 'ar condicionado', 'ac', 'climatização', 'climatizacao', 'congelador', 'geleira', 'frigorífico', 'frigorifico', 'refrigeração'] },
      { label: t.catGuarda, keywords: ['guarda', 'segurança', 'seguranca', 'vigilante', 'portaria', 'proteger', 'proteção', 'patrulha'] },
      { label: t.catJardineiro, keywords: ['jardineiro', 'jardim', 'relva', 'grama', 'flores', 'plantas', 'podar', 'árvores', 'arvores', 'quintal'] },
      { label: t.catAlfaiate, keywords: ['alfaiate', 'costureira', 'roupa', 'costura', 'tecido', 'remendo', 'medidas', 'vestido', 'fato', 'costurar'] },
      { label: t.catMarceneiro, keywords: ['marceneiro', 'carpinteiro', 'madeira', 'móvel', 'movel', 'mesa', 'cadeira', 'armário', 'armario', 'porta', 'cama', 'sofá'] },
      { label: t.catMecanico, keywords: ['mecânico', 'mecanico', 'carro', 'motor', 'pneu', 'freio', 'travão', 'travao', 'óleo', 'oleo', 'bateria', 'automóvel'] },
      { label: t.catPintor, keywords: ['pintor', 'pintar', 'parede', 'tinta', 'cor', 'massa', 'rolo', 'pincel'] },
      { label: t.catPedreiro, keywords: ['pedreiro', 'trolha', 'obra', 'cimento', 'tijolo', 'parede', 'reboque', 'construção', 'construcao', 'piso', 'teto', 'azulejo'] },
      { label: t.catLimpeza, keywords: ['limpeza', 'limpar', 'vassoura', 'aspirador', 'pó', 'po', 'arrumação', 'arrumacao', 'lavagem'] },
      { label: t.catMotorista, keywords: ['motorista', 'conduzir', 'viagem', 'transporte', 'uber', 'chapa', 'táxi', 'taxi'] },
      { label: t.catDiarista, keywords: ['diarista', 'casa', 'doméstica', 'domestica', 'engomar', 'lavar', 'arrumar', 'limpeza doméstica'] },
      { label: t.catCozinheiro, keywords: ['cozinheiro', 'cozinheira', 'comida', 'chef', 'refeição', 'refeicao', 'cozinha', 'almoço', 'almoco', 'jantar'] },
      { label: t.catReparacaoTelemoveis, keywords: ['telemóvel', 'telemovel', 'celular', 'ecrã', 'ecra', 'tela', 'reparar telemovel', 'carregador', 'bateria telemovel', 'smartphone'] },
      { label: t.catSuporteTI, keywords: ['computador', 'pc', 'ti', 'informatica', 'informática', 'software', 'vírus', 'virus', 'internet', 'wi-fi', 'wifi', 'impressora'] },
      { label: t.catFotografo, keywords: ['fotógrafo', 'fotografo', 'foto', 'vídeo', 'video', 'câmara', 'camara', 'casamento', 'sessão', 'sessao'] },
      { label: t.catPiscineiro, keywords: ['piscineiro', 'piscina', 'água piscina', 'limpar piscina', 'cloro'] },
      { label: t.catLavaCar, keywords: ['lava', 'lavagem carro', 'car wash', 'aspirar carro', 'limpeza carro'] },
      { label: t.catAntenas, keywords: ['antena', 'tv', 'televisão', 'televisao', 'dstv', 'gotv', 'sinal', 'cabo tv'] }
    ];

    for (const item of mapping) {
      if (item.keywords.some(kw => lowerText.includes(kw))) {
        return item.label;
      }
    }
    return '';
  };

  const recognitionRef = useRef<any>(null);

  const handleVoiceRecord = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Gracefully open the beautiful text-input voice fallback instead of an annoying alert!
      setVoiceFallbackOpen(true);
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      setIsRecording(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = lang === 'en' ? 'en-US' : 'pt-MZ';

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          const matchedCat = classifyIssueText(text);
          if (matchedCat) {
            setCategory(matchedCat);
            alert(`🔍 ${t.categoryMatched || 'Encontrámos um profissional:'} "${matchedCat}"\n\n"${text}"`);
          } else {
            setCategory(text);
            alert(`🔍 ${t.noCategoryMatched || 'Pesquisando por:'} "${text}"`);
          }
        }
      };

      rec.onerror = (err: any) => {
        console.warn("Speech recognition error / blocked inside iframe, launching fallback modal:", err);
        setIsRecording(false);
        // Open the fallback modal immediately so they can describe the issue via text
        setVoiceFallbackOpen(true);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn("Speech recognition exception, launching fallback modal:", e);
      setIsRecording(false);
      setVoiceFallbackOpen(true);
    }
  };

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');

  // --- USSD Client Line Simulator State & Helpers ---
  const [ussdOpen, setUssdOpen] = useState(false);
  const [ussdScreen, setUssdScreen] = useState<'main' | 'how_it_works' | 'rules' | 'sos' | 'balance_check'>('main');
  const [ussdInput, setUssdInput] = useState('');
  const [ussdError, setUssdError] = useState('');
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const getUssdContent = () => {
    if (lang === 'en') {
      if (ussdScreen === 'main') {
        return "Mozbiscates - Customer Support\nSelect an option:\n1. Direct Support (WhatsApp)\n2. How does payment escrow work?\n3. Community Rules & Safety\n4. Request Emergency SOS\n5. My Wallet / Balance";
      }
      if (ussdScreen === 'how_it_works') {
        return "[How it Works]\nFunds remain in escrow. We release them to the worker only when you confirm completion.\n\n9. Back";
      }
      if (ussdScreen === 'rules') {
        return "[Rules & Safety]\n1. Never pay outside the app.\n2. Always check-in/out with photos.\n3. Keep respect mutual.\n\n9. Back";
      }
      if (ussdScreen === 'sos') {
        return "[SOS & Urgent Help]\nSecurity alert sent! Our team will contact you shortly to provide guidance.\n\n9. Back";
      }
      if (ussdScreen === 'balance_check') {
        return `[Wallet & Balance]\nYour current balance: ${balance} MT\nAll funds are safeguarded by Mozbiscates.\n\n9. Back`;
      }
    } else if (lang === 'em') {
      if (ussdScreen === 'main') {
        return "Mozbiscates - Nikhavelo wa Cliente\nThanla nttina:\n1. WhatsApp Line (Moderator)\n2. Exeeni eniopoliwa musurukhu?\n3. Malamulo a Comunidade\n4. SOS wala Nikhavelo vooluluha\n5. Carteira anyu ni musurukhu";
      }
      if (ussdScreen === 'how_it_works') {
        return "[Exiphika ya Garante]\nMusurukhu onnahisireya ni Garante ni onvahiwa namuteko muteko omalihiwa.\n\n9. Othela";
      }
      if (ussdScreen === 'rules') {
        return "[Malamulo a Communidade]\n1. Ohelihe waatepa ohivahiwa musurukhu.\n2. Okahe check-in ni check-out ni foto.\n3. Okhalane nlema.\n\n9. Othela";
      }
      if (ussdScreen === 'sos') {
        return "[SOS vooluluha]\nNikhavelo na SOS nnahasiriwa! Moderator onnowiirelani pashini.\n\n9. Othela";
      }
      if (ussdScreen === 'balance_check') {
        return `[Carteira ni Musurukhu]\nMusurukhu anyu: ${balance} MT\nSinasuwelihiwa mpuwa mwa Mozbiscates.\n\n9. Othela`;
      }
    } else { // 'pt'
      if (ussdScreen === 'main') {
        return "Mozbiscates - Linha do Cliente\nEscolha uma opção:\n1. Linha Directa (WhatsApp)\n2. Como funciona o Garante?\n3. Recomendações e Regras\n4. Solicitar Ajudo / SOS urgente\n5. Consultar Carteira / Saldo";
      }
      if (ussdScreen === 'how_it_works') {
        return "[Como Funciona]\nO dinheiro fica seguro em conta de custódia do Garante e só é liberado ao trabalhador após validação do serviço.\n\n9. Voltar";
      }
      if (ussdScreen === 'rules') {
        return "[Regras e Segurança]\n1. Nunca pague por fora da app.\n2. Faça sempre Check-in e Check-out com fotos.\n3. Trate a todos com respeito.\n\n9. Voltar";
      }
      if (ussdScreen === 'sos') {
        return "[SOS & Apoio Urgente]\nAlerta enviado ao centro de monitoria! O nosso moderador entrará em contacto com apoio imediato.\n\n9. Voltar";
      }
      if (ussdScreen === 'balance_check') {
        return `[Carteira & Saldo]\nO seu saldo actual: ${balance} MT\nTodos os fundos estão protegidos por Mozbiscates.\n\n9. Voltar`;
      }
    }
    return '';
  };

  const handleUssdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUssdError('');
    const choice = ussdInput.trim();
    if (ussdScreen === 'main') {
      if (choice === '1') {
        window.open('https://wa.me/258870324189', '_blank');
        setUssdOpen(false);
      } else if (choice === '2') {
        setUssdScreen('how_it_works');
        setUssdInput('');
      } else if (choice === '3') {
        setUssdScreen('rules');
        setUssdInput('');
      } else if (choice === '4') {
        setUssdScreen('sos');
        setUssdInput('');
        setNotification({
          title: "🚨 SOS activado via *777#",
          body: "O seu sinal de emergência foi enviado ao moderador."
        });
      } else if (choice === '5') {
        setUssdScreen('balance_check');
        setUssdInput('');
      } else {
        setUssdError(lang === 'en' ? 'Invalid option. Select 1-5.' : lang === 'em' ? 'Option ehikhale yoovala.' : 'Opção inválida. Escolha entre 1 e 5.');
      }
    } else {
      if (choice === '9' || choice === '0') {
        setUssdScreen('main');
        setUssdInput('');
      } else {
        setUssdError(lang === 'en' ? "Invalid option. Enter '9' to go back." : lang === 'em' ? "Option ehikhale. Oreva '9' wi othele." : "Opção inválida. Introduza '9' para voltar.");
      }
    }
  };

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
    if (view === 'app') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          },
          (err) => console.warn("Location warning (using default Maputo coords):", err.message),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );

        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
      }
    }
  }, [view]);

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
              if (data.providerId && data.providerId !== currentUser?.uid) return;

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

  // Emergency Alerts Real-time Listener (for Admin monitor)
  useEffect(() => {
    if (role !== 'admin' || !currentUser) return;
    const q = query(
      collection(db, 'emergency_alerts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setEmergencyAlerts(list);
    }, (err) => {
      console.warn('Emergency alerts sync error:', err);
    });

    return () => unsubscribe();
  }, [role, currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const secDocRef = doc(db, 'users', user.uid, 'private_profile', 'security');

          const [userDoc, secDoc] = await Promise.all([
            getDoc(userDocRef),
            getDoc(secDocRef).catch(() => null)
          ]);

          const isAdmin = (
            user.email === 'fushawshaw@gmail.com' || 
            user.email === 'wanderj419@gmail.com' || 
            user.email === 'mozbiscates@gmail.com'
          );
          
          let secData = secDoc && secDoc.exists() ? secDoc.data() : null;

          if (userDoc.exists()) {
            const data = userDoc.data();

            // Background seamless migration: if old user has PII in root doc, isolate it in private_profile
            if (!secData && (data.biPhoto || data.biSelfie || data.nuit || data.emergencyContactPhone)) {
              try {
                secData = {
                  userId: user.uid,
                  biPhoto: data.biPhoto || '',
                  biSelfie: data.biSelfie || '',
                  nuit: data.nuit || '',
                  emergencyContactName: data.emergencyContactName || '',
                  emergencyContactPhone: data.emergencyContactPhone || '',
                  updatedAt: serverTimestamp()
                };
                await setDoc(secDocRef, secData, { merge: true });
                // Clean up sensitive fields from the public root profile
                await updateDoc(userDocRef, {
                  biPhoto: deleteField(),
                  biSelfie: deleteField(),
                  nuit: deleteField(),
                  emergencyContactName: deleteField(),
                  emergencyContactPhone: deleteField()
                }).catch(() => {});
              } catch (migErr) {
                console.warn("PII migration notice:", migErr);
              }
            }

            setSecurityData(secData);
            setUserData(data);

            if (isAdmin) {
              setRole('admin');
              setView('app');
              if (data.role !== 'admin') {
                await updateDoc(userDocRef, { role: 'admin' }).catch(() => {});
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
          console.warn("Auth initialization error:", err);
          setRole(null);
          setView('roles');
        }
      } else {
        setUserData(null);
        setSecurityData(null);
        setRole(null);
        setView('landing');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBalance(0);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        if (typeof data.balance === 'number') {
          setBalance(data.balance);
        } else {
          setBalance(0);
        }
      }
    }, (err) => console.error("User doc snapshot error:", err));
    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => setNotifPermission(perm)).catch(() => {});
    }
  }, [role]);

  const handleRoleSelection = async (r: 'client' | 'worker' | 'admin') => {
    if (!currentUser) return;
    setRole(r);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => setNotifPermission(perm)).catch(() => {});
    }
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
    try {
      const q = query(
        collection(db, 'users', pid, 'reviews'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data();
        let dateStr = new Date().toISOString();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          dateStr = data.createdAt.toDate().toISOString();
        }
        return {
          id: d.id,
          rating: Number(data.rating) || 5,
          comment: String(data.comment || ''),
          date: dateStr
        };
      });
      setProviderReviews(list);
    } catch (err) {
      console.warn("Could not fetch reviews from firestore:", err);
      setProviderReviews([]);
    }
  };

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    fetchReviews(p.id);
  };

  const [rawProviders, setRawProviders] = useState<Provider[]>([]);
  const isFirstProvidersSyncRef = useRef(true);
  const notifiedNearbyProvidersRef = useRef<Set<string>>(new Set());

  // Restore already notified providers from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('mozbiscates-notified-providers');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          ids.forEach((id: string) => notifiedNearbyProvidersRef.current.add(id));
        }
      }
    } catch(e) {}
  }, []);

  // Proximity check function: notifies client when a verified provider is within 5km radius (Haversine)
  const checkAndNotifyNearbyProvider = useCallback((provider: Provider, userCoords: [number, number], isInitialSync = false) => {
    if (!provider || !provider.verified) return;
    if (currentUser && provider.id === currentUser.uid) return;

    const coords = getProviderCoordinates(provider.id, userCoords);
    const distKm = calculateHaversineDistanceKm(userCoords, coords);

    // 5km radius check using Haversine formula
    if (distKm <= 5.0) {
      if (!notifiedNearbyProvidersRef.current.has(provider.id)) {
        notifiedNearbyProvidersRef.current.add(provider.id);
        try {
          sessionStorage.setItem(
            'mozbiscates-notified-providers',
            JSON.stringify(Array.from(notifiedNearbyProvidersRef.current))
          );
        } catch(e) {}

        // Suppress sound & alert popups on the very initial baseline sync
        if (isInitialSync) return;

        const distFormatted = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        const title = "📍 Novo Prestador Verificado por Perto!";
        const body = `${provider.name} (${provider.category}) está agora a ${distFormatted} de si em ${provider.bairro || 'sua zona'}! Toque para ver o perfil.`;

        // 1. Browser Notification API (Web Push / Local Notification)
        sendLocalNotification(title, {
          body,
          icon: provider.photo || NOTIFICATION_ICON,
          badge: NOTIFICATION_ICON,
          tag: `nearby-provider-${provider.id}`,
          data: { providerId: provider.id, type: 'nearby_provider' }
        });

        // 2. Play audio notification
        try {
          const audio = new Audio(NOTIFICATION_SOUND);
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}

        // 3. In-App Notification Toast
        setNotification({
          title,
          body
        });
        setTimeout(() => setNotification(null), 10000);
      }
    }
  }, [currentUser]);

  // Real-time Firestore query for workers with real-time change detection
  useEffect(() => {
    if (!currentUser || role !== 'client') return;
    const q = query(collection(db, 'users'), where('role', '==', 'worker'), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawProviders(data);

      // Check document changes for newly added or newly verified workers
      snap.docChanges().forEach((change) => {
        const p = { id: change.doc.id, ...change.doc.data() } as Provider;
        if (p.verified && (change.type === 'added' || change.type === 'modified')) {
          checkAndNotifyNearbyProvider(p, userLocation, isFirstProvidersSyncRef.current);
        }
      });
      isFirstProvidersSyncRef.current = false;
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [currentUser?.uid, role, userLocation, checkAndNotifyNearbyProvider]);

  // Periodic background check every 20 seconds for verified providers within 5km as GPS location evolves
  useEffect(() => {
    if (role !== 'client' || rawProviders.length === 0) return;

    const interval = setInterval(() => {
      rawProviders.forEach((p) => {
        if (p.verified) {
          checkAndNotifyNearbyProvider(p, userLocation, false);
        }
      });
    }, 20000);

    return () => clearInterval(interval);
  }, [role, rawProviders, userLocation, checkAndNotifyNearbyProvider]);

  // Listen for notification click events to automatically open provider profile
  useEffect(() => {
    const handleOpenProvider = (e: any) => {
      const providerId = e.detail;
      const p = rawProviders.find(item => item.id === providerId);
      if (p) {
        handleSelectProvider(p);
      }
    };

    window.addEventListener('open-provider', handleOpenProvider);
    return () => window.removeEventListener('open-provider', handleOpenProvider);
  }, [rawProviders]);

  // Listen to Service Worker messages for background notification clicks
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'open-provider' && event.data?.providerId) {
        const p = rawProviders.find(item => item.id === event.data.providerId);
        if (p) {
          handleSelectProvider(p);
        }
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, [rawProviders]);

  const handleSimulateNearbyProviderAlert = () => {
    const candidate = rawProviders.find(p => p.verified) || rawProviders[0] || {
      id: 'demo-worker-nearby',
      name: 'Salomão Cossa',
      category: 'Eletricista Auto & Residencial',
      bairro: 'Polana Caniço',
      rating: 4.9,
      verified: true,
      jobs: 38,
      photo: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400&auto=format&fit=crop&q=80',
      level: 3
    } as Provider;

    const coords = getProviderCoordinates(candidate.id, userLocation);
    const distKm = calculateHaversineDistanceKm(userLocation, coords);
    const distFormatted = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

    const title = "📍 Novo Prestador Verificado por Perto!";
    const body = `${candidate.name} (${candidate.category}) está disponível a apenas ${distFormatted} de si (em ${candidate.bairro || 'sua zona'})! Toque para ver o perfil.`;

    sendLocalNotification(title, {
      body,
      icon: candidate.photo || NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `nearby-provider-${candidate.id}`,
      data: { providerId: candidate.id, type: 'nearby_provider' }
    });

    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch(e) {}

    setNotification({
      title,
      body
    });
    setTimeout(() => setNotification(null), 10000);
  };

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

  // 1. Sync all registered users & inactivity feedbacks for Admin Dashboard
  useEffect(() => {
    if (role !== 'admin' || !currentUser) {
      setAllUsers([]);
      setInactivityFeedbacks([]);
      return;
    }

    const qUsers = query(collection(db, 'users'), limit(500));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(data);
    }, (err) => {
      console.warn("Notice: users sync for admin metrics:", err);
    });

    const qFeedbacks = query(collection(db, 'inactivity_feedback'), limit(200));
    const unsubFeedbacks = onSnapshot(qFeedbacks, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      data.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });
      setInactivityFeedbacks(data);
    }, (err) => {
      console.warn("Notice: inactivity feedbacks sync for admin:", err);
    });

    return () => {
      unsubUsers();
      unsubFeedbacks();
    };
  }, [role, currentUser]);

  // 2. Automated detection of inactive users (> 90 dias / 3 meses) on session entry
  useEffect(() => {
    if (!currentUser || !userData) return;

    const feedbackSubmittedKey = `mozbiscates_feedback_submitted_${currentUser.uid}`;
    if (localStorage.getItem(feedbackSubmittedKey)) return;

    const feedbackDismissedSessionKey = `mozbiscates_feedback_dismissed_${currentUser.uid}`;
    if (sessionStorage.getItem(feedbackDismissedSessionKey)) return;

    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const rawDate = userData.lastActiveAt || userData.updatedAt || userData.createdAt;

    if (rawDate) {
      let lastDate: Date | null = null;
      if (typeof rawDate.toDate === 'function') lastDate = rawDate.toDate();
      else if (rawDate instanceof Date) lastDate = rawDate;
      else if (rawDate.seconds) lastDate = new Date(rawDate.seconds * 1000);
      else {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) lastDate = d;
      }

      if (lastDate && (Date.now() - lastDate.getTime() > NINETY_DAYS_MS)) {
        const timer = setTimeout(() => {
          setShowInactivityModal(true);
          sessionStorage.setItem(feedbackDismissedSessionKey, 'true');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, userData]);

  // 3. Throttled activity heartbeat to update lastActiveAt (once per 24 hours per user)
  useEffect(() => {
    if (!currentUser) return;
    const HEARTBEAT_KEY = `mozbiscates_active_heartbeat_${currentUser.uid}`;
    const lastPing = localStorage.getItem(HEARTBEAT_KEY);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!lastPing || (now - Number(lastPing) > ONE_DAY_MS)) {
      localStorage.setItem(HEARTBEAT_KEY, String(now));
      updateDoc(doc(db, 'users', currentUser.uid), {
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setJobs([]);
      return;
    }
    const q = role === 'admin'
      ? query(
          collection(db, 'jobs'),
          orderBy('createdAt', 'desc'),
          limit(300)
        )
      : query(
          collection(db, 'jobs'),
          where(role === 'client' ? 'clientId' : 'providerId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      if (role === 'worker') {
        if (!hasInitialJobsLoadedRef.current) {
          // Initialize status tracking map for existing jobs
          snap.docs.forEach(d => {
            previousJobStatusesRef.current[d.id] = d.data().status;
          });
          hasInitialJobsLoadedRef.current = true;
        } else {
          snap.docChanges().forEach(change => {
            const job = change.doc.data() as Job;
            const jobId = change.doc.id;
            const prevStatus = previousJobStatusesRef.current[jobId];

            if (change.type === 'added') {
              previousJobStatusesRef.current[jobId] = job.status;
              if (alertCategory === 'Todos' || job.category?.includes(alertCategory)) {
                setNotification({
                  title: t.notificationTitle,
                  body: `${t.notificationBody}: ${job.category} - ${job.amount} MT`
                });
                setTimeout(() => setNotification(null), 5000);
              }
            } else if (change.type === 'modified') {
              // DETECT IF CLIENT CONFIRMED THE FINISHED SERVICE!
              if (job.status === 'CONCLUIDO' && prevStatus && prevStatus !== 'CONCLUIDO') {
                const fee = (job.amount || 0) * 0.1;
                const netAmount = Math.round(job.payoutAmount ?? ((job.amount || 0) - fee));
                const title = t.payoutCreditedTitle || "Saldo Creditado! 💰🎉";
                const body = `${t.payoutCreditedBody || "O cliente confirmou o serviço finalizado. O seu saldo foi creditado com sucesso!"} (+${netAmount} MT • ${job.category})`;

                // 1. Web Push Notification to device / browser
                sendLocalNotification(title, {
                  body,
                  tag: `payout-${jobId}`,
                  data: { jobId }
                });

                // 2. Play audible confirmation
                try {
                  const audio = new Audio(NOTIFICATION_SOUND);
                  audio.volume = 0.5;
                  audio.play().catch(() => {});
                } catch (e) {}

                // 3. In-App Notification Toast
                setNotification({
                  title,
                  body
                });
                setTimeout(() => setNotification(null), 9000);

                // 4. Update worker's local balance state
                setBalance(prev => prev + netAmount);
              }
              previousJobStatusesRef.current[jobId] = job.status;
            }
          });
        }
      }
      setJobs(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'jobs'));
    return () => unsubscribe();
  }, [currentUser, role, alertCategory, t]);

  const [bookingAmount, setBookingAmount] = useState('500');
  const [bookingDesc, setBookingDesc] = useState('');
  const [bookingType, setBookingType] = useState<'immediate' | 'scheduled'>('immediate');
  const [bookingDateTime, setBookingDateTime] = useState('');
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
    const parsedAmount = Math.round(Number(bookingAmount));
    if (isNaN(parsedAmount) || parsedAmount < 50 || parsedAmount > 500000) {
      alert("Por favor, introduza um valor válido para o biscate (entre 50 MT e 500.000 MT).");
      return;
    }
    if (bookingType === 'scheduled' && !bookingDateTime) {
      alert("Por favor, selecione a data e hora para o agendamento.");
      return;
    }
    // Sanitize description to prevent script injections
    const sanitizedDesc = (bookingDesc || '').replace(/[<>]/g, '').trim().slice(0, 500);

    try {
      await addDoc(collection(db, 'jobs'), {
        providerId: p.id,
        category: p.category.slice(0, 60),
        clientId: currentUser.uid,
        clientName: (userData?.fullName || 'Cliente').slice(0, 100),
        providerName: p.name.slice(0, 100),
        bairro: (userData?.bairro || bairro || '').slice(0, 60),
        amount: parsedAmount,
        description: sanitizedDesc,
        bookingType: bookingType === 'scheduled' ? 'scheduled' : 'immediate',
        scheduledFor: bookingType === 'scheduled' ? bookingDateTime : null,
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
      setBookingType('immediate');
      setBookingDateTime('');
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
      // 1. Save sensitive verification details to isolated subcollection
      const secData = {
        userId: currentUser.uid,
        biPhoto: providerData.biPhoto || '',
        biSelfie: providerData.biSelfie || '',
        nuit: providerData.nuit || '',
        emergencyContactName: providerData.emergencyContactName || '',
        emergencyContactPhone: providerData.emergencyContactPhone || '',
        verified: true,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', currentUser.uid, 'private_profile', 'security'), secData, { merge: true });
      setSecurityData(secData);

      // 2. Save public profile to users collection (without exposing government IDs)
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        fullName: providerData.name,
        role: 'worker',
        category: providerData.category,
        specialty: providerData.specialty || providerData.category,
        specialties: [providerData.category],
        photo: providerData.photo,
        verified: true,
        portfolio: providerData.portfolio || [],
        email: currentUser.email,
        level: 1,
        jobs: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setTab('jobs');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid || 'unknown'}`);
    }
  };

  const handleCreateClientProfile = async (clientData: any) => {
    if (!currentUser) return;
    try {
      // 1. Save sensitive verification & emergency details to isolated subcollection
      const secData = {
        userId: currentUser.uid,
        biPhoto: clientData.biPhoto || '',
        emergencyContactName: clientData.emergencyContactName || '',
        emergencyContactPhone: clientData.emergencyContactPhone || '',
        verified: true,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', currentUser.uid, 'private_profile', 'security'), secData, { merge: true });
      setSecurityData(secData);

      // 2. Save public client profile
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        fullName: clientData.fullName,
        role: 'client',
        phone: clientData.phone,
        bairro: clientData.bairro,
        city: clientData.city,
        photo: clientData.photo,
        verified: true,
        email: currentUser.email,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowClientProfileModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid || 'unknown'}`);
    }
  };

  const handleJobAction = async (job: Job, action: string, data: any = {}) => {
    const jobRef = doc(db, 'jobs', job.id);
    let update: any = { updatedAt: serverTimestamp() };

    switch (action) {
      case 'PAY':
      case 'SUBMIT_PAYMENT':
        update.status = 'VALIDACAO_PENDENTE';
        update.transactionId = data.txId;
        break;
      case 'PAY_AUTOMATED':
        update.status = 'PAGO';
        update.transactionId = data.txId;
        // Post real-time automatic payment confirmation message
        await addDoc(collection(db, 'jobs', job.id, 'messages'), {
          senderId: 'system',
          text: `⚡ Pagamento Automatizado Confirmado! Valor de ${job.amount} MT retido em Escrow Digital com sucesso. Transação ID: ${data.txId}. O prestador já pode fazer Check-in.`,
          createdAt: serverTimestamp()
        }).catch(err => console.error("Error adding system message:", err));
        break;
      case 'START':
      case 'CHECK_IN':
        update.status = 'EM_CURSO';
        update.photoBefore = data.photo || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(job.id)}&color=0c513f`;
        break;
      case 'FINISH':
      case 'CHECK_OUT':
        update.status = 'FINALIZADO';
        update.photoAfter = data.photo || "https://picsum.photos/seed/after/400/300";
        break;
      case 'CONFIRM_CLIENT':
        if (job.status === 'CONCLUIDO') {
          console.warn("Biscate já foi concluído anteriormente. Operação ignorada para evitar duplicações.");
          return;
        }
        if (!job.amount || job.amount < 50 || job.amount > 500000) {
          console.error("Valor do trabalho inválido para liquidação de pagamento.");
          return;
        }

        try {
          // VULN-03: Delegar a liquidação e o crédito de saldo ao backend autenticado
          const token = await currentUser?.getIdToken();
          const res = await fetch('/api/jobs/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token || ''}`
            },
            body: JSON.stringify({ jobId: job.id })
          });

          const payoutRes = await res.json();
          if (!res.ok) {
            throw new Error(payoutRes.error || "Falha na liquidação do pagamento.");
          }

          const title = t.payoutCreditedTitle || "Serviço Confirmado e Liquidado! 💰";
          const body = `O valor líquido de ${payoutRes.netAmount} MT (após comissão oficial de 10%: ${payoutRes.fee} MT) foi creditado com sucesso ao prestador. ID: ${payoutRes.transactionId}`;
          sendLocalNotification(title, {
            body,
            tag: `payout-${job.id}`,
            data: { jobId: job.id }
          });
          setNotification({ title, body });
          setTimeout(() => setNotification(null), 9000);
          try {
            const audio = new Audio(NOTIFICATION_SOUND);
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch (e) {}

          // Retornar diretamente: o backend já executou a transacção atómica, actualizou o trabalho e creditou o saldo
          return;
        } catch (payoutErr: any) {
          console.error("Payout error:", payoutErr);
          alert(payoutErr.message || "Erro ao liquidar o trabalho no servidor.");
          return;
        }
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
      case 'CANCEL_UNFORESEEN':
        update.status = 'CANCELADO';
        update.cancellationReason = data.reason || 'Imprevisto inevitável';
        update.previousStatus = job.status || 'AGUARDANDO_DEPOSITO';
        update.cancelledBy = currentUser?.uid || '';
        await addDoc(collection(db, 'jobs', job.id, 'messages'), {
          senderId: 'system',
          text: `⚠️ Biscate cancelado devido a imprevisto: "${data.reason || 'Força maior'}". A caução de pagamento (${job.amount} MT) permanece salvaguardada em garantia Escrow para Reagendamento Rápido.`,
          createdAt: serverTimestamp()
        }).catch(err => console.error("Error adding cancel system message:", err));
        break;
      case 'QUICK_RESCHEDULE':
        // Restore status while preserving exact payment configurations
        const wasPaid = (job.previousStatus === 'PAGO' || job.status === 'PAGO' || !!job.transactionId);
        update.status = wasPaid ? 'PAGO' : 'AGUARDANDO_DEPOSITO';
        update.scheduledFor = data.newDateTime;
        update.bookingType = 'scheduled';
        update.cancellationReason = null;
        update.rescheduledAt = serverTimestamp();
        if (data.note) {
          update.rescheduleNote = data.note;
        }
        const formattedDateStr = data.newDateTime ? new Date(data.newDateTime).toLocaleString('pt-MZ', { dateStyle: 'short', timeStyle: 'short' }) : 'Nova data';
        await addDoc(collection(db, 'jobs', job.id, 'messages'), {
          senderId: 'system',
          text: `🔄 Biscate Reagendado com Sucesso para ${formattedDateStr}! A caução de pagamento (${job.amount} MT) e as condições foram mantidas intactas sem custos adicionais.`,
          createdAt: serverTimestamp()
        }).catch(err => console.error("Error adding reschedule system message:", err));
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

  // Cadastro Obrigatório de Segurança para Quem Precisa de Serviços (Cliente)
  if (role === 'client' && (!combinedUserData?.phone || !combinedUserData?.biPhoto)) {
    return (
      <div className="min-h-screen bg-natural-bg p-4 flex flex-col items-center justify-center">
        <header className="w-full max-w-lg py-4 flex justify-between items-center mb-4">
          <h1 className="font-black italic text-xl">Mozbiscates</h1>
          <button onClick={handleLogout} className="text-natural-muted font-black text-[10px] uppercase">{t.logout || 'Sair'}</button>
        </header>
        <ClientSecurityProfileModal
          initialData={combinedUserData}
          onSave={handleCreateClientProfile}
          isMandatory={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg text-natural-ink font-sans flex flex-col items-center selection:bg-natural-accent selection:text-white pb-24">
      <PwaGuideModal onShow={showPwaGuide} onClose={() => setShowPwaGuide(false)} />

      {/* Alarme de Emergência Anti-Crime SOS (Para Ambos os Lados) */}
      <EmergencyModal 
        isOpen={showEmergencyModal}
        onClose={() => {
          setShowEmergencyModal(false);
          setActiveEmergencyJob(null);
        }}
        currentUser={currentUser}
        userData={combinedUserData}
        activeJob={activeEmergencyJob}
      />

      {/* Modal de Cadastro de Segurança do Cliente (Edição) */}
      {showClientProfileModal && (
        <ClientSecurityProfileModal
          initialData={combinedUserData}
          onSave={handleCreateClientProfile}
          onCancel={() => setShowClientProfileModal(false)}
          isMandatory={false}
        />
      )}

      {/* Formulário Oficial de Inactividade e Melhoria ("Queremos melhorar! 💙") */}
      <InactivityFeedbackModal
        isOpen={showInactivityModal}
        onClose={() => setShowInactivityModal(false)}
        currentUser={currentUser}
        userData={combinedUserData}
        role={role}
      />
      
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

          {ussdOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 select-none animate-in fade-in duration-200">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#F4F4F4] text-black w-full max-w-sm rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-neutral-300 overflow-hidden font-sans text-left"
              >
                <form onSubmit={handleUssdSubmit} className="p-6">
                  <div className="text-[10px] font-black text-neutral-500 mb-2 tracking-[0.2em] uppercase flex items-center gap-1.5 opacity-80">
                    <Smartphone className="w-3.5 h-3.5 text-natural-accent" />
                    <span>{lang === 'en' ? 'USSD MESSAGE' : lang === 'em' ? 'USSD' : 'MENSAGEM USSD'}</span>
                  </div>
                  
                  <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-inner mb-4 min-h-[140px] flex flex-col justify-between">
                    <div className="text-xs font-mono whitespace-pre-line text-neutral-800 tracking-tight leading-relaxed">
                      {getUssdContent()}
                    </div>
                    {ussdError && (
                      <div className="text-red-600 text-[10px] font-black uppercase tracking-wide mt-2">
                        {ussdError}
                      </div>
                    )}
                  </div>

                  <div className="relative mb-5">
                    <input 
                      type="text" 
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={ussdInput}
                      onChange={(e) => {
                        setUssdInput(e.target.value);
                        setUssdError('');
                      }}
                      placeholder={lang === 'en' ? 'Type option here...' : lang === 'em' ? 'Option...' : 'Insira a opção aqui...'}
                      className="w-full bg-white border border-neutral-300 py-3.5 px-4 rounded-xl text-xs font-mono text-neutral-850 focus:outline-none focus:border-natural-accent focus:ring-2 focus:ring-natural-accent/10 transition-all font-bold placeholder-neutral-400"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-3 text-xs font-black tracking-widest">
                    <button 
                      type="button"
                      onClick={() => {
                        setUssdOpen(false);
                        setUssdInput('');
                        setUssdError('');
                      }}
                      className="px-5 py-3 text-neutral-500 hover:text-neutral-800 transition-colors uppercase"
                    >
                      {lang === 'en' ? 'Cancel' : lang === 'em' ? 'Ohiya' : 'Cancelar'}
                    </button>
                    <button 
                      type="submit"
                      className="px-6 py-3 bg-natural-accent hover:bg-natural-accent/90 text-white rounded-xl transition-colors shadow-md hover:shadow-lg active:scale-95 uppercase"
                    >
                      {lang === 'en' ? 'Send' : lang === 'em' ? 'Oveha' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
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

          {voiceFallbackOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white text-natural-heading w-full max-w-sm rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border-4 border-white overflow-hidden font-sans text-left relative"
              >
                <button 
                  onClick={() => {
                    setVoiceFallbackOpen(false);
                    setVoiceInputText('');
                  }}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-natural-surface flex items-center justify-center text-natural-muted hover:bg-natural-line/30 transition-all active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="p-6">
                  <div className="text-[10px] font-black text-natural-accent mb-3 tracking-[0.2em] uppercase flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 animate-pulse" />
                    <span>{t.voiceFallbackTitle}</span>
                  </div>

                  <h3 className="text-lg font-black italic tracking-tight mb-2 leading-none">
                    {t.voiceFallbackTitle}
                  </h3>
                  <p className="text-[11px] text-natural-muted font-bold leading-relaxed mb-4">
                    {t.voiceFallbackDesc}
                  </p>

                  <div className="bg-natural-surface p-4 rounded-2xl border border-natural-line mb-4">
                    <textarea
                      rows={3}
                      value={voiceInputText}
                      onChange={(e) => setVoiceInputText(e.target.value)}
                      placeholder={t.voiceFallbackPlaceholder}
                      className="w-full bg-transparent border-none text-xs font-bold text-natural-heading placeholder-natural-muted/65 focus:outline-none focus:ring-0 resize-none font-sans"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!voiceInputText.trim()) return;
                      const matchedCat = classifyIssueText(voiceInputText);
                      if (matchedCat) {
                        setCategory(matchedCat);
                        alert(`🔍 ${t.categoryMatched} "${matchedCat}"`);
                      } else {
                        setCategory(voiceInputText);
                        alert(`🔍 ${t.noCategoryMatched} "${voiceInputText}"`);
                      }
                      setVoiceFallbackOpen(false);
                      setVoiceInputText('');
                    }}
                    disabled={!voiceInputText.trim()}
                    className="w-full bg-natural-success text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.voiceFallbackButton}</span>
                  </button>
                </div>
              </motion.div>
            </div>
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
            {/* Botão de Emergência SOS Anti-Crime para AMBOS os Lados */}
            <button 
              onClick={() => {
                setActiveEmergencyJob(null);
                setShowEmergencyModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-500/30 animate-pulse cursor-pointer"
              title="Alarme SOS Anti-Crime (Pânico, Sirene e Polícia 112)"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>SOS</span>
            </button>

            {role === 'client' && (
              <button 
                onClick={() => setShowClientProfileModal(true)}
                className="w-10 h-10 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Meu Cadastro de Segurança (BI & Confiança)"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
              </button>
            )}

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
            <>
              <button onClick={() => { setTab('jobs'); setAdminView('history'); }} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 ${tab === 'jobs' && adminView === 'history' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-30'}`}>
                {t.history}
              </button>
              <button onClick={() => { setTab('jobs'); setAdminView('metrics'); }} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 ${tab === 'jobs' && adminView === 'metrics' ? 'text-natural-heading border-natural-accent' : 'text-natural-muted border-transparent opacity-30'}`}>
                {t.metrics}
              </button>
              <button onClick={() => { setTab('jobs'); setAdminView('alerts'); }} className={`text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap pb-3 border-b-4 flex items-center gap-1.5 ${tab === 'jobs' && adminView === 'alerts' ? 'text-red-600 border-red-600' : 'text-natural-muted border-transparent opacity-40'}`}>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>SOS {emergencyAlerts.filter(a => a.status === 'EMERGENCIA_ATIVA').length > 0 ? `(${emergencyAlerts.filter(a => a.status === 'EMERGENCIA_ATIVA').length})` : ''}</span>
              </button>
            </>
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
                    <button 
                      onClick={handleVoiceRecord} 
                      className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl ${isRecording ? 'bg-red-500 text-white scale-95' : 'bg-white text-natural-success hover:scale-[1.02]'}`}
                    >
                      <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} /> 
                      <span className="uppercase tracking-widest text-sm">{isRecording ? (t.listening || t.recording) : t.recordAudio}</span>
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
                        selectedProvider={selectedProvider}
                        onSelectProvider={handleSelectProvider}
                      />
                    </div>
                  )}

                 {/* Filters */}
                 <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                    <button 
                      onClick={async () => {
                        if ('Notification' in window && Notification.permission !== 'granted') {
                          const res = await Notification.requestPermission();
                          setNotifPermission(res);
                        } else {
                          handleSimulateNearbyProviderAlert();
                        }
                      }}
                      className={`shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center gap-1.5 ${
                        notifPermission === 'granted'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                          : 'bg-white border-dashed border-amber-400 text-amber-800'
                      }`}
                      title={notifPermission === 'granted' ? "Radar 5km ativo: Notifica no browser se novo prestador verificado estiver próximo (Toque para testar)" : "Toque para autorizar notificações de prestadores a menos de 5km"}
                    >
                      <Bell className={`w-3.5 h-3.5 ${notifPermission === 'granted' ? 'text-amber-600' : 'text-amber-500 animate-pulse'}`} />
                      <span>{notifPermission === 'granted' ? 'Radar 5km Ativo 🔔' : 'Ativar Radar 5km'}</span>
                    </button>

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
                   {filteredProviders.map(p => (
                     <ProviderCard 
                       key={p.id} 
                       provider={p} 
                       onSelect={handleSelectProvider} 
                       userPos={userLocation}
                     />
                   ))}
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
                      {role === 'worker' 
                        ? `${t.jobAlerts}: ${alertCategory}` 
                        : role === 'admin' 
                          ? adminView === 'active' 
                            ? t.trackingPanel 
                            : adminView === 'history' 
                              ? t.history 
                              : t.metrics 
                          : t.trackingPanel}
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


                 </div>
                  {role === 'worker' && <WorkerWallet t={t} balance={balance} userData={userData} db={db} currentUser={currentUser} />}
                  {role === 'worker' && <WorkerEarningsChart jobs={jobs} userData={userData} balance={balance} t={t} />}
                  {role === 'worker' && <CommunityRules t={t} />}
                  {role === 'admin' && <WithdrawalManagement jobs={jobs} providers={rawProviders} onAction={handleJobAction} t={t} />}

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
                 ) : role === 'admin' && adminView === 'metrics' ? (
                   <AdminMetrics 
                     jobs={jobs} 
                     users={allUsers} 
                     feedbacks={inactivityFeedbacks} 
                     onPreviewInactivityModal={() => setShowInactivityModal(true)} 
                     t={t} 
                   />
                 ) : role === 'admin' && adminView === 'alerts' ? (
                   <AdminEmergencyMonitor alerts={emergencyAlerts} />
                 ) : (
                   jobs.length > 0 ? (
                    <div className="space-y-4">
                      {jobs.map(j => (
                        <div key={j.id} id={`job-${j.id}`} className={focusedJobId === j.id ? 'ring-4 ring-natural-accent ring-offset-4 rounded-[2rem] animate-pulse transition-all duration-1000' : ''}>
                          <JobCard job={j} role={role!} onAction={handleJobAction} t={t} currentUser={currentUser} lang={lang} onPanic={(job) => { setActiveEmergencyJob(job); setShowEmergencyModal(true); }} />
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
                  <div className="grid gap-4 md:grid-cols-2">
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

                    <div className="bg-white p-6 rounded-[2rem] border-2 border-natural-line shadow-sm flex flex-col justify-between">
                       <div>
                         <div className="flex items-center gap-2 mb-2">
                           <span className="p-2 rounded-xl bg-emerald-50 text-natural-accent">
                             <MessageSquareHeart className="w-5 h-5" />
                           </span>
                           <h4 className="font-black text-natural-heading uppercase tracking-wide">Queremos melhorar! 💙</h4>
                         </div>
                         <p className="text-sm text-natural-muted font-medium mb-6 leading-relaxed">
                           A tua opinião é fundamental para melhorarmos a tua experiência no Mozbiscates. Responde ao nosso questionário rápido!
                         </p>
                       </div>
                       <button
                         onClick={() => setShowInactivityModal(true)}
                         className="w-full bg-natural-heading text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform mt-auto"
                       >
                         <MessageSquareHeart className="w-5 h-5 text-natural-accent" />
                         <span>Dar a Minha Opinião 💙</span>
                       </button>
                    </div>

                      <div className="bg-white p-6 rounded-[2rem] border-2 border-natural-line shadow-sm flex flex-col justify-between border-dashed border-natural-accent/50 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 bg-natural-accent text-white px-3 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest leading-none">USSD</div>
                         <div>
                           <h4 className="font-black text-natural-heading mb-2 uppercase tracking-wide">{t.customerLine}</h4>
                           <p className="text-sm text-natural-muted font-medium mb-6 leading-relaxed">{t.customerLineDesc}</p>
                         </div>
                         <button 
                           onClick={() => {
                             setUssdOpen(true);
                             setUssdScreen("main");
                             setUssdInput("");
                             setUssdError("");
                           }}
                           className="w-full bg-natural-accent text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-natural-accent/20 active:scale-95 transition-transform mt-auto"
                         >
                           <Phone className="w-6 h-6 animate-pulse" /> {t.dialCustomerLine}
                         </button>
                      </div>

                      <div className="bg-white p-6 rounded-[2rem] border-2 border-natural-line shadow-sm md:col-span-2 flex flex-col gap-4">
                         <div>
                           <h4 className="font-black text-natural-heading mb-2 uppercase tracking-wide flex items-center gap-2">
                             <Sparkles className="w-4 h-4 text-natural-accent animate-pulse" /> Saiba Mais & Regulamentos
                           </h4>
                           <p className="text-xs text-natural-muted font-bold leading-relaxed">
                             Explore informações importantes sobre a plataforma, termos de utilização e canais oficiais de envio de comunicações e relatórios:
                           </p>
                         </div>

                         <div className="space-y-3">
                           {/* Accordion Item 1: Sobre Nós */}
                           <div className="border border-natural-line rounded-2xl overflow-hidden bg-natural-surface/30">
                             <button
                               onClick={() => setActiveInfo(activeInfo === 'about' ? null : 'about')}
                               className="w-full p-4 flex justify-between items-center text-left hover:bg-natural-surface transition-colors"
                             >
                               <span className="text-xs font-black text-natural-heading uppercase tracking-wide flex items-center gap-2">
                                 <User className="w-4 h-4 text-natural-accent" /> Sobre o Mozbiscates
                               </span>
                               <span className="text-xs font-black text-natural-muted">{activeInfo === 'about' ? '▲' : '▼'}</span>
                             </button>
                             {activeInfo === 'about' && (
                               <div className="p-4 bg-white border-t border-natural-line text-xs font-bold text-natural-muted leading-relaxed space-y-2">
                                 <p>
                                   O <strong>Mozbiscates</strong> é a primeira plataforma de contratação segura e verificação de identidade em Moçambique. O nosso objetivo é conectar prestadores de serviços qualificados a clientes de forma rápida, transparente e altamente profissional.
                                 </p>
                                 <p>
                                   Para garantir que os prestadores trabalhem com total dedicação e os clientes tenham paz de espírito, implementamos o inovador sistema de custódia (Escrow) e as tecnologias inteligentes de auditoria por inteligência artificial.
                                 </p>
                               </div>
                             )}
                           </div>

                           {/* Accordion Item 2: Regulamentos & Segurança */}
                           <div className="border border-natural-line rounded-2xl overflow-hidden bg-natural-surface/30">
                             <button
                               onClick={() => setActiveInfo(activeInfo === 'rules' ? null : 'rules')}
                               className="w-full p-4 flex justify-between items-center text-left hover:bg-natural-surface transition-colors"
                             >
                               <span className="text-xs font-black text-natural-heading uppercase tracking-wide flex items-center gap-2">
                                 <Shield className="w-4 h-4 text-natural-accent" /> Regulamentos & Segurança
                               </span>
                               <span className="text-xs font-black text-natural-muted">{activeInfo === 'rules' ? '▲' : '▼'}</span>
                             </button>
                             {activeInfo === 'rules' && (
                               <div className="p-4 bg-white border-t border-natural-line text-xs font-bold text-natural-muted leading-relaxed space-y-2">
                                 <p>
                                   Para a segurança mútua da comunidade Mozbiscates, todos os utilizadores devem seguir estritamente as diretrizes abaixo:
                                 </p>
                                 <ul className="list-disc pl-5 space-y-1">
                                   <li><strong>Verificação Obrigatória:</strong> Todos os prestadores devem enviar fotos reais do seu Bilhete de Identidade (BI) e uma Selfie correspondente para auditoria da nossa equipe e algoritmos.</li>
                                   <li><strong>Canais Oficiais de Pagamento:</strong> Nunca realize pagamentos fora do fluxo oficial de Escrow do aplicativo. Transações feitas por fora perdem a nossa cobertura de reembolso e seguro.</li>
                                   <li><strong>Check-in e Check-out:</strong> O prestador deve fazer fotos do "Antes" e do "Depois" no início e fim de cada biscate para documentar o trabalho efetuado com fidelidade.</li>
                                 </ul>
                               </div>
                             )}
                           </div>

                           {/* Accordion Item 3: Relatórios & Correio de Sistema */}
                           <div className="border border-natural-line rounded-2xl overflow-hidden bg-natural-surface/30">
                             <button
                               onClick={() => setActiveInfo(activeInfo === 'emails' ? null : 'emails')}
                               className="w-full p-4 flex justify-between items-center text-left hover:bg-natural-surface transition-colors"
                             >
                               <span className="text-xs font-black text-natural-heading uppercase tracking-wide flex items-center gap-2">
                                 <Mail className="w-4 h-4 text-natural-accent" /> Relatórios & Correio Oficial
                               </span>
                               <span className="text-xs font-black text-natural-muted">{activeInfo === 'emails' ? '▲' : '▼'}</span>
                             </button>
                             {activeInfo === 'emails' && (
                               <div className="p-4 bg-white border-t border-natural-line text-xs font-bold text-natural-muted leading-relaxed space-y-2">
                                 <p>
                                   Toda a gestão interna e relatórios analíticos são controlados de forma automatizada:
                                 </p>
                                 <div className="space-y-3 pt-1">
                                   <div className="bg-natural-surface p-3 rounded-xl border border-natural-line">
                                     <span className="block text-[8px] font-black text-natural-muted uppercase tracking-wider leading-none mb-1">E-mail Oficial do Aplicativo</span>
                                     <span className="text-xs font-black text-natural-accent font-mono">mozbiscates@gmail.com</span>
                                     <p className="text-[9px] text-natural-muted mt-1">Usado exclusivamente para envio de informações de atualizações, avisos de sistema e notificações operacionais aos utilizadores.</p>
                                   </div>
                                   <div className="bg-natural-surface p-3 rounded-xl border border-natural-line">
                                     <span className="block text-[8px] font-black text-natural-muted uppercase tracking-wider leading-none mb-1">Destinatário de Relatórios</span>
                                     <span className="text-xs font-black text-natural-heading font-mono">wanderj419@gmail.com</span>
                                     <p className="text-[9px] text-natural-muted mt-1">A plataforma gera relatórios financeiros e de atividade mensalmente e envia-os de forma automatizada para este e-mail administrativo.</p>
                                   </div>
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                      </div>

                    <div className="bg-natural-surface p-8 rounded-[2.5rem] border-2 border-natural-line md:col-span-2">
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
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(shareUrl).then(() => {
                              alert("Link do perfil copiado com sucesso!");
                            }).catch(() => {
                              alert(`Link do perfil: ${shareUrl}`);
                            });
                          } else {
                            alert(`Link do perfil: ${shareUrl}`);
                          }
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> BI Verificado
                      </span>
                      {(selectedProvider as any).nuit && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg" title="Contribuinte regularizado em Moçambique">
                          <FileText className="w-3 h-3 text-slate-500" /> NUIT Registado
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                        <ShieldAlert className="w-3 h-3 text-red-600" /> Alarme SOS Ativo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estimativa de Tempo de Deslocação Haversine */}
                {(() => {
                  const targetCoords = getProviderCoordinates(selectedProvider.id, userLocation);
                  const distKm = calculateHaversineDistanceKm(userLocation, targetCoords);
                  const travel = estimateTravelTime(distKm);

                  return (
                    <div className="mb-8 p-4 bg-gradient-to-br from-orange-50 via-amber-50/50 to-white border-2 border-orange-200 rounded-[2rem] shadow-sm">
                      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-orange-200/50">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-natural-accent text-white flex items-center justify-center shadow-xs shrink-0">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-orange-950">Deslocação & Distância</span>
                            <p className="text-[11px] text-orange-800 font-bold">A {travel.formattedDistance} de si (Fórmula Haversine)</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-natural-accent bg-white px-2.5 py-1 rounded-xl border border-orange-200 shadow-2xs">
                          {travel.primaryEtaText}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2.5 rounded-2xl border border-orange-100 flex flex-col items-center text-center shadow-2xs">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight mb-1">🚗 Carro / Chapa</span>
                          <span className="text-sm font-black text-natural-heading leading-tight">~{travel.carMinutes} min</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-2xl border border-orange-100 flex flex-col items-center text-center shadow-2xs">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight mb-1">🛵 Moto / Txopela</span>
                          <span className="text-sm font-black text-natural-heading leading-tight">~{travel.motoMinutes} min</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-2xl border border-orange-100 flex flex-col items-center text-center shadow-2xs">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight mb-1">🚶 A pé</span>
                          <span className="text-sm font-black text-natural-heading leading-tight">~{travel.walkingMinutes} min</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-orange-900/70 font-semibold mt-2.5 text-center leading-snug">
                        Tempo estimado entre a sua localização atual no mapa e o prestador selecionado com base nas velocidades médias de trânsito em Moçambique.
                      </p>
                    </div>
                  );
                })()}

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
                        <label className="text-[9px] font-bold text-natural-muted uppercase ml-2 mb-1.5 block">{t.scheduleType}</label>
                        <div className="flex bg-natural-surface p-1 rounded-2xl border-2 border-natural-line gap-1 mb-1">
                          <button 
                            type="button"
                            onClick={() => setBookingType('immediate')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${bookingType === 'immediate' ? 'bg-natural-accent text-white' : 'text-natural-muted'}`}
                          >
                            {t.immediate}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setBookingType('scheduled')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${bookingType === 'scheduled' ? 'bg-natural-accent text-white' : 'text-natural-muted'}`}
                          >
                            {t.scheduled}
                          </button>
                        </div>
                      </div>

                      {bookingType === 'scheduled' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[9px] font-bold text-natural-muted uppercase ml-2 mb-1 block">{t.scheduleDate}</label>
                          <input 
                            type="datetime-local" 
                            className="w-full p-4 bg-natural-surface border-2 border-natural-line rounded-2xl outline-none font-bold text-natural-heading focus:border-natural-accent transition-colors"
                            value={bookingDateTime}
                            onChange={(e) => setBookingDateTime(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                      )}

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
