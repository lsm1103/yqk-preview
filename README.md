# YQK Preview

这是 **YQK（一起看）影视 App** 的 Web 端还原 / 预览项目。

整个仓库围绕一件事展开：**把线上 App 的前端逻辑和接口抓出来，重新实现一个能在浏览器里跑的移动端优先播放器**。不依赖官方后端，直接复用抓包得到的业务 API，并在前端本地复刻了签名算法。

> 说明：仓库中的抓包数据、接口文档仅用于学习与技术分析，请确保你对目标系统拥有合法的分析权限。相关接口域名和密钥均来自抓包现场，随时可能失效。

---

## 目录结构

```text
yqk-preview/
├── docs/                     # 接口文档与业务流程梳理
│   ├── api-doc/
│   │   └── yqk-api.md        # 抓包得到的原始接口（curl + 响应样本）
│   └── api-flow-template.md  # API 流程分析模板（梳理用）
│
├── tmp-source/               # 线上原版前端的静态源码快照（Nuxt SPA）
│   ├── index.html            # 入口 HTML
│   ├── js-list.txt           # 页面引用的 JS 清单
│   ├── nuxt/                 # 原始打包 JS（含 decoded/ 反混淆可读版）
│   ├── entry.js / entry.decompressed.js
│   ├── NativeShare.min.js / globalThis.min.js
│   └── ...
│
├── web-player/               # 重新实现的 Web 播放器（React + Vite + TS）
│   ├── src/
│   │   ├── pages/            # 首页 / 搜索页 / 播放页
│   │   ├── components/       # 轮播、货架、视频卡、播放器等组件
│   │   ├── lib/              # API client、签名、格式化工具
│   │   ├── App.tsx / main.tsx / styles.css / types.ts
│   ├── dist/                 # 构建产物
│   ├── package.json
│   └── README.md             # 子项目详细说明
│
└── tools/                    # 周边工具脚本
    ├── devtools-capture/     # Chrome DevTools 抓包模板（Puppeteer/Playwright）
    ├── hls-proxy.js          # 本地 HLS 代理，解决 m3u8 跨域与分片重写
    ├── monitoring/           # vnStat + GoAccess 网络/访问监控报告
    ├── start-services.sh     # 一键启动 vnstat / hls-proxy / nginx / 监控
    └── stop-services.sh      # 一键停止上述服务
```

---

## 各部分是干什么的

### `docs/` — 接口文档

- `api-doc/yqk-api.md`：从线上 App 抓到的 11 个核心接口，以 `curl` + 原始响应样本的形式保存，覆盖首页（`header` / `body` / `firstScreen`）、搜索（`getSearchFilter` / `queryNow` / `search` / `searchClick`）、详情与播放（`vodInfo/index` / `vodInfo/playUrl` / `vodInfo/guessYouLike`）。
- `api-flow-template.md`：一份空白的 API 流程分析模板，用来把抓到的接口整理成「调用先后 → 关键字段 → 业务流程」的文档。

### `tmp-source/` — 原版前端源码

线上 `yqk69.app` 的 Nuxt 前端静态资源快照。主要用来**对照参考**：查接口调用方式、签名算法、页面结构、播放器行为。其中 `nuxt/decoded/` 是反混淆后的可读版本，方便定位逻辑。**这个目录不会参与构建**，只是原始素材。

### `web-player/` — 重新实现的播放器

基于 `docs/api-doc/yqk-api.md` 里的接口做出来的完整前端，移动端优先：

- **首页**：首屏焦点图（`firstScreen`）、频道入口（`header`）、多栏内容货架（`body`）
- **搜索页**：筛选器、关键词搜索、搜索词联想/热搜
- **播放页**：影片详情、选集、猜你喜欢
- **播放器**：基于 `hls.js` 播放 `.m3u8`，支持多清晰度自动降级

关键点是 `src/lib/client.ts` 里**完整还原了签名算法**（参数合并 → key 字典序 → `key=value&...` → 末尾追加 `appKey=...` → `md5`），并内置了多条 API 域名做自动轮询，某条域名挂了会自动尝试下一条。

### `tools/` — 周边工具

- **`devtools-capture/`**：通用的 DevTools 抓包模板。用移动端设备模式打开目标页面，抓 `xhr/fetch` 请求并导出 `requests.json` + `summary.md` + 响应体样本。抓完按 README 流程整理进 `docs/`。仅用于你自有或已授权的系统。
- **`hls-proxy.js`**：一个纯 Node.js 的 HLS 代理。因为 m3u8 分片带跨域限制，浏览器直连会被 CORS 拦截，用它把 m3u8 及其分片重写到本地代理地址，带上移动端 UA 和 `Referer` 转发。监听 `127.0.0.1:8787`，路径 `/__hls_proxy?url=...`，`/healthz` 健康检查。
- **`monitoring/`**：服务器监控报告。用 `vnStat` 出网卡流量图，用 `GoAccess` 分析 nginx 访问日志，生成静态 HTML 报告（`/var/www/monitor/`）。带 systemd `service` + `timer` 定时刷新。
- **`start-services.sh` / `stop-services.sh`**：用 `systemctl` 一键拉起/停止 `vnstat`、`hls-proxy`、`nginx`、`yqk-monitor-report.timer` 四个服务。

---

## 怎么用

### 1. 启动 Web 播放器（最常用）

```bash
cd web-player
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173) 即可。播放器会自动请求 API 域名池，若域名失效会自动切换。**无需本地后端**。

构建生产版本：

```bash
npm run build      # tsc + vite build，产物在 dist/
npm run preview    # 本地预览 dist/
```

### 2. 启动 HLS 代理（可选，播放被 CORS 拦截时用）

```bash
node tools/hls-proxy.js
# 或指定端口
PORT=8787 HOST=127.0.0.1 node tools/hls-proxy.js
```

然后通过 `http://127.0.0.1:8787/__hls_proxy?url=<m3u8地址>` 访问播放地址，代理会自动把 m3u8 里的分片地址也重写成代理地址。健康检查：`curl http://127.0.0.1:8787/healthz`。

也可以用 `tools/start-services.sh` 把它注册成 systemd 服务运行（需要 root）。

### 3. 抓包（分析/更新接口时用）

```bash
cd tools/devtools-capture
npm install
npm run capture -- --url "https://your-business.com" --include "/api/" --wait-ms 30000
```

结果输出到 `output/<时间戳>/`，包含 `requests.json`、`summary.md`、`responses/`。整理后把新接口补进 `docs/api-doc/`。

### 4. 启动服务器监控（需要 root，可选）

```bash
sudo bash tools/start-services.sh    # 启动 vnstat / hls-proxy / nginx / 监控定时器
sudo bash tools/stop-services.sh     # 停止
```

会在 `/var/www/monitor/net/` 生成流量图，在 `/var/www/monitor/goaccess/` 生成访问分析报告。安装前需确认 `vnstat`、`goaccess`、`nginx` 已就绪，并按 `tools/monitoring/systemd/` 里的 unit 文件配置服务。

---

## 技术栈

- **前端**：React 18 + TypeScript + Vite 8 + react-router-dom 6 + hls.js + js-md5
- **抓包工具**：Puppeteer / Playwright（devtools-capture）
- **代理**：原生 Node.js `http`（无第三方依赖）
- **监控**：vnStat / vnstati + GoAccess + nginx + systemd timer

---

## 常见问题

- **接口返回失败 / 签名失败**：API 域名或 `appKey` / `appId` 可能已过期。重新抓包，更新 `web-player/src/lib/client.ts` 里的 `APP_ID`、`APP_KEY`、`APP_VERSION`、`FALLBACK_API_HOSTS`。
- **视频无法播放 / 跨域**：浏览器直接请求 m3u8 会被 CORS 拦截，启动 `hls-proxy.js` 走代理播放。
- **域名失效**：`FALLBACK_API_HOSTS` 会自动轮询下一条，全部失败才会报错。可以在这里追加新的可用域名。
