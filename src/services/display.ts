/**
 * โหมดคอมพิวเตอร์ — บังคับให้เกมวาดที่ความกว้างระดับเดสก์ท็อป แล้วย่อทั้งหน้าให้พอดีจอ
 * ผลลัพธ์เหมือนกด "ขอเว็บไซต์บนเดสก์ท็อป" ของ Chrome แต่กว้างพอจะได้เลย์เอาต์เต็มจริง ๆ
 *
 * ทำไมต้องทำเองแทนที่จะพึ่งเมนูของเบราว์เซอร์:
 *   โหมดเดสก์ท็อปของ Chrome บังคับความกว้างไว้ที่ 980px และ "ไม่สนใจ" meta viewport ของหน้าเว็บ
 *   980px ยังไม่ถึงเบรกพอยต์ xl (1280px) ที่หน้า MATCHMAKING ใช้จัด 3 คอลัมน์
 *   หน้าจึงยังเรียงซ้อนกันเป็นแถวเดียวอยู่ดี แค่ตัวหนังสือเล็กลงเฉย ๆ
 *
 * วิธีทำจึงมีสองชั้น ทำงานร่วมกัน:
 *
 *   ชั้นที่ 1 — meta viewport: ขอความกว้าง 1440px ตรง ๆ
 *              เบราว์เซอร์ส่วนใหญ่ทำตาม ได้ภาพคมและซูมนิ้วได้ตามปกติ
 *
 *   ชั้นที่ 2 — ย่อด้วย CSS transform: ถ้าวัดแล้วเบราว์เซอร์ไม่ทำตาม (เช่นเปิดโหมด
 *              เดสก์ท็อปของ Chrome ค้างไว้ หรือ iOS ไม่ยอมอ่าน meta ที่แก้ทีหลัง)
 *              จะตรึง <body> ไว้ที่ 1440px แล้ว scale ลงให้พอดีจอเอง
 *              ชั้นนี้ไม่พึ่งความร่วมมือของเบราว์เซอร์เลย จึงได้ผลเหมือนกันทั้ง iOS และ Android
 *
 * ค่าที่เลือกไว้เก็บใน localStorage — เป็นการตั้งค่าของ "เครื่อง" ไม่ใช่ของบัญชี
 */

const STORAGE_KEY = 'apex.desktopMode';

/** ความกว้างที่ใช้ตอนเปิดโหมดคอมพิวเตอร์ — เกินเบรกพอยต์ xl (1280) พอให้เลย์เอาต์เต็มทำงาน */
export const DESKTOP_WIDTH = 1440;

const MOBILE_VIEWPORT = 'width=device-width, initial-scale=1.0';

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

/**
 * เครื่องนี้เป็นมือถือ/แท็บเล็ตไหม
 * iPadOS 13+ รายงาน userAgent เป็น Mac จึงต้องเช็คจำนวนจุดสัมผัสประกอบด้วย
 */
export const isHandheld = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|iPad|Windows Phone/i.test(ua)) return true;

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

/* ── ชั้นที่ 1: meta viewport ─────────────────────────────────── */

/**
 * เขียน meta viewport ใหม่
 *
 * ต้อง "สร้าง element ใหม่แทนที่ของเดิม" ไม่ใช่แก้ค่า content ของอันเดิม
 * เพราะ Safari บน iOS จะไม่อ่าน viewport ซ้ำถ้าเราแค่แก้ attribute ของ tag ที่มีอยู่แล้ว
 * ต้องเห็นว่ามี node ใหม่เข้ามาใน <head> ถึงจะยอมคำนวณใหม่ให้
 */
const applyViewport = (enabled: boolean) => {
  if (typeof document === 'undefined') return;

  document.head.querySelectorAll('meta[name="viewport"]').forEach((node) => node.remove());

  const meta = document.createElement('meta');
  meta.name = 'viewport';
  // user-scalable=yes เสมอ — ย่อทั้งหน้าแล้วตัวหนังสือเล็ก ผู้เล่นต้องซูมอ่านเองได้
  meta.content = enabled
    ? `width=${DESKTOP_WIDTH}, user-scalable=yes`
    : MOBILE_VIEWPORT;
  document.head.appendChild(meta);
};

/* ── ชั้นที่ 2: ย่อด้วย CSS transform เมื่อเบราว์เซอร์ไม่ทำตาม ──── */

/** ความกว้าง/สูงที่มองเห็นจริงตอนนี้ (visualViewport แม่นกว่าตอนแถบ URL ยุบ-ขยาย) */
const viewportSize = () => ({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});

/** ล้างการย่อทั้งหมด กลับไปให้ CSS ปกติคุมเอง */
const clearScale = () => {
  const { style } = document.body;
  style.removeProperty('width');
  style.removeProperty('height');
  style.removeProperty('transform');
  style.removeProperty('transform-origin');
  document.documentElement.style.removeProperty('--app-height');
  document.documentElement.style.removeProperty('overflow-x');
};

/**
 * วัดว่าเบราว์เซอร์ให้ความกว้างมาเท่าไหร่จริง แล้วย่อชดเชยถ้ายังไม่ถึง 1440px
 *
 * เผื่อคลาดเคลื่อน 2px เพราะบางเครื่องปัดเศษความกว้างลงเล็กน้อย
 * ไม่งั้นเครื่องที่ทำตามอยู่แล้วจะโดนย่อซ้ำอีกชั้นโดยไม่จำเป็น
 */
const syncScale = (enabled: boolean) => {
  if (typeof document === 'undefined') return;

  if (!enabled) {
    clearScale();
    return;
  }

  const { width, height } = viewportSize();
  if (width >= DESKTOP_WIDTH - 2) {
    // เบราว์เซอร์ทำตาม meta viewport แล้ว ไม่ต้องย่อซ้ำ
    clearScale();
    return;
  }

  const scale = width / DESKTOP_WIDTH;
  const { style } = document.body;

  style.width = `${DESKTOP_WIDTH}px`;
  // ย่อลง scale เท่าไหร่ ต้องสูงขึ้น 1/scale เท่านั้น ภาพหลังย่อถึงจะเต็มจอพอดี
  style.height = `${height / scale}px`;
  style.transform = `scale(${scale})`;
  style.transformOrigin = 'top left';

  /*
   * เลย์เอาต์หลักใช้ h-[var(--app-height)] — ต้องบอกความสูง "ก่อนย่อ" ให้มัน
   * ถ้าปล่อยใช้ 100dvh ตามเดิม มันจะสูงเท่าจอจริง พอโดนย่อแล้วจะเหลือพื้นที่ว่างด้านล่าง
   */
  document.documentElement.style.setProperty('--app-height', `${height / scale}px`);
  // กันแถบเลื่อนแนวนอนโผล่จากความกว้าง 1440px ที่ยังไม่ทันถูกย่อ
  document.documentElement.style.overflowX = 'hidden';
};

/* ── API ที่ส่วนอื่นเรียกใช้ ──────────────────────────────────── */

/** เปิด/ปิดโหมดคอมพิวเตอร์ แล้วจำค่าไว้ในเครื่อง — คืนสถานะใหม่ */
export const setDesktopMode = (enabled: boolean): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // เบราว์เซอร์บล็อก storage (โหมดส่วนตัว) — ยังใช้ได้ในเซสชันนี้ แค่จำข้ามครั้งไม่ได้
  }

  applyViewport(enabled);
  // รอให้เบราว์เซอร์อ่าน viewport ใหม่เสร็จก่อนค่อยวัดความกว้าง ไม่งั้นจะได้ค่าเก่า
  window.requestAnimationFrame(() => syncScale(enabled));

  listeners.forEach((listener) => listener(enabled));
  return enabled;
};

export const toggleDesktopMode = (): boolean => setDesktopMode(!isDesktopMode());

/** ติดตามการเปลี่ยนสถานะ (คืนฟังก์ชันยกเลิกไว้ใช้ใน useEffect) */
export const onDesktopModeChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** เรียกครั้งเดียวตอนเปิดแอป — ตั้ง viewport แล้วคอยย่อใหม่ทุกครั้งที่ขนาดจอเปลี่ยน */
export const initDisplayMode = (): void => {
  if (typeof window === 'undefined') return;

  applyViewport(isDesktopMode());

  const resync = () => syncScale(isDesktopMode());

  // วัดหลายรอบ: เฟรมถัดไป และอีกครั้งหลังเบราว์เซอร์จัดหน้าเสร็จ (iOS ตอบช้ากว่า)
  window.requestAnimationFrame(resync);
  window.setTimeout(resync, 300);

  window.addEventListener('resize', resync);
  window.addEventListener('orientationchange', resync);
  window.visualViewport?.addEventListener('resize', resync);
};
