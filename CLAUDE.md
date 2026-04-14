# Musicians — Project Standards

##  IMPORTANT NOTE
This is a git branch specifically for preparing for a React Native interview. I haven't done much React Native for the last 4 years and so I am catching up on things and using `@musicians/mobile` package in this monorepo as a playground. We can ignore the original purpose of the app for the sake of this.

As we discuss things, write VERY succinct bullet point notes for final quick revision to a docs/revision.md file for anything we talk about that I should go back to. Key points to know for the interview. 

Use a docs/revision-progress.md to describe how far I've gone through my revision. Use checkboxes for each point.

Here's the revision plan. I want you to help build some examples for these concepts so I can see them working for real:

Anything that says "new to me" means you need to teach me concepts along the way because I am new to this area.

NOTE - When dicsussing things keep it fairly brief. We don't need to go into under the hood detail, just keep it practical and aimed at things that might appear in the interview.

### Day 1 — New Architecture concepts (new to me)

- Read the official RN architecture docs
  - https://reactnative.dev/architecture/landing-page
  - https://reactnative.dev/architecture/fabric-renderer
  - https://reactnative.dev/architecture/threading-model
- Understand JSI vs Bridge, Fabric vs old renderer, TurboModules vs NativeModules
- Know what Codegen does (generates type-safe native bindings from TS specs)

### Day 2 — Expo Router hands-on (new to me)

- Build a small app with file-based routing: tabs, stack, dynamic routes, layouts
- Practice useRouter, useLocalSearchParams, Link
- Understand the _layout pattern and route groups

### Day 3 — React 18 in RN + Hermes (new to me)

- How concurrent rendering applies to RN now
- useTransition, useDeferredValue, Suspense for data fetching
- https://react.dev/blog/2022/03/29/react-v18#what-is-concurrent-react
- Why Hermes matters

### Day 4 — Ecosystem catch-up (new to me)

- React Navigation v7 static API (if they're not using Expo Router)
- NativeWind v4 basics
- Scan reactnative.directory for New Arch compatibility indicators

### Day 5 — Refresh fundamentals + interview prep

- Performance patterns: FlatList vs FlashList (FlashList from Shopify is now widely preferred)
- useAnimatedStyle / Reanimated 3, narrowed scope: shared values, one gesture-driven animation
- Common interview Qs: bridge vs JSI, how does RN render, why Fabric, how do you handle native modules

### Day 6 — Day-to-day feature building

The stuff you actually touch every day shipping features. Less theory, more muscle memory.

- Lists & virtualization: `FlatList` / `SectionList` basics, `keyExtractor`, `renderItem`, `getItemLayout`, why virtualization matters, when `.map()` inside `ScrollView` is fine vs when it kills perf
- Forms & keyboard: `TextInput` controlled state, `KeyboardAvoidingView` (iOS/Android differ), auto-focus, dismiss-on-tap, `react-hook-form`
- Data fetching: TanStack Query (`useQuery`, `useMutation`, cache invalidation, loading/error states)
- State management survey: Zustand (dominant), Redux Toolkit (legacy but common), Context for small stuff — when to reach for each
- Styling & layout: RN flexbox defaults (column not row), `StyleSheet.create` vs inline, `Platform.select`, `useWindowDimensions`
- Images: `expo-image` vs built-in `Image` — caching, placeholders, priority
- Platform differences: `Platform.OS`, `.ios.tsx`/`.android.tsx` file extensions, safe area gotchas
- Testing: React Native Testing Library (RNTL) basics; Detox for E2E (rarely asked)
- Debugging: Flipper is dead; current = RN DevTools + Reactotron

(My notes for things that we might need in day 6 too, correct me if these aren't relevant)
- ScrollView
- ListView?
- memo
- general performance gatchas
- debugging in general
- debugging performance
- expo-constants
- expo-linking
- expo-router
- expo-status-bar

### Day 7 — Learn EAS better

Everything past `expo start`. The build + distribution side of an Expo project.

- **EAS Build** — `eas build --profile <name> --platform ios|android`. Cloud builds vs `expo run:ios --configuration Release` local builds — when to pick each
- **`eas.json` profiles** — `development`, `preview`, `production`. What each is for, simulator vs device builds (`"ios": { "simulator": true }`), distribution channels
- **Dev client vs Expo Go** — when you outgrow Expo Go, what a dev client actually is, `expo-dev-client` package
- **Prebuild + bare/managed** — `expo prebuild` generates `ios/`/`android/`, what "continuous native generation" means, when to commit the native folders
- **EAS Update** — OTA for JS + assets. `eas update --branch <name>`. Runtime versions gating compatibility. Why native changes force a binary bump
- **EAS Submit** — `eas submit` to App Store Connect / Play Console, ASC API keys, service accounts
- **Credentials management** — `eas credentials`, auto-managed vs manual, how EAS stores signing keys
- **app.json / app.config.js** — dynamic config, env-driven builds, `expo-constants` `Constants.expoConfig`
- **Build caching, monorepo gotchas** — EAS + pnpm workspaces, how it resolves the mobile package
- **Interview angle** — what an RN team expects you to own: can you ship a build end-to-end without hand-holding?

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
