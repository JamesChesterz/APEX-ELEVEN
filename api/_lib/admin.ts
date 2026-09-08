import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let cached: App | undefined

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`ไม่ได้ตั้งค่า environment variable: ${name}`)
  return value
}

export function adminApp(): App {
  if (cached) return cached

  // serverless function ถูกเรียกซ้ำบน instance เดิมได้ ต้องกัน init ซ้ำ
  const existing = getApps()
  if (existing.length > 0) {
    cached = existing[0]
    return cached
  }

  cached = initializeApp({
    credential: cert({
      projectId: required('FIREBASE_ADMIN_PROJECT_ID'),
      clientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL'),
      // Vercel เก็บ private key เป็นบรรทัดเดียว \n จึงกลายเป็นตัวอักษรสองตัว ต้องแปลงกลับเป็นขึ้นบรรทัดจริง
      privateKey: required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
  })
  return cached
}

export function db(): Firestore {
  return getFirestore(adminApp())
}
