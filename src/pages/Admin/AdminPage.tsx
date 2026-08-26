/**
 * หน้า ADMIN — เห็นเฉพาะไอดีที่อยู่ใน OWNER_USERNAMES (src/data/rankRewards.ts)
 *
 * จัดเป็นแท็บแนวนอนด้านบน กดเลือกแล้วค่อยแสดงทีละเรื่อง
 * (เดิมกองทุกแผงไว้ในหน้าเดียวจนต้องเลื่อนหายาว และโหลดของที่ยังไม่ได้ใช้ทิ้งไว้)
 *
 * คนที่ไม่ใช่เจ้าของ ต่อให้พิมพ์ /admin เข้ามาเองก็เห็นแค่ข้อความปฏิเสธ
 * และต่อให้แก้โค้ดฝั่งหน้าเว็บ Firestore ก็ยังปฏิเสธการเขียนอยู่ดี (ดู firestore.rules)
 */
import { useState } from 'react';
import { AnnouncementPanel } from '@/components/admin/AnnouncementPanel';
import { ExchangeDealsPanel } from '@/components/admin/ExchangeDealsPanel';
import { FeaturedCardsPanel } from '@/components/admin/FeaturedCardsPanel';
import { GiftPanel } from '@/components/admin/GiftPanel';
import { LadderPanel } from '@/components/admin/LadderPanel';
import { NewsPanel } from '@/components/admin/NewsPanel';
import { PackBuilderPanel } from '@/components/admin/PackBuilderPanel';
import { PlayerInspector } from '@/components/admin/PlayerInspector';
import { RankRewardEditor } from '@/components/leaderboard/RankRewardEditor';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useOnline } from '@/hooks/useOnline';
import { LEADERBOARD_LIMIT } from '@/services/firebase/profiles';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

const TABS = [
  { id: 'players', label: 'ส่องบัญชี', icon: '🔍' },
  { id: 'gift', label: 'เสกของ', icon: '🎁' },
  { id: 'packs', label: 'ซองการ์ด', icon: '▣' },
  { id: 'exchange', label: 'แลกเปลี่ยนการ์ด', icon: '⇄' },
  { id: 'rewards', label: 'รางวัลอันดับ', icon: '🏆' },
  { id: 'ladder', label: 'ตารางอันดับ & ซีซัน', icon: '⭐' },
  { id: 'announcement', label: 'ประกาศ', icon: '📢' },
  { id: 'news', label: 'ข่าวหน้าแรก', icon: '📰' },
  { id: 'featuredCards', label: 'การ์ดใหม่ (หน้าแรก)', icon: '🃏' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export const AdminPage = () => {
  const { isOwner, uid } = useGameConfig();
  const { connected, playerCount } = useOnline();
  const [tab, setTab] = useState<TabId>('players');

  if (!isOwner) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl uppercase">เข้าไม่ได้</p>
        <p className="mt-2 text-sm text-chalk/50">หน้านี้สำหรับผู้ดูแลเกมเท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl">ผู้ดูแลเกม</h2>
        <p className="text-sm text-chalk/50">
          {connected
            ? `ต่อกับเซิร์ฟเวอร์อยู่ · ผู้เล่นทั้งหมด ${formatNumber(playerCount)} คน` +
              ` (ตารางอันดับแสดง ${LEADERBOARD_LIMIT} อันดับแรก)`
            : 'ยังไม่ได้ต่อเซิร์ฟเวอร์'}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-chalk/35">
          uid ของคุณ: {uid ?? '—'} (ต้องอยู่ใน isProjectOwner() ของ firestore.rules ถึงจะบันทึกได้)
        </p>
      </div>

      {/* ── แท็บแนวนอน ── */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              playSfx('click');
              setTab(entry.id);
            }}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
              tab === entry.id
                ? 'bg-neon text-ink-900'
                : 'bg-white/5 text-chalk/55 hover:text-chalk',
            )}
          >
            <span className="mr-1.5" aria-hidden>
              {entry.icon}
            </span>
            {entry.label}
          </button>
        ))}
      </div>

      {/* ── เนื้อหาของแท็บที่เลือก ── */}
      {tab === 'players' && <PlayerInspector />}
      {tab === 'gift' && <GiftPanel />}
      {tab === 'packs' && <PackBuilderPanel />}
      {tab === 'exchange' && <ExchangeDealsPanel />}
      {tab === 'rewards' && (
        <section className="glass-panel p-5">
          <div className="mb-3">
            <p className="panel-title">รางวัลปลายซีซันตามอันดับ</p>
            <p className="mt-1 text-xs text-chalk/45">
              ตั้งจำนวนอันดับที่ได้รางวัล และเลือกการ์ดของแต่ละอันดับ
            </p>
          </div>
          <RankRewardEditor />
        </section>
      )}
      {tab === 'ladder' && <LadderPanel />}
      {tab === 'announcement' && <AnnouncementPanel />}
      {tab === 'news' && <NewsPanel />}
      {tab === 'featuredCards' && <FeaturedCardsPanel />}
    </div>
  );
};
