#!/usr/bin/env bash
# Serve a static prototype directory on the tailnet and print its URL.
#
#   deploy.sh <dir> [port]   start a 127.0.0.1 static server and expose it via `tailscale serve`
#   deploy.sh stop <port>    remove the serve mapping and stop the local server
#
# macOS Tailscale (App Store / standalone app) cannot serve a directory directly,
# so a local python3 http.server is proxied instead.
set -euo pipefail

PORT_MIN=19400
PORT_MAX=19499

die() { echo "error: $*" >&2; exit 1; }

command -v tailscale >/dev/null || die "tailscale CLI not found"
command -v python3 >/dev/null || die "python3 not found"

host() {
  tailscale status --self --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))'
}

serve_ports() {
  tailscale serve status --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
for k in (d.get("TCP") or {}):
    print(k)'
}

port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 || serve_ports | grep -qx "$1"
}

if [[ "${1:-}" == "stop" ]]; then
  port="${2:-}"
  [[ "$port" =~ ^[0-9]+$ ]] || die "usage: deploy.sh stop <port>"
  tailscale serve --https="$port" off >/dev/null 2>&1 || true
  pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [[ -n "$pids" ]] && kill $pids
  echo "stopped: $port"
  exit 0
fi

dir="${1:-}"
[[ -n "$dir" && -d "$dir" ]] || die "usage: deploy.sh <dir> [port]"
dir="$(cd "$dir" && pwd)"
[[ -f "$dir/index.html" ]] || die "$dir/index.html not found"

port="${2:-}"
if [[ -z "$port" ]]; then
  for p in $(seq "$PORT_MIN" "$PORT_MAX"); do
    port_busy "$p" || { port="$p"; break; }
  done
  [[ -n "$port" ]] || die "no free port in $PORT_MIN-$PORT_MAX"
elif port_busy "$port"; then
  die "port $port is already in use (local listener or tailscale serve)"
fi

log="${TMPDIR:-/tmp}/prototype-deploy-$port.log"
nohup python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir" >"$log" 2>&1 &
disown

for _ in $(seq 1 20); do
  curl -fs -o /dev/null "http://127.0.0.1:$port/" && break
  sleep 0.25
done
curl -fs -o /dev/null "http://127.0.0.1:$port/" || die "local server did not start (log: $log)"

tailscale serve --bg --https="$port" "http://127.0.0.1:$port" >/dev/null

url="https://$(host):$port/"
code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$url" || true)
[[ "$code" == "200" ]] || die "tailnet URL returned $code: $url (stop with: deploy.sh stop $port)"

echo "dir:  $dir"
echo "port: $port"
echo "url:  $url"
