# Revision Progress

Track of how far through the interview revision plan we've got.

---

## Day 1 — New Architecture

- [x] Old architecture: Bridge, threads, problems
- [x] JSI: what it is, sync vs async, engine-agnostic
- [x] Fabric: C++ shadow tree, concurrent React, sync layout reads
- [x] TurboModules: lazy, typed, Codegen
- [x] Codegen: TS spec → generated C++/Obj-C/Java headers
- [x] Shadow tree vs Virtual DOM distinction
- [x] Runtime globals (`nativeFabricUIManager` etc.) — seen live in app
- [x] Gotcha: `__turboModuleProxy` absent under bridgeless mode
- [x] Why RN globals aren't in TS types (private internals)
- [x] Expo Go vs development build
- [x] Interview one-liner memorised
- [ ] Read official docs: architecture landing, Fabric, threading model
- [ ] Write a TurboModule TS spec file + see what Codegen produces (optional deepening)

## Day 2 — Expo Router

- [x] What file-based routing is + how it differs from imperative React Navigation
- [x] File conventions: `[id]`, `index`, `_layout`, `(group)`, `+not-found`
- [x] `_layout.tsx` pattern — layouts as wrappers, composition down the tree
- [x] `<Link>` declarative navigation
- [x] `useRouter()` imperative API
- [x] `useLocalSearchParams()` in dynamic routes
- [x] Route groups — `(tabs)` invisible in URL
- [x] Nested stack inside a tab — tab bar persists
- [x] Entry point wiring for pnpm monorepo (`expo-router/entry`, scheme, peers)
- [x] Built working example in `packages/mobile/app/`

## Day 3 — React 18 in RN + Hermes

- [x] Concurrent rendering model — render phase vs commit, interruptible renders, scheduler yield points between components
- [x] `useTransition` — urgent vs deferred state, `isPending`, stale content dimmed, built working tab-switch demo
- [x] Why useTransition can't help pathological single-`useMemo` components — scheduler yields between components, not inside one
- [x] Why Hermes matters — bytecode precompile, startup win, AOT interpreter, JSI co-design, OTA bytecode via EAS
- [ ] `useDeferredValue` — conceptually covered (same mechanism, wraps value not setter), not yet used in code
- [ ] Suspense for data fetching — conceptually covered (throws promise, fallback), not yet used in code
- [ ] Read React 18 blog post

**Low priority — only if everything else is done**: rebuild the concurrent demo with
distributed per-row components (30 memoized rows, each doing a chunk of busywork)
so React's yield points kick in between rows and rapid tab-switches can actually
be interrupted. Current demo uses one fat `useMemo`, which is deliberately
pathological for teaching the limit but doesn't show interruption working.

## Day 4 — Ecosystem catch-up

- [x] Native-module-single-copy constraint (why peer deps exist)
- [x] Expo Go bundled natives vs dev build
- [x] `react-native-screens` — what it does, when it's needed
- [x] `react-native-gesture-handler` — native gesture recognition, combo with Reanimated
- [x] `react-native-reanimated` — worklets, shared values, UI-thread animations
- [x] `react-native-safe-area-context` — insets hook, double-inset gotcha
- [x] `react-native-svg` — vector rendering, when to use vs Skia vs Image
- [ ] React Navigation v7 static API
- [ ] NativeWind v4 basics
- [ ] reactnative.directory — New Arch compatibility scan

## Day 5 — Fundamentals refresh + interview prep

- [ ] FlatList vs FlashList — when + why
- [ ] Reanimated 3 — shared values + one gesture-driven animation
- [ ] Interview Qs: bridge vs JSI, why Fabric, how RN renders, native modules

## Day 6 — Day-to-day feature building

- [ ] Lists & virtualization: `FlatList`, `SectionList`, `keyExtractor`, `getItemLayout`, `.map()` vs virtualized
- [ ] Forms: `TextInput` controlled state, `KeyboardAvoidingView`, auto-focus, dismiss-on-tap
- [ ] `react-hook-form` basics
- [ ] TanStack Query: `useQuery`, `useMutation`, cache invalidation
- [ ] State management survey: Zustand, Redux Toolkit, Context — when to use each
- [ ] Styling & layout: flexbox defaults, `StyleSheet.create`, `Platform.select`, `useWindowDimensions`
- [ ] Images: `expo-image` vs `Image` — caching, placeholders, priority
- [ ] Platform differences: `Platform.OS`, `.ios.tsx`/`.android.tsx`, safe area gotchas
- [ ] Testing: RNTL basics
- [ ] Debugging: RN DevTools, Reactotron (Flipper is dead)
