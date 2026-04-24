import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  onError?: (message: string) => void;
}

export default function VideoPlayer({ src, poster, onError }: VideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const proxiedSrc = `/__hls_proxy?url=${encodeURIComponent(src)}`;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isM3U8 = src.includes(".m3u8");
    if (isM3U8 && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(proxiedSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          onError?.(`HLS 播放失败: ${data.type}`);
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = proxiedSrc;
    video.load();
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, onError]);

  // ESC exits page fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pageFullscreen) setPageFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageFullscreen]);

  // Lock body scroll while page-fullscreen
  useEffect(() => {
    if (pageFullscreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [pageFullscreen]);

  // Sync native fullscreen state
  useEffect(() => {
    const handler = () => {
      setNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const togglePageFullscreen = useCallback(() => {
    setPageFullscreen((prev) => !prev);
  }, []);

  const toggleNativeFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const wrapperClass = `atv-player ${pageFullscreen ? "atv-player-page-fs" : ""}`.trim();

  return (
    <div ref={wrapperRef} className={wrapperClass}>
      <video
        ref={videoRef}
        controls
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="metadata"
        poster={poster}
      />
      <div className="atv-player-toolbar">
        <button
          type="button"
          className="atv-player-btn"
          onClick={togglePageFullscreen}
          title={pageFullscreen ? "退出网页全屏 (Esc)" : "网页全屏"}
        >
          {pageFullscreen ? (
            <>
              <span className="atv-player-icon">⤢</span>退出网页全屏
            </>
          ) : (
            <>
              <span className="atv-player-icon">⛶</span>网页全屏
            </>
          )}
        </button>
        <button
          type="button"
          className="atv-player-btn"
          onClick={toggleNativeFullscreen}
          title="浏览器全屏"
        >
          <span className="atv-player-icon">{nativeFullscreen ? "⤡" : "⛶"}</span>
          {nativeFullscreen ? "退出全屏" : "全屏"}
        </button>
      </div>
    </div>
  );
}
