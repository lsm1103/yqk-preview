import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroBanner from "../components/HeroBanner";
import Shelf from "../components/Shelf";
import VideoCard from "../components/VideoCard";
import { api } from "../lib/api";
import { stripAds, toVodId } from "../lib/format";
import type { HomeBodyData, HomeFirstScreenData, HomeHeaderData, VodItem } from "../types";

export default function HomePage() {
  const navigate = useNavigate();
  const [header, setHeader] = useState<HomeHeaderData | null>(null);
  const [body, setBody] = useState<HomeBodyData | null>(null);
  const [firstScreen, setFirstScreen] = useState<HomeFirstScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [headerData, bodyData, firstData] = await Promise.all([
        api.getHomeHeader(),
        api.getHomeBody(),
        api.getHomeFirstScreen()
      ]);
      setHeader(headerData);
      setBody(bodyData);
      setFirstScreen(firstData);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const goWatch = (item: VodItem) => {
    const vodId = toVodId(item.vodId);
    if (!vodId) return;
    navigate(`/watch/${vodId}`);
  };

  const cleanedHotVod = useMemo(() => stripAds(firstScreen?.hotVodList), [firstScreen]);
  const cleanedTopics = useMemo(
    () =>
      (body?.vodTopicList ?? []).map((topic) => ({
        ...topic,
        vodList: stripAds(topic.vodList)
      })),
    [body]
  );

  const heroItems = useMemo(() => cleanedHotVod.slice(0, 5), [cleanedHotVod]);

  if (loading)
    return (
      <div className="atv-page">
        <div className="atv-skeleton-hero" />
        <div className="atv-skeleton-row" />
        <div className="atv-skeleton-row" />
      </div>
    );
  if (error) {
    return (
      <div className="atv-page">
        <div className="atv-error">
          <p>首页加载失败：{error}</p>
          <button className="atv-btn atv-btn-primary" onClick={() => void loadHome()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="atv-page">
      {heroItems.length ? <HeroBanner items={heroItems} /> : null}

      <div className="atv-page-body">
        {header?.hotKeywordList?.length ? (
          <div className="atv-chips-row">
            {header.hotKeywordList.slice(0, 12).map((keyword) => (
              <button
                key={keyword}
                className="atv-chip"
                onClick={() => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
              >
                # {keyword}
              </button>
            ))}
          </div>
        ) : null}

        {header?.channeList?.length ? (
          <Shelf title="频道" subtitle="按品类快速进入">
            {header.channeList.map((channel) => (
              <button
                key={channel.channelId}
                className="atv-channel"
                onClick={() => navigate(`/search?channelId=${channel.channelId}&tab=filter`)}
              >
                {channel.logo ? <img src={channel.logo} alt={channel.channelName} /> : <span className="atv-channel-fallback">{channel.channelName.slice(0, 1)}</span>}
                <span>{channel.channelName}</span>
              </button>
            ))}
          </Shelf>
        ) : null}

        {cleanedHotVod.length ? (
          <Shelf title="正在热播" subtitle="编辑精选">
            {cleanedHotVod.map((item) => (
              <VideoCard key={`${item.vodId}-hot`} item={item} onClick={goWatch} />
            ))}
          </Shelf>
        ) : null}

        {cleanedTopics.map((topic) =>
          topic.vodList.length ? (
            <Shelf key={topic.vodTopicId} title={topic.topicName} subtitle={topic.intro}>
              {topic.vodList.map((item) => (
                <VideoCard key={`${topic.vodTopicId}-${item.vodId}`} item={item} onClick={goWatch} />
              ))}
            </Shelf>
          ) : null
        )}
      </div>
    </div>
  );
}
