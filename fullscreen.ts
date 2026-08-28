/**
 * โหมดเต็มจอ — ซ่อนแถบ URL และแถบระบบของเบราว์เซอร์ ให้เหลือแต่ตัวเกม
 *
 * รองรับต่างกันไปตามเครื่อง:
 *   Android (Chrome/Edge/Samsung) → Fullscreen API ใช้ได้เต็มที่
 *   iPad (iPadOS 12+)             → ใช้ได้ผ่าน webkitRequestFullscreen
 *   iPhone (Safari ทุกเวอร์ชัน)    → Apple ไม่เปิด Fullscreen API ให้ element ทั่วไป
 *                                    ทางเดียวที่ได้เต็มจอจริงคือ "เพิ่มลงหน้าจอโฮม"
 *                                    แล้วเปิดจากไอคอน (โหมด standalone)
 *                                    หน้า Settings จึงบอกวิธีนี้แทนปุ่มที่กดไม่ได้
 *
 * ข้อจำกัดของเบราว์เซอร์: เข้าเต็มจอได้เฉพาะตอนที่ผู้ใช้เพิ่งกดอะไรสักอย่าง
 * เรียกเองตอนโหลดหน้าไม่ได้ ค่าที่จำไว้จึงถูกใช้ตอน "แตะครั้งแรก" หลังเปิดเกมแทน
 */

const STORAGE_KEY = 'apex.fullscreen';

type Listener = (active: boolean) => void;
const listeners = new Set<Listener>();

/** element กับ document ของ WebKit รุ่นเก่ายังใช้ชื่อที่มี prefix อยู่ */
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
}

const doc = (): WebkitDocument => document as WebkitDocument;

/** เปิดจากไอคอนบนหน้าจอโฮมอยู่ไหม (โหมดนี้เต็มจอโดยธรรมชาติ ไม่ต้องกดอะไร) */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;

  // iOS ใช้ property เฉพาะของ Safari ส่วนที่เหลือดูจาก display-mode ของ manifest
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  if (iosStandalone) return true;

  // เบราว์เซอร์เก่ามาก (และ jsdom บางเวอร์ชัน) ไม่มี matchMedia
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
};

/** เครื่องนี้สั่งเต็มจอผ่าน Fullscreen API ได้ไหม */
export const isFullscreenSupported = (): boolean => {
  if (typeof document === 'undefined') return false;

  const target = document.documentElement as WebkitElement;
  return Boolean(
    doc().fullscreenEnabled ||
      doc().webkitFullscreenEnabled ||
      typeof target.webkitRequestFullscreen === 'function',
  );
};

/** ตอนนี้เต็มจออยู่ไหม (นับโหมด standalone ของ iOS ด้วย เพราะผลลัพธ์เหมือนกัน) */
export const isFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (isStandalone()) return true;

  return Boolean(doc().fullscreenElement || doc().webkitFullscreenElement);
};

/** ผู้เล่นเคยเลือกให้เปิดเต็มจอไว้ไหม */
export const prefersFullscreen = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const remember = (enabled: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // เบราว์เซอร์บล็อก storage (โหมดส่วนตัว) — ใช้ได้ในเซสชันนี้ แค่จำข้ามครั้งไม่ได้
  }
};

const notify = () => {
  const active = isFullscreen();
  listeners.forEach((listener) => listener(active));
};

/** ขอเข้าเต็มจอ — คืน false ถ้าเครื่องไม่รองรับหรือเบราว์เซอร์ปฏิเสธ */
export const enterFullscreen = async (): Promise<boolean> => {
  const target = document.documentElement as WebkitElement;

  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen({ navigationUI: 'hide' });
    } else if (typeof target.webkitRequestFullscreen === 'function') {
      await target.webkitRequestFullscreen();
    } else {
      return false;
    }
  } catch {
    // ผู้ใช้ปฏิเสธ หรือเรียกนอกจังหวะที่เพิ่งกดปุ่ม
    return false;
  }

  notify();
  return true;
};

export const exitFullscreen = async (): Promise<void> => {
  try {
    if (typeof document.exitFullscreen === 'function') await document.exitFullscreen();
    else await doc().webkitExitFullscreen?.();
  } catch {
    // ออกไม่สำเร็จก็ปล่อย — ผู้เล่นกดปุ่มย้อนกลับของเครื่องเองได้เสมอ
  }

  notify();
};

/** สลับสถานะเต็มจอ พร้อมจำค่าที่เลือกไว้ — คืนสถานะจริงหลังทำเสร็จ */
export const toggleFullscreen = async (): Promise<boolean> => {
  if (isFullscreen()) {
    await exitFullscreen();
    remember(false);
    return false;
  }

  const ok = await enterFullscreen();
  remember(ok);
  return ok;
};

/** ติดตามการเปลี่ยนสถานะ (คืนฟังก์ชันยกเลิกไว้ใช้ใน useEffect) */
export const onFullscreenChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * เรียกครั้งเดียวตอนเปิดแอป
 *
 * ฟังเหตุการณ์จากเบราว์เซอร์เพื่อให้ปุ่มในหน้า Settings ตรงกับความจริงเสมอ
 * (ผู้เล่นกดปุ่มย้อนกลับของเครื่องออกจากเต็มจอได้ โดยไม่ผ่านปุ่มของเรา)
 *
 * ถ้าเคยเลือกไว้ว่าให้เต็มจอ จะกลับเข้าเต็มจอตอน "แตะครั้งแรก" หลังเปิดเกม
 * เพราะเบราว์เซอร์ไม่ยอมให้สั่งเต็มจอเองตอนโหลดหน้า ต้องมี user gesture เสมอ
 */
export const initFullscreen = (): void => {
  if (typeof document === 'undefined') return;

  document.addEventListener('fullscreenchange', notify);
  document.addEventListener('webkitfullscreenchange', notify);

  if (!prefersFullscreen() || isFullscreen() || !isFullscreenSupported()) return;

  const restore = () => {
    document.removeEventListener('pointerdown', restore);
    void enterFullscreen();
  };
  // once:true ไม่พอ เพราะถ้าเบราว์เซอร์ปฏิเสธเราก็ไม่อยากรบกวนซ้ำอยู่ดี
  document.addEventListener('pointerdown', restore, { once: true });
};
