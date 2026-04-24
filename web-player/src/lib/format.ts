export function toVodId(value: string | number | undefined | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanIntro(text?: string | null) {
  if (!text) return "暂无简介";
  return text.replace(/nbsp;|;/g, " ").replace(/\s+/g, " ").trim();
}

const AD_KEYWORDS = ["广告", "推广", "AD", "ad·", "赞助", "下载APP", "下载 APP", "下载应用"];

export function isLikelyAd(item: {
  vodName?: string;
  remark?: string | null;
  iconList?: Array<{ iconText?: string; iconType?: number }>;
  flags?: string;
}) {
  const texts: string[] = [];
  if (item.vodName) texts.push(item.vodName);
  if (item.remark) texts.push(String(item.remark));
  if (item.flags) texts.push(item.flags);
  if (item.iconList?.length) {
    item.iconList.forEach((ic) => {
      if (ic.iconText) texts.push(ic.iconText);
    });
  }
  const blob = texts.join(" ").toLowerCase();
  return AD_KEYWORDS.some((kw) => blob.includes(kw.toLowerCase()));
}

export function stripAds<T extends {
  vodName?: string;
  remark?: string | null;
  iconList?: Array<{ iconText?: string; iconType?: number }>;
  flags?: string;
}>(list?: T[] | null): T[] {
  if (!list?.length) return [];
  return list.filter((item) => !isLikelyAd(item));
}
