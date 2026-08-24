/**
 * แถบแบ่งหน้าของตารางอันดับ
 *
 * โชว์เลขหน้าแบบย่อ (1 … 4 5 6 … 20) เพื่อให้กดข้ามไปหน้าไกล ๆ ได้
 * โดยไม่ต้องเรียงเลขทุกหน้าจนล้นจอมือถือ
 */
import { cn } from '@/utils/helpers';

interface PaginationProps {
  /** หน้าปัจจุบัน เริ่มที่ 1 */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * เลขหน้าที่จะแสดงจริง — '…' คือช่องที่ถูกย่อ
 * แสดงหน้าแรก หน้าสุดท้าย และหน้ารอบ ๆ หน้าปัจจุบันเสมอ
 */
const buildPages = (page: number, totalPages: number): Array<number | '…'> => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((entry) => entry >= 1 && entry <= totalPages)
    .sort((a, b) => a - b);

  const result: Array<number | '…'> = [];
  visible.forEach((entry, index) => {
    // มีช่องว่างระหว่างเลขสองตัวเมื่อไหร่ ให้ใส่จุดไข่ปลาคั่น
    if (index > 0 && entry - visible[index - 1] > 1) result.push('…');
    result.push(entry);
  });

  return result;
};

const BUTTON = 'min-h-[36px] min-w-[36px] rounded-lg px-2.5 text-sm transition-colors';

export const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="แบ่งหน้าตารางอันดับ">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={cn(BUTTON, 'border border-white/10 text-chalk/60 hover:text-chalk disabled:opacity-30')}
        aria-label="หน้าก่อนหน้า"
      >
        ‹
      </button>

      {buildPages(page, totalPages).map((entry, index) =>
        entry === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-chalk/30">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              BUTTON,
              entry === page
                ? 'bg-neon font-bold text-ink-900'
                : 'border border-white/10 text-chalk/60 hover:text-chalk',
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={cn(BUTTON, 'border border-white/10 text-chalk/60 hover:text-chalk disabled:opacity-30')}
        aria-label="หน้าถัดไป"
      >
        ›
      </button>
    </nav>
  );
};
