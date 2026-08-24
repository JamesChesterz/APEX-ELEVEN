/**
 * รูปโปรไฟล์ผู้เล่น — ใช้ร่วมกันทุกที่ (แถบหัว, ตารางอันดับ, หน้าโปรไฟล์)
 *
 * ยังไม่ได้ตั้งรูป หรือรูปที่ได้มาจากเซิร์ฟเวอร์ไม่ผ่านการตรวจ → แสดงตัวอักษรแรกของชื่อแทน
 * การตรวจอยู่ใน services/avatar.ts เพราะรูปของผู้เล่นคนอื่นถือเป็นข้อมูลจากภายนอก
 */
import { isSafeAvatar } from '@/services/avatar';
import { cn } from '@/utils/helpers';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-9 w-9 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-24 w-24 text-3xl',
};

interface AvatarProps {
  /** data URL ของรูป (ไม่มี = ใช้ตัวอักษรแทน) */
  src?: string | null;
  /** ชื่อที่ใช้ดึงตัวอักษรแรกมาแสดงเมื่อไม่มีรูป */
  name: string;
  size?: AvatarSize;
  className?: string;
}

export const Avatar = ({ src, name, size = 'sm', className }: AvatarProps) => {
  const base = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10',
    SIZE_CLASS[size],
    className,
  );

  if (isSafeAvatar(src)) {
    return (
      <img
        src={src}
        alt={`รูปโปรไฟล์ของ ${name}`}
        className={cn(base, 'object-cover')}
        // รูปมาจาก data URL จึงโหลดทันที ไม่ต้องรอเครือข่าย
        draggable={false}
      />
    );
  }

  return (
    <span className={cn(base, 'bg-gradient-to-b from-ink-500 to-ink-700 font-display')}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
};
