# Musicians

A monorepo for the Musicians app: web (React + Vite), mobile (Expo + React Native), and a Hono + tRPC server backed by Postgres.

See [`CLAUDE.md`](CLAUDE.md) for the full project standards. This README covers
what you need to actually run the thing.

## Day-to-day

```sh
pnpm install                # bootstrap the workspace
docker compose up -d postgres
pnpm db:migrate             # apply Drizzle migrations to the dev DB
pnpm seed                   # seed the dev DB
pnpm dev                    # web on 5173, server on 3001
pnpm mobile:start           # Expo dev server (requires a dev-client build)
```

`pnpm test`, `pnpm typecheck`, `pnpm lint` from the repo root run across every
workspace.

## E2E (Maestro)

End-to-end tests for the mobile app run against [Maestro](https://maestro.mobile.dev/).
The harness wipes a dedicated Postgres DB (`musicians_test`) between runs and
points the mobile bundle at a parallel server on port 3002, so it never touches
your dev data.

`pnpm e2e:run` targets a dedicated headless simulator called `MaestroTest`
(created on first run), not your daily-driver sim. That keeps unattended
Claude Code agent runs from clobbering your auth/session state, and avoids
popping a Simulator.app window during long test runs. See
[Running the journey](#running-the-journey) below for the interactive path
if you want to watch the flow execute on your main sim.

### One-time setup

1. Install Maestro (CLI, needs Java 17 on PATH):
   ```sh
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```
2. Install `jq` (used by the sim-setup script):
   ```sh
   brew install jq
   ```
3. Build the dev-client iOS `.app`. The app uses `expo-dev-client`,
   `expo-secure-store`, and `expo-audio`, so Expo Go won't work. The build
   is cached at `build/MusiciansDev.app` (gitignored):
   ```sh
   pnpm e2e:build-app
   ```
   By default this kicks off an EAS **cloud** build, waits for it to
   finish, and downloads the produced simulator `.tar.gz` into `build/`.
   No local Xcode / CocoaPods / fastlane required, but `eas whoami` must
   succeed first. If you want to build on your Mac instead (e.g. to
   avoid EAS build credits), set `BUILD_LOCAL=1`:
   ```sh
   BUILD_LOCAL=1 pnpm e2e:build-app
   ```
   Local mode additionally needs Xcode CLI tools, CocoaPods, Ruby, and
   fastlane. Rebuild when:
   - New native deps land (anything needing a Pod install)
   - The Expo SDK bumps
   - `app.json` iOS config changes

   Plain JS/TS changes do NOT require a rebuild — the dev-client loads JS
   from the Metro bundler at runtime.
4. Make sure Postgres is up: `docker compose up -d postgres`.
5. Create the test DB and apply migrations (idempotent — safe to re-run):
   ```sh
   pnpm e2e:db-setup
   ```

### Running the journey

The e2e flow needs three processes running together. Open three terminals:

```sh
# Terminal 1 — test server (port 3002, NODE_ENV=test, points at musicians_test)
pnpm e2e:server

# Terminal 2 — mobile bundler with .env.test (EXPO_PUBLIC_API_URL=http://localhost:3002)
pnpm e2e:mobile

# Terminal 3 — Maestro against the sandboxed MaestroTest sim
pnpm e2e:run
```

`pnpm e2e:run` delegates to `scripts/e2e-sim-setup.sh`, which is idempotent:

- reuses an existing simulator named `MaestroTest` or creates one
  (default `iPhone 16 Pro`, latest installed iOS runtime);
- boots it and attaches Simulator.app to that UDID — a Simulator window
  does appear for the dedicated `MaestroTest` sim, but it stays separate
  from any daily-driver sim window you already have open (Maestro's
  `launchApp` uses `XCUIApplication` which only reliably foregrounds
  apps when the Simulator GUI is running);
- uninstalls and `keychain reset`s any prior copy of the app, then
  reinstalls `build/MusiciansDev.app` — so every run starts logged out;
- seeds the Expo dev-launcher's saved-servers `NSUserDefaults` so the
  app auto-connects to Metro at `http://localhost:8082` and skips the
  native `DEVELOPMENT SERVERS` picker;
- then runs every flow under `maestro/flows/request-to-join/` in
  filename-sorted order (01 → 04) against that sim's UDID.

Running it twice in a row should both pass — flow 01 hits `POST /test/reset`
which truncates and reseeds the test DB.

You can also call `pnpm e2e:setup-sim` on its own to just (re)prime the sim,
or pass a single flow file:

```sh
bash scripts/e2e-run.sh maestro/flows/request-to-join/02-sesh-expresses-interest.yaml
```

### Running against your daily-driver simulator

If you'd rather watch the flow step through on the sim you already have
open, bypass `pnpm e2e:run` and invoke Maestro directly — it will auto-target
the only running iOS simulator:

```sh
cd maestro && maestro test flows/request-to-join
```

Use this when Xcode isn't available on the host, when the dev-client `.app`
hasn't been built yet, or when you're debugging a flow interactively.

### What's covered

The single journey today is `request-to-join`:

1. `gigtar` signs in and posts a "Musician for a band" request (Bass, The Testers).
2. `sesh` signs in and expresses interest on the request.
3. `gigtar` accepts sesh's expression of interest.
4. `sesh` sees the request as `Accepted` in the Applied tab and `The Testers` in their bands list.

The point of this slice is to validate Maestro as a tool — additional journeys
slot in as more directories under `maestro/flows/`.

### Safety

- `POST /test/reset` is mounted only when `NODE_ENV=test`. The dev server
  (`pnpm dev`, port 3001) returns 404 for that path.
- The test DB is `musicians_test` — completely separate from `musicians`.
- `.env.test` is committed under `packages/mobile/` and only contains
  deterministic, non-secret config (the test server URL).
