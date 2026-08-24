/**
 * บัญชีผู้เล่นบนคลาวด์ (Firebase Auth + Firestore)
 *
 * ทำไมถึงแปลง "ไอดีผู้เล่น" เป็นอีเมล:
 * Firebase Auth แบบรหัสผ่านรับเฉพาะอีเมล แต่เกมนี้ให้ผู้เล่นตั้งไอดีอะไรก็ได้
 * (รวมภาษาไทย) จึงแปลงไอดี → SHA-256 → ใช้เป็นชื่อหน้าอีเมลบนโดเมนปลอม
 * ผลคือไอดีเดียวกันได้อีเมลเดียวกันเสมอ ไม่ต้องมีตารางค้นหา และ Auth
 * จะกันไอดีซ้ำให้เองด้วย error `auth/email-already-in-use`
 *
 * ⚠️ ผลข้างเคียง: รีเซ็ตรหัสผ่านทางอีเมลไม่ได้ (โดเมนไม่มีจริง)
 * ถ้าต้องการฟีเจอร์นั้น ให้เปลี่ยนหน้าสมัครไปรับอีเมลจริงแล้วส่งเข้าฟังก์ชันนี้ตรง ๆ
 */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AUTH_EMAIL_DOMAIN, COLLECTIONS, getFirebase } from '@/services/firebase/config';
import { SERVER_AUTHORITY } from '@/services/firebase/gameServer';
import type { Account, AccountState } from '@/types/account';

/** เอกสารบัญชีที่เก็บใน Firestore (เจ้าของเท่านั้นที่อ่าน/เขียนได้) */
interface AccountDoc {
  username: string;
  managerName: string;
  teamName: string;
  createdAt: string;
  state: AccountState;
  updatedAt?: unknown;
}

/** แปลงไอดีเป็นคีย์มาตรฐาน: ตัดช่องว่างหัวท้าย + ไม่สนตัวพิมพ์ใหญ่เล็ก */
const normalize = (username: string): string => username.trim().toLowerCase();

/** SHA-256 ของสตริง → hex (ใช้ Web Crypto ที่มีอยู่แล้วในทุกเบราว์เซอร์ยุคใหม่) */
const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/** อีเมลสำหรับ Firebase Auth ที่ผูกกับไอดีนี้ (ไอดีเดียวกัน = อีเมลเดียวกันเสมอ) */
export const emailForUsername = async (username: string): Promise<string> => {
  const hash = await sha256Hex(`apex-eleven:${normalize(username)}`);
  return `u${hash.slice(0, 32)}@${AUTH_EMAIL_DOMAIN}`;
};

/**
 * ล้างค่า undefined ออกก่อนส่งขึ้น Firestore
 * (Firestore ปฏิเสธ undefined แต่ AccountState มีฟิลด์ optional หลายตัว)
 */
const sanitize = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** แปล error ของ Firebase เป็นข้อความไทยที่ผู้เล่นเข้าใจ */
export const describeAuthError = (error: unknown): string => {
  const code = (error as { code?: string } | null)?.code ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'ไอดีนี้ถูกใช้ไปแล้ว ลองตั้งชื่ออื่นดู';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'ไอดีหรือรหัสผ่านไม่ถูกต้อง';
    case 'auth/weak-password':
      return 'รหัสผ่านสั้นเกินไป ต้องยาวอย่างน้อย 6 ตัวอักษร';
    case 'auth/too-many-requests':
      return 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่';
    case 'auth/network-request-failed':
      return 'ต่ออินเทอร์เน็ตไม่ได้ ลองเช็กสัญญาณแล้วลองใหม่';
    case 'auth/operation-not-allowed':
      return 'ยังไม่ได้เปิดวิธีล็อกอินแบบ Email/Password ใน Firebase Console';
    case 'permission-denied':
      return 'สิทธิ์ไม่พอ — ตรวจ Firestore rules ตามคู่มือติดตั้ง';
    default:
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง';
  }
};

/** โหลดเอกสารบัญชีของ uid นี้ (null = ยังไม่เคยเซฟ) */
const readAccountDoc = async (uid: string): Promise<Account | null> => {
  const firebase = getFirebase();
  if (!firebase) return null;

  const snapshot = await getDoc(doc(firebase.db, COLLECTIONS.accounts, uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as AccountDoc;
  return {
    id: uid,
    username: data.username,
    // เก็บช่องนี้ไว้ให้ตรงกับ type เดิม — รหัสผ่านจริงอยู่ที่ Firebase Auth ไม่ได้อยู่ในนี้
    passwordHash: 'firebase',
    managerName: data.managerName,
    teamName: data.teamName,
    createdAt: data.createdAt,
    state: data.state,
  };
};

/** เขียนบัญชีทั้งก้อนทับของเดิม (ใช้ merge เพื่อไม่ลบฟิลด์ที่เพิ่มมาทีหลัง) */
/**
 * ฟิลด์ในเซฟที่ "เซิร์ฟเวอร์เป็นเจ้าของ" ในโหมด SERVER_AUTHORITY
 *
 * ต้องตัดออกก่อนเขียนทุกครั้ง ด้วยเหตุผลสองข้อ:
 *   1. firestore.rules ปฏิเสธคำขอที่พยายามแก้ฟิลด์เหล่านี้ — ไม่ตัด = เซฟไม่ผ่านทั้งก้อน
 *   2. ค่าที่เครื่องผู้เล่นถืออยู่อาจเก่ากว่าของจริง ถ้าเขียนทับจะกลายเป็นย้อนดาวคืน
 *
 * Firestore แบบ merge จะคงค่าเดิมของฟิลด์ที่ไม่ได้ส่งไปให้เอง
 * ตัดออกจึงแปลว่า "ไม่แตะ" ไม่ใช่ "ลบทิ้ง"
 */
const SERVER_OWNED_STATE_FIELDS = ['record', 'recentRivals', 'lastMatchAt', 'league'] as const;

/** เอาเฉพาะส่วนที่เครื่องผู้เล่นมีสิทธิ์เขียน */
const stripServerOwned = (state: AccountState): AccountState => {
  const next = { ...state } as Record<string, unknown>;
  SERVER_OWNED_STATE_FIELDS.forEach((field) => delete next[field]);
  return next as unknown as AccountState;
};

export const writeCloudAccount = async (account: Account): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  const payload: AccountDoc = sanitize({
    username: account.username,
    managerName: account.managerName,
    teamName: account.teamName,
    createdAt: account.createdAt,
    state: SERVER_AUTHORITY ? stripServerOwned(account.state) : account.state,
  });

  await setDoc(
    doc(firebase.db, COLLECTIONS.accounts, account.id),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true },
  );
};

/** สมัครบัญชีใหม่บนคลาวด์ แล้วเขียนสถานะเริ่มต้นลง Firestore ทันที */
export const cloudRegister = async (
  username: string,
  password: string,
  teamName: string,
  initialState: AccountState,
): Promise<Account> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('ยังไม่ได้ตั้งค่า Firebase');

  const name = username.trim();
  const email = await emailForUsername(name);
  const credential = await createUserWithEmailAndPassword(firebase.auth, email, password);

  const account: Account = {
    id: credential.user.uid,
    username: name,
    passwordHash: 'firebase',
    managerName: name,
    teamName: teamName.trim() || `${name} FC`,
    createdAt: new Date().toISOString(),
    state: initialState,
  };

  await writeCloudAccount(account);
  return account;
};

/** เข้าสู่ระบบด้วยไอดี + รหัสผ่าน แล้วดึงเซฟกลับมา */
export const cloudLogin = async (username: string, password: string): Promise<Account> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('ยังไม่ได้ตั้งค่า Firebase');

  const email = await emailForUsername(username);
  const credential = await signInWithEmailAndPassword(firebase.auth, email, password);

  const account = await readAccountDoc(credential.user.uid);
  if (!account) throw new Error('ไม่พบข้อมูลเซฟของบัญชีนี้');

  return account;
};

/** ออกจากระบบ */
export const cloudLogout = async (): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;
  await signOut(firebase.auth);
};

/**
 * ติดตามสถานะล็อกอิน — ใช้ตอนเปิดแอปเพื่อ "จำการล็อกอินไว้"
 * Firebase เก็บ session ไว้ให้เองใน IndexedDB จึงไม่ต้องเก็บ token เอง
 *
 * เรียก callback ด้วยบัญชีที่โหลดเซฟมาแล้ว หรือ null เมื่อยังไม่ได้ล็อกอิน
 */
export const watchCloudSession = (
  onChange: (account: Account | null) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) {
    onChange(null);
    return () => undefined;
  }

  return onAuthStateChanged(firebase.auth, (user: User | null) => {
    if (!user) {
      onChange(null);
      return;
    }

    readAccountDoc(user.uid)
      .then(onChange)
      .catch((error) => {
        console.error('[firebase] โหลดเซฟไม่สำเร็จ', error);
        onChange(null);
      });
  });
};
