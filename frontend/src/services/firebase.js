import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || 'demo-key',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || 'sajama-inventario.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || 'sajama-inventario',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || 'sajama-inventario.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || '1:000000000000:web:demo'
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