# React Native Interview Revision Notes

Very succinct. Expand only where a concept still feels fuzzy.

---

## Day 1 — New Architecture

### Old arch (pre-2022)
- 3 threads: JS, Native/UI, Shadow (Yoga layout)
- **Bridge** = async JSON message queue between JS and native
- Pains: serialization, everything async, batched flushes → jank, weakly typed

### New arch — 3 pillars

**JSI (JavaScript Interface)**
- C++ layer → JS holds direct refs to C++ objects
- **Synchronous** both ways, no JSON, no queue
- **Engine-agnostic by design** — JSI does NOT require Hermes
- Hermes exists *because of* JSI (pre-JSI, native layer was tied to JSC's C API)
- Mental model: Bridge = letters; JSI = shared phone line

**Fabric (new renderer)**
- Shadow tree lives in **C++**, shared across threads → no serialization
- Synchronous layout reads (sync `measure()` etc.)
- Supports **React 18 concurrent rendering** — interruptible renders, `useTransition`, Suspense
- Priority-based updates (gestures preempt background re-renders)
- Old renderer couldn't support concurrent React (assumed renders were sync + final)

**TurboModules + Codegen**
- Replace NativeModules
- **Lazy-loaded** (faster cold start)
- **Typed** via TS spec file
- **Codegen** reads the spec at build time → generates C++/Obj-C/Java headers; mismatches fail the build
- Can return values synchronously via JSI
- Same idea for Fabric components (custom native views)

### Shadow tree vs Virtual DOM
- **Not the same thing**
- Web: Fiber tree (JS) → DOM. 2 trees
- RN has **3** trees:
  1. **Fiber tree** (JS) — the "virtual DOM" equivalent, what React diffs
  2. **Shadow tree** (C++ under Fabric) — layout tree Yoga walks
  3. **Host view tree** — real `UIView` / `ViewGroup` on screen
- Flow: Fiber → Shadow → Native

### Runtime globals (checkable in JS)
- `global.nativeFabricUIManager` → Fabric on
- `global.HermesInternal` → Hermes on
- `global.RN$Bridgeless` → bridgeless mode (legacy bridge gone)
- `global.__turboModuleProxy` → legacy TurboModule lookup proxy (transitional)

### Gotcha: `__turboModuleProxy` can be absent when TurboModules *do* work
- Proxy was transitional
- Under bridgeless mode, TurboModules are installed directly on `global` at bootstrap → no proxy needed
- Absent proxy + bridgeless ON = fully migrated, not broken

### Why RN globals aren't in TS types
- Not standard JS → not in TS lib files
- Not in `@types/react-native` → considered private runtime internals, Meta can rename
- Needs cast: `globalThis as unknown as { ... }`
- Runtime `!= null` check is separate — handles platforms where natives didn't install them

### Expo Go vs dev build
- **Expo Go** = prebuilt host app, frozen native side. No custom native modules, no arch-flag tuning
- **Dev build** = you compile native yourself. Full control
- For custom TurboModules or non-default arch flags → dev build required

### Interview one-liner
> The old Bridge was an async JSON queue between JS and native. The New Architecture replaces it with **JSI** (sync C++ interop), **Fabric** (concurrent-React-aware renderer with a C++ shadow tree), and **TurboModules** (lazy, type-safe native modules generated from TS specs via **Codegen**).

---

## Day 2 — Expo Router

### What it is
- File-based routing for RN, built by Expo
- Thin layer on top of **React Navigation** — not a replacement
- Files in `app/` → routes. No imperative screen registration

### File conventions
- `app/foo.tsx` → `/foo`
- `app/bar/[id].tsx` → `/bar/:id` (dynamic)
- `app/index.tsx` → `/` for that directory
- `app/_layout.tsx` → wraps every route below it (not itself a route)
- `app/(group)/...` → **route group**, organisational only, no URL segment
- `app/+not-found.tsx` → 404

### `_layout.tsx` pattern
- Not a route — a wrapper component
- Where you put `<Stack />`, `<Tabs />`, `<Drawer />`
- Layouts **compose** — a single route can be wrapped by multiple layouts down the tree
- Example chain: `app/_layout` → `(tabs)/_layout` → `routing/_layout` → `[id].tsx`

### Navigation primitives
- **`<Link href="/bands/42">`** — declarative, like web `<a>`. Use `asChild` to wrap custom components
- **`useRouter()`** — imperative: `router.push`, `router.back`, `router.replace`
- **`useLocalSearchParams()`** — inside `[id].tsx`, returns `{ id: string }`. Reactive to URL changes

### Route groups — the key insight
- Parentheses = "share a layout but stay invisible in the URL"
- Lets you give siblings a common shell (tab bar) without dragging group name into URLs
- `app/(tabs)/routing/index.tsx` serves `/routing`, not `/(tabs)/routing`

### Entry point wiring (pnpm monorepo)
- `package.json` → `"main": "expo-router/entry"`
- Needs `"scheme": "..."` in `app.json` (deep linking)
- `expo install` these peers: `expo-router`, `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`
- No `App.tsx` / `index.ts` needed — `expo-router/entry` handles root mount

### Nested stacks inside tabs
- Each tab can have its own inner Stack via a nested `_layout.tsx`
- Pushes on the inner stack keep the tab bar visible
- Example: tapping a list row in `routing/index.tsx` pushes `routing/[id].tsx` onto the nested stack

---

## Day 3 — React 18 concurrent rendering + Hermes

### Render phases
- **Render phase** — React calls your components, builds a new Fiber tree. Pure, side-effect-free. **Interruptible** in React 18.
- **Commit phase** — React walks the new tree, applies changes to host (DOM / native views). Always synchronous, uninterruptible.

### What "concurrent" actually means
- Multiple versions of the tree can be **in flight** simultaneously
- React can **start rendering, pause, yield to higher-priority work, resume** (or discard + restart)
- Not parallelism — still single-threaded JS. Cooperative interruptibility.

### React 18 primitives
1. **Automatic batching** — every `setState` in the same tick batched into one render, even in promises / `setTimeout`. Pre-18 only batched inside React event handlers. No opt-in.
2. **`useTransition`** — wraps a state setter. Update inside `startTransition(...)` is low-priority. Returns `[isPending, startTransition]`.
3. **`useDeferredValue`** — wraps a *value* (not a setter). Use when you don't own the state (e.g. it's a prop). Same mechanism underneath.
4. **Suspense for data** — component throws a promise; nearest `<Suspense fallback>` catches it and renders fallback until resolved. Originally just for `React.lazy`; now works for data via libs (TanStack Query, React 19 `use()` hook).

### `useTransition` vs `useDeferredValue`
- Own the setter → `useTransition`
- Receive the value as prop → `useDeferredValue`

### Urgent vs transition — the split you have to draw
- **Urgent**: typed input echo, button highlight, tap feedback. Update synchronously.
- **Transition**: expensive derived views, filtered lists, chart redraws. Wrap in `startTransition`.
- The whole benefit is physically separating "what must feel instant" from "what can lag a frame or three."

### Scheduler yield points
- React's scheduler yields **between component renders**, not inside one
- Mechanism: React finishes one component's render, returns, checks time budget (~5ms). If over, posts a `MessageChannel` message to itself (web) / `setImmediate`-equivalent (RN), ends the current JS task.
- Event loop runs — native events (taps, keystrokes) get processed — then React's continuation message is picked up.
- **Nothing to do with `await`**. React doesn't pause running functions; it ends tasks and schedules continuations.

### The hard limit
- React **cannot** interrupt inside a single component render function
- A 200ms `useMemo` inside one component = 200ms of unresponsive UI, even in Transition mode
- `useTransition` is a **scheduling hint**, not a way to make slow code fast
- Real apps don't hit this because work is distributed across many small components — yield points are ~1-5ms apart naturally

### Why this only works on Fabric
- Concurrent rendering requires preparing a new tree in the background, maybe discarding it, then atomically committing
- **Old arch (Paper)**: single shadow tree, mutated directly. No way to throw away in-progress work safely.
- **Fabric**: two C++ shadow trees live at once — **committed** (currently displayed) and **in-progress** (React's next attempt). Atomic swap on commit. Same pattern as GPU double-buffering.

### Hermes — why it exists
- Meta-built JS engine, co-designed with JSI
- Replaced JSC as the default around RN 0.70; default in Expo SDK 48+
- **Precompiled bytecode**: `hermesc` compiles JS → Hermes bytecode (`.hbc`) at build time. No parse at startup. Big cold-start win on low-end Android.
- **Interpreter, no JIT** → smaller memory, smaller binary
- **Generational GC** → fewer long pauses
- **Built-in Chrome DevTools debugger** (JSC's was always clunky)
- Historical gotchas (missing BigInt, Proxies, WeakRefs) mostly fixed

### Hermes + dev mode
- Production: JS bundle → `hermesc` → `.hbc` shipped in the app
- Dev: Metro serves JS source, Hermes interprets source directly. Slower startup than prod, but fully dynamic. Hot reload / Fast Refresh all work.

### OTA updates + Hermes bytecode
- EAS Update / CodePush compile JS → `.hbc` **on the server at publish time**, not on device
- Client downloads `.hbc`, writes to disk, next launch loads from disk instead of the baked-in bundle
- Still bytecode-fast after OTA — compilation just moved from local build → server publish
- **Runtime versions** gate OTA compatibility — OTA can only update JS + assets, not native code
- Binary bump required for: new native modules, `app.json` native config changes, Expo SDK upgrades

### Why Hermes + concurrent React play well together
- Scheduler yields frequently — each yield should be cheap
- Faster engine → can yield more aggressively without tanking throughput
- Hermes makes interruptible rendering genuinely responsive on low-end devices

### Interview one-liner
> React 18's concurrent rendering means the render phase is interruptible — React can start building a new tree, yield to urgent work at component boundaries via its scheduler, and discard or restart the render. `useTransition` marks state updates as low-priority; `useDeferredValue` does the same for prop values. On RN, this works because Fabric's C++ shadow tree is double-buffered, so React can build a pending tree and commit atomically. Hermes makes it feel good on low-end devices via bytecode precompilation and a fast AOT interpreter.

---

## Day 4 — Standard RN ecosystem libraries

### The native-module-single-copy constraint
- Native code has **one global namespace** per platform (ObjC runtime class registry; Java ClassLoader)
- Linker cannot distinguish two copies of the same class → duplicate symbol error
- JS can have multiple versions of a package coexisting; **native cannot**
- Autolinking (scans `node_modules`, wires each native lib into the Xcode/Gradle project) would also break on duplicates
- Enforcement mechanism = **peer dependencies**: lib declares it needs the native dep, app installs it exactly once
- This is why any non-trivial RN app has a forest of `react-native-*` top-level deps it doesn't directly import

### Expo Go baked-in natives
- Expo Go is a prebuilt shell with a fixed native library set
- Baked in: `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-svg`, FlashList, all `expo-*` SDK modules
- `expo install` picks SDK-pinned JS bindings to match the baked-in native versions
- Need a different version / custom native lib / custom TurboModule → **dev build**

### `react-native-screens`
- Native container primitives — `UIViewController` (iOS) / `Fragment` (Android) wrappers
- Without it: pushed screens are plain `<View>`s, no native back gesture, no native transitions, no OS-level memory reclaim
- Used by React Navigation / Expo Router internally
- Effectively mandatory for any app using navigation

### `react-native-gesture-handler`
- Native gesture recognition (Pan, Pinch, Tap, LongPress, Rotation, Fling) on the UI thread
- Replaces `PanResponder` / `TouchableOpacity` / `TouchableHighlight` (JS-thread based, laggy under load)
- Use `<Pressable>` (built-in) for taps; gesture-handler for custom gestures
- Required by React Navigation for drawer/tab/back-swipe gestures
- **Killer combo with Reanimated**: gesture → shared value → worklet animation, entirely on UI thread, bypassing JS

### `react-native-reanimated`
- Animations that run on the **UI thread** via **worklets**
- **Worklet** = JS function tagged `'worklet'`, Babel plugin ships it to a separate Reanimated JS runtime living on the UI thread via JSI
- **Shared values** (`useSharedValue`) = C++-backed atomics read/written from either thread
- **Animated styles** (`useAnimatedStyle`) = worklet returning a style object, runs on UI thread
- Immune to JS-thread jank — animations stay smooth even while React is mid-render
- Use when: gesture-driven animations, scroll-linked parallax, anything needing smoothness under load
- Don't use when: simple fade-ins / one-shot animations (built-in `Animated` is fine)
- v3 added layout animations + shared-element transitions

### `react-native-safe-area-context`
- Exposes device safe-area insets (notch, home indicator, software nav bar, keyboard) as React context
- Hook: `useSafeAreaInsets()` → `{ top, right, bottom, left }` in points
- Component: `<SafeAreaView>` auto-pads children by insets
- Provider: `<SafeAreaProvider>` near the root
- RN's built-in `SafeAreaView` is iOS-only, effectively deprecated
- **Double-insetting gotcha**: don't wrap screens inside a navigator's header/tab bar with your own SafeAreaView — navigator already applies insets → extra whitespace

### `react-native-svg`
- SVG rendering primitives — maps `<Svg>`, `<Path>`, `<Circle>` etc. to Core Graphics (iOS) / Canvas (Android)
- RN has no built-in vector support; `<Image>` is raster only
- Used by almost every icon library (`@expo/vector-icons`, `phosphor-react-native`, `lucide-react-native`) and most chart libs
- Use for: icons, charts, custom illustrations, dynamic shapes
- Don't use for: static raster images, simple rounded rects, heavy custom graphics (→ `react-native-skia` instead)

### `react-native-skia` (bonus)
- Shopify's wrapper around Google's Skia graphics library (same one used by Chrome, Android)
- Full Canvas-like renderer — bigger and more powerful than SVG
- Use for games, real-time visuals, complex custom graphics
- Overkill for icons/charts
