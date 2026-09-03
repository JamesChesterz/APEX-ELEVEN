/**
 * ไอคอนของเมนูหนึ่งอัน
 *
 * เมนูส่วนใหญ่มีไฟล์รูปใน public/nav/ แต่บางเมนู (Home · Pass · Settings · Admin)
 * ยังไม่มีรูป จึงต้องมีตัวสำรองเป็นสัญลักษณ์ตัวอักษร
 * ห่อไว้ในกล่องขนาดเท่ากันเสมอ ทั้งสองแบบจะได้ไม่ทำให้ความสูงของแถวเมนูกระโดด
 */
import type { NavItem } from '@/components/sidebar/navItems';
import { cn } from '@/utils/helpers';

interface NavIconProps {
  item: NavItem;
  /** ขนาดกล่องเป็น px */
  size?: number;
  /** เมนูนี้ถูกเลือกอยู่ไหม (ใช้เน้นสีของตัวสำรอง) */
  active?: boolean;
  /** เมนูที่ยังไม่เปิดใช้ — หรี่ลงให้ดูออกว่ากดไม่ได้ */
  muted?: boolean;
  className?: string;
}

export const NavIcon = ({ item, size = 26, active, muted, className }: NavIconProps) => (
  <span
    style={{ width: size, height: size }}
    className={cn('grid shrink-0 place-items-center', className)}
  >
    {item.iconUrl ? (
      <img
        src={item.iconUrl}
        alt=""
        loading="lazy"
        className={cn(
          'h-full w-full object-contain transition-all',
          muted ? 'opacity-30 grayscale' : active ? 'drop-shadow-[0_0_6px_rgba(49,224,109,0.45)]' : 'opacity-90',
        )}
      />
    ) : (
      <span
        className={cn(
          'text-base leading-none',
          muted ? 'text-chalk/20' : active ? 'text-neon' : 'text-chalk/55',
        )}
      >
        {item.icon}
      </span>
    )}
  </span>
);
