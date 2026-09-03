/**
 * ป้าย DEV — บอกว่าไอดีนี้เป็นบัญชีของทีมพัฒนา
 *
 * อยู่โฟลเดอร์เดียวกับ RankBadge / ChampionTitle เพราะเป็นป้ายที่ติดข้างชื่อเหมือนกัน
 * และถูกใช้หลายที่ (แถบบน · ตารางอันดับ) จึงต้องเป็นคอมโพเนนต์กลาง ไม่ใช่ก๊อปโค้ดซ้ำ
 *
 * ใช้สีแดงเพราะป้ายอื่นข้างชื่อใช้โทนม่วง-ทองอยู่แล้ว ถ้าใช้โทนเดียวกัน
 * จะดูเหมือนเป็นระดับหนึ่งในเกม ทั้งที่มันคือสถานะของทีมงาน ไม่ใช่ความสำเร็จที่เล่นได้
 */
import { cn } from '@/utils/helpers';

interface DevBadgeProps {
  /** xs = ข้างชื่อในแถบบน / sm = ที่ที่มีพื้นที่มากกว่า */
  size?: 'xs' | 'sm';
  className?: string;
}

export const DevBadge = ({ size = 'xs', className }: DevBadgeProps) => (
  <span
    title="บัญชีทีมพัฒนา"
    className={cn(
      'shrink-0 rounded border border-rose-400/60 bg-rose-500/15 font-mono font-bold uppercase tracking-[0.12em] text-rose-300',
      size === 'xs' ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]',
      className,
    )}
  >
    Dev
  </span>
);
