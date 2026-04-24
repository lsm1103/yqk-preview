# 通用 DevTools 抓包模板

这套模板干的事很直接：

1. 打开 Chrome（或 Playwright Chromium）。
2. 启用移动端设备模式（默认 `iPhone 14 Pro`）。
3. 抓页面里 `xhr/fetch` 接口请求。
4. 导出接口元数据 + 响应样本，方便你后续整理成 API 文档。

> 仅用于你自有或已获授权的业务系统抓包分析。

## 1. 安装

```bash
cd "tools/devtools-capture"
npm install
```

## 2. 最小可用命令

```bash
npm run capture -- --url "https://your-business.com"
```

执行后会自动：

- 打开浏览器
- 进入移动端模式
- 等待 20 秒（默认）让你手动点页面
- 产出抓包结果到 `tools/devtools-capture/output/<timestamp>/`

## 3. 常用命令

按接口关键词过滤：

```bash
npm run capture -- \
  --url "https://your-business.com" \
  --include "/api/,/v1/" \
  --wait-ms 30000
```

按域名过滤：

```bash
npm run capture -- \
  --url "https://your-business.com" \
  --host-contains "api.,gateway." \
  --wait-ms 30000
```

改设备型号：

```bash
npm run capture -- \
  --url "https://your-business.com" \
  --device "Pixel 7"
```

如果本机没装 Chrome，可强制用 Playwright Chromium：

```bash
npm run capture -- \
  --url "https://your-business.com" \
  --browser-channel "chromium"
```

## 4. 输出说明

每次抓包会生成：

- `requests.json`：请求/响应元数据（敏感请求头已脱敏）
- `summary.md`：接口汇总（按频次排序）
- `responses/`：响应体样本文件（文本类内容）

目录示例：

```text
output/
  20260406-215501/
    requests.json
    summary.md
    responses/
      0001_POST_api.example.com_v1_user_profile.json
      0002_GET_api.example.com_v1_banner_list.json
```

## 5. 参数速查

- `--url`: 目标页面 URL（必填）
- `--out-dir`: 输出目录（默认 `./output/<timestamp>`）
- `--device`: 设备名（默认 `iPhone 14 Pro`）
- `--browser-channel`: `chrome` / `msedge` / `chromium`
- `--headless`: 是否无头模式（默认 `false`）
- `--wait-ms`: 打开页面后额外等待时长
- `--network-idle-ms`: 等待 network idle 超时
- `--include`: URL 包含关键词（逗号分隔）
- `--exclude`: URL 排除关键词（逗号分隔）
- `--host-contains`: host 包含关键词（逗号分隔）
- `--resource-types`: 抓取资源类型，默认 `xhr,fetch`，可设为 `all`
- `--save-body`: 是否保存响应体（默认 `true`）
- `--max-body-bytes`: 单个响应体最大保存字节数

## 6. 对接现有文档

抓完之后建议按下面流程落地：

1. 用 `summary.md` 定位关键接口。
2. 从 `requests.json` 和 `responses/` 提取请求参数、响应字段。
3. 把整理后的结果补到 `docs/api-doc/` 和 `docs/api-flow-template.md`。
