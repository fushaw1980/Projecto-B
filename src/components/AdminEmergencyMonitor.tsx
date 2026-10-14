import React from 'react';
import { ShieldAlert, MapPin, PhoneCall, ExternalLink, Clock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AdminEmergencyMonitorProps {
  alerts: any[];
}

export const AdminEmergencyMonitor: React.FC<AdminEmergencyMonitorProps> = ({ alerts }) => {
  const handleResolveAlert = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'emergency_alerts', alertId), {
        status: 'RESOLVIDO',
        resolvedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao resolver alerta:', err);
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'EMERGENCIA_ATIVA');
  const resolvedAlerts = alerts.filter(a => a.status === 'RESOLVIDO');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-red-600 text-white rounded-3xl shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-tight">Monitor de Segurança SOS Anti-Crime</h3>
            <p className="text-xs text-red-100">Controlo de ocorrências e socorro imediato aos utilizadores</p>
          </div>
        </div>
        <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-black">
          {activeAlerts.length} Ativo{activeAlerts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-natural-line">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-base font-bold text-natural-heading">Nenhum Alerta Ativo</h4>
          <p className="text-xs text-natural-muted mt-1">Todos os biscates e utilizadores estão a operar em segurança.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((al) => {
            const isAtivo = al.status === 'EMERGENCIA_ATIVA';
            const dateStr = al.createdAt?.toDate 
              ? al.createdAt.toDate().toLocaleString('pt-MZ') 
              : al.createdAt?.seconds 
              ? new Date(al.createdAt.seconds * 1000).toLocaleString('pt-MZ') 
              : 'Agora';

            return (
              <div
                key={al.id}
                className={`p-5 rounded-3xl border-2 transition-all shadow-sm ${
                  isAtivo 
                    ? 'bg-red-50/70 border-red-400 shadow-red-200' 
                    : 'bg-white border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      isAtivo ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isAtivo ? '🚨 Perigo Ativo' : '✓ Resolvido'}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3" /> {dateStr}
                    </span>
                  </div>
                  {isAtivo && (
                    <button
                      onClick={() => handleResolveAlert(al.id)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-[10px] font-black uppercase text-slate-700"
                    >
                      Marcar Resolvido
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-natural-heading flex items-center gap-1.5">
                        <User className="w-4 h-4 text-natural-muted" />
                        {al.userName}
                      </p>
                      <p className="text-[11px] text-slate-600 font-semibold">
                        Papel: <span className="font-bold uppercase text-natural-accent">{al.userRole}</span>
                        {al.userPhone && ` • Tel: ${al.userPhone}`}
                      </p>
                    </div>
                  </div>

                  {al.emergencyContactPhone && (
                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold text-red-900">Contacto de Confiança:</span> {al.emergencyContactName} ({al.emergencyContactPhone})
                    </div>
                  )}

                  {al.location && (
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800">
                        <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{al.location.latitude?.toFixed(5)}, {al.location.longitude?.toFixed(5)}</span>
                      </div>
                      <a
                        href={al.location.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-blue-700 shadow-sm"
                      >
                        Ver no Mapa <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {al.userPhone && (
                      <a
                        href={`tel:${al.userPhone}`}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Ligar Utilizador
                      </a>
                    )}
                    <a
                      href="tel:112"
                      className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Ligar 112 (PRM)
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
