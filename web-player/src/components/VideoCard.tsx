import type { VodItem } from "../types";

interface VideoCardProps {
  item: VodItem;
  onClick?: (item: VodItem) => void;
  variant?: "poster" | "wide";
}

export default function VideoCard({ item, onClick, variant = "poster" }: VideoCardProps) {
  const className = variant === "wide" ? "atv-card atv-card-wide" : "atv-card";
  return (
    <article className={className} onClick={() => onClick?.(item)} role="button" tabIndex={0}>
      <div className="atv-card-cover">
        <img loading="lazy" src={item.coverImg} alt={item.vodName} />
        <div className="atv-card-shade" />
        {item.remark ? <span className="atv-card-tag">{item.remark}</span> : null}
        {item.score ? <span className="atv-card-score">★ {item.score}</span> : null}
      </div>
      <div className="atv-card-meta">
        <h3>{item.vodName}</h3>
        <p>{item.flags ?? item.watchingCountDesc ?? "高清在线"}</p>
      </div>
    </article>
  );
}
