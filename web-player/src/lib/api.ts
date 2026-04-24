import { requestApi } from "./client";
import type {
  HomeBodyData,
  HomeFirstScreenData,
  HomeHeaderData,
  ListData,
  PlayUrlData,
  SearchFilterData,
  VodPlayerItem,
  VodInfoData
} from "../types";

function normalizeVodInfo(raw: VodInfoData): VodInfoData {
  const candidates = (raw.vodPlayerList ?? raw.playerList ?? []) as VodPlayerItem[];
  const normalizedPlayers = candidates.map((player) => ({
    ...player,
    epList: player.epList ?? []
  }));

  return {
    ...raw,
    vodPlayerList: normalizedPlayers
  };
}

export const api = {
  getHomeHeader() {
    return requestApi<HomeHeaderData>("/v2/api/home/header");
  },
  getHomeBody() {
    return requestApi<HomeBodyData>("/v2/api/home/body");
  },
  getHomeFirstScreen() {
    return requestApi<HomeFirstScreenData>("/v2/api/home/firstScreen");
  },
  getSearchFilter() {
    return requestApi<SearchFilterData>("/v1/api/search/getSearchFilter");
  },
  queryNow(payload: { nextCount?: number; nextVal?: string; queryValueJson?: string } = {}) {
    return requestApi<ListData>("/v1/api/search/queryNow", {
      nextCount: payload.nextCount ?? 18,
      nextVal: payload.nextVal ?? "",
      queryValueJson: payload.queryValueJson ?? "[]"
    });
  },
  search(payload: { keyword: string; nextCount?: number; nextVal?: string }) {
    return requestApi<ListData>("/v1/api/search/search", {
      keyword: payload.keyword,
      nextCount: payload.nextCount ?? 15,
      nextVal: payload.nextVal ?? ""
    });
  },
  async searchClick(vodId: number) {
    try {
      await requestApi<null>("/v1/api/search/searchClick", { vodId });
    } catch {
      // 点击上报失败不阻塞主流程
    }
  },
  async getVodInfo(vodId: number) {
    const data = await requestApi<VodInfoData>("/v2/api/vodInfo/index", { vodId });
    return normalizeVodInfo(data);
  },
  getPlayUrl(epId: number, vodResolution = 2) {
    return requestApi<PlayUrlData>("/v2/api/vodInfo/playUrl", { epId, vodResolution });
  },
  async getPlayUrlWithFallback(epId: number, resolutions: number[] = [2, 1, 0, 3]) {
    let lastError: unknown = null;
    for (const resolution of resolutions) {
      try {
        const data = await requestApi<PlayUrlData>("/v2/api/vodInfo/playUrl", {
          epId,
          vodResolution: resolution
        });
        return {
          ...data,
          usedResolution: resolution
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `该分集尝试了清晰度 ${resolutions.join(" / ")} 都不可播放：${String(
        (lastError as Error)?.message ?? lastError
      )}`
    );
  },
  guessYouLike(vodId: number, nextVal = "") {
    return requestApi<ListData>("/v2/api/vodInfo/guessYouLike", { vodId, nextVal });
  }
};
