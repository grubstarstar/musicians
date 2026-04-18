# Musicians — Project Standards

## Stack
- **Frontend**: React 19 + Vite + TypeScript (web); Expo + React Native (mobile)
- **Backend**: Hono + Node.js + TypeScript
- **Database**: Postgres via `postgres` (postgres.js) + Docker Compose for local dev
- **API**: REST at `/api/*` (existing; serves web), tRPC at `/trpc/*` (new work). Mobile consumes tRPC via `@trpc/client` + TanStack Query; shared types flow through `@musicians/shared`
- **Package manager**: pnpm (never npm or yarn)

## Monorepo
- pnpm workspace — packages live under `packages/*`
- `@musicians/web` — React + Vite frontend (`packages/web/`)
- `@musicians/server` — Hono backend (`packages/server/`)
- `@musicians/mobile` — Expo + React Native mobile app (`packages/mobile/`) — see [`docs/expo-monorepo.md`](docs/expo-monorepo.md) before touching it, Expo/Metro/pnpm have sharp edges that are easy to "fix" wrong
- `@musicians/shared` — cross-package types and (later) Zod DTO schemas (`packages/shared/`); re-exports the tRPC `AppRouter` type for mobile to consume
- Root `package.json` holds only shared dev tooling (tsc, eslint, concurrently) and delegates scripts via `pnpm --filter` / `pnpm -r`
- Run everything from the repo root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm seed`, `pnpm mobile:start`

## UI: Material UI (MUI) v6
- Use MUI components exclusively (`@mui/material`)
- Custom theme defined in `packages/web/src/theme.ts`, applied via `ThemeProvider` in `packages/web/src/main.tsx`
- Dark theme. Primary colour: `#6c63ff`. Background: `#0f0f11`. Surface: `#1a1a1f`
- Use `sx` prop for one-off overrides, `styled()` for reusable styled components
- No custom CSS files except `packages/web/src/index.css` for global resets only
- No other component libraries

## ORM: Drizzle
- Schema defined in `packages/server/src/schema.ts` using Drizzle `pg-core` table definitions
- DB instance and schema exported from `packages/server/src/db.ts`
- Postgres runs in Docker (`docker compose up -d postgres`); connection via `DATABASE_URL` (defaults to `postgresql://postgres:postgres@localhost:5432/musicians`)
- All queries use Drizzle query builder — no raw SQL strings except migrations
- Migrations managed via `drizzle-kit`. Generate with `pnpm db:generate`, apply with `pnpm db:migrate`

## Folder structure
```
packages/
  web/
    index.html
    vite.config.ts
    tsconfig.json, tsconfig.app.json, tsconfig.node.json
    src/
      main.tsx          # React entry, ThemeProvider
      App.tsx           # Root component
      theme.ts          # MUI theme definition
      components/       # One file per component
      context/          # React context providers
      utils/            # Pure functions (unit-tested)
  server/
    tsconfig.json
    src/
      index.ts          # Hono app entry (mounts REST + tRPC)
      db.ts             # DB instance + Drizzle client
      schema.ts         # Drizzle schema (tables)
      auth.ts           # JWT helpers (bearer + cookie)
      seed.ts           # Seed script
      routes/           # REST routes (Hono sub-apps)
        authRoutes.ts
        bandRoutes.ts
        userRoutes.ts
      trpc/             # tRPC router, context, procedure helpers
        context.ts
        trpc.ts
        router.ts
  shared/
    src/
      index.ts          # Cross-package types; re-exports AppRouter
```

## Auth pattern
- REST: protected routes call `getTokenFromCookie` + `verifyToken`. Return `401` with `{ error: 'Unauthorized' }` if invalid.
- tRPC: `protectedProcedure` wraps `publicProcedure` with a middleware that throws `TRPCError({ code: 'UNAUTHORIZED' })` if `ctx.user` is null.
- Context (`packages/server/src/trpc/context.ts`) resolves the user via `getTokenFromRequest`, which checks the `Authorization: Bearer <token>` header first and falls back to the `auth_token` cookie. Mobile uses bearer; web uses cookies. Same `verifyToken` helper for both.
- Login endpoint returns the token in both the response body (for mobile to store) and the HttpOnly cookie (for web).

## TypeScript
- Strict mode on
- No `any` types
- Interfaces for all DB row shapes, defined alongside schema in `packages/server/src/schema.ts`

## Plans
Long-form roadmaps and multi-ticket plans live in `plans/` at the repo root. Check there for context before starting work on large initiatives.

## Workflow
Work is tracked in Jira. Use the `mcp__mcp-atlassian__*` MCP tools for all Jira interactions — never hit the Jira API directly.

- **Space**: Musician App (`MUS`)
- **Instance**: richard-garner.atlassian.net
- Always fetch the latest issues before starting work — tickets are added and updated frequently

Kanban flow:
```
To Do → Doing → Code Review → Done
                     ↑          |
                     └──────────┘  (changes requested → back to Doing)
```

Available skills:
- `/next-ticket` — picks the next To Do card and works it end-to-end
- `/dev` — implements a feature (includes unit tests for pure functions)
- `/code-review` — reviews code changes
- `/smoke-test` — tests all features working together end-to-end
- `/unit-test` — writes tests for complex pure functions
