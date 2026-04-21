#!/usr/bin/env bash
# mobile-dev-build.sh (MUS-72) — one-off iOS dev-client build.
#
# Produces a simulator-compatible `build/MusiciansDev.app` (gitignored)
# that `scripts/e2e-sim-setup.sh` + `scripts/e2e-run.sh` both know about.
# Uses EAS cloud builds by default (matches the project's existing workflow
# — no local Xcode / CocoaPods / fastlane required). Set BUILD_LOCAL=1 to
# build on this Mac instead (needs the full iOS toolchain).
#
# Rebuild when:
#   - New native deps land (anything that requires a Pod install)
#   - The Expo SDK bumps (`expo`, native runtime changes)
#   - `app.json` iOS config changes
#
# Do NOT run this for plain JS/TS changes — the dev-client loads JS from
# the Metro bundler at runtime, so rebuilding isn't necessary for those.
#
# Prereqs:
#   - EAS CLI authenticated (`eas whoami` should succeed).
#   - `jq` on PATH (used to parse the EAS build result).
#   - `curl` on PATH.
#   - BUILD_LOCAL=1 mode additionally needs Xcode CLI tools, CocoaPods,
#     Ruby, and fastlane.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
out_dir="$repo_root/build"
mkdir -p "$out_dir"

archive="$out_dir/MusiciansDev.tar.gz"
result_json="$out_dir/.eas-build-result.json"

if [ "${BUILD_LOCAL:-0}" = "1" ]; then
  echo "[mobile:dev-build] Local mode (BUILD_LOCAL=1): needs Xcode + CocoaPods + fastlane..."
  pnpm --filter @musicians/mobile exec eas build \
    --profile development \
    --platform ios \
    --local \
    --non-interactive \
    --output "$archive"
else
  echo "[mobile:dev-build] Running eas build on EAS cloud (no local iOS toolchain required)..."
  echo "[mobile:dev-build] Waiting for the build to finish — this takes several minutes."
  pnpm --filter @musicians/mobile exec eas build \
    --profile development \
    --platform ios \
    --non-interactive \
    --wait \
    --json \
    > "$result_json"

  artifact_url=$(jq -r '(if type=="array" then .[0] else . end).artifacts.buildUrl // empty' "$result_json")

  if [ -z "$artifact_url" ]; then
    echo "[mobile:dev-build] ERROR: could not parse artifact URL from EAS response." >&2
    echo "[mobile:dev-build] Response preserved at $result_json for debugging." >&2
    exit 1
  fi

  echo "[mobile:dev-build] Downloading $artifact_url..."
  curl -fL --progress-bar -o "$archive" "$artifact_url"
  rm -f "$result_json"
fi

echo "[mobile:dev-build] Extracting .app from $archive..."
tar -xzf "$archive" -C "$out_dir"
rm -f "$archive"

if [ ! -d "$out_dir/MusiciansDev.app" ]; then
  # EAS names the produced .app after the scheme (e.g. Musicians.app).
  # Normalise to the path `e2e-sim-setup.sh` expects.
  produced=$(find "$out_dir" -maxdepth 1 -type d -name '*.app' | head -n1)
  if [ -n "$produced" ] && [ "$produced" != "$out_dir/MusiciansDev.app" ]; then
    mv "$produced" "$out_dir/MusiciansDev.app"
  fi
fi

if [ ! -d "$out_dir/MusiciansDev.app" ]; then
  echo "[mobile:dev-build] ERROR: no .app produced under $out_dir." >&2
  exit 1
fi

echo "[mobile:dev-build] Cached $out_dir/MusiciansDev.app"
