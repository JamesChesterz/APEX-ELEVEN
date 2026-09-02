/**
 * รูปทรงที่ใช้ซ้ำในหน้าอัปเกรด — หกเหลี่ยม (ช่องนักเตะ/ไอเทม) กับโล่ (โอกาสสำเร็จ)
 *
 * ทำด้วย clip-path ล้วน ไม่ใช้ไฟล์ SVG หรือรูปภาพ เพราะต้องเปลี่ยนสี
 * ตามสถานะ (ว่าง / ใส่แล้ว / ปิดอยู่) แบบสด ๆ และต้องคมทุกความละเอียดหน้าจอ
 *
 * ⚠️ clip-path ตัด border ทิ้ง วาดขอบตรง ๆ ไม่ได้ จึงต้องซ้อนสองชั้นเสมอ:
 * ชั้นนอก = สีขอบ · ชั้นใน (inset 1.5px) = สีพื้น
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/helpers';

/** หกเหลี่ยมหัวแหลมบน-ล่าง ตามแบบช่อง "เลือกนักเตะ" */
export const HEX_CLIP: CSSProperties = {
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
};

/** โล่ของแผง "โอกาสอัปเกรด" ด้านขวา */
export const SHIELD_CLIP: CSSProperties = {
  clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
};

interface HexProps {
  children?: ReactNode;
  /** คลาสสีของ "ขอบ" (ชั้นนอก) เช่น bg-gold/70 */
  edgeClass?: string;
  /** คลาสสีของ "พื้น" (ชั้นใน) เช่น bg-gold/10 */
  fillClass?: string;
  /** ความกว้างเป็น px — ความสูงคิดจากสัดส่วนหกเหลี่ยม */
  width?: number;
  className?: string;
  style?: CSSProperties;
}

/** กรอบหกเหลี่ยมเปล่า ใส่อะไรไว้ข้างในก็ได้ */
export const Hex = ({
  children,
  edgeClass = 'bg-white/15',
  fillClass = 'bg-ink-900',
  width = 74,
  className,
  style,
}: HexProps) => (
  <div
    style={{ width, height: Math.round(width * 1.14), ...style }}
    className={cn('relative shrink-0', className)}
  >
    <div style={HEX_CLIP} className={cn('absolute inset-0', edgeClass)} />
    <div style={HEX_CLIP} className={cn('absolute inset-[1.5px]', fillClass)} />
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center">
      {children}
    </div>
  </div>
);
