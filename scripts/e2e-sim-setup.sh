#!/usr/bin/env bash
# e2e-sim-setup.sh (MUS-72) — idempotent headless simulator setup for Maestro.
#
# Creates (or reuses) a dedicated iOS simulator named "MaestroTest", boots it
# without opening Simulator.app, installs the cached dev-client .app, launches
# it, and deep-links past the dev-client launcher straight into the app.
#
# Prints the simulator UDID as the LAST line on stdout. All progress output
# goes to stderr so callers can safely do:
#
#     udid=$(scripts/e2e-sim-setup.sh | tail -n1)
#
# Why a dedicated sim rather than the user's daily-driver:
# - Keeps the agent's test runs from clobbering the user's auth/session state.
# - Allows the agent to reset cleanly (wipe/reinstall) without touching the
#   user's main simulator.
# - No Simulator.app window pops up during an unattended agent run.

set -euo pipefail

SIM_NAME="${SIM_NAME:-MaestroTest}"
DEVICE_TYPE="${DEVICE_TYPE:-iPhone 16 Pro}"
# Pick the highest-numbered installed iOS runtime if none was specified.
if [ -z "${RUNTIME:-}" ]; then
  RUNTIME=$(
    xcrun simctl list runtimes -j \
      | jq -r '[.runtimes[] | select(.isAvailable == true) | select(.identifier | test("iOS"))] | sort_by(.version) | last.identifier // empty'
  )
fi

APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.musicians.app}"
# Deep link that bypasses the dev-client launcher screen and points the app
# at the local Metro bundler (same URL that `expo start --ios` opens).
DEV_SERVER_URL="${DEV_SERVER_URL:-http://localhost:8082}"
DEEP_LINK="${DEEP_LINK:-exp+musicians://expo-development-client/?url=$(
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DEV_SERVER_URL"
)}"

# Locate the cached dev-client .app. Default matches pnpm e2e:build-app.
# Caller can override via $DEV_CLIENT_APP.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
DEV_CLIENT_APP="${DEV_CLIENT_APP:-$repo_root/build/MusiciansDev.app}"

log() { printf '[e2e-sim-setup] %s\n' "$*" >&2; }

if ! command -v xcrun >/dev/null 2>&1; then
  log "ERROR: xcrun not on PATH. Install Xcode / command-line tools."
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  log "ERROR: jq not on PATH. brew install jq"
  exit 1
fi
if [ -z "$RUNTIME" ]; then
  log "ERROR: no installed iOS simulator runtime found."
  log "       Install one from Xcode > Settings > Platforms."
  exit 1
fi

# 1. Find or create the MaestroTest sim.
udid=$(
  xcrun simctl list devices -j \
    | jq -r --arg n "$SIM_NAME" '[.devices[][] | select(.name==$n) | select(.isAvailable // true)][0].udid // empty'
)
if [ -z "$udid" ]; then
  log "Creating simulator \"$SIM_NAME\" ($DEVICE_TYPE, $RUNTIME)..."
  udid=$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE" "$RUNTIME")
else
  log "Reusing simulator \"$SIM_NAME\" ($udid)."
fi

# 2. Boot headlessly. `simctl boot` is a no-op + error if already booted, so
#    swallow that failure mode specifically. Do NOT `open -a Simulator` —
#    we want the daemon running without the GUI window.
boot_status=$(xcrun simctl list devices -j | jq -r --arg u "$udid" '[.devices[][] | select(.udid==$u)][0].state // empty')
if [ "$boot_status" != "Booted" ]; then
  log "Booting simulator..."
  xcrun simctl boot "$udid"
  # Wait for the device to finish booting before we push an install onto it.
  xcrun simctl bootstatus "$udid" -b >/dev/null
else
  log "Simulator already booted."
fi

# 3. Install the cached dev-client .app (if present). We don't fail the
#    script if it's missing — the caller (pnpm e2e:run) catches that with a
#    clearer message and a pointer to `pnpm e2e:build-app`.
if [ -d "$DEV_CLIENT_APP" ]; then
  log "Installing $DEV_CLIENT_APP..."
  xcrun simctl install "$udid" "$DEV_CLIENT_APP"
else
  log "WARNING: $DEV_CLIENT_APP not found — skipping install."
  log "         Run \`pnpm e2e:build-app\` once to cache it."
fi

# 4. Launch the app, then hand it the deep-link that tells the dev-client
#    which Metro server to load — skipping the dev-launcher list screen.
#    Launch first so the URL scheme handler is registered.
if xcrun simctl get_app_container "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1; then
  log "Launching $APP_BUNDLE_ID..."
  xcrun simctl launch "$udid" "$APP_BUNDLE_ID" >/dev/null || true
  log "Opening deep link to $DEV_SERVER_URL..."
  xcrun simctl openurl "$udid" "$DEEP_LINK" || true
else
  log "App $APP_BUNDLE_ID not installed on this sim — skipping launch."
fi

# Final line on stdout MUST be the UDID so callers can capture it.
printf '%s\n' "$udid"
