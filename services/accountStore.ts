/**
 * ที่เก็บบัญชีผู้เล่น — ชั้นเดียวของแอปที่รู้ว่าข้อมูลถูกเก็บไว้ที่ไหน
 *
 * มีสองโหมด และสลับให้อัตโนมัติ:
 *   • ออนไลน์ (ตั้งค่า Firebase แล้ว) — บัญชีอยู่บน Firebase Auth,
 *     เซฟอยู่บน Firestore เล่นเครื่องไหนก็ได้ ข้อมูลตามไปด้วย
 *   • ออฟไลน์ (ยังไม่ได้ตั้งค่า) — เก็บใน localStorage ของเครื่องเหมือนเดิม
 *
 * ทุกฟังก์ชันเป็น async แล้ว เพราะฝั่งคลาวด์ต้องรอเครือข่าย
 * ส่วนอื่นของแอปคุยกับไฟล์นี้ไฟล์เดียว ไม่ต้องรู้ว่าโหมดไหนกำลังทำงานอยู่
 */
import {
  createStarterCards,
  STARTING_COINS,
  STARTING_POINTS,
  STARTING_UPGRADE_POINTS,
} from '@/data/starter';
import {
  cloudLogin,
  cloudLogout,
  cloudRegister,
  describeAuthError,
  watchCloudSession,
  writeCloudAccount,
} from '@/services/firebase/cloudAccount';
import { isOnlineMode } from '@/services/firebase/config';
import { createLeagueState } from '@/services/league';
import { createUpgradeDaily } from '@/services/upgradePoints';
import { createSeasonState } from '@/services/season';
import type { Account, AccountState } from '@/types/account';
import { createId } from '@/utils/helpers';

const ACCOUNTS_KEY = 'fcallstar.accounts.v1';
const SESSION_KEY = 'fcallstar.session.v1';

/** ข้อกำหนดของไอดีและรหัสผ่าน (ใช้ทั้งตอนสมัครและแสดงข้อความช่วยเหลือ) */
export const USERNAME_MIN = 3;
/** Firebase Auth บังคับรหัสผ่านอย่างน้อย 6 ตัว จึงยกเพดานขั้นต่ำตามนั้นเมื่อออนไลน์ */
export const PASSWORD_MIN = isOnlineMode ? 6 : 4;

/** true = กำลังเล่นแบบออนไลน์ (มีบัญชีกลาง + ตารางอันดับจริง) */
export const ONLINE = isOnlineMode;

/**
 * แปลงรหัสผ่านเป็นสตริงสั้น ๆ (อัลกอริทึม djb2) — ใช้เฉพาะโหมดออฟไลน์
 * จุดประสงค์เดียวคือไม่เก็บรหัสดิบไว้ใน localStorage
 * ไม่ปลอดภัยพอสำหรับระบบจริง — โหมดออนไลน์ให้ Firebase Auth จัดการแทน
 */
export const hashPassword = (password: string): string => {
  let hash = 5381;
  for (let index = 0; index < password.length; index += 1) {
    hash = ((hash << 5) + hash + password.charCodeAt(index)) | 0;
  }
  return `h${(hash >>> 0).toString(36)}`;
};

/* ── ที่เก็บฝั่งเครื่อง (โหมดออฟไลน์ + แคชสำรองของโหมดออนไลน์) ── */

const readAll = (): Account[] => {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Account[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (accounts: Account[]): void => {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* เต็มหรือใช้ไม่ได้ — ยังเล่นต่อได้ แค่ไม่ได้เซฟ */
  }
};

/** เทียบไอดีแบบไม่สนตัวพิมพ์ใหญ่-เล็ก */
const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** เขียนบัญชีลงเครื่อง (ทับของเดิมถ้ามี) */
const saveLocal = (account: Account): void => {
  const accounts = readAll();
  const index = accounts.findIndex((entry) => entry.id === account.id);

  if (index === -1) writeAll([...accounts, account]);
  else writeAll(accounts.map((entry, position) => (position === index ? account : entry)));
};

/** สถานะเริ่มต้นของบัญชีใหม่: เงิน 1 ล้าน + นักเตะเริ่มต้น */
export const createInitialState = (): AccountState => ({
  coins: STARTING_COINS,
  points: STARTING_POINTS,
  upgradePoints: STARTING_UPGRADE_POINTS,
  upgradeDaily: createUpgradeDaily(),
  cards: createStarterCards(),
  record: { points: 0, wins: 0, draws: 0, losses: 0 },
  formationId: '4-3-3',
  squad: {},
  season: createSeasonState(),
  league: createLeagueState(),
  matchHistory: [],
});

export interface AuthResult {
  account: Account | null;
  /** ข้อความบอกสาเหตุเมื่อทำไม่สำเร็จ */
  error: string | null;
}

/* ── สมัคร / เข้าสู่ระบบ / ออกจากระบบ ─────────────────────── */

/** สมัครบัญชีใหม่ */
export const registerAccount = async (
  username: string,
  password: string,
  teamName: string,
): Promise<AuthResult> => {
  const name = username.trim();

  if (name.length < USERNAME_MIN) {
    return { account: null, error: `ไอดีต้องยาวอย่างน้อย ${USERNAME_MIN} ตัวอักษร` };
  }
  if (password.length < PASSWORD_MIN) {
    return { account: null, error: `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร` };
  }

  if (ONLINE) {
    try {
      const account = await cloudRegister(name, password, teamName, createInitialState());
      saveLocal(account); // แคชไว้ให้เปิดเกมครั้งถัดไปได้เร็วขึ้น
      return { account, error: null };
    } catch (error) {
      return { account: null, error: describeAuthError(error) };
    }
  }

  const accounts = readAll();
  if (accounts.some((account) => sameName(account.username, name))) {
    return { account: null, error: 'ไอดีนี้ถูกใช้ไปแล้ว ลองตั้งชื่ออื่นดู' };
  }

  const account: Account = {
    id: createId('acc'),
    username: name,
    passwordHash: hashPassword(password),
    managerName: name,
    teamName: teamName.trim() || `${name} FC`,
    createdAt: new Date().toISOString(),
    state: createInitialState(),
  };

  writeAll([...accounts, account]);
  return { account, error: null };
};

/** เข้าสู่ระบบด้วยไอดีและรหัสผ่าน */
export const loginAccount = async (username: string, password: string): Promise<AuthResult> => {
  if (ONLINE) {
    try {
      const account = await cloudLogin(username, password);
      saveLocal(account);
      return { account, error: null };
    } catch (error) {
      return { account: null, error: describeAuthError(error) };
    }
  }

  const account = readAll().find((entry) => sameName(entry.username, username));

  if (!account) return { account: null, error: 'ไม่พบไอดีนี้ — สมัครใหม่ได้เลย' };
  if (account.passwordHash !== hashPassword(password)) {
    return { account: null, error: 'รหัสผ่านไม่ถูกต้อง' };
  }

  return { account, error: null };
};

/** ออกจากระบบ (โหมดออนไลน์ต้องบอก Firebase ด้วย ไม่งั้นเปิดใหม่จะยังล็อกอินค้าง) */
export const signOutAccount = async (): Promise<void> => {
  rememberSession(null);
  if (ONLINE) await cloudLogout();
};

/* ── เซฟความคืบหน้า ───────────────────────────────────────── */

/**
 * รอสักครู่ก่อนยิงขึ้นคลาวด์ (ms)
 * เกมนี้แก้ state ถี่มาก (ทุกครั้งที่เหรียญขยับ/ลากตัวผู้เล่น) ถ้าเขียนทุกครั้ง
 * จะเปลืองโควตา Firestore มหาศาล จึงรวบให้เหลือครั้งเดียวหลังหยุดนิ่ง
 */
const CLOUD_SAVE_DELAY = 2500;

let pendingAccount: Account | null = null;
let saveTimer: number | null = null;

/** ยิงเซฟที่ค้างอยู่ขึ้นคลาวด์ทันที */
const flushNow = async (): Promise<void> => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  const account = pendingAccount;
  pendingAccount = null;
  if (!account || !ONLINE) return;

  try {
    await writeCloudAccount(account);
  } catch (error) {
    // เซฟลงเครื่องไปแล้ว ข้อมูลจึงไม่หาย — ครั้งถัดไปจะพยายามใหม่เอง
    console.error('[firebase] เซฟขึ้นคลาวด์ไม่สำเร็จ', error);
  }
};

/**
 * บันทึกความคืบหน้า: ลงเครื่องทันที + ขึ้นคลาวด์แบบหน่วงเวลา
 * เรียกได้รัว ๆ ไม่ต้องกลัว — ตัวหน่วงเวลาจัดการให้เอง
 */
export const saveAccount = (account: Account): void => {
  saveLocal(account);
  if (!ONLINE) return;

  pendingAccount = account;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flushNow(), CLOUD_SAVE_DELAY);
};

/** บังคับเซฟทันที — ใช้ตอนออกจากระบบหรือกำลังจะปิดแท็บ */
export const flushAccount = (): Promise<void> => flushNow();

/* ── จำการล็อกอิน ─────────────────────────────────────────── */

/**
 * จำไอดีที่ล็อกอินค้างไว้ (โหมดออฟไลน์)
 * โหมดออนไลน์ Firebase จัดการ session ให้เองอยู่แล้ว
 */
export const rememberSession = (accountId: string | null): void => {
  try {
    if (accountId) window.localStorage.setItem(SESSION_KEY, accountId);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ข้ามไปได้ */
  }
};

/** บัญชีที่ล็อกอินค้างไว้จากครั้งก่อนในเครื่องนี้ (null = ยังไม่ได้ล็อกอิน) */
export const restoreSession = (): Account | null => {
  try {
    const id = window.localStorage.getItem(SESSION_KEY);
    return id ? readAll().find((account) => account.id === id) ?? null : null;
  } catch {
    return null;
  }
};

/**
 * ติดตามสถานะล็อกอินตอนเปิดแอป
 * - ออนไลน์: ถาม Firebase ว่ายังล็อกอินค้างอยู่ไหม แล้วโหลดเซฟจากคลาวด์
 * - ออฟไลน์: อ่านจาก localStorage ครั้งเดียวจบ
 *
 * คืนฟังก์ชันสำหรับยกเลิกการติดตาม
 */
export const watchSession = (onChange: (account: Account | null) => void): (() => void) => {
  if (!ONLINE) {
    onChange(restoreSession());
    return () => undefined;
  }

  return watchCloudSession((account) => {
    if (account) saveLocal(account);
    onChange(account);
  });
};

/** จำนวนบัญชีในเครื่องนี้ ใช้โชว์ในหน้าเข้าสู่ระบบ */
export const countAccounts = (): number => readAll().length;
