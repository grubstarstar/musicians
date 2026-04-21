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

## Mobile data fetching
- New tRPC-backed mobile screens use `useSuspenseQuery` inside a `<QueryBoundary>` wrapper (`packages/mobile/src/components/QueryBoundary.tsx`). Do NOT use `useQuery` with `if (isLoading) ... / if (!data) ... / if (error) ...` guards in new code.
- Wrap the screen's inner component in `<QueryBoundary notFoundFallback={<ScreenSpecificNotFound />}>` (omit prop if "not found" isn't a meaningful state).
- Inside: `const { data } = useSuspenseQuery(trpc.xxx.queryOptions(...))` — `data` is non-nullable, no guards needed.
- Invalid-input short-circuits (like `Number.isNaN(id)`) stay outside the boundary since the query never fires.
- `QueryBoundary` already routes `TRPCClientError` with `code === 'NOT_FOUND'` to `notFoundFallback`; other errors get the default retry UI.

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
To Do → Ready for Development → Doing → Code Review → Done
                                            ↑           |
                                            └───────────┘  (changes requested → back to Doing)
```
- `To Do` is the raw backlog.
- `Ready for Development` is the curated shortlist of next-up work — `/next-tickets` pulls from here by default, falling back to `To Do` only if it's empty.

When filing tickets via `mcp__mcp-atlassian__*`: the markdown→ADF converter mangles fenced code blocks nested inside list items (underscores become italic, escapes leak). Always hoist code/YAML blocks out of lists, and wrap inline identifiers in backticks rather than relying on `*emphasis*`.

Available skills (project-scoped in `.claude/skills/`):
- `/next-tickets` — picks one or more tickets from Ready for Development and runs the full dev → code-review pipeline (parallel where dependencies allow)

Available global skills you may also invoke from chat:
- `/dev`, `/code-review`, `/smoke-test`, `/unit-test`, `/qa`, `/write-a-prd`

## Agent pipeline conventions
- Spawn `dev`, `qa-automate`, and `code-review` subagents via the `Agent` tool with `subagent_type: "dev"` / `"qa-automate"` / `"code-review"`. All three belong to this project at `.claude/agents/`.
- For `dev` and `qa-automate`: always pass `isolation: "worktree"` (the harness manages the worktree — never pre-create one yourself, see Gotchas) and `run_in_background: true` (frees the orchestrator).
- For `code-review`: `run_in_background: true`; no `isolation: "worktree"` needed (read-only).
- Model selection: `dev` and `qa-automate` run on Sonnet; `code-review` runs on Opus. The agent files declare this in their frontmatter (`model:`). You can override via the `Agent` tool's `model` parameter if needed, but the defaults are load-bearing — `qa-automate` is mechanical Jira→YAML pattern-matching, `code-review` does the deep reasoning.
- `qa-automate` takes the ticket's Jira description + AC + dev's `## HANDOFF` block as its input. It MUST NOT be given dev's diff or source files — see `.claude/agents/qa-automate.md` for the blind-to-dev rule.
- When pulling a non-trivial ticket (schema changes, new domain concepts, modelling ambiguity), draft any clarifying corrections in chat first, get user OK, then `jira_update_issue`, then spawn dev. Avoids mid-pipeline rewriting.

## MCP servers
- Project-scoped MCP servers (e.g. ios-simulator, mcp-atlassian for this repo) live in `<repo>/.mcp.json`.
- Cross-project tools (Notion, Gmail, etc.) live in the user's global `~/.claude.json`.
- Before adding an MCP server: ask whether it's useful in every project. If only this one, put it in the repo so it travels with the codebase.

## Product target
- Subscription pricing target: ~A$10/month. Default to AUD when discussing pricing in tickets/plans.

## Gotchas (session-tested)

### Always spawn dev agents with `isolation: "worktree"`
When orchestrating work via the `Agent` tool with `subagent_type: dev` (or `code-review`, `qa`, etc.), pass `isolation: "worktree"`. The harness then creates its own git worktree for the agent and the agent has full write access to it. Without isolation, a pre-created worktree at `../musicians-<ticket>/` has caused permission-denied errors for the agent's Write/Bash calls — see the MUS-51 attempt in this project's history. The `isolation: "worktree"` path has been reliable ever since.

### Subagents cannot write under `.claude/agents/**`
Discovered during MUS-74: the harness applies a protected-path policy that denies `Write`, `Edit`, and write-mode `Bash` calls against paths under `.claude/agents/**` for spawned subagents, even with `isolation: "worktree"` and accept-edits mode on. This is a deliberate safety rail — an agent editing its own definition could grant itself broader tools. The block is specific to `.claude/agents/**`; edits to `CLAUDE.md`, `.claude/skills/**`, and the rest of the repo go through fine.

Practical consequence for the orchestrator: tickets that change agent definitions (new agent files, edits to `dev.md` / `code-review.md` / `qa-automate.md`) cannot be delegated to a dev subagent end-to-end. Options:
- Implement the change directly from the orchestrator session (where this policy doesn't apply) — cleanest for tickets wholly inside `.claude/agents/**`.
- Let the dev subagent do the non-agent parts, then apply the `.claude/agents/**` portion as a follow-up commit from the orchestrator (MUS-72 used this shape — see commit `4660f0b` following `72aadfa`).

The subagent will still _diagnose_ the denial clearly in its completion comment; don't treat it as a configuration error to chase.

### Drizzle-kit `generate` is interactive and may fail in sandboxes
`pnpm db:generate` prompts for rename-vs-create disambiguation when it detects structural schema changes. In a sandboxed session that prompt can't be answered. When this happens, hand-write the migration SQL file in `packages/server/drizzle/NNNN_<name>.sql`, append a matching entry to `drizzle/meta/_journal.json`, and copy the previous snapshot JSON as the new one. Apply with `pnpm db:migrate`. See `0004_tidy_pete_ross.sql` (MUS-56 events→rehearsals rename) and `0005_rename_rehearsals_constraints.sql` (MUS-59 constraint renames) for the pattern.

Postgres note: renaming a table with `ALTER TABLE ... RENAME TO` does **not** rename the underlying PK index, FK constraint, or sequence identifiers — you need explicit `ALTER INDEX / ALTER TABLE RENAME CONSTRAINT / ALTER SEQUENCE RENAME TO` statements alongside. MUS-59 cleaned up leftover `events_*` identifiers from MUS-56's rename.

### Cleaning up stuck agent worktrees
After an Agent-managed worktree finishes, its folder under `.claude/worktrees/agent-<id>/` can remain locked ("locked working tree, lock reason: claude agent agent-<id>"). Force-remove with:

```
git worktree remove -f -f .claude/worktrees/agent-<id>
git branch -D worktree-agent-<id>
```

Always `cd` back to the repo root before running these — removing the worktree you're standing in leaves the shell with an invalid working directory.

### Mobile TypeScript is now part of the root typecheck
Root `pnpm typecheck` runs `tsc -b && pnpm --filter @musicians/mobile typecheck`. Mobile is not in the root tsc project-references graph (Expo + strict TS don't play well with `composite: true` without extra work), so a separate call keeps it in the CI gate. Added in MUS-56's follow-up after the schema widening silently broke mobile-only consumers.

### Merging ticket branches into main
When a dev agent finishes, its branch is cut from whatever `main` was at dev-start time. If other tickets land on `main` in the meantime, a fast-forward merge fails. Fix with:

```
git checkout <agent-branch>
git rebase main                # resolve conflicts here if any
git checkout main
git merge --ff-only <agent-branch>
```

This keeps the `main` history linear (every ticket is one commit, no merge commits).

### tRPC conventions reminder
- **Always shape returns.** Use `db.select({ ...explicit projection })` or `.map(row => ({ ... }))`. Never `db.select().from(table)` without a projection — Drizzle row types leak snake_case column names to the client if you do.
- **Coerce `ctx.user.id` once at the procedure boundary**: `const userId = Number(ctx.user.id)`. The JWT `sub` is a string.
- **Discriminated-union Zod inputs** for polymorphic kinds (see `requests.create`, `expressionsOfInterest.create`). Structured so new branches slot in cleanly.
- **No explicit DTO types in `@musicians/shared`** — use tRPC inference. If you need a named type client-side, use `inferRouterOutputs<AppRouter>` locally.
