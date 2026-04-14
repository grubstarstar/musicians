# Revision Progress

What's left to cover before the interview. Pragmatic stuff only — the deep-dive tangents have been dropped. Grouped by topic, not by day.

---

## Readings (still owed)

- [ ] Official RN architecture docs: landing, Fabric, threading model
- [ ] React 18 blog post — `https://react.dev/blog/2022/03/29/react-v18`

## Lists & performance

- [x] FlashList — install, swap into existing `daily/lists.tsx` demo, compare against FlatList
- [x] Slow-screen-on-mount story: virtualize → defer with `InteractionManager` → `memo` → release build
- [x] General perf gotchas: inline styles/arrows breaking `memo`, missing `keyExtractor`, `expo-image` vs `<Image>`
- [x] Profiling workflow: React DevTools Profiler flame graph, "why did this render", Hermes sampling profiler for JS hot spots — enough to answer "is memo actually helping?"
- [x] Debugging: RN DevTools (bundled 0.76+), Reactotron. Flipper is dead.

## Animation

- [x] Reanimated 3: shared values + ONE gesture-driven animation (gesture-handler → shared value → `useAnimatedStyle`)

## Styling, layout, platform

- [x] Flexbox defaults (column not row), `StyleSheet.create` vs inline, `Platform.select`, `useWindowDimensions`
- [x] `expo-image` vs built-in `Image` — caching, placeholders, priority
- [x] Platform differences: `Platform.OS`, `.ios.tsx` / `.android.tsx` file extensions, safe area gotchas

## Navigation alternative

- [ ] React Navigation v7 static API — enough to talk about it if they're not using Expo Router

## Testing

- [ ] React Native Testing Library basics — render, query, fire events. Detox is rarely asked

## EAS — ship a build end-to-end

- [ ] EAS Build: cloud builds vs `expo run:ios --configuration Release` — when to pick each
- [ ] `eas.json` profiles: development / preview / production, simulator vs device builds
- [ ] Dev client vs Expo Go — when Expo Go stops being enough, `expo-dev-client`
- [ ] `expo prebuild` — continuous native generation, when to commit `ios/` / `android/`
- [ ] EAS Update — OTA for JS + assets, runtime versions, what forces a binary bump
- [ ] EAS Submit — App Store Connect / Play Console pipeline, ASC API keys
- [ ] `app.json` / `app.config.js` dynamic config, env-driven builds, `expo-constants`
- [ ] EAS + pnpm monorepo gotchas

## Interview rehearsal

- [ ] Out-loud one-liners: bridge vs JSI, why Fabric, how RN renders, native modules / TurboModules, how you'd ship a build

---

## Already covered (not revisiting)

New Architecture (JSI / Fabric / TurboModules / Codegen), Expo Router, React 18 concurrent rendering (`useTransition`, `useDeferredValue`), Hermes, Suspense + `use()` conceptually, ecosystem libs (screens, gesture-handler, reanimated, safe-area-context, svg), FlatList / SectionList basics, `memo` / `useMemo` / `useCallback`, forms (TextInput, focus chain, KeyboardAvoidingView, react-hook-form), TanStack Query, Zustand vs Context.
