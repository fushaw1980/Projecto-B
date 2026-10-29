import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, User, Phone, MapPin, Camera, Lock, CheckCircle2, AlertTriangle, HeartHandshake } from 'lucide-react';
import { compressImage } from '../lib/imageOptimizer';

import { isValidMozPhone, cleanPhone, normalizeMozPhone } from '../lib/phoneUtils';

interface ClientSecurityProfileModalProps {
  initialData?: any;
  onSave: (data: {
    fullName: string;
    phone: string;
    bairro: string;
    city: string;
    photo: string;
    biPhoto?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
  isMandatory?: boolean;
}

export const ClientSecurityProfileModal: React.FC<ClientSecurityProfileModalProps> = ({
  initialData,
  onSave,
  onCancel,
  isMandatory = false
}) => {
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [bairro, setBairro] = useState(initialData?.bairro || 'Polana Caniço');
  const [city, setCity] = useState(initialData?.city || 'Maputo Cidade');
  const [photo, setPhoto] = useState<string | null>(initialData?.photo || null);
  const [biPhoto, setBiPhoto] = useState<string | null>(initialData?.biPhoto || null);
  const [emergencyContactName, setEmergencyContactName] = useState(initialData?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialData?.emergencyContactPhone || '');
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (setter: (data: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImg(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 800, 800, 0.72);
      setter(compressed);
    } catch (err: any) {
      setError('Erro ao carregar imagem. Tente uma foto menor.');
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 3) {
      setError('Por favor, informe seu nome completo oficial.');
      return;
    }
    const clean = cleanPhone(phone);
    if (!clean || !isValidMozPhone(clean)) {
      setError('Informe um número de WhatsApp moçambicano válido (ex: 84/85/86/87...).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const normalizedPhone = normalizeMozPhone(clean);
      await onSave({
        fullName: fullName.trim(),
        phone: normalizedPhone,
        bairro: bairro.trim(),
        city: city.trim(),
        photo: photo || '',
        biPhoto: biPhoto || '',
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim()
      });
    } catch (err: any) {
      setError('Erro ao salvar cadastro de segurança. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border-2 border-natural-line overflow-hidden my-auto"
      >
        {/* Header de Segurança */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-6 relative">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Escudo de Segurança Mozbiscates</span>
              <h2 className="text-xl font-black tracking-tight leading-tight mt-0.5">Cadastro Seguro do Contratante</h2>
              <p className="text-xs text-emerald-100/80 mt-1 leading-snug">
                Proteção máxima contra roubos e ciladas: todos os clientes e prestadores são auditados por documento.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Fotos: Perfil e BI */}
          <div className="grid grid-cols-2 gap-4">
            {/* Foto de Perfil */}
            <div className="flex flex-col items-center p-3.5 bg-slate-50 border border-natural-line rounded-2xl">
              <label className="relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-white border-2 border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative">
                  {photo ? (
                    <img src={photo} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <input type="file" className="hidden" accept="image/*" capture="user" onChange={handleImageUpload(setPhoto)} />
              </label>
              <span className="text-[11px] font-bold text-natural-heading mt-2">Sua Foto de Perfil</span>
              <span className="text-[9px] text-natural-muted text-center mt-0.5">Rosto nítido (opcional)</span>
            </div>

            {/* Foto do BI (Obrigatória) */}
            <div className="flex flex-col items-center p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl">
              <label className="relative cursor-pointer group w-full">
                <div className="w-full h-20 rounded-xl bg-white border-2 border-dashed border-amber-300 overflow-hidden flex flex-col items-center justify-center relative">
                  {biPhoto ? (
                    <img src={biPhoto} alt="Foto BI" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5 text-amber-600 mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-800">Foto do BI *</span>
                    </>
                  )}
                  <div className="absolute inset-0 bg-amber-600/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload(setBiPhoto)} />
              </label>
              <span className="text-[11px] font-bold text-amber-900 mt-2 flex items-center gap-1">
                {biPhoto ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : null}
                Bilhete de Identidade (BI)
              </span>
              <span className="text-[9px] text-amber-700 text-center mt-0.5">Foto nítida da frente do BI/DIRE</span>
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                Nome Completo (como consta no BI) *
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-natural-line rounded-xl focus-within:border-emerald-600 focus-within:bg-white transition-all">
                <User className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Alberto Manuel Mondlane"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-sm font-semibold bg-transparent outline-none text-natural-heading"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 inline" />
                  <span>WhatsApp (Obrigatório) *</span>
                </label>
                <div className="flex items-center gap-1.5 px-3 py-3 bg-slate-50 border border-emerald-300 rounded-xl focus-within:border-emerald-600 focus-within:bg-white transition-all">
                  <span className="font-mono font-bold text-[11px] text-emerald-900 shrink-0">🇲🇿 +258</span>
                  <input
                    type="tel"
                    required
                    placeholder="84 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm font-semibold bg-transparent outline-none text-natural-heading font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                  Cidade / Província
                </label>
                <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-natural-line rounded-xl">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full text-sm font-semibold bg-transparent outline-none text-natural-heading"
                  >
                    <option value="Maputo Cidade">Maputo Cidade</option>
                    <option value="Matola">Matola</option>
                    <option value="Beira">Beira</option>
                    <option value="Nampula">Nampula</option>
                    <option value="Chimoio">Chimoio</option>
                    <option value="Quelimane">Quelimane</option>
                    <option value="Tete">Tete</option>
                    <option value="Inhambane">Inhambane</option>
                    <option value="Gaza / Xai-Xai">Gaza / Xai-Xai</option>
                    <option value="Pemba / C. Delgado">Pemba / Cabo Delgado</option>
                    <option value="Lichinga / Niassa">Lichinga / Niassa</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                Bairro de Residência *
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-natural-line rounded-xl focus-within:border-emerald-600 focus-within:bg-white transition-all">
                <MapPin className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Sommerchield, Polana, Malhangalene, Matola Gare..."
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full text-sm font-semibold bg-transparent outline-none text-natural-heading"
                />
              </div>
            </div>
          </div>

          {/* Contacto de Emergência (Para Alarme SOS) */}
          <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-red-900">
              <HeartHandshake className="w-4 h-4 text-red-600" />
              <span className="text-xs font-black uppercase tracking-wider">Contacto de Confiança (Emergência SOS)</span>
            </div>
            <p className="text-[10px] text-red-800 leading-tight">
              Parente ou amigo próximo que receberá sua localização exata caso você pressione o botão de pânico.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nome do parente/amigo"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold bg-white border border-red-200 rounded-xl outline-none"
              />
              <input
                type="tel"
                placeholder="Telefone / WhatsApp"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold bg-white border border-red-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            {!isMandatory && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-1/3 py-3.5 px-4 text-xs font-black uppercase tracking-wider text-natural-muted hover:text-natural-heading rounded-xl border border-natural-line"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || isProcessingImg}
              className={`flex-1 py-4 px-6 text-sm font-black uppercase tracking-wider text-white rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                isSubmitting ? 'bg-slate-400' : 'bg-emerald-700 hover:bg-emerald-800 active:scale-98 shadow-emerald-700/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A proteger cadastro...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Confirmar e Ativar Proteção</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
