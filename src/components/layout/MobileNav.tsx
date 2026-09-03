/**
 * แถบเมนูล่างสำหรับจอที่ยังไม่กว้างพอจะแสดง Sidebar
 *
 * ใช้หมวดเดียวกับแถบซ้าย แต่แสดงเป็นเส้นคั่นบาง ๆ ระหว่างกลุ่มแทนหัวข้อ
 * เพราะแถบล่างมีความสูงจำกัด ยัดหัวข้อลงไปจะเบียดปุ่มจนกดพลาด
 */
import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { groupedNavItems } from '@/components/sidebar/navItems';
import { NavIcon } from '@/components/sidebar/NavIcon';
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

  // ตัดเมนูที่ยังไม่เปิดใช้ทิ้งไปเลย และตัดหมวดที่ว่างหลังกรองออกด้วย
  const groups = groupedNavItems(isOwner, toggles)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.available) }))
    .filter((group) => group.items.length > 0);

  return (
    <nav
      className="flex shrink-0 items-stretch overflow-x-auto border-t border-white/5 bg-ink-800 pb-[env(safe-area-inset-bottom)] lg:hidden"
      // ซ่อนแถบเลื่อนแต่ยังปัดได้ (เมนูมีหลายอันเกินจอมือถือ)
      style={{ scrollbarWidth: 'none' }}
    >
      {groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && <span className="my-2 w-px shrink-0 bg-white/10" />}

          {group.items.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              title={`${group.label} · ${item.label}`}
              className={({ isActive }) =>
                cn(
                  // min-w กันปุ่มถูกบีบจนกดพลาด (นิ้วต้องมีพื้นที่อย่างน้อย ~44px)
                  'flex min-w-[70px] flex-1 flex-col items-center gap-1 whitespace-nowrap px-2.5 pb-2.5 pt-2 text-center text-[10px] font-bold uppercase tracking-wide transition-colors',
                  isActive ? 'border-t-2 border-neon text-neon' : 'border-t-2 border-transparent text-chalk/45',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon item={item} size={22} active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </Fragment>
      ))}
    </nav>
  );
};
