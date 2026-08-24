/**
 * แผงรีเซ็ตดาว / ซีซัน / ความยาวซีซัน
 *
 * การรีเซ็ตทำงานสองชั้นพร้อมกัน:
 *   1. เขียนทับดาวใน profiles ของทุกคน → ตารางอันดับเป็นศูนย์ทันทีทั้งกระดาน
 *   2. ประทับเวลาคำสั่งไว้ที่ config/ladder → ดาวในบัญชีจริงของแต่ละคน
 *      ถูกล้างตอนเขาเปิดเกมครั้งถัดไป (แอดมินเขียนบัญชีคนอื่นตรง ๆ ไม่ได้)
 */
import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useOnline } from '@/hooks/useOnline';
import { pointsAfterReset } from '@/services/admin';
import { resetProfilePoints } from '@/services/firebase/adminActions';
import { SEASON_DAYS, SEASON_DAYS_RANGE, resolveSeasonDays } from '@/services/season';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

/** ตัวเลือกสัดส่วนดาวที่เก็บไว้ */
const KEEP_OPTIONS = [
  { value: 0, label: 'ล้างหมด (0%)' },
  { value: 0.3, label: 'เหลือ 30%' },
  { value: 0.5, label: 'เหลือ 50%' },
];

export const LadderPanel = () => {
  const { ladder, saveLadder } = useGameConfig();
  const { profileByUid } = useOnline();

  const [keep, setKeep] = useState(0);
  const [resetSeason, setResetSeason] = useState(false);
  const [seasonDays, setSeasonDays] = useState(() => resolveSeasonDays(ladder.seasonDays));
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const everyone = Object.values(profileByUid);

  const runReset = async () => {
    setBusy(true);
    setStatus(null);

    const command = {
      resetAt: new Date().toISOString(),
      keep,
      resetSeason,
      seasonDays: resolveSeasonDays(seasonDays),
    };

    // 1) สั่งให้ทุกเครื่องล้างดาวในบัญชีตัวเองตอนเปิดเกมครั้งถัดไป
    const error = await saveLadder(command);

    if (error) {
      setBusy(false);
      setConfirming(false);
      setStatus(error);
      return;
    }

    // 2) ล้างตารางอันดับให้เห็นผลทันที
    try {
      const written = await resetProfilePoints(
        everyone.map((profile) => ({
          uid: profile.uid,
          points: pointsAfterReset(profile.points, command),
        })),
      );

      setStatus(
        `รีเซ็ตแล้ว ${written} บัญชี · ตารางอันดับอัปเดตทันที ส่วนดาวในบัญชีของแต่ละคน` +
          ' จะถูกล้างตอนเขาเปิดเกมครั้งถัดไป',
      );
      playSfx('rankUp');
    } catch (writeError) {
      console.error('[admin] ล้างตารางอันดับไม่สำเร็จ', writeError);
      setStatus(
        'สั่งรีเซ็ตสำเร็จ แต่เขียนทับตารางอันดับไม่ได้ —' +
          ' ตารางจะค่อย ๆ เป็นศูนย์ตอนแต่ละคนเปิดเกม (ตรวจสิทธิ์ profiles ใน firestore.rules)',
      );
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const saveDaysOnly = async () => {
    setBusy(true);
    setStatus(null);
    const error = await saveLadder({ ...ladder, seasonDays: resolveSeasonDays(seasonDays) });
    setBusy(false);
    setStatus(error ?? `บันทึกแล้ว — ซีซันต่อไปยาว ${resolveSeasonDays(seasonDays)} วัน`);
    if (!error) playSfx('click');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">ตารางอันดับ &amp; ซีซัน</p>
        <p className="mt-1 text-xs text-chalk/45">
          รีเซ็ตดาวของทุกคน และตั้งความยาวของหนึ่งซีซัน
        </p>
      </div>

      {/* ── ความยาวซีซัน ── */}
      <div className="rounded-xl border border-white/10 bg-ink-700/50 p-3">
        <p className="eyebrow">จำนวนวันต่อหนึ่งซีซัน</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={SEASON_DAYS_RANGE.min}
            max={SEASON_DAYS_RANGE.max}
            value={seasonDays}
            onChange={(event) => setSeasonDays(Number(event.target.value) || SEASON_DAYS)}
            className="w-24 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 font-mono text-sm outline-none focus:border-neon/50"
          />
          <span className="text-xs text-chalk/50">
            วัน (ค่าเริ่มต้น {SEASON_DAYS} · ตั้งได้ {SEASON_DAYS_RANGE.min}–{SEASON_DAYS_RANGE.max})
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={saveDaysOnly}
            className="ml-auto rounded-lg border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk disabled:opacity-40"
          >
            บันทึกจำนวนวัน
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-chalk/35">
          มีผลกับการนับเวลาของซีซันที่กำลังเดินอยู่ทันที (นับจากวันที่ซีซันนั้นเริ่ม)
        </p>
      </div>

      {/* ── รีเซ็ตดาว ── */}
      <div className="rounded-xl border border-white/10 bg-ink-700/50 p-3">
        <p className="eyebrow">รีเซ็ตดาวของผู้เล่นทุกคน</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {KEEP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                playSfx('click');
                setKeep(option.value);
                setConfirming(false);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                keep === option.value
                  ? 'bg-neon text-ink-900'
                  : 'bg-white/5 text-chalk/55 hover:text-chalk',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-chalk/70">
          <input
            type="checkbox"
            checked={resetSeason}
            onChange={(event) => {
              setResetSeason(event.target.checked);
              setConfirming(false);
            }}
            className="h-4 w-4 accent-[#B6FF3B]"
          />
          ขึ้นเลขซีซันใหม่ให้ทุกคนด้วย (เริ่มนับเวลาซีซันใหม่ตอนเขาเปิดเกม)
        </label>

        {!confirming ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              playSfx('click');
              setConfirming(true);
            }}
            className="mt-3 w-full rounded-lg border border-[#F0A070]/50 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F0A070] transition-colors hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            รีเซ็ตดาวทุกคน
          </button>
        ) : (
          <div className="mt-3 space-y-2 rounded-lg border border-[#F0A070]/50 bg-[#F0A070]/10 p-3">
            <p className="text-xs text-[#F0A070]">
              ยืนยันรีเซ็ตดาวของ {everyone.length} บัญชี
              {keep > 0 ? ` (เหลือ ${Math.round(keep * 100)}%)` : ' (ล้างหมด)'}
              {resetSeason && ' และขึ้นซีซันใหม่'} — ย้อนกลับไม่ได้
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runReset}
                className="flex-1 rounded-lg bg-[#F0A070] py-2 text-xs font-bold uppercase tracking-wider text-ink-900 disabled:opacity-40"
              >
                {busy ? 'กำลังรีเซ็ต…' : 'ยืนยันรีเซ็ต'}
              </button>
            </div>
          </div>
        )}

        {ladder.resetAt && (
          <p className="mt-2 font-mono text-[10px] text-chalk/35">
            รีเซ็ตล่าสุดเมื่อ {new Date(ladder.resetAt).toLocaleString('th-TH')}
          </p>
        )}
      </div>

      {status && <p className="text-xs text-chalk/70">{status}</p>}
    </section>
  );
};
