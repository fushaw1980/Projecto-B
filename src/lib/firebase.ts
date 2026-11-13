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

export const ADMIN_EMAILS = [
  'fushawshaw@gmail.com',
  'wanderj419@gmail.com',
  'mozbiscates@gmail.com'
] as const;

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  return (ADMIN_EMAILS as readonly string[]).includes(normalized);
}

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

const DEMO_PASS_STORAGE_KEY = 'mozbiscates_demo_session_pass';

export function saveDemoSessionPassword(pass: string) {
  try {
    if (pass && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DEMO_PASS_STORAGE_KEY, pass);
    }
  } catch {}
}

export function getDemoSessionPassword(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(DEMO_PASS_STORAGE_KEY) || '';
    }
  } catch {}
  return '';
}

export function clearDemoSessionPassword() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(DEMO_PASS_STORAGE_KEY);
    }
  } catch {}
}

export async function switchDemoAccount(
  targetRole: 'worker' | 'client',
  password: string
) {
  const targetEmail =
    targetRole === 'worker' ? DEMO_ACCOUNTS.worker.email : DEMO_ACCOUNTS.client.email;
  const cleanPass = password.trim();
  if (cleanPass.length < 6) {
    throw new Error('Introduza a palavra-passe das contas demo (mín. 6 caracteres).');
  }
  const cred = await signInWithEmailAndPassword(auth, targetEmail, cleanPass);
  saveDemoSessionPassword(cleanPass);
  return cred.user;
}

export async function settleDemoJobClientFallback(
  job: {
    id: string;
    providerId: string;
    clientId: string;
    category?: string;
    amount: number;
    status: string;
  },
  callerUid: string
): Promise<{ fee: number; netAmount: number; transactionId: string }> {
  if (!job?.id || !job?.providerId || job.providerId === 'OPEN') {
    throw new Error('O pedido ainda não tem um prestador atribuído para receber a liquidação.');
  }
  const amount = Math.round(Number(job.amount) || 0);
  if (amount < 50 || amount > 500000) {
    throw new Error('Montante inválido para liquidação.');
  }

  const fee = Math.round(amount * 0.05);
  const netAmount = amount - fee;
  const txId = `TX_DEMO_${job.id.slice(0, 6)}_${Date.now()}`;

  await updateDoc(doc(db, 'jobs', job.id), {
    status: 'CONCLUIDO',
    payoutAmount: netAmount,
    platformFee: fee,
    payoutTransactionId: txId,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (job.providerId && job.providerId !== 'OPEN') {
    await updateDoc(doc(db, 'users', job.providerId), {
      balance: increment(netAmount),
      jobs: increment(1),
      updatedAt: serverTimestamp()
    }).catch((err) => {
      console.warn('Aviso ao creditar saldo do prestador demo:', err);
    });

    await setDoc(doc(db, 'users', job.providerId, 'transactions', txId), {
      id: txId,
      jobId: job.id,
      type: 'CREDIT_PAYOUT',
      grossAmount: amount,
      fee,
      netAmount,
      clientId: callerUid,
      providerId: job.providerId,
      description: `Liberação Escrow (Demo): Biscate ${job.category || ''}`.trim(),
      createdAt: serverTimestamp()
    }).catch((err) => {
      console.warn('Aviso ao gravar transação demo:', err);
    });
  }

  await addDoc(collection(db, 'jobs', job.id, 'messages'), {
    senderId: 'system',
    text: `🎉 Serviço Confirmado pelo Cliente! O valor líquido de ${netAmount} MT (taxa oficial de 5%: ${fee} MT) foi creditado ao prestador. ID: ${txId}`,
    createdAt: serverTimestamp()
  }).catch(() => {});

  return { fee, netAmount, transactionId: txId };
}

function getSecondaryClients() {
  const existingSecApp = getApps().find((a) => a.name === 'demo-provisioner');
  const secApp = existingSecApp || initializeApp(firebaseConfig, 'demo-provisioner');
  const secAuth = getAuth(secApp);
  const secDb = existingSecApp
    ? getFirestore(secApp, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(secApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
  return { secAuth, secDb };
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
      throw new Error(`Palavra-passe incorreta para ${normalizedEmail}. Use a senha antiga correta ou o link de redefinição por e-mail.`);
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

export async function adminResetUserAsDemo(
  targetUid: string,
  demoProfile: {
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
) {
  if (!targetUid) throw new Error('UID inválido.');

  await updateDoc(doc(db, 'users', targetUid), {
    role: demoProfile.role,
    fullName: demoProfile.fullName,
    phone: demoProfile.phone,
    city: demoProfile.city,
    bairro: demoProfile.bairro,
    photo: '',
    balance: 0,
    verified: false,
    ...(demoProfile.role === 'worker'
      ? {
          category: demoProfile.category || 'Electricista Profissional',
          specialty: demoProfile.specialty || demoProfile.category || 'Electricista Profissional',
          specialties: [...(demoProfile.specialties || [demoProfile.category || 'Electricista Profissional'])],
          level: demoProfile.level ?? 2,
          jobs: demoProfile.jobs ?? 12,
          rating: demoProfile.rating ?? 4.9,
          portfolio: []
        }
      : {}),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  });

  await setDoc(
    doc(db, 'users', targetUid, 'private_profile', 'security'),
    {
      userId: targetUid,
      biPhoto: '',
      biSelfie: '',
      nuit: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
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
  },
  options?: { resetExistingProfile?: boolean }
): Promise<{ uid: string; email: string; role: 'worker' | 'client'; created: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || password.length < 6) {
    throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.');
  }

  const { secAuth, secDb } = getSecondaryClients();

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
            `A conta ${normalizedEmail} já existe com outra palavra-passe. Use a palavra-passe antiga, apague-a primeiro, ou envie um link de redefinição por e-mail.`
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
    } else if (options?.resetExistingProfile) {
      await updateDoc(userRef, {
        role: profileData.role,
        fullName: profileData.fullName,
        phone: profileData.phone,
        city: profileData.city,
        bairro: profileData.bairro,
        photo: '',
        balance: 0,
        ...(profileData.role === 'worker'
          ? {
              category: profileData.category || 'Electricista Profissional',
              specialty: profileData.specialty || profileData.category || 'Electricista Profissional',
              specialties: [...(profileData.specialties || ['Electricista Profissional'])],
              level: profileData.level ?? 2,
              jobs: profileData.jobs ?? 12,
              rating: profileData.rating ?? 4.9,
              portfolio: []
            }
          : {}),
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
      options?.resetExistingProfile
        ? {
            userId: uid,
            biPhoto: '',
            biSelfie: '',
            nuit: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            updatedAt: serverTimestamp()
          }
        : {
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
