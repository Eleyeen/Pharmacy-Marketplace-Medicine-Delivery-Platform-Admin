import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'

if (getApps().length === 0) {
  initializeApp()
}

export const db = getFirestore()
export const messaging = getMessaging()
export const storage = getStorage()

db.settings({ ignoreUndefinedProperties: true })
