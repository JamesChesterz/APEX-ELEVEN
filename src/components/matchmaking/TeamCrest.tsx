/**
 * ตราสโมสรแบบ monogram — ใช้อักษรย่อของชื่อทีม ไม่ใช้โลโก้จริงของสโมสรใด
 * สีคงที่ต่อชื่อทีม (คิดจาก clubHue) ทีมเดิมจึงได้ตราสีเดิมทุกครั้งที่เจอกัน
 */
import { clubHue, cn, initials } from '@/utils/helpers';

type CrestSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<CrestSize, string> = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-11 w-11 text-xs',
  lg: 'h-14 w-14 text-sm',
};

interface TeamCrestProps {
  name: string;
  size?: CrestSize;
  className?: string;
}

export const TeamCrest = ({ name, size = 'md', className }: TeamCrestProps) => {
  const hue = clubHue(name);

  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display leading-none tracking-wider text-white',
        SIZE_CLASS[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(150deg, hsl(${hue} 62% 42%), hsl(${(hue + 40) % 360} 55% 22%))`,
        boxShadow: `inset 0 0 0 2px hsl(${hue} 70% 62% / 0.55), 0 6px 18px -8px #000`,
      }}
    >
      {initials(name)}
    </span>
  );
};
