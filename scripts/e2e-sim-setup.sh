#!/usr/bin/env bash
# e2e-sim-setup.sh (MUS-72) — idempotent headless simulator setup for Maestro.
#
# Creates (or reuses) a dedicated iOS simulator named "MaestroTest", boots it
# without opening Simulator.app, installs the cached dev-client .app, seeds
# the Expo dev-launcher preferences so it auto-connects to the local Metro
# bundler on launch, and launches the app. The Maestro flow then arrives at
# the app's login screen without ever seeing the dev-launcher picker.
#
# How the dev-launcher bypass works:
# - Expo dev-client persists recently-opened Metro URLs in NSUserDefaults
#   under `expo.devlauncher.recentlyopenedapps`. On launch, if there's a
#   recent entry, it auto-connects to it and skips the picker UI.
# - We write that key (plus the grant flags for the one-time network and
#   onboarding prompts) via `simctl spawn defaults write` before launching.
# - Previous revisions drove the picker via `simctl openurl exp+musicians://`
#   (iOS confirmation dialog blocked it) or a Maestro-side helper flow
#   (Maestro can't reliably tap native dev-launcher UI). Seeding defaults
#   sidesteps both.
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
#
# Note: Simulator.app IS opened (pointed at the MaestroTest sim) — Maestro's
# `launchApp` relies on XCUIApplication which only reliably foregrounds apps
# when the Simulator GUI is running. A pure headless boot installs + launches
# fine but subsequent force-relaunches from Maestro don't come to foreground.

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
# Metro listens on the host's 8082 by default (pnpm e2e:mobile). iOS Simulator
# bridges the host's localhost, so this URL works unmodified from inside the sim.
METRO_URL="${METRO_URL:-http://localhost:8082}"

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

# 2. Boot the sim and make sure Simulator.app is open for this UDID.
#    Maestro's `launchApp` uses XCUIApplication which only reliably foregrounds
#    apps when the Simulator GUI is running. `open -a Simulator --args
#    -CurrentDeviceUDID <udid>` is idempotent — if Simulator.app is already
#    running against this device it's a no-op.
boot_status=$(xcrun simctl list devices -j | jq -r --arg u "$udid" '[.devices[][] | select(.udid==$u)][0].state // empty')
if [ "$boot_status" != "Booted" ]; then
  log "Booting simulator..."
  xcrun simctl boot "$udid"
  # Wait for the device to finish booting before we push an install onto it.
  xcrun simctl bootstatus "$udid" -b >/dev/null
else
  log "Simulator already booted."
fi
log "Opening Simulator.app window for $udid..."
open -a Simulator --args -CurrentDeviceUDID "$udid"

# 3. Uninstall any prior copy of the app + reset the keychain before a fresh
#    install. Without this, a SecureStore auth token from a previous run
#    survives into the next run and flow 01 starts signed in rather than at
#    the login screen. The uninstall also wipes the app's Preferences domain
#    which is why the defaults-seeding step below runs AFTER install.
if xcrun simctl get_app_container "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1; then
  log "Uninstalling existing $APP_BUNDLE_ID..."
  xcrun simctl uninstall "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
fi
log "Resetting keychain (wipes SecureStore tokens)..."
xcrun simctl keychain "$udid" reset >/dev/null 2>&1 || true

# 4. Install the cached dev-client .app (if present). We don't fail the
#    script if it's missing — the caller (pnpm e2e:run) catches that with a
#    clearer message and a pointer to `pnpm e2e:build-app`.
if [ -d "$DEV_CLIENT_APP" ]; then
  log "Installing $DEV_CLIENT_APP..."
  xcrun simctl install "$udid" "$DEV_CLIENT_APP"
else
  log "WARNING: $DEV_CLIENT_APP not found — skipping install."
  log "         Run \`pnpm e2e:build-app\` once to cache it."
fi

# 4. Seed dev-launcher defaults so the app auto-connects to Metro on launch
#    and skips the native "DEVELOPMENT SERVERS" picker. Safe to re-run — each
#    `defaults write` overwrites idempotently. Terminate the app first so the
#    writes land in the live defaults domain rather than a process that then
#    overwrites them on shutdown.
if xcrun simctl get_app_container "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1; then
  log "Seeding dev-launcher defaults (Metro: $METRO_URL)..."
  xcrun simctl terminate "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "expo.devlauncher.hasGrantedNetworkPermission" -bool true
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "EXDevMenuIsOnboardingFinished" -bool true
  # Disable the Expo dev-menu gestures. Multi-finger taps from Maestro
  # (which simulates touches) can otherwise trigger the dev menu overlay
  # mid-flow, which hides the real app UI and breaks assertions.
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "EXDevMenuTouchGestureEnabled" -bool false
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "EXDevMenuMotionGestureEnabled" -bool false
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "EXDevMenuShowFloatingActionButton" -bool false
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "EXDevMenuShowsAtLaunch" -bool false
  # `recentlyopenedapps` is a dict keyed by URL. A single entry is enough for
  # the dev-client to auto-connect on launch. Timestamp is the epoch-millis
  # "last opened" value — any recent number works.
  timestamp_ms=$(($(date +%s) * 1000))
  xcrun simctl spawn "$udid" defaults write "$APP_BUNDLE_ID" \
    "expo.devlauncher.recentlyopenedapps" -dict "$METRO_URL" \
    "<dict><key>isEASUpdate</key><false/><key>name</key><string>Musicians</string><key>timestamp</key><real>$timestamp_ms</real><key>url</key><string>$METRO_URL</string></dict>"
fi

# 5. Launch the app. With defaults seeded above the dev-client skips the
#    picker, connects to Metro, and the Maestro flow lands on the login screen.
if xcrun simctl get_app_container "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1; then
  log "Launching $APP_BUNDLE_ID..."
  xcrun simctl launch "$udid" "$APP_BUNDLE_ID" >/dev/null || true
else
  log "App $APP_BUNDLE_ID not installed on this sim — skipping launch."
fi

# Final line on stdout MUST be the UDID so callers can capture it.
printf '%s\n' "$udid"
