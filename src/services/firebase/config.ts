/**
 * ตั้งค่าและเปิดใช้ Firebase (ชั้นล่างสุดของระบบออนไลน์)
 *
 * ค่าคอนฟิกอ่านจาก environment variable ของ Vite (ไฟล์ .env / ตั้งค่าใน Vercel)
 * ถ้ายังไม่ได้ตั้งค่า แอปจะไม่พังแต่จะตกลงไปเล่นแบบออฟไลน์ (เก็บข้อมูลในเครื่อง)
 * ทำแบบนี้เพื่อให้ `npm run dev` เปล่า ๆ ยังเล่นได้ และเดโมบน Vercel ที่ยังไม่ผูก
 * Firebase ก็ยังเปิดดูได้ ไม่ขึ้นจอขาว
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/** ค่าคอนฟิกจาก Firebase Console → Project settings → Your apps → Web app */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/**
 * ครบทั้ง 3 ค่าที่จำเป็นถึงจะถือว่า "ต่อออนไลน์ได้"
 * (ที่เหลือไม่มีก็ยังทำงานได้ แต่ใส่ให้ครบดีกว่า)
 */
export const isOnlineMode = Boolean(config.apiKey && config.authDomain && config.projectId);

interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let bundle: FirebaseBundle | null = null;

/**
 * เปิดใช้ Firebase แบบ lazy — เรียกครั้งแรกเมื่อมีคนต้องใช้จริง
 * คืน null เมื่อยังไม่ได้ตั้งค่า env (โหมดออฟไลน์)
 */
export const getFirebase = (): FirebaseBundle | null => {
  if (!isOnlineMode) return null;
  if (bundle) return bundle;

  try {
    const app = initializeApp({
      apiKey: "AIzaSyAPSQGSA927Eu5kU9O-X8iDblWP7z-489k",
      authDomain: "apex-eleven.firebaseapp.com",
      projectId: "apex-eleven",
      storageBucket: "apex-eleven.firebasestorage.app",
      messagingSenderId: "534907379967",
      appId: "1:534907379967:web:d1e78bab41b94783976cca",
    });

    bundle = { app, auth: getAuth(app), db: getFirestore(app) };
    return bundle;
  } catch (error) {
    // ตั้งค่าผิดไม่ควรทำให้เกมเปิดไม่ได้ — แจ้งใน console แล้วเล่นออฟไลน์ต่อ
    console.error('[firebase] เริ่มต้นไม่สำเร็จ จะเล่นแบบออฟไลน์แทน', error);
    return null;
  }
};

/** ชื่อโดเมนปลอมที่ใช้แปลง "ไอดีผู้เล่น" เป็นอีเมลสำหรับ Firebase Auth (ดู cloudAuth.ts) */
export const AUTH_EMAIL_DOMAIN = 'apex-eleven.local';

/** ชื่อ collection ใน Firestore — รวมไว้ที่เดียวกันเผื่อเปลี่ยนภายหลัง */
export const COLLECTIONS = {
  /** ข้อมูลเซฟทั้งก้อนของแต่ละบัญชี (เจ้าของอ่าน/เขียนได้คนเดียว) */
  accounts: 'accounts',
  /** ข้อมูลสาธารณะที่ใช้ทำตารางอันดับและจับคู่ (ทุกคนที่ล็อกอินอ่านได้) */
  profiles: 'profiles',
} as const;
