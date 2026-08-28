/**
 * โหมดคอมพิวเตอร์ — บังคับให้เบราว์เซอร์วาดหน้าเว็บที่ความกว้างระดับเดสก์ท็อป
 * แล้วย่อทั้งหน้าให้พอดีจอ (เหมือนเมนู "ขอไซต์เดสก์ท็อป" ของเบราว์เซอร์มือถือ)
 *
 * ทำไมต้องมี: หน้าจออย่าง MATCHMAKING วางของเป็น 3 คอลัมน์ + แถวล่างอีก 3 ช่อง
 * บนจอกว้าง 390px มันเบียดกันจนอ่านไม่ออก การย่อทั้งหน้าให้เล็กลงอ่านง่ายกว่า
 * การยัดทุกอย่างลงคอลัมน์เดียวมาก
 *
 * วิธีทำคือเขียนทับ <meta name="viewport"> ตอนรันไทม์ ไม่ต้องแตะ CSS ของหน้าไหนเลย
 * ค่าที่เลือกไว้เก็บใน localStorage ของเครื่อง (เป็นการตั้งค่าของ "เครื่อง" ไม่ใช่ของบัญชี)
 */

const STORAGE_KEY = 'apex.desktopMode';

/** ความกว้างที่ใช้ตอนเปิดโหมดคอมพิวเตอร์ — พอให้เลย์เอาต์ xl ทำงานครบ */
export const DESKTOP_WIDTH = 1440;

const MOBILE_VIEWPORT = 'width=device-width, initial-scale=1.0';

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

/**
 * เครื่องนี้เป็นมือถือ/แท็บเล็ตไหม
 * iPad รุ่นใหม่รายงาน userAgent เป็น Mac จึงต้องเช็คจำนวนจุดสัมผัสประกอบด้วย
 */
export const isHandheld = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|iPad|Windows Phone/i.test(ua)) return true;

  // iPadOS 13+ : userAgent เหมือน Mac แต่มีหน้าจอสัมผัส
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
};

/** ค่าที่ผู้เล่นเลือกไว้เอง (null = ยังไม่เคยเลือก ให้ระบบตัดสินให้) */
const storedPreference = (): boolean | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
};

/**
 * เปิดโหมดคอมพิวเตอร์อยู่ไหม
 * ยังไม่เคยตั้งค่าเอง → เปิดให้อัตโนมัติถ้าเล่นบนมือถือ/แท็บเล็ต
 */
export const isDesktopMode = (): boolean => storedPreference() ?? isHandheld();

/** เขียน <meta name="viewport"> ให้ตรงกับสถานะปัจจุบัน */
const applyViewport = (enabled: boolean) => {
  if (typeof document === 'undefined') return;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }

  // ตอนเปิดโหมดคอมพิวเตอร์ต้องปล่อยให้ผู้เล่นซูมเองได้ ไม่งั้นตัวหนังสือจะเล็กเกินไปจนอ่านไม่ไหว
  meta.content = enabled
    ? `width=${DESKTOP_WIDTH}, user-scalable=yes`
    : MOBILE_VIEWPORT;
};

/** เปิด/ปิดโหมดคอมพิวเตอร์ แล้วจำค่าไว้ในเครื่อง — คืนสถานะใหม่ */
export const setDesktopMode = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // เบราว์เซอร์บล็อก storage (โหมดส่วนตัว) — ยังใช้ได้ในเซสชันนี้ แค่จำข้ามครั้งไม่ได้
  }

  applyViewport(enabled);
  listeners.forEach((listener) => listener(enabled));
  return enabled;
};

export const toggleDesktopMode = (): boolean => setDesktopMode(!isDesktopMode());

/** ติดตามการเปลี่ยนสถานะ (คืนฟังก์ชันยกเลิกไว้ใช้ใน useEffect) */
export const onDesktopModeChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** เรียกครั้งเดียวตอนเปิดแอป — ตั้ง viewport ให้ตรงกับค่าที่ควรเป็น */
export const initDisplayMode = (): void => {
  applyViewport(isDesktopMode());
};
