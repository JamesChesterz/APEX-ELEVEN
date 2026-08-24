/// <reference types="vite/client" />

/**
 * ตัวแปรสภาพแวดล้อมที่แอปนี้ใช้ (ตั้งในไฟล์ .env หรือหน้า Environment Variables ของ Vercel)
 * ทุกตัวต้องขึ้นต้นด้วย VITE_ ไม่งั้น Vite จะไม่ส่งมาให้ฝั่งเบราว์เซอร์
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
