import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Web Audio API Siren Generator
 * Generates an unmistakable emergency siren tone without requiring external audio files.
 */
let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let sirenInterval: any = null;

export function startSirenSound(): boolean {
  try {
    if (oscillator) stopSirenSound();

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return false;

    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(650, audioCtx.currentTime);

    // Initial volume
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();

    // Modulate pitch up and down like an authentic emergency siren
    let pitchUp = true;
    sirenInterval = setInterval(() => {
      if (!audioCtx || !oscillator) return;
      const targetFreq = pitchUp ? 950 : 550;
      oscillator.frequency.exponentialRampToValueAtTime(targetFreq, audioCtx.currentTime + 0.35);
      pitchUp = !pitchUp;
    }, 400);

    return true;
  } catch (err) {
    console.warn('Could not start siren audio:', err);
    return false;
  }
}

export function stopSirenSound(): void {
  try {
    if (sirenInterval) {
      clearInterval(sirenInterval);
      sirenInterval = null;
    }
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  } catch (err) {
    console.warn('Error stopping siren audio:', err);
  }
}

/**
 * Capture High-Accuracy GPS Coordinates
 */
export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  mapsUrl: string;
}

export async function getLiveLocation(): Promise<GpsLocation> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      // Default fallback (Maputo center)
      resolve({
        latitude: -25.9692,
        longitude: 32.5732,
        accuracy: 1000,
        mapsUrl: 'https://www.google.com/maps?q=-25.9692,32.5732'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({
          latitude,
          longitude,
          accuracy,
          mapsUrl: `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        resolve({
          latitude: -25.9692,
          longitude: 32.5732,
          accuracy: 2000,
          mapsUrl: 'https://www.google.com/maps?q=-25.9692,32.5732'
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000
      }
    );
  });
}

/**
 * Register Emergency Alert in Firestore
 */
export interface EmergencyAlertPayload {
  userId: string;
  userName: string;
  userRole: 'client' | 'worker' | 'admin';
  userPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  jobId?: string;
  jobCategory?: string;
  bairro?: string;
  city?: string;
  location: GpsLocation;
  isSilent: boolean;
  notes?: string;
}

export async function sendEmergencyAlertToFirestore(payload: EmergencyAlertPayload): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'emergency_alerts'), {
      ...payload,
      status: 'EMERGENCIA_ATIVA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error('Failed to log emergency alert:', err);
    throw err;
  }
}

/**
 * Build WhatsApp SOS Direct Message
 */
export function buildWhatsAppSosUrl(
  emergencyPhone: string | undefined,
  userName: string,
  userRole: string,
  mapsUrl: string,
  bairro?: string
): string {
  const roleLabel = userRole === 'worker' ? 'Prestador/Biscateiro' : 'Cliente/Contratante';
  const localStr = bairro ? `Bairro: ${bairro}` : 'Localização em tempo real abaixo';
  
  const text = 
`🚨 *ALERTA DE EMERGÊNCIA - MOZBISCATES!*
⚠️ Estou em perigo imediato / suspeita de crime!

👤 *Nome:* ${userName || 'Utilizador Mozbiscates'} (${roleLabel})
📍 *Zona:* ${localStr}
🗺️ *Localização GPS Exata:*
${mapsUrl}

⏰ *Hora:* ${new Date().toLocaleTimeString('pt-MZ')}
Por favor enviem a Polícia (112) ou socorro urgente!`;

  const cleanPhone = (emergencyPhone || '').replace(/\D/g, '');
  const phoneParam = cleanPhone.length >= 8 ? `phone=${cleanPhone.startsWith('258') ? cleanPhone : '258' + cleanPhone}&` : '';
  
  return `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
}

/**
 * Emergency Phone Numbers for Mozambique
 */
export const MOZ_EMERGENCY_NUMBERS = [
  { name: 'PRM - Polícia da República de Moçambique', number: '112', tel: 'tel:112', desc: 'Central Nacional de Emergência Policial' },
  { name: 'PRM Linha Alternativa', number: '119', tel: 'tel:119', desc: 'Denúncias e Piquete Geral' },
  { name: 'Emergência Médica / Ambulância', number: '117', tel: 'tel:117', desc: 'Pronto Socorro & Apoio de Saúde' },
  { name: 'SENSAP - Bombeiros de Moçambique', number: '198', tel: 'tel:198', desc: 'Resgate, Incêndios e Salvamento' },
];
