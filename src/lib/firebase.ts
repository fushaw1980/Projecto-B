import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
