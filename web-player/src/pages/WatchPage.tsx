import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Shelf from "../components/Shelf";
import VideoCard from "../components/VideoCard";
import VideoPlayer from "../components/VideoPlayer";
import { api } from "../lib/api";
import { cleanIntro, stripAds, toVodId } from "../lib/format";
import type { EpisodeItem, ListData, VodInfoData, VodItem } from "../types";

export default function WatchPage() {
  const navigate = useNavigate();
  const params = useParams<{ vodId: string }>();
  const vodId = toVodId(params.vodId);

  const [detail, setDetail] = useState<VodInfoData | null>(null);
  const [guessList, setGuessList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [activeEpId, setActiveEpId] = useState<number | null>(null);
  const [playUrl, setPlayUrl] = useState("");
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState("");
  const [playResolution, setPlayResolution] = useState<number | null>(null);
  const [autoRetriedEpId, setAutoRetriedEpId] = useState<number | null>(null);

  const playerLines = useMemo(() => detail?.vodPlayerList ?? [], [detail]);

  const activePlayer = useMemo(
    () => playerLines[activePlayerIndex] ?? null,
    [playerLines, activePlayerIndex]
  );

  const loadPlayUrl = useCallback(async (epId: number) => {
    setPlayLoading(true);
    setPlayError("");
    setPlayResolution(null);
    try {
      const res = await api.getPlayUrlWithFallback(epId, [2, 1, 0, 3]);
      if (!res.playUrl) {
        throw new Error(res.popMsg || "未拿到播放地址");
      }
      setPlayUrl(res.playUrl);
      setPlayResolution(res.usedResolution);
      setAutoRetriedEpId(null);
    } catch (err) {
      setPlayUrl("");
      setPlayError(String((err as Error).message || err));
    } finally {
      setPlayLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!vodId) {
      setError("非法 vodId");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setDetail(null);
    setPlayUrl("");
    setPlayError("");
    setAutoRetriedEpId(null);
    setActiveEpId(null);

    try {
      const [detailData, guessData] = await Promise.all([
        api.getVodInfo(vodId),
        api.guessYouLike(vodId).catch(() => null)
      ]);

      setDetail(detailData);
      setGuessList(guessData);
      setActivePlayerIndex(0);

      const firstEpisode = detailData.vodPlayerList[0]?.epList?.[0];
      if (firstEpisode?.epId) {
        setActiveEpId(firstEpisode.epId);
        await loadPlayUrl(firstEpisode.epId);
      } else {
        setPlayError("该线路没有可播分集");
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }, [vodId, loadPlayUrl]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const switchLine = async (lineIndex: number) => {
    const line = playerLines[lineIndex];
    if (!line) return;
    setActivePlayerIndex(lineIndex);
    setAutoRetriedEpId(null);
    const firstEpisode = line.epList?.[0];
    if (!firstEpisode?.epId) {
      setActiveEpId(null);
      setPlayError("当前线路没有可播放分集");
      return;
    }
    setActiveEpId(firstEpisode.epId);
    await loadPlayUrl(firstEpisode.epId);
  };

  const playEpisode = async (episode: EpisodeItem) => {
    setActiveEpId(episode.epId);
    setAutoRetriedEpId(null);
    await loadPlayUrl(episode.epId);
  };

  const handlePlayerError = useCallback(
    (msg: string) => {
      if (msg.includes("networkError") && activeEpId && autoRetriedEpId !== activeEpId) {
        setAutoRetriedEpId(activeEpId);
        setPlayError("HLS 网络错误，正在重新获取播放地址...");
        void loadPlayUrl(activeEpId);
        return;
      }
      setPlayError(msg);
    },
    [activeEpId, autoRetriedEpId, loadPlayUrl]
  );

  const openVod = (item: VodItem) => {
    const id = toVodId(item.vodId);
    if (!id) return;
    navigate(`/watch/${id}`);
  };

  const guessItems = useMemo(() => stripAds(guessList?.items), [guessList]);

  if (loading)
    return (
      <div className="atv-page">
        <div className="atv-skeleton-hero" />
      </div>
    );
  if (error) {
    return (
      <div className="atv-page">
        <div className="atv-error">
          <p>详情加载失败：{error}</p>
          <button className="atv-btn atv-btn-primary" onClick={() => void loadDetail()}>
            重试
          </button>
        </div>
      </div>
    );
  }
  if (!detail) return <p className="atv-state">没有找到该视频信息</p>;

  return (
    <div className="atv-page atv-page-watch">
      <section
        className="atv-watch-hero"
        style={{ backgroundImage: `url(${detail.coverImg})` }}
      >
        <div className="atv-watch-hero-scrim" />
        <button className="atv-back" onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
        <div className="atv-watch-hero-content">
          <span className="atv-hero-eyebrow">{detail.flags || "在线播放"}</span>
          <h1>{detail.vodName}</h1>
          <div className="atv-hero-meta">
            {detail.score ? <span className="atv-score">★ {detail.score}</span> : null}
            {detail.remark ? <span>{detail.remark}</span> : null}
            {detail.tagList?.length ? <span>{detail.tagList.slice(0, 3).join(" · ")}</span> : null}
          </div>
        </div>
      </section>

      <div className="atv-page-body">
        <VideoPlayer src={playUrl} poster={detail.coverImg} onError={handlePlayerError} />

        {playLoading ? <p className="atv-state">播放地址加载中...</p> : null}
        {playError ? <p className="atv-state error">播放失败：{playError}</p> : null}
        {!playError && playResolution != null ? (
          <p className="atv-mini-tip">当前清晰度参数：{playResolution}</p>
        ) : null}

        {playerLines.length ? (
          <section className="atv-section">
            <header className="atv-section-head">
              <h2>播放线路</h2>
            </header>
            <div className="atv-pill-list">
              {playerLines.map((line, index) => (
                <button
                  key={`${line.vodPlayerKind}-${line.playerName}`}
                  className={index === activePlayerIndex ? "atv-pill active" : "atv-pill"}
                  onClick={() => void switchLine(index)}
                >
                  {line.playerName}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activePlayer?.epList?.length ? (
          <section className="atv-section">
            <header className="atv-section-head">
              <h2>选集</h2>
              <span>{activePlayer.epList.length} 集</span>
            </header>
            <div className="atv-ep-grid">
              {activePlayer.epList.map((episode) => (
                <button
                  key={episode.epId}
                  className={episode.epId === activeEpId ? "atv-ep active" : "atv-ep"}
                  onClick={() => void playEpisode(episode)}
                >
                  {episode.epName}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="atv-section">
          <header className="atv-section-head">
            <h2>剧情简介</h2>
          </header>
          <div className="atv-intro">
            <img loading="lazy" src={detail.coverImg} alt={detail.vodName} />
            <div>
              <h3>{detail.vodName}</h3>
              {detail.directorList?.length ? (
                <p className="atv-mini-tip">
                  导演：{detail.directorList.map((d) => d.vodWorkerName).join(" / ")}
                </p>
              ) : null}
              {detail.actorList?.length ? (
                <p className="atv-mini-tip">
                  主演：{detail.actorList.slice(0, 6).map((d) => d.vodWorkerName).join(" / ")}
                </p>
              ) : null}
              <p className="atv-intro-text">{cleanIntro(detail.intro)}</p>
              {detail.tagList?.length ? (
                <div className="atv-tag-list">
                  {detail.tagList.map((tag) => (
                    <span key={tag} className="atv-pill atv-pill-static">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {guessItems.length ? (
          <Shelf title="猜你喜欢">
            {guessItems.map((item) => (
              <VideoCard key={`guess-${item.vodId}-${item.vodName}`} item={item} onClick={openVod} />
            ))}
          </Shelf>
        ) : null}
      </div>
    </div>
  );
}
