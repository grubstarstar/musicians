#!/usr/bin/env bash
# e2e-run.sh (MUS-72) — run Maestro flows against the sandboxed MaestroTest sim.
#
# Flow:
# 1. Call scripts/e2e-sim-setup.sh to create/boot/install/launch on the
#    dedicated `MaestroTest` simulator (see that script for details).
# 2. Run Maestro against that sim using its UDID so the tests don't land on
#    the user's daily-driver simulator.
# 3. On failure, convert Maestro's full-resolution PNG screenshots into small
#    JPEGs under build/e2e-failures/ so agents can open them without bloating
#    the context window. Maestro writes ~150KB PNGs per step; sips compresses
#    a failure screenshot to ~10KB at 700px wide / JPEG q40.
#
# For the interactive workflow (GUI sim open, user at the keyboard) use
# `pnpm e2e:mobile` + `pnpm e2e:run` — this script serves both paths because
# Maestro auto-targets a single running simulator when `--device` is set.

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
