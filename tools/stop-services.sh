#!/usr/bin/env bash
set -euo pipefail

SERVICES=("yqk-monitor-report.timer" "nginx" "hls-proxy" "vnstat")

run_systemctl() {
  if [[ "${EUID}" -eq 0 ]]; then
    systemctl "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo systemctl "$@"
  else
    echo "需要 root 权限执行 systemctl（请用 root 运行或安装 sudo）" >&2
    exit 1
  fi
}

echo "Stopping services: ${SERVICES[*]}"
run_systemctl stop "${SERVICES[@]}"

echo "Service status:"
for svc in "${SERVICES[@]}"; do
  if run_systemctl is-active --quiet "$svc"; then
    echo "  - ${svc}: still active" >&2
    exit 1
  else
    echo "  - ${svc}: inactive"
  fi
done

echo "All services are stopped."
