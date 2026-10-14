import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertOctagon, Volume2, VolumeX, PhoneCall, Share2, MapPin, 
  ShieldAlert, X, CheckCircle, ExternalLink, Flame
} from 'lucide-react';
import { 
  startSirenSound, 
  stopSirenSound, 
  getLiveLocation, 
  GpsLocation, 
  sendEmergencyAlertToFirestore,
  buildWhatsAppSosUrl,
  MOZ_EMERGENCY_NUMBERS 
} from '../lib/emergencyService';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  userData: any;
  activeJob?: any;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userData,
  activeJob
}) => {
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [location, setLocation] = useState<GpsLocation | null>(null);
  const [isLoadingLoc, setIsLoadingLoc] = useState(true);
  const [alertSent, setAlertSent] = useState(false);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingLoc(true);
      getLiveLocation().then((loc) => {
        setLocation(loc);
        setIsLoadingLoc(false);
      });
    } else {
      // Clean up siren when closed
      if (sirenPlaying) {
        stopSirenSound();
        setSirenPlaying(false);
      }
    }

    return () => {
      stopSirenSound();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSiren = () => {
    if (sirenPlaying) {
      stopSirenSound();
      setSirenPlaying(false);
    } else {
      const ok = startSirenSound();
      if (ok) setSirenPlaying(true);
    }
  };

  const handleSendCloudAlert = async () => {
    if (!currentUser || isSendingAlert) return;
    setIsSendingAlert(true);
    try {
      const loc = location || await getLiveLocation();
      const id = await sendEmergencyAlertToFirestore({
        userId: currentUser.uid,
        userName: userData?.fullName || currentUser.email || 'Utilizador',
        userRole: userData?.role || 'client',
        userPhone: userData?.phone || '',
        emergencyContactName: userData?.emergencyContactName || '',
        emergencyContactPhone: userData?.emergencyContactPhone || '',
        jobId: activeJob?.id || undefined,
        jobCategory: activeJob?.category || undefined,
        bairro: userData?.bairro || '',
        city: userData?.city || '',
        location: loc,
        isSilent: silentMode,
        notes: 'Disparo de Alarme de Emergência Anti-Crime pelo utilizador.'
      });
      setAlertId(id);
      setAlertSent(true);
    } catch (err) {
      console.error('Erro ao enviar alerta SOS:', err);
    } finally {
      setIsSendingAlert(false);
    }
  };

  const emergencyPhone = userData?.emergencyContactPhone || '';
  const mapsUrl = location?.mapsUrl || 'https://www.google.com/maps?q=-25.9692,32.5732';
  const whatsappSosUrl = buildWhatsAppSosUrl(
    emergencyPhone,
    userData?.fullName || 'Utilizador',
    userData?.role || 'client',
    mapsUrl,
    userData?.bairro
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-4 border-red-500 overflow-hidden my-auto"
      >
        {/* Banner Superior Vermelho */}
        <div className="bg-red-600 text-white p-5 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 animate-pulse">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-200">Anti-Crime & Proteção</span>
                <h2 className="text-xl font-black tracking-tight leading-none">Alarme de Emergência SOS</h2>
              </div>
            </div>
            <button
              onClick={() => {
                stopSirenSound();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status e Alerta Silencioso */}
          <div className="flex items-center justify-between p-3.5 bg-red-50 rounded-2xl border border-red-200">
            <div>
              <p className="text-xs font-black text-red-900">Modo de Alerta</p>
              <p className="text-[10px] text-red-700">
                {silentMode ? 'Silencioso (sem barulho, seguro em assaltos)' : 'Sonoro (com sirene audível)'}
              </p>
            </div>
            <button
              onClick={() => {
                if (!silentMode && sirenPlaying) {
                  stopSirenSound();
                  setSirenPlaying(false);
                }
                setSilentMode(!silentMode);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                silentMode ? 'bg-slate-800 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {silentMode ? 'Silencioso' : 'Sonoro'}
            </button>
          </div>

          {/* Botão de Sirene Sonora (se não for modo silencioso) */}
          {!silentMode && (
            <button
              onClick={toggleSiren}
              className={`w-full py-4 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-3 shadow-lg ${
                sirenPlaying
                  ? 'bg-amber-500 text-black animate-pulse shadow-amber-500/40'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
              }`}
            >
              {sirenPlaying ? (
                <>
                  <VolumeX className="w-5 h-5" />
                  <span>PARAR SIRENE DE ALARME</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5" />
                  <span>TOCAR SIRENE DE ALTA POTÊNCIA</span>
                </>
              )}
            </button>
          )}

          {/* Localização GPS Atual */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
                Sua Localização GPS Atual
              </span>
              {isLoadingLoc ? (
                <span className="text-[10px] text-slate-400 animate-pulse">Obtendo satélite...</span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700">✓ Precisão: {Math.round(location?.accuracy || 0)}m</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
              <span>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'A aguardar GPS...'}</span>
              {location && (
                <a
                  href={location.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 text-[11px] font-bold hover:underline flex items-center gap-1"
                >
                  Ver Mapa <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Botão de Disparo para a Nuvem / Central Mozbiscates */}
          <div className="pt-1">
            <button
              onClick={handleSendCloudAlert}
              disabled={isSendingAlert || alertSent}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${
                alertSent
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-red-500 text-red-700 hover:bg-red-50 active:scale-98'
              }`}
            >
              {isSendingAlert ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  <span>Registando Alerta na Central...</span>
                </>
              ) : alertSent ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Alerta Registado na Central Mozbiscates</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  <span>Registar Ocorrência na Central (Admin)</span>
                </>
              )}
            </button>
          </div>

          {/* Enviar WhatsApp SOS para Contacto de Confiança */}
          <div className="space-y-1.5">
            <a
              href={whatsappSosUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {emergencyPhone
                  ? `Enviar WhatsApp SOS (${emergencyPhone})`
                  : 'Enviar WhatsApp SOS com Localização'}
              </span>
            </a>
            <p className="text-[9px] text-center text-slate-400">
              Dispara texto de emergência com link do mapa para seu contacto de confiança.
            </p>
          </div>

          {/* Linhas de Emergência de Moçambique */}
          <div className="pt-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Ligar Imediato para Autoridades (Moçambique)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {MOZ_EMERGENCY_NUMBERS.map((item, idx) => (
                <a
                  key={idx}
                  href={item.tel}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex flex-col justify-between transition-all group active:scale-95"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-black text-red-600 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" />
                      {item.number}
                    </span>
                    <span className="text-[8px] font-black uppercase bg-red-100 text-red-800 px-1.5 py-0.5 rounded-md">Ligar</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-800 line-clamp-1">{item.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-center">
          <p className="text-[9px] text-slate-500 font-semibold">
            🛡️ O Mozbiscates monitora incidentes para garantir que você e o prestador estejam sempre em segurança.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
