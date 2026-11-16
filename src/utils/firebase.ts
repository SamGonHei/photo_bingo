import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, type Database } from 'firebase/database';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAmBClT872Y9NKko3M9Hv_B4OZTIpqZLMo",
  authDomain: "photo-bingo-41ba5.firebaseapp.com",
  databaseURL: "https://photo-bingo-41ba5-default-rtdb.firebaseio.com",
  projectId: "photo-bingo-41ba5",
  storageBucket: "photo-bingo-41ba5.firebasestorage.app",
  messagingSenderId: "609518308756",
  appId: "1:609518308756:web:cac42866180a2a04bc1381",
  measurementId: "G-6WBEPXZKC3"
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  (firebaseConfig.databaseURL || firebaseConfig.projectId)
);

let db: Database | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log('🔥 Firebase Realtime Database initialized successfully!');
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { db, ref, onValue, set, update, push };
