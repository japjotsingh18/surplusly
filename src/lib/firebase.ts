import { initializeApp, FirebaseApp, getApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage;
let isFirebaseInitialized = false;
let initializationError = null;

try {
  // Check if config is valid (basic check)
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key') {
    throw new Error('Missing or invalid Firebase API Key. Please configure your .env file.');
  }

  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app);
  isFirebaseInitialized = true;
} catch (error: any) {
  console.error('Firebase initialization failed:', error);
  initializationError = error.message;
  // Create dummy objects to prevent immediate crash on import, 
  // but they will fail if used.
  app = {} as any;
  auth = {} as any;
  db = {} as any;
}

export { app, auth, db, functions, storage, isFirebaseInitialized, initializationError };
export default app;
