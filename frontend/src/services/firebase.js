import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.DEV ? 'demo-key' : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'sajama-inventario-b5b17.firebaseapp.com',
  projectId:         import.meta.env.DEV ? 'sajama-inventario'        : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'sajama-inventario-b5b17.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '838813749958',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:838813749958:web:7a1fb73f890912c86d44ef'
}

const app        = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)

// Conectar emuladores locales en modo desarrollo
if (import.meta.env.DEV) {
  connectAuthEmulator(auth,      'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db,    'localhost', 8090)
  connectStorageEmulator(storage, 'localhost', 9199)
}