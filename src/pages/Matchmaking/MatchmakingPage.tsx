/**
 * หน้า MATCHMAKING — สนามแข่งเต็มจอ ทั้งสองทีมยืนหันหน้าเข้าหากันบนสนามเดียว
 *
 * ฝั่งเรา (ครึ่งล่าง) = 11 ตัวจริงล่าสุดจากหน้า MY TEAM เรียงตามแผนที่ใช้อยู่
 * ฝั่งคู่แข่ง (ครึ่งบน) = ทีมจริงของเขาถ้ามีโปรไฟล์ ไม่มีก็ปั้นให้ใกล้เคียง OVR
 *
 * ต่างจากลีกประจำวัน (เมนู MATCH) ตรงที่ลีกเดินรอบให้เองทุก 30 นาที
 * ส่วนหน้านี้คือการลงแข่งเมื่อไหร่ก็ได้ที่อยากลง — รวมถึงเหตุการณ์บาดเจ็บ/ใบแดง
 * ที่อาจเกิดขึ้นกลางแมตช์ (บาดเจ็บต้องเปลี่ยนตัวก่อนแข่งต่อ, ใบแดงติดโทษแบน 3 นัดถัดไป)
 */
import { useMemo } from 'react';
import { InjurySubModal } from '@/components/matchmaking/InjurySubModal';
import { MatchdayControls } from '@/components/matchmaking/MatchdayControls';
import { MatchdayPitch, type OurPitchSlot } from '@/components/matchmaking/MatchdayPitch';
import { MatchHistoryList } from '@/components/league/MatchHistoryList';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { useTeam } from '@/hooks/useTeam';
import { resolveOpponentSquad } from '@/services/opponentSquad';
import { formatNumber } from '@/utils/helpers';

export const MatchmakingPage = () => {
  const {
    record,
    history,
    state,
    live,
    elapsed,
    squadIncomplete,
    squadHasSuspended,
    search,
    cancel,
    emptyReason,
    pendingInjury,
    resolveInjury,
    sentOffCardIds,
  } = useMatchmaking();
  const { rating, ratedSlots, team, bench, canAssign } = useTeam();
  const { profileByUid } = useOnline();

  /** ผลของนัดที่จับคู่เอง — นัดลีกดูได้ที่เมนู MATCH */
  const friendlyHistory = history.filter((match) => match.mode !== 'league');

  const ourSlots = useMemo<OurPitchSlot[]>(
    () =>
      ratedSlots.map(({ slot, player }) => ({
        slotId: slot.id,
        x: slot.x,
        y: slot.y,
        player,
        cardId: team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null,
      })),
    [ratedSlots, team.squad],
  );

  const opponentSlots = useMemo(
    () =>
      state.opponent ? resolveOpponentSquad(state.opponent, profileByUid[state.opponent.id]) : [],
    [profileByUid, state.opponent],
  );

  const score =
    state.status === 'playing' || state.status === 'finished'
      ? { team: live?.teamScore ?? 0, opponent: live?.opponentScore ?? 0 }
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl">จับคู่แข่งขัน</h2>
        <p className="text-sm text-chalk/50">
          ทีมของคุณ OVR {rating.matchOvr} · {formatNumber(record.points)} ⭐ ในซีซันนี้ · ชนะ{' '}
          {record.wins} เสมอ {record.draws} แพ้ {record.losses}
        </p>
      </div>

      <div className="relative">
        <MatchdayPitch
          ourSlots={ourSlots}
          opponentSlots={opponentSlots}
          sentOffCardIds={sentOffCardIds}
          injuredCardId={pendingInjury?.cardId ?? null}
          status={state.status}
          score={score}
          minute={live?.minute}
        />

        {pendingInjury && (
          <InjurySubModal
            playerName={pendingInjury.playerName}
            bench={bench}
            canAssign={(cardId) => canAssign(pendingInjury.slotId, cardId).ok}
            onPick={resolveInjury}
          />
        )}
      </div>

      <MatchdayControls
        status={state.status}
        teamName={team.name}
        teamOvr={rating.matchOvr}
        opponentName={state.opponent?.name ?? 'รอคู่แข่ง'}
        opponentOvr={state.opponent?.ovr ?? null}
        elapsed={elapsed}
        squadIncomplete={squadIncomplete}
        squadHasSuspended={squadHasSuspended}
        emptyReason={emptyReason}
        outcome={state.result?.outcome}
        onSearch={search}
        onCancel={cancel}
      />

      <section className="space-y-2">
        <p className="eyebrow">ผลย้อนหลังของนัดที่จับคู่เอง ({friendlyHistory.length} นัด)</p>
        <MatchHistoryList matches={friendlyHistory} />
      </section>
    </div>
  );
};
