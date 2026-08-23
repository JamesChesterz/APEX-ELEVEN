/** แถบเมนูล่างสำหรับจอที่ยังไม่กว้างพอจะแสดง Sidebar */
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/sidebar/navItems';
import { cn } from '@/utils/helpers';

export const MobileNav = () => (
  <nav className="flex shrink-0 overflow-x-auto border-t border-white/5 bg-ink-800 lg:hidden">
    {NAV_ITEMS.filter((item) => item.available).map((item) => (
      <NavLink
        key={item.id}
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) =>
          cn(
            'flex-1 whitespace-nowrap px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide transition-colors',
            isActive ? 'border-t-2 border-neon text-neon' : 'text-chalk/45',
          )
        }
      >
        {item.label}
      </NavLink>
    ))}
  </nav>
);
