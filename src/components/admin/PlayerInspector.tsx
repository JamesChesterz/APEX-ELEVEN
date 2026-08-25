/**
 * ส่องบัญชีผู้เล่นรายคน — ของหลักในหน้า ADMIN
 *
 * เลือกผู้เล่นจากตารางอันดับ แล้วดู/แก้ได้ทุกอย่างในที่เดียว:
 *   • ยอดเงิน แต้มแลกนักเตะ แต้มตีบวก
 *   • การ์ดทั้งหมดในคลัง (พร้อมเลเวลตีบวก)
 *   • ประวัติการเล่นย้อนหลัง พร้อมวันที่-เวลา
 *   • เพิ่ม/ลบดาว และสถิติแพ้-ชนะ-เสมอ
 *   • ระงับ/ปลดระงับบัญชี
 *
 * ข้อมูลอ่านจาก accounts/{uid} โดยตรง (กฎเปิดให้เจ้าของโปรเจคอ่านได้ทุกบัญชี)
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { Avatar } from '@/components/profile/Avatar';
import { getPlayerById } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useOnline } from '@/hooks/useOnline';
import { addBan, banReason, BAN_REASON_MAX_CHARS, isBanned, removeBan } from '@/services/admin';
import {
  readAccountForAdmin,
  setPlayerRecord,
  type AdminAccountView,
} from '@/services/firebase/adminActions';
import { playSfx } from '@/services/sound';
import type { RankRecord } from '@/types/match';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

type Tab = 'overview' | 'cards' | 'history';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'cards', label: 'คลังการ์ด' },
  { key: 'history', label: 'ประวัติการเล่น' },
];

const EMPTY_RECORD: RankRecord = { points: 0, wins: 0, draws: 0, losses: 0 };

/** วันที่-เวลาแบบไทย อ่านง่ายในตารางประวัติ */
const formatWhen = (iso?: string): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';

  return at.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** ช่องกรอกตัวเลขของสถิติ */
const StatField = ({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  tone?: string;
  onChange: (next: number) => void;
}) => (
  <label className="block">
    <span className={cn('eyebrow', tone)}>{label}</span>
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
      className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 font-mono text-sm outline-none focus:border-neon/50"
    />
  </label>
);

export const PlayerInspector = () => {
  const { profileByUid } = useOnline();
  const { bans, saveBans } = useGameConfig();

  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<AdminAccountView | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  /** สถิติที่กำลังแก้อยู่ (ยังไม่กดบันทึก) */
  const [draft, setDraft] = useState<RankRecord>(EMPTY_RECORD);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const everyone = useMemo(() => Object.values(profileByUid), [profileByUid]);

  const matches = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const list = term
      ? everyone.filter(
          (profile) =>
            profile.teamName.toLowerCase().includes(term) ||
            profile.managerName.toLowerCase().includes(term) ||
            profile.uid.toLowerCase().includes(term),
        )
      : everyone;

    return [...list].sort((a, b) => b.points - a.points).slice(0, 20);
  }, [everyone, keyword]);

  const open = async (uid: string) => {
    playSfx('click');
    setLoading(true);
    setStatus(null);
    setTab('overview');

    try {
      const account = await readAccountForAdmin(uid);
      if (!account) {
        setStatus('อ่านบัญชีไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
        setSelected(null);
        return;
      }

      setSelected(account);
      setDraft(account.state?.record ?? EMPTY_RECORD);
      setReason(banReason(bans, uid));
    } catch (error) {
      console.error('[admin] อ่านบัญชีไม่สำเร็จ', error);
      setStatus('อ่านบัญชีไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const saveRecord = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);

    try {
      await setPlayerRecord(selected.uid, draft);
      setStatus('บันทึกสถิติแล้ว — ตารางอันดับอัปเดตทันที');
      playSfx('rankUp');
    } catch (error) {
      console.error('[admin] บันทึกสถิติไม่สำเร็จ', error);
      setStatus('บันทึกไม่สำเร็จ — ตรวจสิทธิ์ isProjectOwner ใน firestore.rules');
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);

    const banned = isBanned(bans, selected.uid);
    const next = banned ? removeBan(bans, selected.uid) : addBan(bans, selected.uid, reason);
    const error = await saveBans(next);

    setBusy(false);
    setStatus(error ?? (banned ? 'ปลดระงับแล้ว' : 'ระงับบัญชีแล้ว — เจ้าตัวจะเข้าเกมไม่ได้'));
    if (!error) playSfx('click');
  };

  /** เวลาที่โปรไฟล์สาธารณะของเขาถูกเขียนล่าสุด (ข้อมูลที่คนอื่นเห็น) */
  const profileUpdatedMs = selected ? profileByUid[selected.uid]?.updatedAtMs ?? 0 : 0;
  const lastProfileUpdate = profileUpdatedMs
    ? formatWhen(new Date(profileUpdatedMs).toISOString())
    : 'ไม่เคย';
  /** ค้างเกินหนึ่งวัน = น่าสงสัยว่าเขียนไม่ผ่าน */
  const staleProfile = !profileUpdatedMs || Date.now() - profileUpdatedMs > 24 * 60 * 60 * 1000;

  const state = selected?.state;
  const cards = state?.cards ?? [];
  const history = state?.matchHistory ?? [];
  const banned = selected ? isBanned(bans, selected.uid) : false;

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">ส่องบัญชีผู้เล่น</p>
        <p className="mt-1 text-xs text-chalk/45">
          ดูของในบัญชี · ประวัติการเล่น · แก้ดาวและสถิติ · ระงับบัญชี
        </p>
      </div>

      {/* ── ค้นหาผู้เล่น ── */}
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="ค้นหาชื่อทีม / ชื่อผู้จัดการ / uid"
        className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
      />

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {matches.map((profile) => (
          <button
            key={profile.uid}
            type="button"
            onClick={() => open(profile.uid)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
              selected?.uid === profile.uid
                ? 'border-neon/60 bg-neon/10'
                : 'border-white/8 bg-ink-700/40 hover:border-white/20',
            )}
          >
            <Avatar src={profile.avatar} name={profile.managerName} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {profile.teamName}
                {isBanned(bans, profile.uid) && (
                  <span className="ml-2 rounded bg-[#F0A070]/20 px-1.5 py-0.5 font-mono text-[9px] text-[#F0A070]">
                    ถูกระงับ
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-[10px] text-chalk/40">
                {profile.managerName} · OVR {profile.teamOvr} · ⭐ {formatNumber(profile.points)}
              </span>
            </span>
          </button>
        ))}

        {matches.length === 0 && (
          <p className="px-1 py-3 text-center text-xs text-chalk/40">ไม่พบผู้เล่นที่ค้นหา</p>
        )}
      </div>

      {status && <p className="text-xs text-chalk/70">{status}</p>}
      {loading && <p className="text-xs text-chalk/50">กำลังอ่านบัญชี…</p>}

      {/* ── รายละเอียดบัญชีที่เลือก ── */}
      {selected && !loading && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-ink-700/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-none">
                {selected.teamName ?? '—'}
              </p>
              <p className="truncate font-mono text-[10px] text-chalk/40">
                {selected.managerName} · ไอดี {selected.username ?? '—'} · uid {selected.uid}
              </p>
            </div>

            <span className="text-right font-mono text-[10px] text-chalk/35">
              สมัครเมื่อ {formatWhen(selected.createdAt)}
              {/*
                * โปรไฟล์คือข้อมูลที่ "คนอื่นเห็น" — ถ้าค้างมานานผิดปกติ
                * แปลว่าเครื่องเขาเขียนขึ้นเซิร์ฟเวอร์ไม่สำเร็จ (กฎปฏิเสธ/โควตาหมด)
                * เคยเกิดมาแล้วและกว่าจะรู้ก็ต่อเมื่อมีคนมาบ่น จึงโชว์ไว้ให้เห็นตรงนี้
                */}
              <span className={cn('block', staleProfile ? 'text-[#F0A070]' : undefined)}>
                โปรไฟล์อัปเดตล่าสุด {lastProfileUpdate}
                {staleProfile && ' ⚠'}
              </span>
            </span>
          </div>

          {/* แท็บ */}
          <div className="flex gap-1.5">
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  playSfx('click');
                  setTab(entry.key);
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  tab === entry.key ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/55 hover:text-chalk',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {/* ── ภาพรวม ── */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'เหรียญ', value: state?.coins ?? 0, tone: 'text-gold' },
                  { label: 'แต้มแลกนักเตะ', value: state?.points ?? 0, tone: 'text-token' },
                  { label: 'แต้มตีบวก', value: state?.upgradePoints ?? 0, tone: 'text-kit' },
                ].map((entry) => (
                  <div key={entry.label} className="rounded-lg border border-white/8 bg-ink-900/50 p-2">
                    <p className="eyebrow">{entry.label}</p>
                    <p className={cn('font-display text-lg leading-tight', entry.tone)}>
                      {formatNumber(entry.value)}
                    </p>
                  </div>
                ))}
              </div>

              <p className="font-mono text-[10px] text-chalk/35">
                มีการ์ดในคลัง {cards.length} ใบ · ลงแข่งไปแล้ว {history.length} นัด (เท่าที่เก็บไว้)
              </p>

              {/* แก้ดาวและสถิติ */}
              <div className="space-y-2 rounded-lg border border-white/10 bg-ink-900/40 p-3">
                <p className="eyebrow">แก้ดาวและสถิติ</p>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatField
                    label="ดาว"
                    tone="text-gold"
                    value={draft.points}
                    onChange={(points) => setDraft((current) => ({ ...current, points }))}
                  />
                  <StatField
                    label="ชนะ"
                    value={draft.wins}
                    onChange={(wins) => setDraft((current) => ({ ...current, wins }))}
                  />
                  <StatField
                    label="เสมอ"
                    value={draft.draws}
                    onChange={(draws) => setDraft((current) => ({ ...current, draws }))}
                  />
                  <StatField
                    label="แพ้"
                    value={draft.losses}
                    onChange={(losses) => setDraft((current) => ({ ...current, losses }))}
                  />
                </div>

                {/* ปุ่มบวก-ลบเร็ว ๆ ไม่ต้องพิมพ์เลขเอง */}
                <div className="flex flex-wrap gap-1.5">
                  {[100, 500, -100, -500].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        setDraft((current) => ({
                          ...current,
                          points: Math.max(0, current.points + delta),
                        }));
                      }}
                      className="rounded-lg border border-white/15 px-3 py-1 font-mono text-[11px] text-chalk/70 hover:text-chalk"
                    >
                      {delta > 0 ? `+${delta}` : delta} ดาว
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraft(selected.state?.record ?? EMPTY_RECORD)}
                    className="ml-auto rounded-lg border border-white/15 px-3 py-1 font-mono text-[11px] text-chalk/50 hover:text-chalk"
                  >
                    คืนค่าเดิม
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={saveRecord}
                  className="w-full rounded-lg bg-neon py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
                >
                  {busy ? 'กำลังบันทึก…' : 'บันทึกสถิติ'}
                </button>
              </div>

              {/* ระงับบัญชี */}
              <div className="space-y-2 rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/5 p-3">
                <p className="eyebrow text-[#F0A070]">
                  {banned ? 'บัญชีนี้ถูกระงับอยู่' : 'ระงับบัญชี'}
                </p>

                {!banned && (
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={BAN_REASON_MAX_CHARS}
                    placeholder="เหตุผล (เจ้าตัวจะเห็นข้อความนี้)"
                    className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
                  />
                )}

                {banned && banReason(bans, selected.uid) && (
                  <p className="text-xs text-chalk/60">เหตุผล: {banReason(bans, selected.uid)}</p>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={toggleBan}
                  className={cn(
                    'w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40',
                    banned
                      ? 'border border-white/20 text-chalk/70 hover:text-chalk'
                      : 'bg-[#F0A070] text-ink-900',
                  )}
                >
                  {banned ? 'ปลดระงับบัญชี' : 'ระงับบัญชีนี้'}
                </button>
              </div>
            </div>
          )}

          {/* ── คลังการ์ด ── */}
          {tab === 'cards' && (
            <div>
              {cards.length === 0 ? (
                <p className="py-6 text-center text-xs text-chalk/40">ยังไม่มีการ์ดในคลัง</p>
              ) : (
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-7">
                  {cards.map((card) => {
                    const player = getPlayerById(card.playerId);
                    if (!player) return null;

                    return (
                      <div key={card.id} className="flex flex-col items-center gap-1">
                        <PlayerCard player={player} size="xs" />
                        <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                          {player.name}
                        </span>
                        <span
                          className={cn('font-mono text-[8px]', RARITY_STYLE[player.rarity].text)}
                        >
                          {card.level > 1 ? `+${card.level - 1}` : 'OVR'} {player.ovr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ประวัติการเล่น ── */}
          {tab === 'history' && (
            <div className="max-h-72 overflow-y-auto">
              {history.length === 0 ? (
                <p className="py-6 text-center text-xs text-chalk/40">ยังไม่มีประวัติการแข่ง</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['วันที่-เวลา', 'โหมด', 'คู่แข่ง', 'ผล', 'ดาว'].map((head) => (
                        <th key={head} className="eyebrow py-1.5 font-normal">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((match) => (
                      <tr key={match.id} className="border-b border-white/5 last:border-0">
                        <td className="py-1.5 font-mono text-[10px] text-chalk/60">
                          {formatWhen(match.playedAt)}
                        </td>
                        <td className="py-1.5 font-mono text-[10px] text-chalk/45">{match.mode}</td>
                        <td className="max-w-[8rem] truncate py-1.5">{match.opponentName}</td>
                        <td className="py-1.5 font-mono">
                          {match.teamScore}-{match.opponentScore}
                        </td>
                        <td
                          className={cn(
                            'py-1.5 font-mono',
                            match.rankingPoints > 0
                              ? 'text-neon'
                              : match.rankingPoints < 0
                                ? 'text-[#F0A070]'
                                : 'text-chalk/40',
                          )}
                        >
                          {match.rankingPoints > 0 ? '+' : ''}
                          {match.rankingPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
