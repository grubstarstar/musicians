# Musicians — Project Standards

## Stack
- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Hono + Node.js + TypeScript
- **Database**: SQLite via better-sqlite3
- **Package manager**: pnpm (never npm or yarn)

## Monorepo
- pnpm workspace — packages live under `packages/*`
- `@musicians/web` — React + Vite frontend (`packages/web/`)
- `@musicians/server` — Hono backend (`packages/server/`)
- `@musicians/mobile` — Expo + React Native mobile app (`packages/mobile/`) — see [`docs/expo-monorepo.md`](docs/expo-monorepo.md) before touching it, Expo/Metro/pnpm have sharp edges that are easy to "fix" wrong
- Root `package.json` holds only shared dev tooling (tsc, eslint, concurrently) and delegates scripts via `pnpm --filter` / `pnpm -r`
- Run everything from the repo root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm seed`, `pnpm mobile`

## UI: Material UI (MUI) v6
- Use MUI components exclusively (`@mui/material`)
- Custom theme defined in `packages/web/src/theme.ts`, applied via `ThemeProvider` in `packages/web/src/main.tsx`
- Dark theme. Primary colour: `#6c63ff`. Background: `#0f0f11`. Surface: `#1a1a1f`
- Use `sx` prop for one-off overrides, `styled()` for reusable styled components
- No custom CSS files except `packages/web/src/index.css` for global resets only
- No other component libraries

## ORM: Drizzle
- Schema defined in `packages/server/src/schema.ts` using Drizzle table definitions
- DB instance and schema exported from `packages/server/src/db.ts`
- SQLite file lives at the repo root (`musicians.db`); override with `MUSICIANS_DB_PATH`
- All queries use Drizzle query builder — no raw SQL strings except migrations
- Migrations managed via `drizzle-kit`

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
      index.ts          # Hono app entry
      db.ts             # DB instance + Drizzle client
      schema.ts         # Drizzle schema (tables)
      auth.ts           # JWT helpers
      seed.ts           # Seed script
      routes/
        authRoutes.ts
        bandRoutes.ts
        userRoutes.ts
```

## Auth pattern
- All protected routes check the auth cookie via `getTokenFromCookie` + `verifyToken`
- Return `401` with `{ error: 'Unauthorized' }` if invalid

## TypeScript
- Strict mode on
- No `any` types
- Interfaces for all DB row shapes, defined alongside schema in `packages/server/src/schema.ts`

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
