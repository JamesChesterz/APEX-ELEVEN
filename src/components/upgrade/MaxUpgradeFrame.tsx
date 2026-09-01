/**
 * กรอบแสงทองของการ์ดที่ตีบวกจนสุด (+8)
 *
 * แสงทองวิ่งวนรอบกรอบไม่หยุด เป็นเครื่องหมายว่าใบนี้ตันแล้ว
 * ทำเป็นคอมโพเนนต์แยกเพราะต้องใช้ทั้งในหน้าตีบวกและในคลังการ์ด
 *
 * วิธีทำ: วางเลเยอร์ conic-gradient หมุนอยู่ข้างหลัง แล้วให้ตัวการ์ดทึบแสง
 * ทับตรงกลางไว้ เหลือให้เห็นเฉพาะขอบหนา 3px รอบนอก = แสงวิ่งรอบกรอบ
 * (ไม่ได้ใช้ mask เพราะ Safari รุ่นเก่ายังเพี้ยนอยู่)
 */
import type { ReactNode } from 'react';
import { cn } from '@/utils/helpers';

interface MaxUpgradeFrameProps {
  /** false = ไม่ต้องใส่กรอบ เรนเดอร์ลูกออกมาเฉย ๆ ไม่เพิ่ม element ให้เปลือง */
  active: boolean;
  /** true = เพิ่งตีติด +8 หมาด ๆ ให้เรืองแสงแรงกว่าปกติ */
  celebrate?: boolean;
  children: ReactNode;
  className?: string;
}

export const MaxUpgradeFrame = ({
  active,
  celebrate = false,
  children,
  className,
}: MaxUpgradeFrameProps) => {
  if (!active) return <>{children}</>;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-[3px]',
        celebrate
          ? 'shadow-[0_0_48px_rgba(245,185,62,0.95)]'
          : 'animate-max-glow shadow-[0_0_26px_rgba(245,185,62,0.55)]',
        className,
      )}
    >
      {/*
        เลเยอร์แสงหมุน — กว้างกว่ากรอบสองเท่าเพื่อให้มุมทั้งสี่ไม่ขาดตอน
        เว้นช่วงโปร่งใสไว้ยาว ๆ จะได้เห็นเป็น "ลำแสงวิ่ง" ไม่ใช่ขอบทองเรืองทั้งวง
      */}
      <div
        aria-hidden
        className={cn(
          'absolute left-1/2 top-1/2 h-[200%] w-[200%] animate-max-halo',
          'bg-[conic-gradient(from_0deg,transparent_0deg,transparent_190deg,rgba(245,185,62,0.25)_230deg,#F5B93E_300deg,#FFF3C4_330deg,#F5B93E_350deg,transparent_360deg)]',
        )}
      />

      {/* ตัวการ์ดทึบแสง ทับตรงกลางไว้ เหลือแค่ขอบ 3px ที่แสงวิ่งผ่าน */}
      <div className="relative rounded-[10px]">{children}</div>
    </div>
  );
};
