/** แถบเมนูล่างสำหรับจอที่ยังไม่กว้างพอจะแสดง Sidebar */
import { NavLink } from 'react-router-dom';
import { visibleNavItems } from '@/components/sidebar/navItems';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/utils/helpers';

export const MobileNav = () => {
  /** เมนู ADMIN โผล่เฉพาะเจ้าของโปรเจค */
  const { isOwner } = useGameConfig();

  return (
  <nav
    className="flex shrink-0 overflow-x-auto border-t border-white/5 bg-ink-800 pb-[env(safe-area-inset-bottom)] lg:hidden"
    // ซ่อนแถบเลื่อนแต่ยังปัดได้ (เมนูมีหลายอันเกินจอมือถือ)
    style={{ scrollbarWidth: 'none' }}
  >
    {visibleNavItems(isOwner)
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
