# RN Interview Revision — Quick Scan

Bullet-point reminders only. You already know this stuff; these are here to trigger recall the morning of the interview.

---

## New Architecture

- **Old arch**: async JSON bridge between JS ↔ native. Everything serialised, single bottleneck.
- **New arch = 3 pillars**: JSI, Fabric, TurboModules (all generated via Codegen).
- **JSI** (JavaScript Interface): C++ API letting JS hold direct refs to native objects. Synchronous calls, no serialisation, no bridge.
- **Fabric**: new renderer. C++ shadow tree shared between JS and native. Synchronous layout, concurrent React support (priority scheduling actually works).
- **TurboModules**: native modules loaded lazily via JSI. Replace old NativeModules. Type-safe, sync or async.
- **Codegen**: reads TS specs, generates C++/ObjC/Java bindings at build time. Removes hand-written bridge glue.
- **Runtime checks**: `global.RN$Bridgeless`, `global._IS_FABRIC` (both truthy = new arch on).
- **Gotcha**: `__turboModuleProxy` can be absent even with TurboModules on.
- **Expo SDK 51+ / RN 0.76+** = new arch default.
- **Interview one-liner**: *"Old arch used an async JSON bridge between JS and native. New arch replaces it with three things — JSI for direct synchronous JS-to-C++ calls, Fabric for a concurrent-capable renderer with a shared C++ shadow tree, and TurboModules as lazily-loaded native modules over JSI. Codegen generates type-safe bindings from TS specs. RN 0.76+ and Expo SDK 51+ have it on by default."*

---

## Expo Router

- File-based routing on top of React Navigation.
- Files under `app/` → routes. `index.tsx` = `/`. `[id].tsx` = dynamic segment.
- `_layout.tsx` = layout wrapper for everything in that folder. Usually hosts a `<Stack>` or `<Tabs>`.
- **Route groups**: `(auth)` / `(tabs)` — parens mean "folder for organisation, not in URL".
- Hooks: `useRouter()`, `useLocalSearchParams()`, `useSegments()`, `<Link href="...">`.
- `router.push`, `router.replace`, `router.back`, `router.setParams`.
- Same `pathname` + different `params` → new stack entry.
- **Entry point wiring** in pnpm monorepo: `package.json` → `"main": "expo-router/entry"`.
- Typed routes: `experimental.typedRoutes` in `app.json` generates a union type of valid hrefs.
- Navigator hierarchy: root stack → tabs → nested stacks inside tabs is normal.
- **Interview one-liner**: *"Expo Router is file-based routing over React Navigation. Files in `app/` become routes, `_layout.tsx` wraps a folder with a navigator, route groups in parens organise without affecting URLs, and `useLocalSearchParams` / `useRouter` are the main hooks. Typed routes gives you compile-time checking of hrefs."*

---

## React 18 Concurrent + Hermes

- **Two render phases**: render (pure, interruptible) and commit (side effects, non-interruptible).
- **Concurrent = interruptible rendering** with priority. High-pri (typing, tap) beats low-pri (filtering a big list).
- **`useTransition`** — `const [isPending, startTransition] = useTransition()`. Wrap state updates you want marked low-priority.
- **`useDeferredValue(value)`** — returns a lagging copy of a value; useful for passing stale-but-cheap data to expensive children while the real value races through.
- **Split**: user-visible direct input = urgent, downstream effects of it = transition.
- **Key limit**: only slices React renders. Doesn't help with synchronous JS blocks (`heavySort()`, `for` loops).
- **Scheduler yields** between components during render. Long-running components still block.
- **Only works on Fabric** — legacy renderer can't be interrupted mid-commit.
- **Suspense + `use()`** (React 19) — throw a promise and React waits; cleaner than useEffect for data fetching.
- **Hermes** — AOT bytecode compilation, fast startup, small memory, Hermes Profiler for JS flame graphs. Default on all new RN projects.
- **OTA caveat**: EAS Update ships JS/assets only. Native changes force a binary bump.
- **Interview one-liner**: *"React 18 splits rendering into interruptible render and non-interruptible commit, with priority via `useTransition` and `useDeferredValue`. Only slices React renders — synchronous JS still blocks. Needs Fabric to work. Hermes is the RN JS engine — AOT bytecode, fast startup, comes with a sampling profiler. Both are on by default in new projects."*

---

## Ecosystem libs

- **`react-native-screens`** — native-backed Stack/Tab navigators. Required by Expo Router. Why it matters: each screen gets a native view, push animations drive on the UI thread (immune to JS blocking).
- **`react-native-gesture-handler`** — native gesture recognisers. Everything should be wrapped in `GestureHandlerRootView`. New API: `Gesture.Pan()`, `Gesture.Tap()` + `GestureDetector`.
- **`react-native-reanimated`** — animations as *worklets* running on the UI thread. `useSharedValue`, `useAnimatedStyle`. v3 uses plain JS functions with Babel plugin marking them.
- **`react-native-safe-area-context`** — notch/home-indicator insets. `SafeAreaProvider` + `useSafeAreaInsets`.
- **`react-native-svg`** — SVG rendering. The `<Svg><Path/></Svg>` API.
- **Native-module single-copy rule**: only one version of a native lib can be linked. Nested pnpm hoisting can duplicate — one of the hardest monorepo issues.
- **Expo Go** has a fixed set of bundled natives. Anything outside that set needs a dev client (`expo-dev-client`).

---

## Lists & virtualization

- **Virtualization** = only mount rows in/near the viewport. Rule: >30 items → virtualize.
- **`.map()` inside `ScrollView`** mounts everything up front. Fine for short fixed lists; death for long ones.
- **FlatList** props that matter:
  - `keyExtractor` — stable id. Don't fall back to index keys.
  - `renderItem` — module-scope or useCallback. NEVER inline (kills memo).
  - `getItemLayout` — for fixed-height rows. Skips measurement, enables sync `scrollToIndex`.
  - `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`.
- **FlatList = windowing**: rows unmount/remount as they leave/enter the window.
- **FlashList (Shopify) = recycling**: pool of live cells reused with new props. No mount/unmount churn.
  - v1 required `estimatedItemSize`, v2 auto-measures.
  - **Stale-state gotcha**: state inside a row survives recycle. Use `useRecyclingState([item.id])`.
  - **Don't put `key` on elements inside `renderItem`** — forces React to unmount subtrees, defeats recycling. Use `useMappingHelper` if you need keys for inner `.map()`s.
  - **`getItemType`** for heterogeneous rows — segregates cell pools by type.
- **`expo-image` + `recyclingKey={item.id}`** inside a recycled list — resets the image's internal state (in-flight load, displayed pixels) without unmounting.
- **Memo every row component** with stable props. Inline arrows / inline styles break memo.
- **Interview one-liner**: *"FlatList virtualises by windowing — rows unmount and remount as they scroll out and in. FlashList from Shopify recycles — same cells reused with new props, no churn. Give it a stable `keyExtractor`, a module-scoped `renderItem`, memo the row, and in recycled lists use `recyclingKey` on images and `useRecyclingState` for per-row state."*

---

## memo / useMemo / useCallback

- **All three preserve referential identity across renders.** Not about speed directly — about preventing downstream work.
- **`React.memo(Component)`** skips re-renders when props are shallow-equal.
- **Identity traps**:
  - Inline object literal (`style={{...}}`)
  - Inline arrow function (`onPress={() => ...}`)
  - New array every render (`data={[...items]}`)
- **`useMemo(fn, deps)`** — caches a computed value while deps match.
- **`useCallback(fn, deps)`** — caches a function identity while deps match. Syntactic sugar for `useMemo(() => fn, deps)`.
- **When to reach for them**: only if (a) a `memo`'d child depends on the prop identity, or (b) computation is genuinely expensive. Otherwise adding them is noise.
- **Alternative to `useCallback`**: hoist the function to module scope if it closes over nothing from the component. Stable by construction, no hook needed.
- **React Compiler** (19.x) auto-memoises at build time — eventually removes the need to write these by hand.
- **StrictMode** double-invokes renders in dev → intentional, catches impure renders.
- **Interview one-liner**: *"All three hooks exist to preserve referential identity so downstream memoised work doesn't run needlessly. Only add them when a memo'd child depends on identity, or when a computation is actually expensive. React Compiler will eventually remove the need."*

---

## Forms & keyboard

- **`TextInput`** controlled state is fine for small forms. Every keystroke re-renders the screen — only matters if the parent is expensive.
- **Focus chain**: refs + `onSubmitEditing` + `returnKeyType="next"` / `"done"`. Move focus manually via `ref.current.focus()`.
- **`KeyboardAvoidingView`** — `behavior="padding"` on iOS, `"height"` on Android (or nothing on Android if the system auto-resizes). Biggest cross-platform pain point.
- **Dismiss on tap**: wrap form in a Pressable that calls `Keyboard.dismiss()`, or use `keyboardShouldPersistTaps="handled"` on a ScrollView.
- **`react-hook-form`** dominates. Uses refs internally → form state lives outside React, inputs only re-render when their own value changes. Huge perf win on long forms.
- **Non-text fields**: no native `<select>` / radio. Use `@react-native-picker/picker`, or roll your own with a modal.
- **Universal `<Controller>`** pattern wraps anything (picker, date, slider) into RHF.
- **Interview one-liner**: *"Controlled `TextInput`s are fine for small forms but re-render the screen per keystroke; react-hook-form uses refs so only the focused input renders. `KeyboardAvoidingView` with `behavior='padding'` on iOS and usually nothing on Android. Focus chain via refs and `onSubmitEditing`."*

---

## TanStack Query

- **Why**: cache, dedupe, invalidate, refetch, loading/error state — the stuff you reinvent badly with `useEffect + fetch`.
- **`useQuery({ queryKey, queryFn })`**: returns `{ data, isLoading, isFetching, isError, error, refetch }`.
- **Four flags to know**: `isPending` (first load), `isFetching` (any load including refetches), `isError`, `isSuccess`.
- **Cache is keyed by `queryKey`**. Array-based for composability: `['tracks', { genre }]`.
- **`staleTime`** — how long data is "fresh"; no refetch during that window. Default 0 (always stale).
- **`gcTime`** — how long unused data stays in cache. Default 5 min.
- **`useMutation`** — for writes. `mutate(payload)` triggers, returns `isPending/isSuccess/isError`.
- **Optimistic updates**: `onMutate` updates cache, `onError` rolls back, `onSettled` refetches.
- **Invalidation**: `queryClient.invalidateQueries({ queryKey })` — marks matching queries stale, triggers refetch if mounted.
- **RN gotcha**: `refetchOnWindowFocus: false` — no browser window focus event in RN. Use `refetchOnReconnect` and the `focusManager`/`AppState` integration instead.
- **Interview one-liner**: *"TanStack Query owns server state — keyed cache, dedupe, stale-time, refetch-on-focus, optimistic updates with rollback. `useQuery` for reads, `useMutation` for writes, `invalidateQueries` to bust cache. Turn off `refetchOnWindowFocus` on RN and wire `AppState` into `focusManager` instead."*

---

## State management (Zustand vs Context)

- **Classify first**:
  - Server state → TanStack Query
  - URL state → router params
  - Local UI state → `useState`
  - Shared client state → Zustand or Context
- **Context**: fine for rarely-changing state (theme, user). No selector API — every consumer re-renders on every change. Don't put frequently-mutated state in it.
- **Zustand**: ~1KB, no provider, selector-based subscriptions. `const name = useStore(s => s.name)` — only re-renders on that slice.
- **Redux Toolkit**: still fine, mostly teams already on it. More ceremony than Zustand.
- **Re-render isolation pattern** (how RHF, TanStack Query, Zustand all work): external store + hook subscription with selector. Each consumer only re-renders when its selected slice changes.
- **Interview one-liner**: *"Classify first: server state to TanStack Query, URL state to the router, local UI to useState, shared client state to Zustand. Context has no selectors so every consumer re-renders on every change — only use it for stable stuff like theme. Zustand is tiny, provider-free, and uses selectors — effectively the default on RN."*

---

## Performance techniques (slow screen)

- **Core principle**: never hold the JS thread for more than a frame. Every "concurrent" technique (useTransition, InteractionManager, worklets) is a variant of "cut it up and yield".
- **Demo**: `daily/slow-mount.tsx` — 600ms sync vs chunked (16ms slices, setTimeout(0) between).
- **The escalating toolkit** (in order):
  1. **Virtualise long lists** — biggest single win.
  2. **Move work off the JS thread** — Reanimated worklets for anim, native module for compute.
  3. **Chunk it** — cooperative scheduling (16ms chunks + setTimeout(0)).
  4. **`useTransition`** for expensive *renders* triggered by state change.
  5. **Release build** — before concluding anything is slow. Dev mode is 3–10x slower.
  6. **Profile** — React Profiler + Hermes sampling.
- **`InteractionManager.runAfterInteractions`** — legacy tool. Earned its stripes on JS-driven stacks where a block would judder the slide. On native-stack (current default via react-native-screens), the animation is native-driven so it's immune to JS blocking → much of InteractionManager's value evaporated.
- **`InteractionManager` vs `useTransition`**:
  - InteractionManager defers *arbitrary JS*.
  - `useTransition` only affects *React renders*. Does nothing for a sync `for` loop.
- **General gotchas**:
  - Inline styles / arrows breaking `memo`
  - Missing `keyExtractor`
  - New array references forcing re-renders
  - Heavy JS work where a worklet belongs
- **Always benchmark in release**: `npx expo run:ios --configuration Release`.

---

## Profiling & debugging

- **RN DevTools** — bundled with RN 0.76+. Hit `j` in Metro. Chromium-based, includes React tab with Profiler.
- **React Profiler** — record, interact, stop. Flame graph per commit. Click a component to see *why* it re-rendered (prop changed, hook changed, parent rendered). This is how you verify `memo` is doing its job.
- **`<Profiler>` component** — React's programmatic profiler. `onRender` callback gives per-commit durations. For CI budgets or one-off measurements.
- **Hermes sampling profiler** — `global.HermesInternal.enableSamplingProfiler()`, save .cpuprofile, open in Chrome DevTools Performance tab or speedscope.app. For JS hot spots *outside* React.
- **Reactotron** — timeline of state changes, network, async storage. Pairs well with Zustand/Redux.
- **Flipper is dead** (deprecated 2024). Don't reach for it.
- **Native tools** (Instruments, Perfetto, Systrace) — rare, for native-side slowness.
- **Mental order for "why is this slow"**:
  1. Release build first (often fixes it)
  2. React Profiler — too many renders or expensive renders?
  3. Hermes sampler — where's JS time going if not React?
  4. Native tools — only if JS side is clean

---

## Styling, layout, platform

### Flexbox
- **`flexDirection` defaults to `column`** (web is row). Biggest surprise coming from web.
- **`flex: 1`** on a container = "fill parent". Root screens need this.
- **`flex: N`** on siblings = proportional share of free space.
- **`gap`** works in modern RN (flex containers). Use it.
- **`aspectRatio`** works. Great for responsive cards.
- **`alignItems` = cross-axis, `justifyContent` = main-axis** (main = direction of flexDirection).
- No `float`, no grid, no `position: fixed`. `position: 'absolute'` is relative to nearest positioned parent.

### StyleSheet vs inline
- `StyleSheet.create` = referentially stable style refs. Inline object literal = new object every render → breaks `memo` on children.
- Dev-mode style validation catches typos.
- Style arrays for conditionals: `style={[base, active && activeStyle]}`.

### Platform
- **`Platform.OS`**: `'ios' | 'android' | 'web' | ...`
- **`Platform.select({ ios, android, default })`**: returns matching value.
- **`Platform.Version`**: iOS = string `'17.2'`, Android = number `34`. Watch the type.
- **Shadow vs elevation** is the #1 use case:
  ```tsx
  ...Platform.select({
    ios: { shadowColor, shadowOpacity, shadowRadius, shadowOffset },
    android: { elevation: 4 },
  })
  ```
- **File extensions**: `Button.ios.tsx` / `Button.android.tsx` / `Button.native.tsx` / `Button.web.tsx`. Metro picks the right one. Use for whole-component divergence; use `Platform.select` for small inline branches.

### Dimensions
- **`useWindowDimensions()`** — reactive hook. Re-renders on rotation, split-view, font-scale change. Use in components.
- **`Dimensions.get('window')`** — one-shot snapshot, never updates. Use only outside React.
- `window` = drawable area; `screen` = full physical. Usually you want `window`.
- **`fontScale`** = user's accessibility font-size multiplier. `<Text>` scales automatically; use the value yourself if you need non-text elements (touch targets, icons) to scale.

### Safe area
- Library: `react-native-safe-area-context`. Needs `<SafeAreaProvider>` above consumers.
- **`useSafeAreaInsets()`** → `{ top, right, bottom, left }`. Re-renders on rotation.
- Apply as `paddingTop` / `paddingBottom` on full-bleed screens.
- **Expo Router's native-stack header handles top inset automatically** — you only need it manually for full-bleed screens or fixed footers.
- **Gotcha 1**: fixed footer button covered by home indicator → always add `paddingBottom: insets.bottom`.
- **Gotcha 2**: double-padding when you add top inset AND have a header → don't.
- `<SafeAreaView>` component exists and auto-pads. Simpler but less flexible than reading insets.

### Interview one-liner
> *"Flexbox only with column as default — that's the first gotcha coming from web. StyleSheet.create for referentially stable styles. Platform.OS / Platform.select for small branches, .ios.tsx / .android.tsx file extensions for whole-file divergence. useWindowDimensions for reactive screen size. Safe-area insets via react-native-safe-area-context — though Expo Router's native-stack handles the top inset for me automatically."*

---

## Interview cheat sheet — the one-liner bank

**Bridge vs JSI**: Old arch had an async JSON bridge between JS and native. JSI replaces it with a C++ API letting JS hold direct refs to native objects — synchronous calls, no serialisation.

**Why Fabric**: Concurrent rendering needs an interruptible renderer. Fabric's C++ shadow tree is shared between JS and native and supports priority-based rendering. The old renderer couldn't be interrupted mid-commit.

**TurboModules vs NativeModules**: TurboModules load lazily over JSI with Codegen-generated type-safe bindings. NativeModules loaded everything eagerly and went over the bridge.

**How does RN render**: JS produces a React tree → Fabric builds a C++ shadow tree → Yoga computes layout → the native view hierarchy is updated. All synchronous now, no bridge hops.

**FlatList vs FlashList**: FlatList windows (unmount/remount as rows scroll). FlashList recycles (reuses cells with new props, like native UITableView/RecyclerView).

**Why memo**: Preserve prop identity so memoised children don't re-render unnecessarily. Only helps if the child is memoised and deps are stable.

**Shipping a build**: `eas build --profile production` → EAS Submit to stores. JS-only changes can ship via EAS Update (OTA) without a binary bump, as long as runtime version matches.

**State management**: Server state to TanStack Query, URL state to router, local UI to useState, shared client state to Zustand. Context only for rarely-changing things like theme.

**Perf**: virtualise, move off JS thread, chunk compute, useTransition for renders, release build, then profile.
