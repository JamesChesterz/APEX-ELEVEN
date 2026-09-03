/**
 * เมนูนำทางด้านซ้าย: โลโก้ + รายการเมนูแบ่งเป็นหมวด + แบนเนอร์อีเวนต์
 *
 * แบ่งหมวดเพราะเมนูโตขึ้นเป็นสิบกว่าอันแล้ว เรียงยาวรวดเดียวหาของไม่เจอ
 * หัวข้อหมวดกับลำดับอยู่ใน navItems.ts ที่เดียว (NAV_GROUPS)
 * เมนูที่ยังไม่มีหน้าจะ render เป็นปุ่มจาง ๆ ที่กดไม่ได้ เพื่อคงลำดับเมนูตามดีไซน์
 */
import { NavLink } from 'react-router-dom';
import { groupedNavItems } from './navItems';
import { NavIcon } from './NavIcon';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/utils/helpers';

const itemBase =
  'relative flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide transition-colors';

interface SidebarProps {
  /** true = กำลังแข่งอยู่ ห้ามเปลี่ยนหน้าจนกว่าจะจบนัด */
  locked?: boolean;
}

export const Sidebar = ({ locked = false }: SidebarProps) => {
  /** เมนู ADMIN โผล่เฉพาะเจ้าของโปรเจค · Lucky Box กับ Pass โผล่เมื่อแอดมินเปิดสวิตช์ไว้ */
  const { isOwner, luckyGrid, pass } = useGameConfig();
  const toggles = { luckyBox: luckyGrid.enabled, pass: pass.enabled };

  return (
    <aside className="hidden w-[212px] shrink-0 flex-col border-r border-white/5 bg-ink-800/90 lg:flex xl:w-[248px]">
      {/* โลโก้ (ตราสโมสรของเกมนี้เอง ไม่ใช่ของเกมต้นฉบับ) */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/15 font-display text-lg text-neon ring-1 ring-neon/40">
          A
        </span>
        <span className="leading-none">
          <span className="block font-display text-lg tracking-[0.08em]">APEX</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-neon">
            Eleven
          </span>
        </span>
      </div>

      {locked && (
        <p className="mx-3 mt-3 rounded-lg border border-kit/40 bg-kit/10 px-3 py-2 text-[11px] leading-snug text-kit">
          🔒 กำลังแข่งอยู่ — เมนูจะปลดล็อกเมื่อจบนัด
        </p>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {groupedNavItems(isOwner, toggles).map((group) => (
          <div key={group.id} className="pb-1.5">
            <p className="px-5 pb-1 pt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-chalk/25">
              {group.label}
            </p>

            {group.items.map((item) =>
              item.available && !locked ? (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      itemBase,
                      isActive
                        ? 'bg-gradient-to-r from-neon/20 to-transparent text-chalk'
                        : 'text-chalk/55 hover:bg-white/[0.04] hover:text-chalk',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-0 left-0 w-1 bg-neon" />}
                      <NavIcon item={item} active={isActive} />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  disabled
                  title={
                    locked
                      ? 'กำลังแข่งอยู่ — ดูจนจบนัดก่อนถึงจะเปลี่ยนหน้าได้'
                      : 'ยังไม่เปิดใช้งานในเฟสนี้'
                  }
                  className={cn(itemBase, 'w-full cursor-not-allowed text-chalk/25')}
                >
                  <NavIcon item={item} muted />
                  <span className="truncate">{item.label}</span>
                </button>
              ),
            )}
          </div>
        ))}
      </nav>

      {/* แบนเนอร์อีเวนต์ท้ายเมนู */}
      <div className="m-3 overflow-hidden rounded-xl border border-neon/25 bg-gradient-to-b from-neon/15 via-ink-700 to-ink-800 p-4">
        <p className="eyebrow text-neon">Event now on</p>
        <p className="mt-1 font-display text-lg leading-tight">TEAM OF THE SEASON</p>
        <p className="mt-1 text-xs text-chalk/50">รวมนักเตะฟอร์มแรงประจำซีซัน</p>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-neon py-2 text-xs font-bold uppercase tracking-wider text-ink-900"
        >
          เข้าร่วม
        </button>
      </div>
    </aside>
  );
};
