import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from "react";

interface ShelfProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

export default function Shelf({ title, subtitle, extra, children }: ShelfProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="shelf">
      <header className="shelf-head">
        <div className="shelf-title">
          <h2>{title}</h2>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <div className="shelf-actions">
          {extra}
          <div className="shelf-arrows">
            <button
              type="button"
              className="shelf-arrow"
              disabled={!canPrev}
              aria-label="向左滚动"
              onClick={() => scrollBy(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="shelf-arrow"
              disabled={!canNext}
              aria-label="向右滚动"
              onClick={() => scrollBy(1)}
            >
              ›
            </button>
          </div>
        </div>
      </header>
      <div className="shelf-rail" ref={railRef}>
        {children}
      </div>
    </section>
  );
}
