/**
 * แถบ "อัปเกรดเพิ่มโอกาสในการอัปเกรด" — โล่ 1–5 บนเส้นสนามเรืองแสง
 *
 * โบนัสสะสม: อัปเกรดไม่ติดสะสมทีละขั้น (สูงสุด 5) ขั้นละ +2%
 * แล้วรีเซ็ตเมื่อสำเร็จ ค่าเก็บแยกรายการ์ด (ดู data/upgradeConfig.ts)
 *
 * ทำด้วย CSS + clip-path ล้วน ไม่ได้ใช้ภาพพื้นหลังสำเร็จรูป
 * เพราะโล่ต้องสว่าง/หรี่ตามความคืบหน้าจริงของการ์ดแต่ละใบ
 * ภาพนิ่งจะโชว์ได้แค่สถานะเดียวตายตัว
 */
import { MAX_STREAK_STAGE, STREAK_BONUS_RATE } from '@/data/upgradeConfig';
import { cn } from '@/utils/helpers';

/** ลูกฟุตบอล — ใช้ไอคอนเมนู MY TEAM ที่มีอยู่แล้ว ไม่ต้องเพิ่มไฟล์ใหม่ */
const BALL = '/nav/my-team.png';

/** ขนาดโล่เป็น px — ใช้ทั้งวาดโล่และวางเส้นให้ตรงปลายโล่พอดี */
const SHIELD_W = 62;
const SHIELD_H = 74;

/** ทรงโล่: หัวตัดตรง ไหล่ตรง แล้วสอบลงมาเป็นปลายแหลม */
const SHIELD = {
  clipPath: 'polygon(0% 0%, 100% 0%, 100% 58%, 50% 100%, 0% 58%)',
} as const;

interface StreakTrackProps {
  /** ขั้นที่สะสมได้แล้ว 0–5 */
  streak: number;
  className?: string;
}

export const StreakTrack = ({ streak, className }: StreakTrackProps) => {
  const stages = Array.from({ length: MAX_STREAK_STAGE }, (_, index) => index + 1);

  /*
   * เส้นเรืองแสงลากจากโล่ใบแรกถึงใบสุดท้าย ไม่ใช่ขอบซ้ายถึงขอบขวา
   * ระยะที่เติมแล้วจึงคิดเป็นสัดส่วนของ "ช่องว่างระหว่างโล่" (4 ช่อง) ไม่ใช่ 5
   */
  const gaps = MAX_STREAK_STAGE - 1;
  const filled = Math.min(1, Math.max(0, (streak - 1) / gaps));

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a1220] via-[#08131b] to-[#04140c]',
        className,
      )}
    >
      {/* แสงไฟสนามจาง ๆ มุมบนขวา และแสงสนามหญ้าด้านล่าง */}
      <span className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-neon/10 blur-3xl" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neon/[0.14] to-transparent" />

      {/* หัวข้อ */}
      <div className="relative flex items-center gap-2.5 px-4 pt-3.5">
        <img src={BALL} alt="" className="h-6 w-6 shrink-0 object-contain" />
        <p className="font-semibold tracking-wide text-chalk">อัปเกรดเพิ่มโอกาสในการอัปเกรด</p>
        <span
          title={`อัปเกรดไม่สำเร็จสะสมทีละขั้น สูงสุด ${MAX_STREAK_STAGE} ขั้น · ขั้นละ +${Math.round(
            STREAK_BONUS_RATE * 100,
          )}% และรีเซ็ตเมื่ออัปเกรดติด`}
          className="grid h-5 w-5 cursor-help place-items-center rounded-full bg-white/10 text-[11px] text-chalk/70"
        >
          ?
        </span>
      </div>

      {/* รางโล่ */}
      <div className="relative mt-3 px-6 pb-7 pt-1">
        <div className="relative">
          {/*
            เส้นวางที่ "ปลายโล่" พอดี โดยวัดจากความสูงโล่ (SHIELD_H) ไม่ใช่ค่ากะเอา
            แถวใช้ items-end และโล่สูงเท่ากันทุกใบ ระยะ top จึงตรงกันทั้งแถว
            ระยะ inset ซ้าย/ขวา = ครึ่งความกว้างโล่ เส้นจะได้เริ่มที่ "กลางโล่ใบแรก"
            ไม่ใช่ขอบกรอบ ตามแบบ
          */}
          <span
            className="pointer-events-none absolute h-px bg-white/10"
            style={{ top: SHIELD_H, left: SHIELD_W / 2, right: SHIELD_W / 2 }}
          />
          <span
            className="pointer-events-none absolute h-px bg-neon shadow-[0_0_10px_2px_rgba(49,224,109,0.8)] transition-[width] duration-500"
            style={{
              top: SHIELD_H,
              left: SHIELD_W / 2,
              width: `calc((100% - ${SHIELD_W}px) * ${filled})`,
            }}
          />
          {/* แสงฟุ้งบนพื้นหญ้าใต้เส้น */}
          <span
            className="pointer-events-none absolute h-2.5 rounded-full bg-neon/20 blur-md"
            style={{ top: SHIELD_H + 6, left: SHIELD_W / 2, right: SHIELD_W / 2 }}
          />

          <div className="relative flex items-end justify-between">
            {stages.map((stage) => {
              const reached = stage <= streak;

              return (
                <div key={stage} className="relative flex flex-col items-center">
                  {/* กรอบทองต้องวาดสองชั้น เพราะ clip-path ตัด border ทิ้ง */}
                  <div
                    style={{ ...SHIELD, height: SHIELD_H, width: SHIELD_W }}
                    className={cn(
                      'relative transition-all duration-300',
                      reached
                        ? 'bg-gradient-to-b from-[#F3D98B] to-[#B8862F] drop-shadow-[0_0_10px_rgba(245,185,62,0.45)]'
                        : 'bg-white/15',
                    )}
                  >
                    <div
                      style={SHIELD}
                      className={cn(
                        'absolute inset-[3px] grid place-items-center',
                        reached
                          ? 'bg-gradient-to-b from-[#1B7A55] via-[#0E5A3C] to-[#093C2A]'
                          : 'bg-gradient-to-b from-white/[0.07] to-black/40',
                      )}
                    >
                      <span
                        className={cn(
                          'pb-2 font-display text-2xl leading-none',
                          reached
                            ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                            : 'text-chalk/30',
                        )}
                      >
                        {stage}
                      </span>
                    </div>
                  </div>

                  {/* จุดไฟใต้ปลายโล่ */}
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 rounded-full transition-all duration-300',
                      reached ? 'bg-white shadow-[0_0_12px_4px_rgba(49,224,109,0.9)]' : 'bg-white/15',
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ลูกบอลมุมขวา ตามแบบ — ล้นออกนอกกรอบเล็กน้อยให้ดูมีมิติ */}
        <img
          src={BALL}
          alt=""
          className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 object-contain opacity-90"
        />
      </div>
    </div>
  );
};
