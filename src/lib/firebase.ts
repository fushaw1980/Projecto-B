import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const DEMO_ACCOUNTS = {
  worker: {
    email: 'pandavlogs419@gmail.com',
    role: 'worker' as const,
    fullName: 'Panda Vlogs (Biscateiro Demo)',
    phone: '258841112233',
    city: 'Maputo Cidade',
    bairro: 'Polana Caniço',
    category: 'Electricista Profissional',
    specialty: 'Electricista Profissional',
    specialties: ['Electricista Profissional'],
    level: 2,
    jobs: 12,
    rating: 4.9
  },
  client: {
    email: 'mrwanderboy7@gmail.com',
    role: 'client' as const,
    fullName: 'Wander Boy (Cliente Demo)',
    phone: '258842223344',
    city: 'Maputo Cidade',
    bairro: 'Polana Cimento'
  }
} as const;

export function getDemoAccountConfig(email?: string | null) {
  const normalized = (email || '').trim().toLowerCase();
  if (normalized === DEMO_ACCOUNTS.worker.email) return DEMO_ACCOUNTS.worker;
  if (normalized === DEMO_ACCOUNTS.client.email) return DEMO_ACCOUNTS.client;
  return null;
}

export function isDemoPresentationEmail(email?: string | null): boolean {
  return Boolean(getDemoAccountConfig(email));
}

export async function provisionDemoAccount(
  email: string,
  password: string,
  profileData: {
    role: 'worker' | 'client';
    fullName: string;
    phone: string;
    city: string;
    bairro: string;
    category?: string;
    specialty?: string;
    specialties?: readonly string[];
    level?: number;
    jobs?: number;
    rating?: number;
  }
): Promise<{ uid: string; email: string; role: 'worker' | 'client'; created: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || password.length < 6) {
    throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.');
  }

  const existingSecApp = getApps().find((a) => a.name === 'demo-provisioner');
  const secApp = existingSecApp || initializeApp(firebaseConfig, 'demo-provisioner');
  const secAuth = getAuth(secApp);
  const secDb = existingSecApp
    ? getFirestore(secApp, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(secApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secAuth, normalizedEmail, password);
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      try {
        cred = await signInWithEmailAndPassword(secAuth, normalizedEmail, password);
      } catch (signInErr: any) {
        if (
          signInErr?.code === 'auth/wrong-password' ||
          signInErr?.code === 'auth/invalid-credential'
        ) {
          throw new Error(
            `A conta ${normalizedEmail} já existe com outra palavra-passe. Introduza a palavra-passe atual ou use a recuperação de acesso.`
          );
        }
        throw signInErr;
      }
    } else {
      throw err;
    }
  }

  try {
    const uid = cred.user.uid;
    const authEmail = (cred.user.email || normalizedEmail).toLowerCase();
    const userRef = doc(secDb, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email: authEmail,
        role: profileData.role,
        fullName: profileData.fullName,
        phone: profileData.phone,
        city: profileData.city,
        bairro: profileData.bairro,
        ...(profileData.role === 'worker'
          ? {
              category: profileData.category || 'Electricista Profissional',
              specialty: profileData.specialty || profileData.category || 'Electricista Profissional',
              specialties: [...(profileData.specialties || [profileData.category || 'Electricista Profissional'])],
              level: profileData.level ?? 2,
              jobs: profileData.jobs ?? 0,
              rating: profileData.rating ?? 5.0
            }
          : {}),
        photo: '',
        balance: 0,
        verified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      });
    } else {
      const existing = snap.data() || {};
      await updateDoc(userRef, {
        role: profileData.role,
        fullName: existing.fullName || profileData.fullName,
        phone: existing.phone || profileData.phone,
        city: existing.city || profileData.city,
        bairro: existing.bairro || profileData.bairro,
        ...(profileData.role === 'worker'
          ? {
              category: existing.category || profileData.category || 'Electricista Profissional',
              specialty: existing.specialty || profileData.specialty || 'Electricista Profissional',
              specialties: existing.specialties || [...(profileData.specialties || ['Electricista Profissional'])]
            }
          : {}),
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      });
    }

    await setDoc(
      doc(secDb, 'users', uid, 'private_profile', 'security'),
      {
        userId: uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return {
      uid,
      email: authEmail,
      role: profileData.role,
      created: !snap.exists()
    };
  } finally {
    await signOut(secAuth).catch(() => {});
  }
}

// Connectivity check with detailed logging
async function checkFirestoreConnection() {
  try {
    const testDoc = doc(db, '_connection_test_', 'ping');
    await getDocFromServer(testDoc);
    console.log("✅ Firestore connected successfully");
  } catch (error: any) {
    console.warn("⚠️ Firestore connection notice:", error.message);
    if (error.code === 'unavailable') {
      console.error("Critical: Firestore is currently unreachable. Retrying in background...");
    }
  }
}
checkFirestoreConnection();
