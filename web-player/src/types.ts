export interface ApiEnvelope<T> {
  result: boolean;
  msg: string;
  data: T;
  operateCode: number;
}

export interface IconItem {
  iconType: number;
  iconText: string;
}

export interface VodItem {
  vodId: number;
  vodName: string;
  coverImg: string;
  score?: string;
  iconList?: IconItem[];
  remark?: string | null;
  intro?: string;
  flags?: string;
  watchingCountDesc?: string;
}

export interface HomeHeaderData {
  hotKeywordList: string[];
  channeList: Array<{
    channelId: number;
    logo: string;
    channelName: string;
    viewType: number;
    targetUrl: string;
  }>;
}

export interface HomeBodyData {
  adList?: Array<Array<Record<string, unknown>>>;
  vodTopicList: Array<{
    vodTopicId: number;
    topicName: string;
    intro: string;
    coverImg: string;
    vodList: VodItem[];
  }>;
}

export interface HomeFirstScreenData {
  focusAdList: Array<{
    id: number;
    title: string;
    imgUrl: string;
    actionContent: string;
  }>;
  hotMudleList: Array<{
    id: number;
    title: string;
    imgUrl: string;
    adAction: number;
    actionContent: string;
  }>;
  hotVodList: VodItem[];
}

export interface SearchFilterData {
  filterList: Array<{
    filterName: string;
    filterValueList: Array<{ id: string; name: string }>;
  }>;
  sortList: Array<{
    sortType: number;
    sortName: string;
    hasDefault: boolean;
  }>;
}

export interface ListData {
  hasNext: boolean;
  nextVal: string;
  items: VodItem[];
}

export interface EpisodeItem {
  epId: number;
  epName: string;
}

export interface VodPlayerItem {
  vodPlayerKind: number;
  playerName: string;
  totalEpCount: number;
  remark?: string;
  epList: EpisodeItem[];
  checkM3u8?: string;
}

export interface VodInfoData {
  vodId: number;
  vodName: string;
  coverImg: string;
  intro?: string;
  score?: string;
  remark?: string;
  flags?: string;
  tagList?: string[];
  directorList?: Array<{ vodWorkerId: number; vodWorkerName: string }>;
  actorList?: Array<{ vodWorkerId: number; vodWorkerName: string }>;
  playerList?: VodPlayerItem[];
  vodPlayerList: VodPlayerItem[];
}

export interface PlayUrlData {
  playUrl: string;
  popMsg?: string;
  popOperateCode?: number;
}
