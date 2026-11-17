import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  increment,
  collection,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validação silenciosa de conectividade ao Firestore no arranque
(async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline: verifique a ligação à internet ou configuração.');
    }
  }
})();

export const ADMIN_EMAILS = [
  'fushawshaw@gmail.com',
  'wanderj419@gmail.com',
  'mozbiscates@gmail.com'
] as const;

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  return (ADMIN_EMAILS as readonly string[]).includes(normalized);
}

function getSecondaryClients() {
  const existingSecApp = getApps().find((a) => a.name === 'admin-auth-helper');
  const secApp = existingSecApp || initializeApp(firebaseConfig, 'admin-auth-helper');
  const secAuth = getAuth(secApp);
  return { secAuth };
}

export async function deleteAccountAuthWithPassword(
  email: string,
  password: string
): Promise<{ uid: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (isAuthorizedAdminEmail(normalizedEmail)) {
    throw new Error('Contas de administrador protegidas não podem ser apagadas por aqui.');
  }
  if (!password || password.length < 1) {
    throw new Error('Introduza a palavra-passe atual da conta.');
  }
  const { secAuth } = getSecondaryClients();
  try {
    const cred = await signInWithEmailAndPassword(secAuth, normalizedEmail, password);
    const uid = cred.user.uid;
    await deleteUser(cred.user);
    return { uid };
  } catch (err: any) {
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      throw new Error(`Palavra-passe incorreta para ${normalizedEmail}. Use a senha atual correta ou o link de redefinição por e-mail.`);
    }
    if (err?.code === 'auth/user-not-found') {
      throw new Error(`A conta ${normalizedEmail} já não existe no Firebase Auth.`);
    }
    throw err;
  } finally {
    await signOut(secAuth).catch(() => {});
  }
}

export async function adminWipeUserFirestore(
  targetUid: string,
  options?: { deleteJobs?: boolean }
): Promise<{ deletedDocs: number; deletedJobs: number }> {
  if (!targetUid) throw new Error('UID inválido.');
  let deletedDocs = 0;
  let deletedJobs = 0;

  // 1. Limpar subcolecções do utilizador
  for (const sub of ['private_profile', 'reviews', 'transactions'] as const) {
    try {
      const subSnap = await getDocs(collection(db, 'users', targetUid, sub));
      for (const d of subSnap.docs) {
        await deleteDoc(d.ref);
        deletedDocs += 1;
      }
    } catch (e) {
      console.warn(`Aviso ao limpar subcolecção ${sub}:`, e);
    }
  }

  // 2. Limpar questionários de inactividade e alertas SOS associados
  for (const colName of ['inactivity_feedback', 'emergency_alerts'] as const) {
    try {
      const q = query(collection(db, colName), where('userId', '==', targetUid));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        deletedDocs += 1;
      }
    } catch (e) {
      console.warn(`Aviso ao limpar ${colName}:`, e);
    }
  }

  // 3. Opcionalmente limpar biscates associados (como prestador ou cliente)
  if (options?.deleteJobs) {
    const seenJobIds = new Set<string>();
    for (const field of ['providerId', 'clientId'] as const) {
      try {
        const jobsSnap = await getDocs(query(collection(db, 'jobs'), where(field, '==', targetUid)));
        for (const jobDoc of jobsSnap.docs) {
          if (seenJobIds.has(jobDoc.id)) continue;
          seenJobIds.add(jobDoc.id);
          try {
            const msgSnap = await getDocs(collection(db, 'jobs', jobDoc.id, 'messages'));
            for (const m of msgSnap.docs) {
              await deleteDoc(m.ref);
              deletedDocs += 1;
            }
          } catch (msgErr) {
            console.warn('Aviso ao limpar mensagens do biscate:', msgErr);
          }
          await deleteDoc(jobDoc.ref);
          deletedJobs += 1;
          deletedDocs += 1;
        }
      } catch (jobErr) {
        console.warn(`Aviso ao limpar jobs (${field}):`, jobErr);
      }
    }
  }

  // 4. Apagar documento principal do utilizador
  await deleteDoc(doc(db, 'users', targetUid));
  deletedDocs += 1;

  return { deletedDocs, deletedJobs };
}

export {};
