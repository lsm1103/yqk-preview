import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cleanIntro, toVodId } from "../lib/format";
import type { VodItem } from "../types";

interface HeroBannerProps {
  items: VodItem[];
  intervalMs?: number;
}

export default function HeroBanner({ items, intervalMs = 7000 }: HeroBannerProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!items.length) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [items.length, intervalMs]);

  if (!items.length) return null;
  const current = items[active] ?? items[0];

  const play = () => {
    const id = toVodId(current.vodId);
    if (id) navigate(`/watch/${id}`);
  };

  return (
    <section className="atv-hero">
      {items.map((item, idx) => (
        <div
          key={`${item.vodId}-${idx}`}
          className={idx === active ? "atv-hero-bg active" : "atv-hero-bg"}
          style={{ backgroundImage: `url(${item.coverImg})` }}
          aria-hidden={idx !== active}
        />
      ))}
      <div className="atv-hero-scrim" />
      <div className="atv-hero-content">
        <span className="atv-hero-eyebrow">焦点推荐</span>
        <h1 className="atv-hero-title">{current.vodName}</h1>
        <div className="atv-hero-meta">
          {current.score ? <span className="atv-score">★ {current.score}</span> : null}
          {current.remark ? <span>{current.remark}</span> : null}
          {current.flags ? <span>{current.flags}</span> : null}
        </div>
        {current.intro ? (
          <p className="atv-hero-intro">{cleanIntro(current.intro)}</p>
        ) : null}
        <div className="atv-hero-actions">
          <button type="button" className="atv-btn atv-btn-primary" onClick={play}>
            <span className="atv-btn-icon">▶</span>立即播放
          </button>
          <button
            type="button"
            className="atv-btn atv-btn-ghost"
            onClick={() => {
              const id = toVodId(current.vodId);
              if (id) navigate(`/watch/${id}`);
            }}
          >
            更多信息
          </button>
        </div>
      </div>
      <div className="atv-hero-dots" role="tablist">
        {items.map((_, idx) => (
          <button
            key={idx}
            role="tab"
            aria-selected={idx === active}
            className={idx === active ? "atv-hero-dot active" : "atv-hero-dot"}
            onClick={() => setActive(idx)}
          />
        ))}
      </div>
    </section>
  );
}
