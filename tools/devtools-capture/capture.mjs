#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "playwright";

const DEFAULT_OPTIONS = {
  url: "",
  outDir: "",
  device: "iPhone 14 Pro",
  browserChannel: "chrome",
  headless: false,
  waitMs: 20000,
  gotoTimeoutMs: 45000,
  networkIdleMs: 8000,
  include: "",
  exclude: "",
  hostContains: "",
  resourceTypes: "xhr,fetch",
  saveBody: true,
  maxBodyBytes: 250000,
  viewportWidth: 390,
  viewportHeight: 844,
  userAgent: "",
  mobile: true,
  deviceScaleFactor: 3
};

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth-token",
  "x-access-token"
]);

function printUsage() {
  const usage = `
用法:
  npm run capture -- --url "https://example.com"

常用参数:
  --url                目标页面 URL（必填）
  --out-dir            输出目录（默认: ./output/<timestamp>）
  --device             Playwright 内置设备名（默认: iPhone 14 Pro）
  --browser-channel    chrome | msedge | chromium（默认: chrome）
  --headless           true/false（默认: false）
  --wait-ms            打开页面后额外等待时长，方便你手动点业务（默认: 20000）
  --network-idle-ms    等待 networkidle 的超时（默认: 8000）
  --include            URL 包含关键词（逗号分隔）
  --exclude            URL 排除关键词（逗号分隔）
  --host-contains      host 包含关键词（逗号分隔）
  --resource-types     资源类型（默认: xhr,fetch；可用 all）
  --save-body          是否保存响应体（默认: true）
  --max-body-bytes     单个响应体最大落盘字节（默认: 250000）

示例:
  npm run capture -- \\
    --url "https://your-business.com" \\
    --device "Pixel 7" \\
    --include "/api/,/v1/" \\
    --host-contains "api.,gateway." \\
    --wait-ms 30000
`;

  process.stdout.write(usage);
}

function parseBoolean(value, defaultValue) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function parseNumber(value, defaultValue) {
  if (value == null || value === "") return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function splitCsv(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const [keyRaw, valueFromEq] = token.replace(/^--/, "").split("=");
    const key = keyRaw.trim();
    const nextToken = argv[i + 1];
    const hasNextValue = nextToken && !nextToken.startsWith("--");
    const value = valueFromEq ?? (hasNextValue ? nextToken : "");

    if (valueFromEq == null && hasNextValue) i += 1;

    switch (key) {
      case "url":
        options.url = value;
        break;
      case "out-dir":
        options.outDir = value;
        break;
      case "device":
        options.device = value;
        break;
      case "browser-channel":
        options.browserChannel = value;
        break;
      case "headless":
        options.headless = parseBoolean(value, DEFAULT_OPTIONS.headless);
        break;
      case "wait-ms":
        options.waitMs = parseNumber(value, DEFAULT_OPTIONS.waitMs);
        break;
      case "goto-timeout-ms":
        options.gotoTimeoutMs = parseNumber(value, DEFAULT_OPTIONS.gotoTimeoutMs);
        break;
      case "network-idle-ms":
        options.networkIdleMs = parseNumber(value, DEFAULT_OPTIONS.networkIdleMs);
        break;
      case "include":
        options.include = value;
        break;
      case "exclude":
        options.exclude = value;
        break;
      case "host-contains":
        options.hostContains = value;
        break;
      case "resource-types":
        options.resourceTypes = value;
        break;
      case "save-body":
        options.saveBody = parseBoolean(value, DEFAULT_OPTIONS.saveBody);
        break;
      case "max-body-bytes":
        options.maxBodyBytes = parseNumber(value, DEFAULT_OPTIONS.maxBodyBytes);
        break;
      case "viewport-width":
        options.viewportWidth = parseNumber(value, DEFAULT_OPTIONS.viewportWidth);
        break;
      case "viewport-height":
        options.viewportHeight = parseNumber(value, DEFAULT_OPTIONS.viewportHeight);
        break;
      case "user-agent":
        options.userAgent = value;
        break;
      case "mobile":
        options.mobile = parseBoolean(value, DEFAULT_OPTIONS.mobile);
        break;
      case "device-scale-factor":
        options.deviceScaleFactor = parseNumber(value, DEFAULT_OPTIONS.deviceScaleFactor);
        break;
      case "help":
      case "h":
        printUsage();
        process.exit(0);
        break;
      default:
        process.stdout.write(`忽略未知参数: --${key}\n`);
        break;
    }
  }

  return {
    ...options,
    includeList: splitCsv(options.include),
    excludeList: splitCsv(options.exclude),
    hostContainsList: splitCsv(options.hostContains),
    resourceTypeList: splitCsv(options.resourceTypes.toLowerCase())
  };
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sanitizeFilePart(input) {
  return String(input)
    .replace(/https?:\/\//g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function maskHeaders(headers = {}) {
  const result = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) {
      result[k] = "***";
    } else {
      result[k] = v;
    }
  }
  return result;
}

function getUrlMeta(url) {
  try {
    const u = new URL(url);
    return {
      host: u.host,
      origin: u.origin,
      pathname: u.pathname,
      search: u.search
    };
  } catch {
    return {
      host: "",
      origin: "",
      pathname: "",
      search: ""
    };
  }
}

function shouldKeepRecord(record, options) {
  if (!record || !record.url) return false;

  const { resourceTypeList, includeList, excludeList, hostContainsList } = options;
  const urlMeta = getUrlMeta(record.url);
  const urlLower = record.url.toLowerCase();

  if (!resourceTypeList.includes("all")) {
    const typeLower = String(record.resourceType || "").toLowerCase();
    if (!resourceTypeList.includes(typeLower)) return false;
  }

  if (includeList.length > 0) {
    const hasIncluded = includeList.some((kw) => urlLower.includes(kw.toLowerCase()));
    if (!hasIncluded) return false;
  }

  if (excludeList.length > 0) {
    const hasExcluded = excludeList.some((kw) => urlLower.includes(kw.toLowerCase()));
    if (hasExcluded) return false;
  }

  if (hostContainsList.length > 0) {
    const hostLower = (urlMeta.host || "").toLowerCase();
    const hostMatched = hostContainsList.some((kw) => hostLower.includes(kw.toLowerCase()));
    if (!hostMatched) return false;
  }

  return true;
}

function shouldSaveAsText(contentType = "") {
  if (!contentType) return true;
  const v = contentType.toLowerCase();
  return (
    v.includes("json") ||
    v.includes("text") ||
    v.includes("javascript") ||
    v.includes("xml") ||
    v.includes("x-www-form-urlencoded")
  );
}

function guessFileExtension(url, contentType = "") {
  const ct = contentType.toLowerCase();
  if (ct.includes("application/json")) return ".json";
  if (ct.includes("javascript")) return ".js";
  if (ct.includes("text/html")) return ".html";
  if (ct.includes("text/plain")) return ".txt";
  if (ct.includes("xml")) return ".xml";

  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname);
    if (ext) return ext.slice(0, 8);
  } catch {
    return ".txt";
  }

  return ".txt";
}

function buildSummary(records, meta) {
  const endpointMap = new Map();

  for (const item of records) {
    const urlMeta = getUrlMeta(item.url);
    const key = `${item.method} ${urlMeta.origin}${urlMeta.pathname}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, {
        key,
        method: item.method,
        endpoint: `${urlMeta.origin}${urlMeta.pathname}`,
        count: 0,
        statusCodes: new Set(),
        samples: []
      });
    }

    const current = endpointMap.get(key);
    current.count += 1;
    if (item.response?.status != null) {
      current.statusCodes.add(item.response.status);
    }
    if (current.samples.length < 2) {
      current.samples.push({
        url: item.url,
        bodyFile: item.response?.bodyFile || ""
      });
    }
  }

  const lines = [];
  lines.push("# DevTools 抓包汇总");
  lines.push("");
  lines.push(`- 抓包时间: ${meta.createdAt}`);
  lines.push(`- 目标页面: ${meta.url}`);
  lines.push(`- 设备模式: ${meta.deviceName || "custom"}`);
  lines.push(`- 捕获条数: ${records.length}`);
  lines.push("");
  lines.push("## 接口清单（按出现频次）");
  lines.push("");
  lines.push("| Method | Endpoint | Count | Status | 示例响应文件 |");
  lines.push("|---|---|---:|---|---|");

  const sorted = [...endpointMap.values()].sort((a, b) => b.count - a.count);
  for (const endpoint of sorted) {
    const statusText = [...endpoint.statusCodes].sort((a, b) => a - b).join(", ") || "-";
    const sample = endpoint.samples.find((s) => s.bodyFile)?.bodyFile || "-";
    lines.push(
      `| ${endpoint.method} | ${endpoint.endpoint} | ${endpoint.count} | ${statusText} | ${sample} |`
    );
  }

  lines.push("");
  lines.push("## 说明");
  lines.push("");
  lines.push("- `requests.json`: 请求和响应元数据（已脱敏敏感请求头）。");
  lines.push("- `responses/`: 已保存的响应体样本（遵循 `max-body-bytes` 截断）。");
  lines.push("- 建议把关键接口复制到 `docs/api-doc/` 做人工清洗归档。");
  lines.push("");

  return lines.join("\n");
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.url) {
    process.stderr.write("缺少必填参数: --url\n\n");
    printUsage();
    process.exit(1);
  }

  const createdAt = new Date().toISOString();
  const defaultOutDir = path.resolve(process.cwd(), "output", formatTimestamp());
  const outDir = options.outDir ? path.resolve(process.cwd(), options.outDir) : defaultOutDir;
  const responsesDir = path.join(outDir, "responses");

  await ensureDir(outDir);
  if (options.saveBody) {
    await ensureDir(responsesDir);
  }

  let launchOptions = {
    headless: options.headless
  };

  if (options.browserChannel && options.browserChannel !== "chromium") {
    launchOptions.channel = options.browserChannel;
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    process.stdout.write(
      `[提示] 使用 channel="${options.browserChannel}" 启动失败，回退到 Playwright Chromium。\n`
    );
    browser = await chromium.launch({ headless: options.headless });
  }

  const deviceDescriptor = devices[options.device];
  let contextOptions;

  if (deviceDescriptor) {
    contextOptions = { ...deviceDescriptor };
  } else {
    process.stdout.write(
      `[提示] 未找到设备 "${options.device}"，改用自定义 viewport + mobile 参数。\n`
    );
    contextOptions = {
      viewport: {
        width: options.viewportWidth,
        height: options.viewportHeight
      },
      isMobile: options.mobile,
      hasTouch: options.mobile,
      deviceScaleFactor: options.deviceScaleFactor
    };
    if (options.userAgent) {
      contextOptions.userAgent = options.userAgent;
    }
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const allRecords = [];
  const requestIndex = new Map();
  const pendingBodyTasks = [];
  let seq = 0;

  page.on("request", (request) => {
    seq += 1;
    const record = {
      id: seq,
      startedAt: new Date().toISOString(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      request: {
        headers: maskHeaders(request.headers()),
        postData: request.postData() ?? null
      },
      response: null
    };
    requestIndex.set(request, record);
    allRecords.push(record);
  });

  page.on("response", (response) => {
    const task = (async () => {
      const request = response.request();
      const record = requestIndex.get(request);
      if (!record) return;

      const contentType = response.headers()["content-type"] || "";
      record.response = {
        receivedAt: new Date().toISOString(),
        status: response.status(),
        ok: response.ok(),
        headers: maskHeaders(response.headers()),
        contentType
      };

      if (!options.saveBody) return;
      if (!shouldKeepRecord(record, options)) return;
      if (!shouldSaveAsText(contentType)) return;

      try {
        const rawBody = await response.body();
        const isTruncated = rawBody.length > options.maxBodyBytes;
        const limitedBody = isTruncated ? rawBody.subarray(0, options.maxBodyBytes) : rawBody;
        const bodyText = limitedBody.toString("utf8");

        const urlMeta = getUrlMeta(record.url);
        const fileNameBase = [
          String(record.id).padStart(4, "0"),
          sanitizeFilePart(record.method),
          sanitizeFilePart(urlMeta.host || "unknown-host"),
          sanitizeFilePart(urlMeta.pathname || "root")
        ]
          .filter(Boolean)
          .join("_");
        const ext = guessFileExtension(record.url, contentType);
        const relPath = path.join("responses", `${fileNameBase}${ext}`);
        const absPath = path.join(outDir, relPath);

        await fs.writeFile(absPath, bodyText, "utf8");
        record.response.bodyFile = relPath;
        if (isTruncated) {
          record.response.bodyTruncated = true;
        }
      } catch (error) {
        record.response.bodyError = String(error?.message || error);
      }
    })();

    pendingBodyTasks.push(task);
  });

  try {
    await page.goto(options.url, {
      waitUntil: "domcontentloaded",
      timeout: options.gotoTimeoutMs
    });

    try {
      await page.waitForLoadState("networkidle", {
        timeout: options.networkIdleMs
      });
    } catch {
      process.stdout.write("[提示] networkidle 等待超时，继续抓包。\n");
    }

    process.stdout.write(
      `[进行中] 浏览器已打开，移动端模式已生效。等待 ${options.waitMs}ms 供你手动操作业务页面...\n`
    );
    await page.waitForTimeout(options.waitMs);
  } finally {
    await Promise.allSettled(pendingBodyTasks);
    await context.close();
    await browser.close();
  }

  const keptRecords = allRecords.filter((record) => shouldKeepRecord(record, options));

  const outputMeta = {
    createdAt,
    url: options.url,
    deviceName: deviceDescriptor ? options.device : "",
    browserChannel: options.browserChannel,
    headless: options.headless,
    waitMs: options.waitMs,
    filters: {
      include: options.includeList,
      exclude: options.excludeList,
      hostContains: options.hostContainsList,
      resourceTypes: options.resourceTypeList
    },
    count: keptRecords.length
  };

  await fs.writeFile(
    path.join(outDir, "requests.json"),
    JSON.stringify({ meta: outputMeta, records: keptRecords }, null, 2),
    "utf8"
  );

  const summary = buildSummary(keptRecords, outputMeta);
  await fs.writeFile(path.join(outDir, "summary.md"), summary, "utf8");

  process.stdout.write(`\n抓包完成。\n输出目录: ${outDir}\n`);
  process.stdout.write(`- requests.json: ${path.join(outDir, "requests.json")}\n`);
  process.stdout.write(`- summary.md:    ${path.join(outDir, "summary.md")}\n`);
  if (options.saveBody) {
    process.stdout.write(`- responses/:    ${path.join(outDir, "responses")}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`执行失败: ${String(error?.stack || error)}\n`);
  process.exit(1);
});
