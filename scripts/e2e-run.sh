#!/usr/bin/env bash
# e2e-run.sh (MUS-72) — run Maestro flows against the sandboxed MaestroTest sim.
#
# Flow:
# 1. Ensure the e2e Hono server (port 3002, `musicians_test` DB) and the Expo
#    Metro bundler (port 8082, `EXPO_PUBLIC_API_URL=http://localhost:3002`) are
#    running. By default any existing process on those ports is killed and a
#    fresh one is started from `$repo_root` so a stale Metro (wrong cwd, wrong
#    env) cannot silently serve the wrong bundle. Escape hatch for humans who
#    are driving Metro themselves: set `E2E_NO_AUTOSTART=1`.
# 2. Call scripts/e2e-sim-setup.sh to create/boot/install/launch on the
#    dedicated `MaestroTest` simulator (see that script for details).
# 3. Run Maestro against that sim using its UDID so the tests don't land on
#    the user's daily-driver simulator.
# 4. On failure, convert Maestro's full-resolution PNG screenshots into small
#    JPEGs under build/e2e-failures/ so agents can open them without bloating
#    the context window. Maestro writes ~150KB PNGs per step; sips compresses
#    a failure screenshot to ~10KB at 700px wide / JPEG q40.
#
# For the interactive workflow (GUI sim open, user at the keyboard) either let
# the autostart manage things, or export `E2E_NO_AUTOSTART=1` and run
# `pnpm e2e:mobile` + `pnpm e2e:server` yourself.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
flow_path="${1:-maestro/flows/request-to-join}"

dev_client_app="${DEV_CLIENT_APP:-$repo_root/build/MusiciansDev.app}"
if [ ! -d "$dev_client_app" ]; then
  cat >&2 <<EOF
[e2e:run] Cached dev-client app not found at:
            $dev_client_app
          Run \`pnpm e2e:build-app\` once to produce it (EAS cloud build by default).
          Rebuild after new native deps or an Expo SDK bump.
EOF
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  # Fall back to the default Maestro install location if it's not on PATH.
  if [ -x "$HOME/.maestro/bin/maestro" ]; then
    export PATH="$HOME/.maestro/bin:$PATH"
  else
    echo "[e2e:run] ERROR: maestro CLI not found. See README \"E2E (Maestro)\"." >&2
    exit 1
  fi
fi

# ---------- autostart Metro + e2e server ----------
# A stale Metro (wrong cwd, wrong EXPO_PUBLIC_API_URL) is the most common
# prereq failure in practice — it serves, so the sim launches, but the bundle
# is from an older commit / points at the wrong API. We'd rather kill-and-
# restart than silently run a misleading test. `E2E_NO_AUTOSTART=1` opts out
# when a human is driving Metro themselves.
autostart="1"
if [ "${E2E_NO_AUTOSTART:-0}" = "1" ]; then
  autostart="0"
fi

started_pids=()
server_log="${TMPDIR:-/tmp}/e2e-run-server.log"
metro_log="${TMPDIR:-/tmp}/e2e-run-metro.log"

port_in_use() {
  lsof -ti tcp:"$1" >/dev/null 2>&1
}

kill_port() {
  local port="$1"
  if port_in_use "$port"; then
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "[e2e:run] Freeing port $port (pids: $pids)..." >&2
      # SIGTERM first, then SIGKILL after a short grace period for stragglers.
      echo "$pids" | xargs kill -TERM 2>/dev/null || true
      for _ in 1 2 3 4 5; do
        port_in_use "$port" || return 0
        sleep 1
      done
      pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
      [ -n "$pids" ] && echo "$pids" | xargs kill -KILL 2>/dev/null || true
    fi
  fi
}

wait_for_port() {
  local port="$1" name="$2" timeout="${3:-90}"
  local i
  for i in $(seq 1 "$timeout"); do
    if port_in_use "$port"; then
      return 0
    fi
    sleep 1
  done
  echo "[e2e:run] ERROR: $name did not come up on port $port within ${timeout}s." >&2
  return 1
}

cleanup_autostart() {
  if [ ${#started_pids[@]} -eq 0 ]; then
    return
  fi
  echo "[e2e:run] Stopping autostarted services..." >&2
  # Best-effort direct kill of the pnpm wrappers we spawned. macOS doesn't
  # ship `setsid`, so we can't reliably PG-signal the full child tree — but
  # `kill_port` below picks up any stragglers (Metro's sub-daemons, Node
  # workers) by listening-socket ownership.
  for pid in "${started_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${started_pids[@]}"; do
    kill -KILL "$pid" 2>/dev/null || true
  done
  kill_port 3002
  kill_port 8082
}

if [ "$autostart" = "1" ]; then
  # e2e server (port 3002).
  if port_in_use 3002; then
    echo "[e2e:run] Port 3002 already in use — replacing to guarantee the e2e server is serving from $repo_root against musicians_test." >&2
    kill_port 3002
  fi
  echo "[e2e:run] Starting e2e server on :3002 (logs: $server_log)..." >&2
  ( cd "$repo_root" && exec pnpm e2e:server ) >"$server_log" 2>&1 &
  started_pids+=("$!")
  # Trap as soon as we've spawned the first bg process so Ctrl-C cleans up.
  trap cleanup_autostart EXIT INT TERM
  wait_for_port 3002 "e2e server" 60 || { tail -n 40 "$server_log" >&2 || true; exit 1; }

  # Metro (port 8082).
  if port_in_use 8082; then
    echo "[e2e:run] Port 8082 already in use — replacing to guarantee Metro is serving from $repo_root with EXPO_PUBLIC_API_URL=http://localhost:3002." >&2
    kill_port 8082
  fi
  echo "[e2e:run] Starting Metro on :8082 (logs: $metro_log)..." >&2
  ( cd "$repo_root" && exec pnpm e2e:mobile ) >"$metro_log" 2>&1 &
  started_pids+=("$!")
  wait_for_port 8082 "Metro" 90 || { tail -n 40 "$metro_log" >&2 || true; exit 1; }
else
  # Opt-out mode: fail fast with a helpful message if prereqs aren't already up.
  if ! port_in_use 3002; then
    echo "[e2e:run] ERROR: E2E_NO_AUTOSTART=1 but nothing is listening on :3002 (e2e server). Start it with \`pnpm e2e:server\` or unset the flag." >&2
    exit 1
  fi
  if ! port_in_use 8082; then
    echo "[e2e:run] ERROR: E2E_NO_AUTOSTART=1 but nothing is listening on :8082 (Metro). Start it with \`pnpm e2e:mobile\` or unset the flag." >&2
    exit 1
  fi
  echo "[e2e:run] E2E_NO_AUTOSTART=1 — assuming Metro on :8082 is serving from $repo_root with EXPO_PUBLIC_API_URL=http://localhost:3002." >&2
fi

udid="$(bash "$repo_root/scripts/e2e-sim-setup.sh" | tail -n1)"
if [ -z "$udid" ]; then
  echo "[e2e:run] ERROR: sim setup did not return a UDID." >&2
  exit 1
fi

# Remember the most recent Maestro test dir before the run so we can find the
# new one afterwards. Maestro writes to ~/.maestro/tests/<timestamp>/.
tests_root="$HOME/.maestro/tests"
before_run=""
if [ -d "$tests_root" ]; then
  before_run=$(ls -1t "$tests_root" 2>/dev/null | head -n1 || true)
fi

echo "[e2e:run] Running Maestro on $udid against $flow_path" >&2
set +e
# If the argument is a directory, run the flows inside it in filename-sorted
# order (01-*, 02-*, ...). Pointing `maestro test` at the directory itself
# iterates in file mtime order instead, which breaks any journey where step
# ordering matters — e.g. request-to-join's "flow 01 posts, flow 02 EOIs
# against that post". Maestro still runs every file we pass even if an
# earlier one fails; each flow asserts its own state at entry so a
# mid-journey failure produces useful follow-on signal rather than stopping.
if [ -d "$flow_path" ]; then
  flows=("$flow_path"/[0-9]*-*.yaml)
  if [ ! -e "${flows[0]}" ]; then
    echo "[e2e:run] ERROR: no numbered flows under $flow_path." >&2
    exit 1
  fi
  maestro --device "$udid" test "${flows[@]}"
else
  maestro --device "$udid" test "$flow_path"
fi
status=$?
set -e

# On failure, compress Maestro's latest-run PNGs into build/e2e-failures/
# as small JPEGs. sips is bundled with macOS so no extra deps.
if [ "$status" -ne 0 ] && command -v sips >/dev/null 2>&1 && [ -d "$tests_root" ]; then
  after_run=$(ls -1t "$tests_root" 2>/dev/null | head -n1 || true)
  if [ -n "$after_run" ] && [ "$after_run" != "$before_run" ]; then
    latest_dir="$tests_root/$after_run"
    out_dir="$repo_root/build/e2e-failures/$after_run"
    mkdir -p "$out_dir"
    # Maestro writes screenshots as .png files directly under the timestamp
    # directory (one per step/failure). Quiet sips to keep the log short.
    png_count=0
    while IFS= read -r -d '' png; do
      base=$(basename "$png" .png)
      sips -Z 700 -s format jpeg --setProperty formatOptions 40 \
        "$png" --out "$out_dir/$base.jpg" >/dev/null 2>&1 || true
      png_count=$((png_count + 1))
    done < <(find "$latest_dir" -maxdepth 2 -name '*.png' -print0)
    if [ "$png_count" -gt 0 ]; then
      echo "[e2e:run] Wrote $png_count compressed screenshot(s) to $out_dir" >&2
    fi
  fi
fi

exit "$status"
