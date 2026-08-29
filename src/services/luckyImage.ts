/**
 * รูปของรางวัลในกล่องสุ่ม — รับได้ทั้ง .png .webp .gif (และ .jpg)
 *
 * รูปหนึ่งใบเก็บได้สองแบบ แล้วแต่แอดมินสะดวก:
 *
 *   1) พาธไฟล์ในโฟลเดอร์ public/ เช่น /lucky/coin.gif  ← แนะนำสำหรับ GIF และรูปใหญ่
 *      ไม่กินพื้นที่เอกสารเลย โหลดเร็ว และ GIF ยังขยับได้ตามปกติ
 *      (วิธีเดียวกับรูปการ์ดนักเตะที่อยู่ใน public/players/)
 *
 *   2) อัปโหลดไฟล์ตรง ๆ → เก็บเป็น data URL ในเอกสารค่าตั้ง
 *      ไฟล์เล็ก (ไม่เกิน LUCKY_IMAGE_RAW_BYTES) จะถูกเก็บทั้งไฟล์แบบไม่แตะต้อง
 *      GIF จึงยังขยับได้ · ไฟล์ใหญ่กว่านั้นถูกย่อผ่าน canvas เป็น webp/png
 *      ซึ่ง "GIF จะกลายเป็นภาพนิ่ง" เพราะ canvas เก็บได้แค่เฟรมแรก — ฟังก์ชันจะบอกกลับมาว่าย่อไปไหม
 *
 * ทำไมไม่ใช้ Firebase Storage: Storage ต้องเปิดแพลนแบบผูกบัตร (Blaze)
 * ส่วน Firestore ใช้ได้ฟรีตั้งแต่แรก — เหตุผลเดียวกับรูปโปรไฟล์ใน services/avatar.ts
 *
 * ⚠️ เอกสาร Firestore หนึ่งใบเก็บได้ไม่เกิน 1 MB และเอกสารนี้ผู้เล่น "ทุกคน" ต้องโหลด
 * ถ้าจะใส่รูปหลายสิบช่อง ให้ใช้วิธีที่ 1 เป็นหลัก — หน้า ADMIN มีมาตรวัดขนาดคอยเตือนอยู่
 */

/** ความกว้าง/สูงของรูปหลังย่อ (px) — ช่องในตารางเล็ก 128 จึงเหลือเฟือแล้ว */
const RESIZE_TO = 128;

/** คุณภาพการบีบอัดตอนย่อ 0–1 */
const QUALITY = 0.8;

/** ไฟล์ต้นทางที่ยอมรับ */
const ACCEPTED = ['image/png', 'image/webp', 'image/gif', 'image/jpeg'];

/** ขนาดไฟล์ต้นทางสูงสุด 8 MB — ใหญ่กว่านี้มือถือรุ่นเก่าจะค้างตอนวาดลง canvas */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/**
 * ไฟล์ที่เล็กกว่านี้จะถูกเก็บทั้งไฟล์โดยไม่ย่อ (ไบต์)
 * 48 KB → data URL ราว 64,000 ตัวอักษร ยังพอใส่ได้หลายช่องโดยเอกสารไม่บวม
 * และเป็นเส้นแบ่งที่ทำให้ GIF ไอคอนเล็ก ๆ ส่วนใหญ่รอดมาแบบยังขยับได้
 */
export const LUCKY_IMAGE_RAW_BYTES = 48 * 1024;

/** ความยาวสูงสุดของ data URL หนึ่งใบที่ยอมให้เก็บ (ตัวอักษร) */
export const LUCKY_IMAGE_MAX_CHARS = 70_000;

/** ข้อความบอกว่ารับไฟล์แบบไหน ใช้แสดงใต้ปุ่มเลือกรูป */
export const LUCKY_IMAGE_HINT = 'PNG · WEBP · GIF · JPG — ไม่เกิน 8 MB (ระบบย่อให้เองถ้าไฟล์ใหญ่)';

/** นามสกุลที่ยอมรับเมื่อแอดมินพิมพ์เป็นพาธ/ลิงก์ */
const PATH_PATTERN = /\.(png|webp|gif|jpe?g)(\?.*)?$/i;

/**
 * ค่านี้เอาไปใส่ src ของ <img> ได้อย่างปลอดภัยไหม
 * ยอมรับสามแบบ: data URL ของรูป · พาธในเว็บตัวเอง (/lucky/x.gif) · ลิงก์ https
 * ปฏิเสธทุกอย่างที่เหลือ โดยเฉพาะ javascript: ที่จะกลายเป็นช่องรันสคริปต์
 */
export const isSafeLuckyImage = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > LUCKY_IMAGE_MAX_CHARS) return false;

  if (value.startsWith('data:')) {
    return /^data:image\/(png|webp|gif|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value);
  }

  // พาธในโฟลเดอร์ public/ ของเราเอง — ต้องขึ้นต้นด้วย / เดียว (// คือลิงก์ข้ามเว็บ)
  if (value.startsWith('/') && !value.startsWith('//')) return PATH_PATTERN.test(value);

  if (value.startsWith('https://')) return PATH_PATTERN.test(value);

  return false;
};

/** ผลของการอ่านไฟล์รูปหนึ่งไฟล์ */
export interface LuckyImageResult {
  /** data URL ที่พร้อมเก็บลงค่าตั้ง */
  dataUrl: string;
  /** true = ถูกย่อผ่าน canvas (GIF จะกลายเป็นภาพนิ่ง) */
  resized: boolean;
}

/** อ่านไฟล์ทั้งไฟล์เป็น data URL โดยไม่แตะต้องเนื้อใน (GIF ยังขยับได้) */
const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้ ไฟล์อาจเสียหาย'));
    reader.readAsDataURL(file);
  });

/** โหลดไฟล์รูปเข้ามาเป็น <img> ที่พร้อมวาดลง canvas */
const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url); // คืนหน่วยความจำทันทีที่ไม่ใช้แล้ว
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('เปิดไฟล์รูปไม่ได้ ไฟล์อาจเสียหาย'));
    };

    image.src = url;
  });

/**
 * ย่อรูปให้ด้านยาวสุดไม่เกิน RESIZE_TO โดยคงสัดส่วนเดิม
 * (ไม่ครอบตัดเหมือนรูปโปรไฟล์ เพราะไอคอนรางวัลมีทั้งแนวตั้งแนวนอน โดนตัดแล้วเสียความหมาย)
 */
const toScaledDataUrl = (image: HTMLImageElement): string => {
  const longest = Math.max(image.width, image.height) || RESIZE_TO;
  const scale = Math.min(1, RESIZE_TO / longest);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์นี้ย่อรูปไม่ได้');

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // webp เล็กกว่า png มากและยังเก็บพื้นหลังโปร่งใสได้ — Safari รุ่นเก่าที่เขียนไม่ได้จะถอยไป png
  const webp = canvas.toDataURL('image/webp', QUALITY);
  if (webp.startsWith('data:image/webp')) return webp;

  return canvas.toDataURL('image/png');
};

/**
 * แปลงไฟล์ที่แอดมินเลือกเป็นรูปพร้อมใช้
 * โยน Error พร้อมข้อความภาษาไทยเมื่อใช้ไฟล์นั้นไม่ได้ — ให้ UI เอาไปแสดงได้เลย
 */
export const fileToLuckyImage = async (file: File): Promise<LuckyImageResult> => {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('ใช้ได้เฉพาะไฟล์ PNG, WEBP, GIF หรือ JPG');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('ไฟล์ใหญ่เกิน 8 MB ลองใช้รูปที่เล็กกว่านี้');
  }

  // ไฟล์เล็กพอ = เก็บทั้งไฟล์ ไม่ย่อ เพื่อให้ GIF ยังขยับและรูปไม่เสียคุณภาพ
  if (file.size <= LUCKY_IMAGE_RAW_BYTES) {
    const dataUrl = await readAsDataUrl(file);
    if (isSafeLuckyImage(dataUrl)) return { dataUrl, resized: false };
  }

  const image = await loadImage(file);
  const dataUrl = toScaledDataUrl(image);

  if (dataUrl.length > LUCKY_IMAGE_MAX_CHARS) {
    throw new Error('รูปนี้บีบให้เล็กพอไม่ได้ ลองใช้รูปอื่น หรือวางไฟล์ไว้ใน public/ แล้วใส่พาธแทน');
  }

  return { dataUrl, resized: true };
};
