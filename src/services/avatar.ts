/**
 * รูปโปรไฟล์ — ย่อรูปที่ผู้เล่นเลือกให้เล็กพอจะเก็บลง Firestore ได้ตรง ๆ
 *
 * ทำไมไม่ใช้ Firebase Storage: Storage ต้องเปิดแพลนแบบผูกบัตร (Blaze) ส่วน Firestore
 * ใช้ได้ฟรีตั้งแต่แรก เราจึงย่อรูปให้เหลือหลักไม่กี่ KB แล้วเก็บเป็นข้อความ data URL
 * ในเอกสารบัญชีเลย — ไม่ต้องตั้งค่าอะไรเพิ่ม และไม่มีไฟล์ค้างให้ต้องตามลบ
 *
 * ขนาดที่เลือก (112px) ตั้งใจให้เล็กเป็นพิเศษ เพราะรูปนี้ถูกส่งไปกับโปรไฟล์สาธารณะ
 * ที่ทุกคนโหลดพร้อมตารางอันดับ 100 แถว — รูปใหญ่ขึ้น 10 เท่าแปลว่าเน็ตมือถือของทุกคน
 * ต้องโหลดหนักขึ้น 10 เท่าเช่นกัน
 */

/** ความกว้าง/สูงของรูปหลังย่อ (px) — รูปเป็นสี่เหลี่ยมจัตุรัสเสมอ */
const SIZE = 112;

/** คุณภาพการบีบอัด 0–1 */
const QUALITY = 0.72;

/** ไฟล์ต้นทางที่ยอมรับ (กันไฟล์แปลก ๆ ตั้งแต่ก่อนอ่าน) */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

/** ขนาดไฟล์ต้นทางสูงสุด 8 MB — ใหญ่กว่านี้มือถือรุ่นเก่าจะค้างตอนวาดลง canvas */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/**
 * ความยาวสูงสุดของ data URL ที่ยอมให้เก็บ (ตัวอักษร)
 * 112px webp คุณภาพ 0.72 ปกติได้ราว 4–8 KB — เผื่อไว้ถึง 60 KB สำหรับรูปที่บีบยาก
 * ต้องตรงกับเพดานใน firestore.rules ไม่งั้นจะเซฟผ่านฝั่งเราแต่ถูกเซิร์ฟเวอร์ปฏิเสธ
 */
export const AVATAR_MAX_CHARS = 60_000;

/** ข้อความบอกผู้เล่นว่ารับไฟล์แบบไหน ใช้แสดงใต้ปุ่มเลือกรูป */
export const AVATAR_HINT = 'JPG · PNG · WEBP · ไม่เกิน 8 MB (ระบบจะย่อให้เอง)';

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
 * ย่อรูปเป็นสี่เหลี่ยมจัตุรัสขนาด SIZE โดยครอบตัดจากกึ่งกลาง
 * (รูปแนวตั้ง/แนวนอนจึงไม่ถูกบีบจนหน้าเบี้ยว แต่ถูกตัดขอบด้านที่ยาวกว่าออก)
 */
const toSquareDataUrl = (image: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์นี้ย่อรูปไม่ได้');

  // ด้านที่สั้นกว่าคือขนาดของกรอบสี่เหลี่ยมที่จะตัดออกมา
  const side = Math.min(image.width, image.height);
  const sourceX = (image.width - side) / 2;
  const sourceY = (image.height - side) / 2;

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, SIZE, SIZE);

  // webp เล็กกว่า jpeg ราวครึ่งหนึ่งที่คุณภาพเท่ากัน แต่ Safari รุ่นเก่าเขียนไม่ได้
  // toDataURL จะคืน image/png มาแทนเมื่อไม่รองรับ — เช็กจากหัวข้อความแล้วถอยไปใช้ jpeg
  const webp = canvas.toDataURL('image/webp', QUALITY);
  if (webp.startsWith('data:image/webp')) return webp;

  return canvas.toDataURL('image/jpeg', QUALITY);
};

/**
 * แปลงไฟล์ที่ผู้เล่นเลือกเป็นรูปโปรไฟล์พร้อมใช้ (data URL)
 * โยน Error พร้อมข้อความภาษาไทยเมื่อใช้ไฟล์นั้นไม่ได้ — ให้ UI เอาไปแสดงได้เลย
 */
export const fileToAvatar = async (file: File): Promise<string> => {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('ใช้ได้เฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('ไฟล์ใหญ่เกิน 8 MB ลองใช้รูปที่เล็กกว่านี้');
  }

  const image = await loadImage(file);
  const dataUrl = toSquareDataUrl(image);

  if (dataUrl.length > AVATAR_MAX_CHARS) {
    throw new Error('รูปนี้บีบให้เล็กพอไม่ได้ ลองใช้รูปอื่น');
  }

  return dataUrl;
};

/**
 * รูปนี้ปลอดภัยพอจะเอาไปแสดงไหม
 * ใช้กับรูปที่มาจากผู้เล่นคนอื่นบนเซิร์ฟเวอร์ — กันไม่ให้ค่าที่ถูกยัดมาแปลก ๆ
 * (เช่น javascript: หรือลิงก์ไปเว็บนอก) กลายเป็น src ของ <img>
 */
export const isSafeAvatar = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= AVATAR_MAX_CHARS &&
  /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value);
