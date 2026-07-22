import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
]

if (requiredConfig.some((value) => !value)) {
  throw new Error('Firebase configuration is incomplete. Check your VITE_FIREBASE_* variables.')
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)
export const cloudFunctions = getFunctions(firebaseApp, 'asia-south1')
export const firebaseStorage = getStorage(firebaseApp)

const emulatorKey = '__PHARMAFLOW_FIREBASE_EMULATORS_CONNECTED__'
const globalState = globalThis as typeof globalThis & Record<string, boolean>

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' &&
  !globalState[emulatorKey]
) {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  connectFunctionsEmulator(cloudFunctions, '127.0.0.1', 5001)
  connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199)
  globalState[emulatorKey] = true
}

export const analyticsPromise: Promise<Analytics | null> =
  import.meta.env.PROD && typeof window !== 'undefined'
    ? isSupported().then((supported) => supported ? getAnalytics(firebaseApp) : null)
    : Promise.resolve(null)
