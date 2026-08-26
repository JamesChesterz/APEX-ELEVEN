/**
 * "ประกาศอัปเดตล่าสุด" บนหน้า HOME — แบนเนอร์สไลด์ด้านซ้าย + รายการข่าวด้านขวา
 * ข้อมูลมาจาก config/news ที่แอดมินตั้งไว้ (หน้า ADMIN → ข่าวหน้าแรก)
 */
import { useEffect, useState } from 'react';
import type { NewsItem } from '@/services/homeFeed';
import { cn } from '@/utils/helpers';

interface NewsFeedPanelProps {
  news: NewsItem[];
}

export const NewsFeedPanel = ({ news }: NewsFeedPanelProps) => {
  /** เฉพาะใบที่มีรูป จะขึ้นในสไลด์แบนเนอร์ */
  const slides = news.filter((item) => item.imageUrl);
  const [slideIndex, setSlideIndex] = useState(0);
  const [openItem, setOpenItem] = useState<NewsItem | null>(null);

  useEffect(() => {
    if (slideIndex >= slides.length) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (news.length === 0) return null;

  const slide = slides[slideIndex];

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4">
        <span aria-hidden>📣</span>
        <p className="panel-title">ประกาศอัปเดตล่าสุด</p>
      </div>

      <div className="mt-3 grid gap-0 lg:grid-cols-[1.5fr_1fr]">
        {/* ── แบนเนอร์สไลด์ ── */}
        <div className="relative">
          {slide ? (
            <button
              type="button"
              onClick={() => setOpenItem(slide)}
              className="group relative block aspect-[16/8] w-full overflow-hidden bg-ink-900 text-left sm:aspect-[16/7]"
            >
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-display text-2xl uppercase leading-tight text-chalk drop-shadow sm:text-3xl">
                  {slide.title}
                </p>
                {slide.message && (
                  <p className="mt-1 line-clamp-2 max-w-md text-xs text-chalk/70">
                    {slide.message}
                  </p>
                )}
                <span className="mt-3 inline-block rounded-lg bg-neon px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-900">
                  ดูรายละเอียด
                </span>
              </div>
            </button>
          ) : (
            <div className="flex aspect-[16/8] w-full items-center justify-center bg-ink-900 text-xs text-chalk/40 sm:aspect-[16/7]">
              ยังไม่มีแบนเนอร์
            </div>
          )}

          {slides.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={`สไลด์ที่ ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    index === slideIndex ? 'w-5 bg-neon' : 'w-1.5 bg-white/40 hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── รายการข่าว ── */}
        <ul className="divide-y divide-white/[0.06] lg:max-h-[280px] lg:overflow-y-auto">
          {news.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenItem(item)}
                className="flex w-full items-start justify-between gap-3 px-5 py-3 text-left hover:bg-white/[0.03]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="rounded bg-neon/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">
                        NEW
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold text-chalk/90">
                      {item.title}
                    </span>
                  </span>
                  {item.message && (
                    <span className="mt-0.5 line-clamp-1 block text-xs text-chalk/45">
                      {item.message}
                    </span>
                  )}
                </span>
                {item.date && (
                  <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-chalk/35">
                    {item.date}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {openItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setOpenItem(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-panel w-full max-w-md overflow-hidden"
          >
            {openItem.imageUrl && (
              <img src={openItem.imageUrl} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="p-5">
              <p className="eyebrow text-neon">{openItem.date || 'ประกาศ'}</p>
              <h3 className="mt-1 font-display text-xl uppercase leading-tight">
                {openItem.title}
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-chalk/75">
                {openItem.message}
              </p>
              <button
                type="button"
                onClick={() => setOpenItem(null)}
                className="mt-5 w-full rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
