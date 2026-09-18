#!/usr/bin/env bash
set -euo pipefail

SERVICES=("vnstat" "hls-proxy" "nginx" "yqk-monitor-report.timer")

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

echo "Starting services: ${SERVICES[*]}"
run_systemctl start "${SERVICES[@]}"

echo "Service status:"
for svc in "${SERVICES[@]}"; do
  if run_systemctl is-active --quiet "$svc"; then
    echo "  - ${svc}: active"
  else
    echo "  - ${svc}: NOT active" >&2
    exit 1
  fi
done

echo "All services are running."
