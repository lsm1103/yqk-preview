#!/usr/bin/env node
"use strict";

const http = require("http");
const { Readable } = require("stream");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const PROXY_PATH = process.env.PROXY_PATH || "/__hls_proxy";

const MOBILE_UA =
  process.env.HLS_PROXY_UA ||
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36";
const DEFAULT_ORIGIN = process.env.HLS_PROXY_ORIGIN || "https://yqk69.app";
const DEFAULT_REFERER = process.env.HLS_PROXY_REFERER || "https://yqk69.app/";

function toProxyUrl(rawUrl) {
  return `${PROXY_PATH}?url=${encodeURIComponent(rawUrl)}`;
}

function rewriteM3U8(content, baseUrl) {
  const lines = content.split(/\r?\n/);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_full, group) => {
          try {
            const absolute = new URL(group, baseUrl).toString();
            return `URI="${toProxyUrl(absolute)}"`;
          } catch {
            return `URI="${group}"`;
          }
        });
      }

      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return toProxyUrl(absolute);
      } catch {
        return line;
      }
    })
    .join("\n");
}

function isM3U8(targetUrl, contentType) {
  const lowerContentType = (contentType || "").toLowerCase();
  const lowerPath = targetUrl.pathname.toLowerCase();
  return (
    lowerPath.endsWith(".m3u8") ||
    lowerContentType.includes("mpegurl") ||
    lowerContentType.includes("vnd.apple.mpegurl")
  );
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Cache-Control", "no-store");
}

function copyUpstreamHeaders(upstream, res, isPlaylist) {
  const passHeaders = [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified"
  ];

  for (const header of passHeaders) {
    if (isPlaylist && header === "content-length") continue;
    const value = upstream.headers.get(header);
    if (value) {
      res.setHeader(header, value);
    }
  }
}

async function handleProxy(req, res, requestUrl) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    setCorsHeaders(res);
    res.end();
    return;
  }

  if (!["GET", "HEAD"].includes(req.method || "")) {
    res.statusCode = 405;
    setCorsHeaders(res);
    res.end("Method Not Allowed");
    return;
  }

  const target = requestUrl.searchParams.get("url");
  if (!target) {
    res.statusCode = 400;
    setCorsHeaders(res);
    res.end("Missing query: url");
    return;
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(target);
    if (!["http:", "https:"].includes(parsedTarget.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    res.statusCode = 400;
    setCorsHeaders(res);
    res.end("Invalid target url");
    return;
  }

  const upstream = await fetch(parsedTarget.toString(), {
    method: req.method,
    redirect: "follow",
    headers: {
      accept: req.headers.accept || "*/*",
      range: req.headers.range || "",
      "user-agent": MOBILE_UA,
      origin: DEFAULT_ORIGIN,
      referer: DEFAULT_REFERER
    }
  });

  const playlist = isM3U8(parsedTarget, upstream.headers.get("content-type"));
  res.statusCode = upstream.status;
  setCorsHeaders(res);
  copyUpstreamHeaders(upstream, res, playlist);

  if (playlist) {
    const playlistText = await upstream.text();
    const rewritten = rewriteM3U8(playlistText, parsedTarget.toString());
    if (!upstream.headers.get("content-type")) {
      res.setHeader("content-type", "application/vnd.apple.mpegurl");
    }
    res.end(rewritten);
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body).pipe(res);
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (requestUrl.pathname === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok\n");
    return;
  }

  if (requestUrl.pathname !== PROXY_PATH) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Not Found\n");
    return;
  }

  handleProxy(req, res, requestUrl).catch((error) => {
    res.statusCode = 502;
    setCorsHeaders(res);
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(`Proxy failed: ${String(error?.message || error)}\n`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`hls-proxy listening on http://${HOST}:${PORT}${PROXY_PATH}`);
});

