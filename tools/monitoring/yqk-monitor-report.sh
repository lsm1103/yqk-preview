#!/usr/bin/env bash
set -euo pipefail

IFACE="${1:-${IFACE:-eth0}}"
WEB_ROOT="${WEB_ROOT:-/var/www/monitor}"
NET_DIR="${WEB_ROOT}/net"
GO_DIR="${WEB_ROOT}/goaccess"
GO_DB="${GO_DB:-/var/lib/goaccess}"
ACCESS_LOG="${ACCESS_LOG:-/var/log/nginx/access.log}"
export HOME="${HOME:-/root}"

mkdir -p "${NET_DIR}" "${GO_DIR}" "${GO_DB}"

if ! vnstat --iflist | tr " " "\n" | grep -qx "${IFACE}"; then
  vnstat --add -i "${IFACE}" || true
fi

vnstati -i "${IFACE}" -s -o "${NET_DIR}/summary.png"
vnstati -i "${IFACE}" -h -o "${NET_DIR}/hours.png"
vnstati -i "${IFACE}" -d -o "${NET_DIR}/days.png"
vnstati -i "${IFACE}" -m -o "${NET_DIR}/months.png"
vnstati -i "${IFACE}" -t -o "${NET_DIR}/top10.png"

TS="$(date '+%Y-%m-%d %H:%M:%S %Z')"
cat > "${NET_DIR}/index.html" <<EOF
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YQK Network Monitor</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 20px; color: #111; }
    h1 { margin-bottom: 8px; }
    p { color: #555; }
    .chart { margin: 16px 0 24px; }
    .chart h3 { margin: 0 0 10px; }
    .chart-box {
      overflow-x: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
    }
    .chart img {
      display: block;
      width: 500px;
      max-width: none;
      height: auto;
    }
  </style>
</head>
<body>
  <h1>网络流量监控（vnStat / vnstati）</h1>
  <p>网卡: <strong>${IFACE}</strong> | 更新时间: ${TS} | 图支持横向滚动，点击可新开原图</p>
  <div class="chart"><h3>总览</h3><div class="chart-box"><a href="summary.png" target="_blank" rel="noopener"><img src="summary.png" alt="summary" /></a></div></div>
  <div class="chart"><h3>最近 24 小时</h3><div class="chart-box"><a href="hours.png" target="_blank" rel="noopener"><img src="hours.png" alt="hours" /></a></div></div>
  <div class="chart"><h3>每日</h3><div class="chart-box"><a href="days.png" target="_blank" rel="noopener"><img src="days.png" alt="days" /></a></div></div>
  <div class="chart"><h3>每月</h3><div class="chart-box"><a href="months.png" target="_blank" rel="noopener"><img src="months.png" alt="months" /></a></div></div>
  <div class="chart"><h3>流量 Top 10 天</h3><div class="chart-box"><a href="top10.png" target="_blank" rel="noopener"><img src="top10.png" alt="top10" /></a></div></div>
  <div class="chart"><h3>文本统计</h3><div class="chart-box"><pre>$(vnstat -i "${IFACE}" 2>/dev/null)</pre></div></div>
  <p><a href="/monitor/goaccess/">查看网站访问分析（GoAccess）</a></p>
  <p><a href="/monitor/net/">刷新页面</a></p>
</body>
</html>
EOF

if [[ -f "${ACCESS_LOG}" ]]; then
  GO_ARGS=(
    --log-format=COMBINED
    --no-progress
    --persist
    --db-path="${GO_DB}"
    --ignore-crawlers
    --html-report-title="网站访问分析（GoAccess）"
    -o "${GO_DIR}/report.html"
    "${ACCESS_LOG}"
  )

  if find "${GO_DB}" -maxdepth 1 -type f -name '*.db' | grep -q '.'; then
    GO_ARGS=(--restore "${GO_ARGS[@]}")
  fi

  goaccess "${GO_ARGS[@]}"

  cat > "${GO_DIR}/index.html" <<EOF
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GoAccess Report</title>
  <style>
    body { margin: 0; }
    .wrap { height: 100vh; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <div class="wrap"><iframe src="/monitor/goaccess/report.html" title="GoAccess Report"></iframe></div>
</body>
</html>
EOF
else
  cat > "${GO_DIR}/index.html" <<EOF
<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>GoAccess</title></head>
<body><h1>GoAccess</h1><p>未找到 Nginx 访问日志: ${ACCESS_LOG}</p></body>
</html>
EOF
fi
