import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase's SDK throws synchronously (not just on network calls) when the
// config is missing/malformed, e.g. no .env.local set up yet. Online mode is
// optional - pass-and-play must keep working even with zero Firebase setup -
// so initialization failures are caught and surfaced as a normal rejected
// promise from ensureSignedIn() instead of crashing the module.
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let initError: string | null = null;

try {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase is not configured yet (missing VITE_FIREBASE_* env vars).');
  }
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  initError = err instanceof Error ? err.message : 'Failed to initialize Firebase';
}

export { auth, db };

// roomService only calls this after ensureSignedIn() has resolved, at which
// point db is guaranteed to be initialized.
export function getDb() {
  if (!db) throw new Error(initError ?? 'Firebase is not configured');
  return db;
}

// Resolves once we have a signed-in (anonymous) user, signing in if needed.
// Each device gets a stable uid persisted by the Firebase SDK across reloads.
export function ensureSignedIn(): Promise<User> {
  return new Promise((resolve, reject) => {
    if (!auth || initError) {
      reject(new Error(initError ?? 'Firebase is not configured'));
      return;
    }
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        } else {
          signInAnonymously(auth!).catch(reject);
        }
      },
      reject,
    );
  });
}
