import md5 from "js-md5";
import type { ApiEnvelope } from "../types";

const md5Hash = md5 as unknown as (input: string) => string;

const APP_ID = "e6ddefe09e0349739874563459f56c54";
const APP_KEY = "3359de478f8d45638125e446a10ec541";
const APP_VERSION = "1.2.7.164";
const REQ_DOMAIN = "yqk69.app";
const CUSTOM_FIELD = "aabbcc";
const UDID_STORAGE_KEY = "yqk_udid";

const FALLBACK_API_HOSTS = [
  "https://yz1018.goi6lhmry.com",
  "https://yz1018.o5r52at9v.com",
  "https://yz1018.tgs2hl4ut.com",
  "https://yz260324.00zgz0th.com"
];

let cachedHosts: string[] | null = null;

function randomString(length: number) {
  const dict = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += dict[Math.floor(Math.random() * dict.length)];
  }
  return output;
}

function createUuid() {
  const part = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const val = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return val.toString(16);
  });
  return `${part}-${Date.now().toString(16)}`;
}

function getDeviceInfo() {
  const ua = window.navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  return "Android";
}

function getOrCreateUdid() {
  const fromStorage = window.localStorage.getItem(UDID_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const udid = createUuid();
  window.localStorage.setItem(UDID_STORAGE_KEY, udid);
  return udid;
}

function sortObject(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  Object.keys(input)
    .sort()
    .forEach((key) => {
      output[key] = input[key];
    });
  return output;
}

function signPayload(data: Record<string, unknown>) {
  const sorted = sortObject(data);
  let plain = "";

  for (const [key, value] of Object.entries(sorted)) {
    if (value === "" || value == null) continue;
    plain += `${key}=${String(value)}&`;
  }

  plain += `appKey=${APP_KEY}`;
  const sign = md5Hash(plain);
  return { ...sorted, sign };
}

function buildPayload(data: Record<string, unknown>) {
  const fullPayload = {
    ...data,
    appId: APP_ID,
    reqDomain: REQ_DOMAIN,
    deviceInfo: getDeviceInfo(),
    version: APP_VERSION,
    requestId: randomString(32),
    cus1tom: CUSTOM_FIELD,
    udid: getOrCreateUdid()
  };
  return signPayload(fullPayload);
}

async function getApiHosts() {
  if (cachedHosts) return cachedHosts;
  // 业务站点不开放 baseUrlList.js 的 CORS，这里直接使用抓包得到的域名池。
  cachedHosts = FALLBACK_API_HOSTS;
  return cachedHosts;
}

async function postJSON<T>(url: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json;charset=UTF-8"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as ApiEnvelope<T>;
    if (!json.result) {
      throw new Error(json.msg || "接口返回失败");
    }

    return json.data;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function requestApi<T>(
  path: string,
  bizPayload: Record<string, unknown> = {}
): Promise<T> {
  const payload = buildPayload(bizPayload);
  const hosts = await getApiHosts();

  let lastError: unknown;
  for (const host of hosts) {
    try {
      const url = `${host}${path}`;
      return await postJSON<T>(url, payload);
    } catch (error) {
      lastError = error;
      const msg = String((error as Error)?.message ?? error);
      // 业务错误不需要跨域名重试，直接抛给上层处理。
      if (
        msg.includes("sign error") ||
        msg.includes("该清晰度不可播放") ||
        msg.startsWith("失败：")
      ) {
        throw new Error(msg.includes("sign error") ? `签名失败: ${msg}` : msg);
      }
    }
  }

  throw new Error(`所有 API 域名请求失败: ${String((lastError as Error)?.message ?? lastError)}`);
}
