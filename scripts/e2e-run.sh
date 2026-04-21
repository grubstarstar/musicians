#!/usr/bin/env bash
# e2e-run.sh (MUS-72) — run Maestro flows against the sandboxed MaestroTest sim.
#
# Flow:
# 1. Call scripts/e2e-sim-setup.sh to create/boot/install/launch on the
#    dedicated `MaestroTest` simulator (see that script for details).
# 2. Run Maestro against that sim using its UDID so the tests don't land on
#    the user's daily-driver simulator.
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

echo "[e2e:run] Running Maestro on $udid against $flow_path" >&2
exec maestro --device "$udid" test "$flow_path"
