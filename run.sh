#!/usr/bin/env bash
# DistributeKaro local dev runner.
#
#   ./run.sh            infra + API + retailer web (the Android app is separate: ./run.sh app)
#   ./run.sh bg         same, in the background: returns to the prompt (stop with ./run.sh stop)
#   ./run.sh server     infra + migrate + seed + API only        (http://localhost:3000)
#   ./run.sh web        retailer web only                        (http://localhost:5173)
#   ./run.sh app        build, install and launch on the phone   (no laptop emulator)
#   ./run.sh logs       follow API + web logs
#   ./run.sh status     what is running
#   ./run.sh stop       stop API + web started by this script (docker keeps running)
#   ./run.sh down       stop API + web AND the docker stack (data volumes are kept)
#   ./run.sh restart    down, then start everything again in the background
#   ./run.sh infra:restart   restart only the docker stack (Postgres, Valkey, Garage)
#   ./run.sh clean      stop + kill Gradle/Kotlin/turbo daemons, leftover test containers, adb reverse
#   ./run.sh clean --all   clean + stop the docker stack (data volumes are kept)
#
# The phone reaches the laptop over USB with `adb reverse`, so on the phone the API is http://127.0.0.1:3000
# and the retailer web is http://127.0.0.1:5173. No Wi-Fi or LAN IP needed.
# Several phones attached? Pick one: ANDROID_SERIAL=<serial> ./run.sh app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"
ANDROID_DIR="$ROOT/apps/distributor-android"
APP_ID="in.distributekaro.app"
API_PORT=3000
WEB_PORT=5173
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
mkdir -p "$RUN"

c_info=$'\e[36m' c_ok=$'\e[32m' c_warn=$'\e[33m' c_err=$'\e[31m' c_off=$'\e[0m'
info() { printf '%s▸ %s%s\n' "$c_info" "$*" "$c_off"; }
ok() { printf '%s✓ %s%s\n' "$c_ok" "$*" "$c_off"; }
warn() { printf '%s! %s%s\n' "$c_warn" "$*" "$c_off"; }
die() { printf '%s✗ %s%s\n' "$c_err" "$*" "$c_off" >&2; exit 1; }

# pnpm via PATH or corepack (pinned by packageManager). An array so setsid can exec it.
if type -P pnpm >/dev/null; then PNPM=(pnpm); else PNPM=(corepack pnpm); fi
pnpm() { "${PNPM[@]}" "$@"; }
compose() { docker compose -f "$ROOT/infra/docker-compose.yml" --env-file "$ROOT/infra/.env" "$@"; }

# ---------- background processes (own process group, so stop kills tsx/vite children too) ----------
is_running() { [[ -f "$RUN/$1.pid" ]] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

start_bg() { # name, command...
  local name=$1; shift
  if is_running "$name"; then ok "$name already running (pid $(cat "$RUN/$name.pid"))"; return; fi
  setsid "$@" >"$RUN/$name.log" 2>&1 < /dev/null &
  echo $! >"$RUN/$name.pid"
}

stop_bg() {
  local name=$1
  if is_running "$name"; then
    local pid; pid=$(cat "$RUN/$name.pid")
    kill -TERM -- "-$pid" 2>/dev/null || true
    for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    ok "stopped $name"
  fi
  rm -f "$RUN/$name.pid"
}

wait_http() { # url, name, log
  for _ in {1..60}; do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 0.5; done
  warn "$2 did not come up; last log lines:"; tail -n 20 "$3" >&2; return 1
}

# ---------- steps ----------
deps() {
  [[ -d "$ROOT/node_modules" ]] || { info "installing JS dependencies"; (cd "$ROOT" && pnpm install --frozen-lockfile); }
}

infra() {
  [[ -f "$ROOT/infra/.env" ]] || die "infra/.env missing: copy infra/.env.example to infra/.env and fill in secrets (openssl rand -hex 32)"
  info "starting Postgres, Valkey, Garage"
  local out; out=$(compose up -d --wait 2>&1) || { echo "$out" >&2; die "docker compose up failed"; }
  if [[ ! -f "$ROOT/infra/.env.api" ]]; then
    info "writing infra/.env.api"
    (set -a; . "$ROOT/infra/.env"; set +a; node "$ROOT/infra/scripts/gen-api-env.mjs")
  fi
  ok "infra up"
}

server() {
  deps; infra
  info "migrating + seeding (both are no-ops when up to date)"
  pnpm --filter @dk/shared build >/dev/null
  pnpm --filter @dk/api db:migrate | tail -n 1
  pnpm --filter @dk/api db:seed | tail -n 1
  start_bg api "${PNPM[@]}" --filter @dk/api dev
  wait_http "http://127.0.0.1:$API_PORT/healthz" api "$RUN/api.log" && ok "API  http://localhost:$API_PORT  (readyz: $(curl -s "http://127.0.0.1:$API_PORT/readyz"))"
}

web() {
  if [[ ! -f "$ROOT/apps/retailer-web/package.json" ]]; then
    warn "retailer web not built yet (apps/retailer-web arrives in Phase 1C); skipping"
    return 0
  fi
  deps
  start_bg web "${PNPM[@]}" --filter @dk/retailer-web dev --host 127.0.0.1 --port "$WEB_PORT" --strictPort
  wait_http "http://127.0.0.1:$WEB_PORT" web "$RUN/web.log" && ok "web  http://localhost:$WEB_PORT"
}

phone() {
  [[ -x "$ADB" ]] || die "adb not found at $ADB (set ANDROID_HOME)"
  "$ADB" start-server >/dev/null 2>&1
  local devices; devices=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')
  local unauth; unauth=$("$ADB" devices | awk 'NR>1 && $2=="unauthorized" {print $1}')
  [[ -n "$unauth" ]] && warn "phone $unauth is unauthorized: unlock it and accept the USB debugging prompt"
  [[ -n "$devices" ]] || die "no phone connected. Enable Developer options → USB debugging, plug in over USB, accept the prompt, then retry"
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    grep -qx "$ANDROID_SERIAL" <<<"$devices" || die "ANDROID_SERIAL=$ANDROID_SERIAL is not connected (connected: $(echo $devices))"
  elif [[ $(wc -l <<<"$devices") -gt 1 ]]; then
    die "several phones connected ($(echo $devices)); pick one with ANDROID_SERIAL=<serial> ./run.sh app"
  else
    export ANDROID_SERIAL="$devices"
  fi
  ok "phone $ANDROID_SERIAL ($("$ADB" shell getprop ro.product.model | tr -d '\r'), Android $("$ADB" shell getprop ro.build.version.release | tr -d '\r'))"
}

app() {
  phone
  [[ -f "$ANDROID_DIR/local.properties" ]] || echo "sdk.dir=$ANDROID_HOME" >"$ANDROID_DIR/local.properties"
  "$ADB" reverse "tcp:$API_PORT" "tcp:$API_PORT" >/dev/null
  "$ADB" reverse "tcp:$WEB_PORT" "tcp:$WEB_PORT" >/dev/null
  ok "adb reverse: phone 127.0.0.1:$API_PORT → API, 127.0.0.1:$WEB_PORT → web"
  info "building + installing debug APK"
  (cd "$ANDROID_DIR" && ./gradlew --quiet installDebug)
  "$ADB" shell am start -W -n "$APP_ID/.MainActivity" >/dev/null
  ok "launched $APP_ID on the phone"
}

status() {
  for n in api web; do
    if is_running "$n"; then ok "$n running (pid $(cat "$RUN/$n.pid"), log .run/$n.log)"; else info "$n stopped"; fi
  done
  compose ps --format '  {{.Service}}: {{.Status}}' 2>/dev/null || true
  local daemons; daemons=$(pgrep -fc '^\S*java .*(GradleDaemon|KotlinCompileDaemon)' || true)
  info "Gradle/Kotlin daemons: ${daemons:-0}"
  [[ -x "$ADB" ]] && "$ADB" devices | awk 'NR>1 && NF {print "  phone " $1 ": " $2}'
}

stop_all() { stop_bg web; stop_bg api; }

clean() {
  stop_all
  info "stopping Gradle + Kotlin daemons"
  stop_daemons
  info "stopping turbo daemon"
  (cd "$ROOT" && pnpm exec turbo daemon stop >/dev/null 2>&1 || true)
  info "removing leftover Testcontainers containers"
  local tc; tc=$(docker ps -aq --filter label=org.testcontainers=true 2>/dev/null || true)
  [[ -n "$tc" ]] && docker rm -f $tc >/dev/null
  # Orphaned dev servers from an earlier crash (only this repo's).
  pkill -f "^\S*node .*$ROOT/.*(tsx|vite)" 2>/dev/null || true
  [[ -x "$ADB" ]] && "$ADB" reverse --remove-all >/dev/null 2>&1 || true
  if [[ "${1:-}" == "--all" ]]; then
    info "stopping docker stack (volumes kept)"
    compose down >/dev/null
  fi
  ok "clean"
}

stop_daemons() {
  [[ -x "$ANDROID_DIR/gradlew" ]] && (cd "$ANDROID_DIR" && ./gradlew --stop >/dev/null 2>&1 || true)
  pkill -f '^\S*java .*KotlinCompileDaemon' 2>/dev/null || true
  pkill -f '^\S*java .*GradleDaemon' 2>/dev/null || true
}

on_interrupt() {
  echo
  [[ -n "${TAIL_PID:-}" ]] && kill "$TAIL_PID" 2>/dev/null
  stop_all
  ok "stopped API + web (infra still running)"
  exit 0
}

up() {
  trap on_interrupt INT TERM
  server
  web
  echo
  ok "API + web up. Ctrl-C stops them; infra keeps running (./run.sh clean --all to stop it)"
  tail -n 0 -F "$RUN"/api.log $( [[ -f "$RUN/web.log" ]] && echo "$RUN/web.log" ) &
  TAIL_PID=$!
  wait
}

down() {
  stop_all
  info "stopping docker stack (volumes kept)"
  compose down >/dev/null 2>&1
  ok "docker stack stopped"
}

background() {
  server
  web
  echo
  ok "running in the background. ./run.sh logs to follow, ./run.sh stop to stop"
}

case "${1:-up}" in
  up) up ;;
  bg | background | -d) background ;;
  server) server ;;
  web) web ;;
  app) app ;;
  logs) tail -n 50 -F "$RUN"/*.log ;;
  status) status ;;
  stop) stop_all ;;
  down) down ;;
  restart) down; background ;;
  infra:restart) info "restarting docker stack"; compose restart >/dev/null 2>&1; infra ;;
  clean) clean "${2:-}" ;;
  -h | --help | help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command '$1' (try ./run.sh help)" ;;
esac
