/** แถบเมนูล่างสำหรับจอที่ยังไม่กว้างพอจะแสดง Sidebar */
import { NavLink } from 'react-router-dom';
import { visibleNavItems } from '@/components/sidebar/navItems';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/utils/helpers';

interface MobileNavProps {
  /** true = กำลังแข่งอยู่ ห้ามเปลี่ยนหน้าจนกว่าจะจบนัด */
  locked?: boolean;
}

export const MobileNav = ({ locked = false }: MobileNavProps) => {
  /** เมนู ADMIN โผล่เฉพาะเจ้าของโปรเจค · Lucky Box กับ Pass โผล่เมื่อแอดมินเปิดสวิตช์ไว้ */
  const { isOwner, luckyGrid, pass } = useGameConfig();
  const toggles = { luckyBox: luckyGrid.enabled, pass: pass.enabled };

  if (locked) {
    return (
      <p className="shrink-0 border-t border-white/5 bg-ink-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] font-bold uppercase tracking-wide text-kit lg:hidden">
        🔒 กำลังแข่งอยู่ — เมนูจะปลดล็อกเมื่อจบนัด
      </p>
    );
  }

  return (
  <nav
    className="flex shrink-0 overflow-x-auto border-t border-white/5 bg-ink-800 pb-[env(safe-area-inset-bottom)] lg:hidden"
    // ซ่อนแถบเลื่อนแต่ยังปัดได้ (เมนูมีหลายอันเกินจอมือถือ)
    style={{ scrollbarWidth: 'none' }}
  >
    {visibleNavItems(isOwner, toggles)
      .filter((item) => item.available)
      .map((item) => (
      <NavLink
        key={item.id}
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) =>
          cn(
            // min-w กันปุ่มถูกบีบจนกดพลาด (นิ้วต้องมีพื้นที่อย่างน้อย ~44px)
            'min-w-[76px] flex-1 whitespace-nowrap px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide transition-colors',
            isActive ? 'border-t-2 border-neon text-neon' : 'text-chalk/45',
          )
        }
      >
        {item.label}
      </NavLink>
      ))}
  </nav>
  );
};
