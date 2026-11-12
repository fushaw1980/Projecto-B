import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Camera,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Save,
  X,
  Briefcase,
  FileText,
  Star,
  Wallet,
  HeartHandshake,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Search,
  MessageCircle,
  Globe
} from 'lucide-react';
import { compressImage } from '../lib/imageOptimizer';
import {
  cleanPhone,
  isValidMozPhone,
  normalizeMozPhone,
  formatDisplayPhone,
  getWhatsAppUrl
} from '../lib/phoneUtils';
import { ALL_SPECIALTIES, FREQUENT_CATEGORIES } from '../data/specialties';

export interface ProfileUpdatePayload {
  fullName: string;
  phone: string;
  city: string;
  bairro: string;
  photo: string;
  biPhoto: string;
  biSelfie?: string;
  nuit?: string;
  category?: string;
  portfolio?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

interface UserProfileViewProps {
  currentUser: any;
  userData: any;
  role: 'client' | 'worker' | 'admin' | null;
  isManager: boolean;
  balance: number;
  jobsCount: number;
  lang: 'pt' | 'en' | 'em';
  setLang: (l: 'pt' | 'en' | 'em') => void;
  t: any;
  onSaveProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  onSwitchRole: () => void;
  onLogout: () => void;
}

const CITIES = [
  'Maputo Cidade',
  'Matola',
  'Beira',
  'Nampula',
  'Chimoio',
  'Quelimane',
  'Tete',
  'Inhambane',
  'Gaza / Xai-Xai',
  'Pemba / C. Delgado',
  'Lichinga / Niassa'
];

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  userData,
  role,
  isManager,
  balance,
  jobsCount,
  lang,
  setLang,
  t,
  onSaveProfile,
  onSwitchRole,
  onLogout
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPrivateDocs, setShowPrivateDocs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState(userData?.fullName || currentUser?.displayName || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [city, setCity] = useState(userData?.city || 'Maputo Cidade');
  const [bairro, setBairro] = useState(userData?.bairro || '');
  const [photo, setPhoto] = useState<string>(userData?.photo || '');
  const [biPhoto, setBiPhoto] = useState<string>(userData?.biPhoto || '');
  const [biSelfie, setBiSelfie] = useState<string>(userData?.biSelfie || '');
  const [nuit, setNuit] = useState<string>(userData?.nuit || '');
  const [category, setCategory] = useState<string>(userData?.category || 'Electricista Profissional');
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [portfolio, setPortfolio] = useState<string[]>(Array.isArray(userData?.portfolio) ? userData.portfolio : []);
  const [emergencyContactName, setEmergencyContactName] = useState<string>(userData?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>(userData?.emergencyContactPhone || '');

  // Keep form synced with external Firestore snapshots when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setFullName(userData?.fullName || currentUser?.displayName || '');
      setPhone(userData?.phone || '');
      setCity(userData?.city || 'Maputo Cidade');
      setBairro(userData?.bairro || '');
      setPhoto(userData?.photo || '');
      setBiPhoto(userData?.biPhoto || '');
      setBiSelfie(userData?.biSelfie || '');
      setNuit(userData?.nuit || '');
      setCategory(userData?.category || 'Electricista Profissional');
      setPortfolio(Array.isArray(userData?.portfolio) ? userData.portfolio : []);
      setEmergencyContactName(userData?.emergencyContactName || '');
      setEmergencyContactPhone(userData?.emergencyContactPhone || '');
    }
  }, [userData, currentUser, isEditing]);

  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return [];
    const q = specialtySearch.toLowerCase();
    return ALL_SPECIALTIES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.categoryGroup.toLowerCase().includes(q)
    );
  }, [specialtySearch]);

  const handleImageUpload = (setter: (val: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImg(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 800, 800, 0.72);
      setter(compressed);
    } catch {
      setError('Erro ao carregar imagem. Tente uma fotografia mais leve.');
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleAddPortfolio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || portfolio.length >= 3) return;
    setIsProcessingImg(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 800, 800, 0.7);
      setPortfolio((prev) => [...prev, compressed]);
    } catch {
      setError('Erro ao otimizar foto do portfólio.');
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    setSpecialtySearch('');
    setFullName(userData?.fullName || currentUser?.displayName || '');
    setPhone(userData?.phone || '');
    setCity(userData?.city || 'Maputo Cidade');
    setBairro(userData?.bairro || '');
    setPhoto(userData?.photo || '');
    setBiPhoto(userData?.biPhoto || '');
    setBiSelfie(userData?.biSelfie || '');
    setNuit(userData?.nuit || '');
    setCategory(userData?.category || 'Electricista Profissional');
    setPortfolio(Array.isArray(userData?.portfolio) ? userData.portfolio : []);
    setEmergencyContactName(userData?.emergencyContactName || '');
    setEmergencyContactPhone(userData?.emergencyContactPhone || '');
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Por favor, informe o seu nome completo.');
      return;
    }

    const cleanedPhone = cleanPhone(phone);
    if (!cleanedPhone || !isValidMozPhone(cleanedPhone)) {
      setError('Informe um número de WhatsApp válido em Moçambique (ex: 84 123 4567).');
      return;
    }

    if (!isManager && !biPhoto) {
      setError('O Bilhete de Identidade (BI) é obrigatório para contas de clientes e biscateiros (dispensado apenas para gerentes).');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveProfile({
        fullName: fullName.trim().slice(0, 100),
        phone: normalizeMozPhone(cleanedPhone),
        city: city.trim().slice(0, 80),
        bairro: bairro.trim().slice(0, 80),
        photo: photo || '',
        biPhoto: biPhoto || '',
        biSelfie: biSelfie || '',
        nuit: nuit.trim(),
        category: role === 'worker' ? category : undefined,
        portfolio: role === 'worker' ? portfolio : undefined,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim()
      });
      setIsEditing(false);
      setSuccessMsg('As suas informações foram atualizadas com sucesso.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível guardar as alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    role === 'admin'
      ? 'Gerência / Administrador'
      : role === 'worker'
        ? 'Biscateiro (Prestador)'
        : 'Cliente';

  const memberSince = useMemo(() => {
    const raw = userData?.createdAt;
    if (!raw) return null;
    try {
      const date = typeof raw.toDate === 'function' ? raw.toDate() : raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('pt-MZ', { month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  }, [userData?.createdAt]);

  const hasValidPhone = Boolean(userData?.phone && isValidMozPhone(cleanPhone(userData.phone)));
  const biStatusLabel = isManager
    ? userData?.biPhoto
      ? 'BI Registado · Gerência'
      : 'Dispensado (Gerência)'
    : userData?.biPhoto
      ? 'BI Verificado'
      : 'BI Pendente (Obrigatório)';

  return (
    <main className="flex-1 px-5 pt-4 pb-32 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Feedback Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Identity Overview Card */}
      <section className="bg-white border border-natural-line rounded-[2rem] p-6 shadow-premium">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-3xl bg-natural-surface border-2 border-natural-line overflow-hidden flex items-center justify-center">
              {photo ? (
                <img src={photo} alt={fullName || 'Foto de perfil'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-9 h-9 text-natural-muted/50" />
              )}
            </div>
            {isEditing && (
              <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-natural-accent text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" capture="user" onChange={handleImageUpload(setPhoto)} />
              </label>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-natural-heading tracking-tight truncate">
              {userData?.fullName || currentUser?.displayName || 'Utilizador Mozbiscates'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-natural-muted mt-1">
              <span className="text-natural-heading font-bold">{roleLabel}</span>
              <span aria-hidden="true">·</span>
              <span className={userData?.biPhoto || isManager ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                {biStatusLabel}
              </span>
              {memberSince && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Desde {memberSince}</span>
                </>
              )}
            </div>
            <p className="text-xs text-natural-muted font-mono truncate mt-1.5">
              {currentUser?.email || 'Sem e-mail'}
            </p>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-natural-line">
          <div className="text-center">
            <p className="text-lg font-black text-natural-heading tabular-nums">
              {role === 'worker' ? (userData?.jobs ?? jobsCount ?? 0) : jobsCount}
            </p>
            <p className="text-[10px] font-bold text-natural-muted uppercase tracking-wider mt-0.5">
              Biscates
            </p>
          </div>

          {role === 'worker' ? (
            <>
              <div className="text-center border-x border-natural-line">
                <p className="text-lg font-black text-natural-heading tabular-nums">
                  {userData?.rating ? Number(userData.rating).toFixed(1) : '5.0'} ★
                </p>
                <p className="text-[10px] font-bold text-natural-muted uppercase tracking-wider mt-0.5">
                  Nível {userData?.level || 1}
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-natural-success tabular-nums">
                  {Number(balance || 0).toLocaleString('pt-MZ')} MT
                </p>
                <p className="text-[10px] font-bold text-natural-muted uppercase tracking-wider mt-0.5">
                  Saldo
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center border-x border-natural-line">
                <p className={`text-sm font-black ${hasValidPhone ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {hasValidPhone ? 'Ativo' : 'Pendente'}
                </p>
                <p className="text-[10px] font-bold text-natural-muted uppercase tracking-wider mt-0.5">
                  WhatsApp
                </p>
              </div>
              <div className="text-center">
                <p className={`text-sm font-black ${userData?.biPhoto || isManager ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isManager ? 'Gerente' : userData?.biPhoto ? 'Auditado' : 'Em falta'}
                </p>
                <p className="text-[10px] font-bold text-natural-muted uppercase tracking-wider mt-0.5">
                  Segurança
                </p>
              </div>
            </>
          )}
        </div>

        {/* Primary Action */}
        <div className="mt-5">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccessMsg(null);
                setIsEditing(true);
              }}
              className="w-full min-h-[44px] py-3 px-4 bg-natural-accent text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-accent-glow hover:opacity-95 active:scale-[0.99] transition-all whitespace-nowrap"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Minhas Informações</span>
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 min-h-[44px] py-3 px-4 bg-natural-surface border border-natural-line text-natural-heading rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-natural-line/40 transition-colors whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving || isProcessingImg}
                className="flex-[1.5] min-h-[44px] py-3 px-4 bg-natural-success text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'A guardar...' : isProcessingImg ? 'A otimizar...' : 'Guardar Alterações'}</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <form id="user-profile-form" onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Dados Pessoais & Contacto */}
        <section className="bg-white border border-natural-line rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-natural-line pb-3">
            <h3 className="text-sm font-black text-natural-heading uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-natural-accent" />
              <span>Dados Pessoais & Contacto</span>
            </h3>
          </div>

          <div className="space-y-4">
            {/* Nome Completo */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                Nome Completo
              </label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: João Carlos Mondlane"
                  className="w-full px-4 py-3 bg-natural-surface border border-natural-line rounded-xl text-sm font-semibold text-natural-heading focus:bg-white focus:border-natural-accent outline-none transition-colors"
                />
              ) : (
                <p className="text-sm font-bold text-natural-heading">
                  {userData?.fullName || 'Não definido'}
                </p>
              )}
            </div>

            {/* E-mail */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                E-mail da Conta
              </label>
              <div className="flex items-center gap-2 text-sm font-semibold text-natural-heading">
                <Mail className="w-4 h-4 text-natural-muted shrink-0" />
                <span className="font-mono text-xs break-all">{currentUser?.email || 'Não disponível'}</span>
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                WhatsApp de Contacto (Moçambique)
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-natural-surface border border-emerald-300 rounded-xl focus-within:bg-white focus-within:border-emerald-600 transition-colors">
                  <span className="font-mono font-black text-xs text-emerald-800 shrink-0">🇲🇿 +258</span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="84 123 4567"
                    className="w-full bg-transparent text-sm font-semibold text-natural-heading font-mono outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold font-mono text-natural-heading tabular-nums">
                      {userData?.phone ? formatDisplayPhone(userData.phone) : 'Não registado'}
                    </span>
                  </div>
                  {hasValidPhone && (
                    <a
                      href={getWhatsAppUrl(userData.phone, 'Olá! Teste de contacto Mozbiscates.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Testar WhatsApp</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Cidade e Bairro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                  Cidade / Província
                </label>
                {isEditing ? (
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-3 bg-natural-surface border border-natural-line rounded-xl text-sm font-semibold text-natural-heading focus:bg-white focus:border-natural-accent outline-none"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-natural-heading">
                    <MapPin className="w-4 h-4 text-natural-accent shrink-0" />
                    <span>{userData?.city || 'Maputo Cidade'}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                  Bairro
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Ex: Polana Caniço, Sommerschield..."
                    className="w-full px-4 py-3 bg-natural-surface border border-natural-line rounded-xl text-sm font-semibold text-natural-heading focus:bg-white focus:border-natural-accent outline-none"
                  />
                ) : (
                  <p className="text-sm font-bold text-natural-heading">
                    {userData?.bairro || 'Não definido'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Perfil Profissional (Workers only) */}
        {role === 'worker' && (
          <section className="bg-white border border-natural-line rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-natural-line pb-3">
              <h3 className="text-sm font-black text-natural-heading uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-natural-accent" />
                <span>Dados Profissionais</span>
              </h3>
            </div>

            <div className="space-y-4">
              {/* Especialidade */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                  Especialidade / Ofício Principal
                </label>
                {isEditing ? (
                  <div className="space-y-2.5 bg-natural-surface/60 p-3.5 rounded-2xl border border-natural-line">
                    <p className="text-xs font-black text-natural-accent">Selecionada: {category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FREQUENT_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-colors ${
                            category === cat
                              ? 'bg-natural-accent text-white'
                              : 'bg-white border border-natural-line text-natural-heading hover:border-natural-accent'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="bg-white border border-natural-line p-2.5 rounded-xl flex items-center gap-2">
                      <Search className="w-4 h-4 text-natural-muted shrink-0" />
                      <input
                        type="text"
                        value={specialtySearch}
                        onChange={(e) => setSpecialtySearch(e.target.value)}
                        placeholder="Pesquisar outra especialidade..."
                        className="w-full text-xs font-semibold outline-none bg-transparent"
                      />
                    </div>
                    {filteredSpecialties.length > 0 && specialtySearch && (
                      <div className="bg-white border border-natural-line rounded-xl max-h-36 overflow-y-auto p-1 space-y-0.5">
                        {filteredSpecialties.slice(0, 8).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setCategory(item.name);
                              setSpecialtySearch('');
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-natural-surface flex items-center justify-between"
                          >
                            <span>{item.name}</span>
                            <span className="text-[10px] text-natural-muted">{item.categoryGroup}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-natural-heading">
                    {userData?.category || 'Não definida'}
                  </p>
                )}
              </div>

              {/* NUIT */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-1">
                  NUIT (Opcional)
                </label>
                {isEditing ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-natural-surface border border-natural-line rounded-xl focus-within:bg-white focus-within:border-natural-accent">
                    <FileText className="w-4 h-4 text-natural-muted shrink-0" />
                    <input
                      type="text"
                      value={nuit}
                      onChange={(e) => setNuit(e.target.value)}
                      placeholder="Número de NUIT (ex: 123456789)"
                      className="w-full bg-transparent text-sm font-semibold font-mono outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-bold font-mono text-natural-heading">
                    {userData?.nuit || 'Não informado'}
                  </p>
                )}
              </div>

              {/* Portfólio */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-2">
                  Portfólio de Trabalhos ({portfolio.length}/3)
                </label>
                <div className="flex flex-wrap gap-3">
                  {portfolio.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-natural-line">
                      <img src={img} alt={`Trabalho ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setPortfolio((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-white/90 text-red-600 p-1 rounded-full shadow-sm"
                          title="Remover foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && portfolio.length < 3 && (
                    <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-natural-line flex flex-col items-center justify-center cursor-pointer hover:bg-natural-surface transition-colors">
                      <Plus className="w-5 h-5 text-natural-muted mb-1" />
                      <span className="text-[9px] font-black uppercase text-natural-muted">Adicionar</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleAddPortfolio} />
                    </label>
                  )}
                  {!isEditing && portfolio.length === 0 && (
                    <p className="text-xs font-medium text-natural-muted">Nenhuma fotografia adicionada ao portfólio.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Segurança, BI & Emergência SOS */}
        <section className="bg-white border border-natural-line rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-natural-line pb-3">
            <h3 className="text-sm font-black text-natural-heading uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Segurança, BI & Emergência SOS</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowPrivateDocs((v) => !v)}
              className="text-xs font-bold text-natural-muted hover:text-natural-heading flex items-center gap-1 px-2 py-1 rounded-lg"
            >
              {showPrivateDocs ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPrivateDocs ? 'Ocultar BI' : 'Ver BI'}</span>
            </button>
          </div>

          {/* BI & Selfie */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-natural-heading">Bilhete de Identidade (BI)</span>
              <span className={`font-bold ${isManager || biPhoto ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isManager ? 'Dispensado para Gerência' : biPhoto ? 'Carregado' : 'Obrigatório'}
              </span>
            </div>

            {(showPrivateDocs || isEditing) && (
              <div className={`grid ${role === 'worker' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <div>
                  <p className="text-[10px] font-bold uppercase text-natural-muted mb-1">Frente do BI / DIRE</p>
                  {isEditing ? (
                    <label className="cursor-pointer block">
                      <div className="h-28 bg-natural-surface rounded-2xl border-2 border-dashed border-natural-line flex flex-col items-center justify-center overflow-hidden relative group">
                        {biPhoto ? (
                          <img src={biPhoto} alt="Bilhete de Identidade" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Lock className="w-5 h-5 text-natural-muted mb-1" />
                            <span className="text-[10px] font-bold text-natural-muted">
                              {isManager ? 'Carregar BI (Opcional)' : 'Carregar BI *'}
                            </span>
                          </>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload(setBiPhoto)} />
                    </label>
                  ) : biPhoto ? (
                    <img src={biPhoto} alt="Bilhete de Identidade" className="w-full h-32 object-cover rounded-2xl border border-natural-line" />
                  ) : (
                    <div className="h-24 bg-natural-surface rounded-2xl border border-natural-line flex items-center justify-center text-xs text-natural-muted font-semibold">
                      {isManager ? 'Dispensado para Gerência' : 'BI ainda não enviado'}
                    </div>
                  )}
                </div>

                {role === 'worker' && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-natural-muted mb-1">Selfie com BI</p>
                    {isEditing ? (
                      <label className="cursor-pointer block">
                        <div className="h-28 bg-natural-surface rounded-2xl border-2 border-dashed border-natural-line flex flex-col items-center justify-center overflow-hidden relative group">
                          {biSelfie ? (
                            <img src={biSelfie} alt="Selfie com BI" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Star className="w-5 h-5 text-natural-muted mb-1" />
                              <span className="text-[10px] font-bold text-natural-muted">Selfie com BI</span>
                            </>
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <input type="file" className="hidden" accept="image/*" capture="user" onChange={handleImageUpload(setBiSelfie)} />
                      </label>
                    ) : biSelfie ? (
                      <img src={biSelfie} alt="Selfie com BI" className="w-full h-32 object-cover rounded-2xl border border-natural-line" />
                    ) : (
                      <div className="h-24 bg-natural-surface rounded-2xl border border-natural-line flex items-center justify-center text-xs text-natural-muted font-semibold">
                        {isManager ? 'Opcional para Gerência' : 'Não enviada'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-natural-muted leading-relaxed">
              Os documentos de identificação ficam isolados no cofre privado da sua conta e nunca são expostos a outros utilizadores.
            </p>
          </div>

          {/* Contacto de Confiança SOS */}
          <div className="pt-4 border-t border-natural-line space-y-2">
            <div className="flex items-center gap-2 text-red-800">
              <HeartHandshake className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider">Contacto de Emergência SOS</span>
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Nome do parente/amigo"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-natural-surface border border-red-200 rounded-xl outline-none focus:bg-white focus:border-red-500"
                />
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="Telefone / WhatsApp SOS"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold font-mono bg-natural-surface border border-red-200 rounded-xl outline-none focus:bg-white focus:border-red-500"
                />
              </div>
            ) : (
              <div className="text-sm font-bold text-natural-heading">
                {userData?.emergencyContactName || userData?.emergencyContactPhone ? (
                  <span>
                    {userData?.emergencyContactName || 'Contacto SOS'}
                    {userData?.emergencyContactPhone ? ` · ${userData.emergencyContactPhone}` : ''}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-natural-muted">
                    Nenhum contacto de confiança configurado ainda.
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </form>

      {/* Section 4: Conta & Preferências */}
      <section className="bg-white border border-natural-line rounded-[2rem] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-natural-line pb-3">
          <h3 className="text-sm font-black text-natural-heading uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-natural-accent" />
            <span>Conta & Preferências</span>
          </h3>
        </div>

        {/* Idioma */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-natural-muted mb-2">
            Idioma da Aplicação
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-natural-surface rounded-xl border border-natural-line">
            {[
              { code: 'pt', label: 'Português' },
              { code: 'en', label: 'English' },
              { code: 'em', label: 'Emakhuwa' }
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLang(item.code as 'pt' | 'en' | 'em')}
                className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  lang === item.code
                    ? 'bg-white text-natural-heading shadow-sm'
                    : 'text-natural-muted hover:text-natural-heading'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trocar Perfil & Sair */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onSwitchRole}
            className="min-h-[44px] py-3 px-4 bg-natural-surface border border-natural-line text-natural-heading rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:border-natural-accent transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 text-natural-accent" />
            <span>Trocar Modo de Conta</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] py-3 px-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout || 'Terminar Sessão'}</span>
          </button>
        </div>
      </section>
    </main>
  );
};
