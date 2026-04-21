#!/usr/bin/env bash
# mobile-dev-build.sh (MUS-72) — one-off local iOS dev-client build.
#
# Wraps `eas build --profile development --platform ios --local` so the
# output lands at a predictable, gitignored path (`build/MusiciansDev.app`)
# that `scripts/e2e-sim-setup.sh` + `scripts/e2e-run.sh` both know about.
#
# Rebuild when:
#   - New native deps land (anything that requires a Pod install)
#   - The Expo SDK bumps (`expo`, native runtime changes)
#   - `app.json` iOS config changes
#
# Do NOT run this for plain JS/TS changes — the dev-client loads JS from
# the Metro bundler at runtime, so rebuilding isn't necessary for those.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
out_dir="$repo_root/build"
mkdir -p "$out_dir"

# `eas build --local` emits a tarball containing the .app bundle. We
# extract it so `simctl install` can consume the .app directly.
archive="$out_dir/MusiciansDev.tar.gz"

echo "[mobile:dev-build] Running eas build --local (Xcode + ~several minutes)..."
pnpm --filter @musicians/mobile exec eas build \
  --profile development \
  --platform ios \
  --local \
  --non-interactive \
  --output "$archive"

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
