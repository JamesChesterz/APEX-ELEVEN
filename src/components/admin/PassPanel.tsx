/**
 * ตั้งค่า FC ALLSTAR PASS (แท็บ "พาส" ของหน้า ADMIN)
 *
 * ทำได้ทั้งหมดจากหน้านี้:
 *   • เปิด/ปิดเมนู Pass (ปิดแล้วเมนูหายจากแถบนำทางของผู้เล่นทุกคน)
 *   • ตั้งชื่อพาส ชื่อซีซัน รูปแบนเนอร์ และวันปิดซีซัน
 *   • ตั้ง XP ต่อนัด Matchmaking · ราคาซื้อเลเวล · ราคาปลดล็อก PREMIUM และ PREMIUM+
 *   • เลือกเลเวล 1–30 แล้วแก้ XP ที่ต้องใช้ และเพิ่ม/ลบรางวัลของทั้งสามสายในเลเวลนั้น
 *   • กด "เริ่มซีซันใหม่" เพื่อล้าง XP และของที่ผู้เล่นทุกคนรับไปแล้ว
 *
 * บันทึกแล้วหน้า Pass ของทุกคนเปลี่ยนทันที ไม่ต้อง deploy ใหม่
 */
import { useMemo, useState } from 'react';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { PlayerCard } from '@/components/player/PlayerCard';
import { PLAYERS } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { configByteSize, LUCKY_SIZE_BLOCK, LUCKY_SIZE_WARN } from '@/services/luckyGrid';
import {
  createReward,
  createStarterPass,
  describePassReward,
  PASS_LEVELS,
  PASS_LIMITS,
  PASS_REWARD_TYPES,
  PASS_TIERS,
  passRewardIcon,
  TIER_LABEL,
} from '@/services/pass';
import {
  formatRemaining,
  fromLocalInputValue,
  hoursFromNow,
  toLocalInputValue,
} from '@/services/pointsExchange';
import { playSfx } from '@/services/sound';
import type { PassConfig, PassLevel, PassReward, PassRewardType, PassTier } from '@/types/pass';
import { cn, formatNumber } from '@/utils/helpers';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

/** ปุ่มลัดตั้งวันปิดซีซัน */
const QUICK_END = [
  { label: '+7 วัน', hours: 168 },
  { label: '+14 วัน', hours: 336 },
  { label: '+30 วัน', hours: 720 },
  { label: '+60 วัน', hours: 1440 },
] as const;

/** จำนวนการ์ดที่แสดงในตารางเลือกต่อครั้ง */
const PICKER_VISIBLE = 32;

export const PassPanel = () => {
  const { pass, savePass } = useGameConfig();

  const [draft, setDraft] = useState<PassConfig>(pass);
  /** เลเวลที่กำลังแก้อยู่ (1–30) */
  const [level, setLevel] = useState(1);
  /** id ของรางวัลที่กางแผงเลือกการ์ด/รูปอยู่ */
  const [openReward, setOpenReward] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ตั้ง XP อัตโนมัติ: เลเวล N ต้องใช้ (N−1) × step */
  const [xpStep, setXpStep] = useState(500);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(pass);
  if (syncedWith !== pass) {
    setSyncedWith(pass);
    setDraft(pass);
    setOpenReward(null);
  }

  const ready = draft.levels.length > 0;
  const current: PassLevel | undefined = draft.levels[level - 1];

  const byteSize = configByteSize(draft as never);
  const embedded =
    draft.levels.reduce(
      (sum, entry) =>
        sum +
        PASS_TIERS.reduce(
          (inner, tier) => inner + entry[tier].filter((r) => r.image?.startsWith('data:')).length,
          0,
        ),
      0,
    ) + (draft.bannerImage?.startsWith('data:') ? 1 : 0);

  const results = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const list = term
      ? PLAYERS.filter(
          (player) =>
            player.name.toLowerCase().includes(term) ||
            player.position.toLowerCase().includes(term) ||
            player.rarity.toLowerCase().includes(term),
        )
      : PLAYERS;

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, PICKER_VISIBLE);
  }, [keyword]);

  const patch = (changes: Partial<PassConfig>) =>
    setDraft((entry) => ({ ...entry, ...changes }));

  /** ลบคีย์ทิ้งทั้งคีย์เมื่อค่าว่าง — Firestore ไม่รับ undefined */
  const setBanner = (image: string) =>
    setDraft((entry) => {
      if (!image) {
        const { bannerImage: _drop, ...rest } = entry;
        return rest;
      }
      return { ...entry, bannerImage: image };
    });

  const clearEndsAt = () =>
    setDraft((entry) => {
      const { endsAt: _drop, ...rest } = entry;
      return rest;
    });

  const patchLevel = (target: number, changes: Partial<PassLevel>) =>
    setDraft((entry) => ({
      ...entry,
      levels: entry.levels.map((item) => (item.level === target ? { ...item, ...changes } : item)),
    }));

  /** แก้รางวัลหนึ่งชิ้นในสายหนึ่งของเลเวลที่เลือกอยู่ */
  const patchReward = (tier: PassTier, id: string, changes: Partial<PassReward>) => {
    if (!current) return;
    patchLevel(level, {
      [tier]: current[tier].map((reward) => (reward.id === id ? { ...reward, ...changes } : reward)),
    } as Partial<PassLevel>);
  };

  /** ตั้ง/ล้างรูปของรางวัลหนึ่งชิ้น */
  const setRewardImage = (tier: PassTier, id: string, image: string) => {
    if (!current) return;
    patchLevel(level, {
      [tier]: current[tier].map((reward) => {
        if (reward.id !== id) return reward;
        if (!image) {
          const { image: _drop, ...rest } = reward;
          return rest;
        }
        return { ...reward, image };
      }),
    } as Partial<PassLevel>);
  };

  const addReward = (tier: PassTier) => {
    if (!current || current[tier].length >= PASS_LIMITS.maxRewardsPerCell) return;
    playSfx('click');
    patchLevel(level, { [tier]: [...current[tier], createReward()] } as Partial<PassLevel>);
  };

  const removeReward = (tier: PassTier, id: string) => {
    if (!current) return;
    playSfx('click');
    setOpenReward((entry) => (entry === id ? null : entry));
    patchLevel(level, {
      [tier]: current[tier].filter((reward) => reward.id !== id),
    } as Partial<PassLevel>);
  };

  /** เติม XP ให้ทุกเลเวลตามขั้นบันไดที่ตั้งไว้ */
  const autoFillXp = () => {
    playSfx('click');
    setDraft((entry) => ({
      ...entry,
      levels: entry.levels.map((item) => ({ ...item, xp: (item.level - 1) * xpStep })),
    }));
  };

  const submit = async () => {
    if (byteSize > LUCKY_SIZE_BLOCK) {
      setStatus('รูปที่ฝังไว้รวมกันใหญ่เกินไป — ลบรูปบางใบออก หรือเปลี่ยนไปใช้พาธไฟล์ใน public/ แทน');
      playSfx('error');
      return;
    }

    setSaving(true);
    setStatus(null);
    const error = await savePass(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — หน้า Pass ของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">FC ALLSTAR PASS</p>
          <p className="mt-1 text-xs text-chalk/45">
            {PASS_LEVELS} เลเวลต่อซีซัน · สาย FREE / PREMIUM / PREMIUM+ · ซีซันที่ {draft.season}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            patch({ enabled: !draft.enabled });
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
            draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/10 text-chalk/50 hover:text-chalk',
          )}
        >
          {draft.enabled ? 'เปิดอยู่ — ผู้เล่นเห็นเมนูนี้' : 'ปิดอยู่ — ซ่อนเมนูนี้'}
        </button>
      </div>

      {!ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 p-3 text-xs text-[#F0A070]">
          <span>ยังไม่เคยตั้งค่าพาส — กดสร้างชุดตั้งต้น 30 เลเวลแล้วค่อยแก้ทีละเลเวลได้เลย</span>
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setDraft(createStarterPass());
              setLevel(1);
            }}
            className="ml-auto rounded-lg border border-neon/40 px-3 py-1.5 font-bold uppercase tracking-wider text-neon hover:bg-neon/10"
          >
            สร้างพาสตั้งต้น
          </button>
        </div>
      )}

      {/* ── ค่าพื้นฐาน ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="ชื่อพาส">
          <input
            value={draft.title}
            maxLength={PASS_LIMITS.maxTitleChars}
            onChange={(event) => patch({ title: event.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="ชื่อซีซัน">
          <input
            value={draft.seasonName}
            maxLength={PASS_LIMITS.maxTitleChars}
            onChange={(event) => patch({ seasonName: event.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="XP ต่อหนึ่งนัด Matchmaking">
          <input
            type="number"
            min={0}
            value={draft.xpPerMatch}
            onChange={(event) => patch({ xpPerMatch: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>

        <Field label="ราคาซื้อข้ามเลเวล (เหรียญ · 0 = ปิด)">
          <input
            type="number"
            min={0}
            value={draft.levelUpCoins}
            onChange={(event) => patch({ levelUpCoins: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(inputClass, 'font-mono')}
          />
        </Field>
      </div>

      {/* ── ราคาปลดล็อกแต่ละสาย ── */}
      <div className="grid gap-3 rounded-lg border border-white/10 bg-ink-700/40 p-3 sm:grid-cols-2">
        {(['premium', 'plus'] as const).map((tier) => {
          const cost = tier === 'premium' ? draft.premiumCost : draft.plusCost;
          const apply = (changes: Partial<typeof cost>) =>
            patch(
              tier === 'premium'
                ? { premiumCost: { ...cost, ...changes } }
                : { plusCost: { ...cost, ...changes } },
            );

          return (
            <div key={tier} className="space-y-2">
              <p className="eyebrow">ราคาปลดล็อก {TIER_LABEL[tier]}</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="ตั๋วพาส (0 = ปิด)">
                  <input
                    type="number"
                    min={0}
                    value={cost.tickets}
                    onChange={(event) =>
                      apply({ tickets: Math.max(0, Number(event.target.value) || 0) })
                    }
                    className={cn(inputClass, 'font-mono')}
                  />
                </Field>
                <Field label="เหรียญ (0 = ปิด)">
                  <input
                    type="number"
                    min={0}
                    value={cost.coins}
                    onChange={(event) => apply({ coins: Math.max(0, Number(event.target.value) || 0) })}
                    className={cn(inputClass, 'font-mono')}
                  />
                </Field>
              </div>
              {cost.tickets === 0 && cost.coins === 0 && (
                <p className="text-[11px] text-[#F0A070]">
                  ⚠️ ปิดทั้งสองทาง = ผู้เล่นปลดล็อกสายนี้ไม่ได้เลย
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="rounded-lg border border-neon/25 bg-neon/5 p-3 text-[11px] leading-relaxed text-chalk/60">
        ตั๋วพาสไม่ได้ซื้อจากที่อื่น — วิธีเดียวที่ผู้เล่นจะได้คือใส่รางวัลชนิด “ตั๋วพาส” ไว้ในสาย FREE
        ของพาสเอง ถ้าอยากให้คนเล่นฟรีมีทางไปถึง PREMIUM ได้เอง ให้แจกตั๋วในสาย FREE สักเลเวล
        หรือเปิดทางเหรียญไว้ด้วย
      </p>

      {/* ── รูปแบนเนอร์ ── */}
      <ImagePicker
        label="รูปแบนเนอร์ของซีซัน (โชว์บนการ์ดสาย PREMIUM+)"
        value={draft.bannerImage ?? ''}
        onChange={setBanner}
        onError={setStatus}
      />

      {/* ── วันปิดซีซัน + ขึ้นซีซันใหม่ ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ปิดซีซันเมื่อ (ว่าง = ไม่มีกำหนด)">
          <div className="flex flex-wrap gap-1.5">
            <input
              type="datetime-local"
              value={toLocalInputValue(draft.endsAt)}
              onChange={(event) => {
                const next = fromLocalInputValue(event.target.value);
                if (next) patch({ endsAt: next });
                else clearEndsAt();
              }}
              className={cn(inputClass, 'font-mono text-xs')}
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_END.map((entry) => (
                <button
                  key={entry.hours}
                  type="button"
                  onClick={() => patch({ endsAt: hoursFromNow(entry.hours) })}
                  className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-chalk/55 hover:text-chalk"
                >
                  {entry.label}
                </button>
              ))}
              {draft.endsAt && (
                <button
                  type="button"
                  onClick={clearEndsAt}
                  className="rounded-lg border border-white/15 px-2 py-1 font-mono text-[10px] uppercase text-chalk/55 hover:text-chalk"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
          {draft.endsAt && (
            <p className="mt-1 font-mono text-[10px] text-chalk/45">
              เหลือ{' '}
              {formatRemaining(
                Math.max(0, Math.floor((new Date(draft.endsAt).getTime() - Date.now()) / 1000)),
              )}
            </p>
          )}
        </Field>

        <Field label="ซีซัน">
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              patch({ season: draft.season + 1 });
            }}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10"
          >
            เริ่มซีซันใหม่ (ซีซันที่ {draft.season + 1})
          </button>
          <p className="mt-1 text-[11px] text-chalk/45">
            กดแล้วบันทึก = XP สายที่ปลดล็อก และของที่รับไปแล้วของผู้เล่นทุกคนถูกล้างทันที
            รางวัลที่ยังไม่ได้กดรับจะหายไปด้วย
          </p>
        </Field>
      </div>

      {ready && (
        <>
          {/* ── ตั้ง XP ทุกเลเวลรวดเดียว ── */}
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-ink-700/40 p-3">
            <Field label="ตั้ง XP อัตโนมัติ — เลเวล N ใช้ (N−1) × ขั้น">
              <input
                type="number"
                min={0}
                value={xpStep}
                onChange={(event) => setXpStep(Math.max(0, Number(event.target.value) || 0))}
                className={cn(inputClass, 'w-32 font-mono')}
              />
            </Field>
            <button
              type="button"
              onClick={autoFillXp}
              className="rounded-lg border border-kit/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-kit hover:bg-kit/10"
            >
              เติมให้ทุกเลเวล
            </button>
            <p className="text-[11px] text-chalk/45">
              เลเวลสุดท้าย ({PASS_LEVELS}) จะต้องใช้ {formatNumber((PASS_LEVELS - 1) * xpStep)} XP
              ≈ {xpStep > 0 && draft.xpPerMatch > 0
                ? Math.ceil(((PASS_LEVELS - 1) * xpStep) / draft.xpPerMatch)
                : 0}{' '}
              นัด
            </p>
          </div>

          {/* ── เลือกเลเวล ── */}
          <div className="space-y-2">
            <p className="eyebrow">เลือกเลเวลที่จะแก้</p>
            <div className="flex flex-wrap gap-1">
              {draft.levels.map((entry) => {
                const filled = PASS_TIERS.some((tier) => entry[tier].length > 0);
                return (
                  <button
                    key={entry.level}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setLevel(entry.level);
                      setOpenReward(null);
                    }}
                    className={cn(
                      'h-9 w-9 rounded-lg border font-mono text-xs transition-colors',
                      entry.level === level
                        ? 'border-neon bg-neon text-ink-900'
                        : filled
                          ? 'border-white/15 bg-ink-900/60 text-chalk/70 hover:border-white/30'
                          : 'border-dashed border-white/10 text-chalk/35 hover:text-chalk/60',
                    )}
                  >
                    {entry.level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── แก้เลเวลที่เลือก ── */}
          {current && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-ink-700/50 p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="font-display text-lg uppercase">เลเวล {current.level}</p>

                <Field label="XP สะสมที่ต้องมีถึงจะปลดล็อกเลเวลนี้">
                  <input
                    type="number"
                    min={0}
                    disabled={current.level === 1}
                    value={current.xp}
                    onChange={(event) =>
                      patchLevel(current.level, { xp: Math.max(0, Number(event.target.value) || 0) })
                    }
                    className={cn(inputClass, 'w-40 font-mono disabled:opacity-40')}
                  />
                </Field>

                {current.level === 1 && (
                  <p className="text-[11px] text-chalk/45">เลเวล 1 เป็น 0 เสมอ (จุดเริ่มต้น)</p>
                )}
              </div>

              {/* รางวัลของสามสาย */}
              <div className="grid gap-3 lg:grid-cols-3">
                {PASS_TIERS.map((tier) => (
                  <div
                    key={tier}
                    className={cn(
                      'space-y-2 rounded-lg border p-2',
                      tier === 'free'
                        ? 'border-kit/30 bg-kit/5'
                        : tier === 'premium'
                          ? 'border-gold/30 bg-gold/5'
                          : 'border-neon/30 bg-neon/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'font-display text-sm uppercase',
                          tier === 'free' ? 'text-kit' : tier === 'premium' ? 'text-gold' : 'text-neon',
                        )}
                      >
                        {TIER_LABEL[tier]}
                      </p>
                      <button
                        type="button"
                        disabled={current[tier].length >= PASS_LIMITS.maxRewardsPerCell}
                        onClick={() => addReward(tier)}
                        className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk disabled:opacity-30"
                      >
                        + เพิ่มรางวัล
                      </button>
                    </div>

                    {current[tier].length === 0 ? (
                      <p className="rounded border border-dashed border-white/10 p-3 text-center text-[11px] text-chalk/40">
                        ยังไม่มีรางวัลในสายนี้
                      </p>
                    ) : (
                      current[tier].map((reward) => (
                        <div
                          key={reward.id}
                          className="space-y-2 rounded-lg border border-white/10 bg-ink-900/50 p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[11px] text-chalk/60">
                              {passRewardIcon(reward)} {describePassReward(reward)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeReward(tier, reward.id)}
                              className="shrink-0 rounded border border-[#F0A070]/40 px-2 py-0.5 text-[10px] font-bold uppercase text-[#F0A070] hover:bg-[#F0A070]/10"
                            >
                              ลบ
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {PASS_REWARD_TYPES.map((entry) => (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() =>
                                  patchReward(
                                    tier,
                                    reward.id,
                                    entry.key === 'card'
                                      ? { type: 'card', playerId: reward.playerId ?? PLAYERS[0]?.id }
                                      : { type: entry.key as PassRewardType, amount: reward.amount ?? 1000 },
                                  )
                                }
                                title={entry.label}
                                className={cn(
                                  'rounded px-2 py-1 text-[11px] transition-colors',
                                  reward.type === entry.key
                                    ? 'bg-neon text-ink-900'
                                    : 'bg-white/5 text-chalk/55 hover:text-chalk',
                                )}
                              >
                                {entry.icon}
                              </button>
                            ))}
                          </div>

                          {reward.type !== 'card' && (
                            <input
                              type="number"
                              min={0}
                              value={reward.amount ?? 0}
                              onChange={(event) =>
                                patchReward(tier, reward.id, {
                                  amount: Math.max(0, Number(event.target.value) || 0),
                                })
                              }
                              className={cn(inputClass, 'font-mono')}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setOpenReward((entry) => (entry === reward.id ? null : reward.id))
                            }
                            className="w-full rounded border border-white/15 py-1 text-[10px] font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
                          >
                            {openReward === reward.id ? 'ปิดตัวเลือก' : 'เลือกการ์ด / ใส่รูป'}
                          </button>

                          {openReward === reward.id && (
                            <div className="space-y-2">
                              {reward.type === 'card' && (
                                <>
                                  <input
                                    value={keyword}
                                    onChange={(event) => setKeyword(event.target.value)}
                                    placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
                                    className={cn(inputClass, 'text-xs')}
                                  />
                                  <div className="grid max-h-40 grid-cols-3 gap-1 overflow-y-auto rounded border border-white/10 bg-ink-900/60 p-1">
                                    {results.map((player) => (
                                      <button
                                        key={player.id}
                                        type="button"
                                        onClick={() =>
                                          patchReward(tier, reward.id, {
                                            type: 'card',
                                            playerId: player.id,
                                          })
                                        }
                                        className={cn(
                                          'flex flex-col items-center gap-0.5 rounded border p-1 transition-colors',
                                          reward.playerId === player.id
                                            ? 'border-neon bg-neon/10'
                                            : 'border-transparent hover:border-white/20',
                                        )}
                                      >
                                        <PlayerCard player={player} size="xs" />
                                        <span className="w-full truncate text-center font-mono text-[8px] text-chalk/50">
                                          {player.name}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}

                              <ImagePicker
                                label="รูปของรางวัลชิ้นนี้"
                                value={reward.image ?? ''}
                                onChange={(image) => setRewardImage(tier, reward.id, image)}
                                onError={setStatus}
                              />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── มาตรวัดขนาดเอกสาร ── */}
      {embedded > 0 && (
        <p
          className={cn(
            'rounded-lg border p-3 text-[11px]',
            byteSize > LUCKY_SIZE_BLOCK
              ? 'border-gem/40 bg-gem/10 text-gem'
              : byteSize > LUCKY_SIZE_WARN
                ? 'border-[#F0A070]/30 bg-[#F0A070]/10 text-[#F0A070]'
                : 'border-white/10 bg-ink-700/40 text-chalk/55',
          )}
        >
          ฝังรูปไว้ {embedded} ใบ · ขนาดค่าตั้งราว {Math.round(byteSize / 1024)} KB จากเพดาน 1024 KB
          {byteSize > LUCKY_SIZE_WARN && (
            <>
              <br />
              พาสมี 30 เลเวล × 3 สาย ถ้าใส่รูปฝังทุกช่องจะชนเพดานเร็วมาก — วางไฟล์ไว้ใน public/
              แล้วใส่พาธแทนจะไม่กินพื้นที่เลย
            </>
          )}
        </p>
      )}

      {/* ── บันทึก ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {status && <p className="min-w-0 text-xs text-chalk/70">{status}</p>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(pass)}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
          >
            คืนค่าเดิม
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-lg bg-neon px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกพาส'}
          </button>
        </div>
      </div>
    </section>
  );
};
