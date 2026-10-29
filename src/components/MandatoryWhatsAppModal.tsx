import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, CheckCircle2, AlertCircle, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { isValidMozPhone, cleanPhone, normalizeMozPhone } from '../lib/phoneUtils';

interface MandatoryWhatsAppModalProps {
  isOpen: boolean;
  userRole?: string | null;
  currentPhone?: string | null;
  onSavePhone: (phone: string) => Promise<void>;
  userName?: string | null;
}

export const MandatoryWhatsAppModal: React.FC<MandatoryWhatsAppModalProps> = ({
  isOpen,
  userRole,
  currentPhone,
  onSavePhone,
  userName
}) => {
  const [phoneInput, setPhoneInput] = useState(currentPhone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanPhone(phoneInput);

    if (!clean) {
      setError('Por favor, introduza o seu número de WhatsApp.');
      return;
    }

    if (!isValidMozPhone(clean)) {
      setError('Número de telefone inválido. Introduza um contacto móvel válido de Moçambique (ex: 84/85/86/87...).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Normaliza para formato completo internacional com 258
      const normalized = normalizeMozPhone(clean);
      await onSavePhone(normalized);
    } catch (err: any) {
      console.error('Error saving WhatsApp phone:', err);
      setError(err?.message || 'Erro ao guardar número do WhatsApp. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-natural-heading/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border-2 border-natural-line overflow-hidden my-auto text-left"
      >
        {/* Header WhatsApp em Verde Oficial */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white p-6 relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shrink-0">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                Contacto Directo Obrigatório
              </span>
              <h2 className="text-xl font-black tracking-tight leading-tight mt-0.5">
                Número do WhatsApp
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <h3 className="text-base font-black text-natural-heading leading-tight">
              Olá{userName ? `, ${userName}` : ''}! 📱
            </h3>
            <p className="text-xs text-natural-muted font-bold leading-relaxed">
              No <strong>Mozbiscates</strong>, o contacto por WhatsApp é obrigatório para que clientes e biscateiros possam enviar e receber formulários, propostas e orçamentos de forma <strong>directa e imediata</strong>.
            </p>
          </div>

          {/* Vantagens do WhatsApp Obrigatório */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 text-[11px] font-bold text-emerald-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Receba pedidos e formulários de serviços directamente.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Converse com {userRole === 'worker' ? 'clientes' : 'prestadores'} com um só clique.</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Maior segurança e transparência na negociação de biscates.</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo de Número de WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-natural-muted ml-2">
              Seu Número de WhatsApp (Moçambique) *
            </label>
            <div className="flex items-center bg-natural-surface border-2 border-natural-line rounded-2xl p-2.5 focus-within:border-emerald-600 focus-within:bg-white transition-all shadow-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-natural-line/80 rounded-xl font-mono font-black text-xs text-natural-heading shrink-0 shadow-2xs">
                <span>🇲🇿</span>
                <span>+258</span>
              </div>
              <input
                type="tel"
                required
                autoFocus
                placeholder="Ex: 84 123 4567"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setError(null);
                }}
                className="w-full pl-3 pr-2 py-1.5 bg-transparent outline-none font-mono font-bold text-sm text-natural-heading"
              />
            </div>
            <p className="text-[9px] text-natural-muted/80 ml-2 font-medium">
              Válido para Vodacom (84/85), Tmcel (82/83) e Movitel (86/87).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar & Continuar no App</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
