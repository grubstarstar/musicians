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

### One-time setup

1. Install Maestro (CLI):
   ```sh
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```
2. Build and install a dev-client iOS build on the simulator. The app uses
   `expo-dev-client`, `expo-secure-store`, and `expo-audio`, so Expo Go won't
   work. EAS does this for you:
   ```sh
   pnpm mobile:eas-dev-build
   ```
3. Make sure Postgres is up: `docker compose up -d postgres`.
4. Create the test DB and apply migrations (idempotent — safe to re-run):
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

# Terminal 3 — Maestro
pnpm e2e:run
```

`pnpm e2e:run` boots the iOS simulator if it isn't running and executes every
flow under `maestro/flows/request-to-join/` in alphabetical order (01 → 04).
Running it twice in a row should both pass — flow 01 hits `POST /test/reset`
which truncates and reseeds the test DB.

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
