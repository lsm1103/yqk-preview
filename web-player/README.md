# YQK Web Player

这是基于 `docs/api-doc/yqk-api.md` 里抓到的接口，做出来的一套完整前端项目（移动端优先）：

- 首页：`header/body/firstScreen`
- 搜索页：`getSearchFilter/queryNow/search/searchClick`
- 播放页：`vodInfo/index/playUrl/guessYouLike`
- 播放器：`hls.js` 支持 `.m3u8`

## 启动

```bash
cd "web-player"
npm install
npm run dev
```

默认地址：

- [http://localhost:5173](http://localhost:5173)

## 构建

```bash
npm run build
npm run preview
```

## 关键实现

项目已内置签名算法（从线上前端还原）：

1. 业务参数 + 公共参数合并
2. 按 key 字典序排序
3. 拼接 `key=value&...`
4. 末尾追加 `appKey=...`
5. `md5` 生成 `sign`

公共参数包括：

- `appId`
- `reqDomain`
- `deviceInfo`
- `version`
- `requestId`
- `cus1tom`
- `udid`

## 目录结构

```text
web-player/
  src/
    components/
    lib/
    pages/
    App.tsx
    main.tsx
    styles.css
```

## 说明

- 该项目直接调用抓包中的业务 API 域名，不走本地后端代理。
- 若某个 API 域名失效，代码会自动轮询尝试下一条域名。
