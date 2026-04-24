import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PROXY_PATH = "/__hls_proxy";
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36";

function toProxyUrl(rawUrl: string) {
  return `${PROXY_PATH}?url=${encodeURIComponent(rawUrl)}`;
}

function rewriteM3U8(content: string, baseUrl: string) {
  const lines = content.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        // Rewrite URI="..." inside EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA etc.
        return line.replace(/URI="([^"]+)"/g, (_full, group: string) => {
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

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  plugins: [
    react(),
    {
      name: "hls-dev-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) return next();

          const base = `http://${req.headers.host ?? "localhost:5173"}`;
          const requestUrl = new URL(req.url, base);
          if (requestUrl.pathname !== PROXY_PATH) return next();

          const target = requestUrl.searchParams.get("url");
          if (!target) {
            res.statusCode = 400;
            res.end("Missing query: url");
            return;
          }

          let parsedTarget: URL;
          try {
            parsedTarget = new URL(target);
            if (!["http:", "https:"].includes(parsedTarget.protocol)) {
              throw new Error("Invalid protocol");
            }
          } catch {
            res.statusCode = 400;
            res.end("Invalid target url");
            return;
          }

          try {
            const upstream = await fetch(parsedTarget.toString(), {
              headers: {
                accept: req.headers.accept ?? "*/*",
                "user-agent": MOBILE_UA,
                origin: "https://yqk69.app",
                referer: "https://yqk69.app/"
              }
            });

            res.statusCode = upstream.status;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") ?? "application/octet-stream"
            );

            const isM3u8 =
              parsedTarget.pathname.endsWith(".m3u8") ||
              (upstream.headers.get("content-type") ?? "").toLowerCase().includes("mpegurl");

            if (isM3u8) {
              const text = await upstream.text();
              const rewritten = rewriteM3U8(text, parsedTarget.toString());
              res.end(rewritten);
              return;
            }

            const body = Buffer.from(await upstream.arrayBuffer());
            res.end(body);
          } catch (error) {
            res.statusCode = 502;
            res.end(`Proxy failed: ${String((error as Error).message || error)}`);
          }
        });
      }
    }
  ],
  preview: {
    host: "0.0.0.0",
    port: 5173
  }
});
