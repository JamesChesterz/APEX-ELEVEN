/**
 * Live แชท — การ์ดแรกของแดชบอร์ดหน้า MY TEAM (แทนที่ภารกิจประจำวันเดิม)
 *
 * แต่ละบรรทัดบอก: ชื่อผู้จัดการ · ป้ายระดับแรงค์ · ค่าพลังทีม · เวลา · ข้อความ
 * ป้ายระดับคิดจากดาว ณ ตอนที่พิมพ์ (ดู services/rank.ts) ไม่ใช่ดาวปัจจุบัน
 *
 * ความสูงคงที่และเลื่อนเองภายในการ์ด เพื่อไม่ให้แชทยาว ๆ ดันสนามด้านบนเพี้ยน
 */
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { CHAT_MAX_CHARS, formatChatTime } from '@/services/chat';
import { getRankTier } from '@/services/rank';
import { cn } from '@/utils/helpers';

export const LiveChatPanel = () => {
  const { messages, uid, canModerate, suspended, cooldownLeft, sending, error, send, remove } =
    useChat();

  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  /** มีข้อความใหม่ = เลื่อนลงล่างสุดให้เอง */
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  const submit = async () => {
    if (await send(draft)) setDraft('');
  };

  const locked = suspended || sending || cooldownLeft > 0;

  return (
    <section className="panel flex h-[19rem] flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="panel-title">Live แชท</p>
        <span className="font-mono text-[10px] text-chalk/35">
          {messages.length > 0 ? `${messages.length} ข้อความล่าสุด` : 'ห้องรวมของทุกคน'}
        </span>
      </div>

      {/* ── ข้อความ ── */}
      <div ref={scroller} className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-chalk/35">
            ยังไม่มีใครพิมพ์ — ทักทายเป็นคนแรกเลย
          </p>
        ) : (
          messages.map((message) => {
            const tier = getRankTier(message.points);
            const mine = message.uid === uid;

            return (
              <div key={message.id} className="group text-xs leading-relaxed">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('font-semibold', mine ? 'text-neon' : 'text-chalk/85')}>
                    {message.managerName}
                  </span>

                  {/* ป้ายระดับแรงค์ — สีมาจากข้อมูล จึงใช้ inline style */}
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase leading-none"
                    style={{ backgroundColor: `${tier.color}22`, color: tier.color }}
                  >
                    {tier.label}
                  </span>

                  <span className="font-mono text-[9px] text-chalk/40">
                    OVR {message.teamOvr} · {formatChatTime(message.sentAt)}
                  </span>

                  {(mine || canModerate) && (
                    <button
                      type="button"
                      onClick={() => remove(message)}
                      title="ลบข้อความ"
                      className="ml-auto font-mono text-[9px] text-chalk/25 opacity-0 transition-opacity hover:text-[#F0A070] group-hover:opacity-100"
                    >
                      ลบ
                    </button>
                  )}
                </div>

                {/* break-words กันข้อความยาวติดกันดันการ์ดกว้างเกิน */}
                <p className="whitespace-pre-line break-words text-chalk/70">{message.text}</p>
              </div>
            );
          })
        )}
      </div>

      {/* ── ช่องพิมพ์ ── */}
      <div className="mt-2 space-y-1">
        {error && <p className="text-[10px] text-[#F0A070]">{error}</p>}

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            maxLength={CHAT_MAX_CHARS}
            disabled={suspended}
            placeholder={suspended ? 'บัญชีถูกระงับ' : 'พิมพ์ข้อความ…'}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs outline-none placeholder:text-chalk/30 focus:border-neon/50 disabled:opacity-50"
          />

          <button
            type="button"
            disabled={locked || draft.trim().length === 0}
            onClick={() => void submit()}
            className="shrink-0 rounded-lg bg-neon px-4 text-[11px] font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
          >
            {cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 1000)}s` : 'ส่ง'}
          </button>
        </div>
      </div>
    </section>
  );
};
