# Expo + Metro + pnpm monorepo — what I learned the hard way

_Last validated: 2026-04-11 against Expo SDK **55.0.14**, React Native **0.83.4**,
React **19.2.0**, pnpm **10.29.1**. If the "latest" SDK on npm has moved on, treat
specific version numbers in this doc as examples and re-run the research steps in
the "How I research Expo/RN version pins" section below._

This document captures non-obvious things about running Expo / React Native inside a
pnpm workspace, discovered while setting up `@musicians/mobile` (MUS-5). It's aimed at
future contributors (human or AI) who open the mobile package and wonder why things
look the way they do — especially anything that would otherwise be mistaken for "that
looks wrong, let me clean it up."

**What this doc covers:** the dev-server / Metro bundler path (the `pnpm mobile:start`
workflow and what Expo Go / simulators use). **What it doesn't cover yet:** EAS
builds, native iOS/Android Xcode/Gradle integration, or production bundling — none
of that is configured or exercised in this repo. Issue #33013 (referenced below)
specifically fixed a monorepo bug in the *iOS native* build pipeline, not the dev
server, so expect to learn more when EAS is set up.

## TL;DR

- **Use the current Expo SDK** (as of writing: SDK 55). Older SDKs predate Expo's
  first-class monorepo support and force painful workarounds.
- **Don't hand-write a `metro.config.js`** for monorepo purposes. From SDK 52+,
  `getDefaultConfig()` auto-detects monorepos. Any `watchFolders` /
  `nodeModulesPaths` / `disableHierarchicalLookup` snippet you find in a blog post
  older than SDK 52 is deprecated and will actively break things.
- **Don't set `nodeLinker: hoisted`** unless you're forced to. From SDK 54+, Expo
  supports pnpm's default isolated linker. Hoisted works but sacrifices the whole
  benefit of pnpm for the rest of the workspace.
- **Don't set `"main": "expo/AppEntry.js"`** in `packages/mobile/package.json`. It
  was the Expo convention for years and old tutorials still recommend it, but the
  file contains a hardcoded `import App from '../../App'` that only works in a
  non-monorepo layout. Use a custom `index.ts` that calls `registerRootComponent(App)`
  and set `"main": "index.ts"` instead. (See "Gotcha: AppEntry.js" below for the
  full story.)
- **Bundle URLs are relative to the workspace root**, not the package. When
  debugging Metro with `curl`, hit
  `http://localhost:8081/packages/mobile/index.bundle?platform=ios&dev=true`, not
  `/index.bundle`. The latter looks for `index.ts` at the *workspace root* and 404s.

## Why this page exists

SDK 52 and earlier needed several manual monorepo patches (custom Metro config,
hoisted pnpm, direct `@babel/runtime` dep). Most of those patches are now
actively harmful on SDK 54+ because Expo's tooling already does the right thing and
your manual overrides fight it.

If you land here and think "this should be simpler," it is — follow the "Current
setup" section below and ignore the archaeology.

## Current setup (what actually works)

### `pnpm-workspace.yaml`
```yaml
packages:
  - "packages/*"
```
No `nodeLinker` override. pnpm stays in its default isolated mode.

### `packages/mobile/package.json` (abridged)
```json
{
  "name": "@musicians/mobile",
  "main": "index.ts",
  "scripts": { "start": "expo start" },
  "dependencies": {
    "expo": "~55.0.14",
    "expo-status-bar": "~55.0.5",
    "react": "19.2.0",
    "react-native": "0.83.4"
  },
  "devDependencies": {
    "@types/react": "~19.2.2"
  }
}
```
Notes:
- `typescript` is NOT declared here. The workspace root's `typescript` is the single
  source of truth for all packages (matches `@musicians/web` and `@musicians/server`).
- No `@babel/runtime` direct dep. Under isolated mode it's reachable from every
  package's scope via normal transitive resolution — Expo handles it.
- React version must exactly match the pin in the matching Expo template. Check
  `npm view expo-template-blank-typescript@sdk-<N> dependencies` before bumping.

### `packages/mobile/index.ts`
```ts
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```
This is our entry. `packages/mobile/package.json` has `"main": "index.ts"` so Metro
starts bundling here. The older `"main": "expo/AppEntry.js"` pattern does NOT work
in a monorepo — see "Gotcha: AppEntry.js" below.

### No `metro.config.js`
`expo/metro-config`'s `getDefaultConfig()` auto-detects monorepos on SDK 52+. If
you need a custom config later (e.g. an SVG transformer), create it as:
```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// your tweaks here
module.exports = config;
```
**Never** add `watchFolders`, `nodeModulesPaths`, or `disableHierarchicalLookup`
manually. Those were the pre-SDK-52 monorepo workaround and they break SDK 52+
auto-configuration.

### `packages/mobile/app.json`
Standard Expo config. Nothing monorepo-specific.

### `eslint.config.js`
`packages/mobile/**` is in the global ignore list. Expo projects have their own
lint setup (`expo lint` / `eslint-config-expo`); our web/server ESLint config is
TypeScript-eslint + react-hooks and isn't compatible with RN's rules. When we add
mobile lint later, it should live in a separate ESLint config block scoped to
`packages/mobile/**`.

## How to verify it works

1. Install: `pnpm install` from the repo root.
2. Boot the dev server: `pnpm mobile:start` from the repo root (alias for
   `pnpm --filter @musicians/mobile start`). Running `pnpm start` from inside
   `packages/mobile/` also works; the root alias is just the project convention.
3. Smoke-test the bundle without a simulator:
   ```
   curl -s -o /tmp/bundle.js -w "HTTP %{http_code} size %{size_download}\n" \
     "http://localhost:8081/packages/mobile/index.bundle?platform=ios&dev=true"
   ```
   Expected: `HTTP 200` and a multi-megabyte JS file that starts with
   `var __BUNDLE_START_TIME__=...`.
4. Verify it contains our code: `grep -o "registerRootComponent" /tmp/bundle.js`.

### Benign warnings you will see on first install

- **`Node.js (v20.x.x) is outdated and unsupported. Please update to a newer Node.js
  LTS version (required: >=20.19.4)`** — Expo 55 requires a newer Node LTS than our
  repo currently runs for other packages. The dev-server bundle path still works on
  older Node, but EAS / native builds may not. If you're going to ship the mobile
  app, bump your local Node first. If you're just iterating on the dev server, the
  warning is safe to ignore.
- **`react-dom 19.2.5 ✕ unmet peer react@^19.2.5: found 19.2.0`** — `react-dom`
  gets pulled in transitively (web support) and has a patch-version-newer peer
  range than the React version the SDK 55 template pins. Do NOT "fix" this by
  bumping React above the template's pin; that breaks Expo's internal version
  compatibility assumptions. Trust the template pin and treat this warning as
  noise.

## Three things that will confuse you

### 1. `@babel/runtime` "missing" errors

React Native's Babel preset uses `@babel/plugin-transform-runtime`, which rewrites
compiled code to `require('@babel/runtime/helpers/...')`. These requires appear in
**every** transformed file, including files inside `node_modules`. If the importing
file's own pnpm scope doesn't have `@babel/runtime` symlinked into it, Metro
resolution fails.

On SDK 55, `@babel/runtime` is declared as a direct dependency of the `expo`
package — run `npm view expo@55 dependencies` to confirm — so every package that
transitively depends on `expo` has it reachable under pnpm isolated mode. You don't
need to declare it yourself.

On SDK 52 in this repo, under pnpm isolated mode, we hit
`Unable to resolve @babel/runtime/helpers/interopRequireDefault`. I never fully
traced whether the root cause was Expo 52 omitting the dep vs some other dependency
graph quirk, but empirically the workarounds were: adding it as a direct dep of
the mobile package (fixes *our* code only, not Expo's compiled output), using
`public-hoist-pattern[]=*` (whack-a-mole), or switching to `nodeLinker: hoisted`
(nuclear but works). Don't do any of those on SDK 54+. If you hit this error on
a newer SDK, the first things to check are (a) your SDK version, (b) whether
`pnpm-workspace.yaml` has an accidental `nodeLinker` override, and (c) whether a
stale custom `metro.config.js` has reappeared.

### 2. Bundle URL is relative to the workspace root, not the package

Metro's `projectRoot` in a monorepo is the **workspace root**, by design. The Metro
docs say so: "If your Metro project is developed in a monorepo and includes files
from multiple logical packages, you'll generally want to set projectRoot to the root
of your repository." Expo's auto-config does exactly this.

Consequence: a URL path like `/index.bundle` resolves to `workspaceRoot/index.ts`,
which doesn't exist, and you get:
```
Unable to resolve module ./index from /Users/you/repo/.
```
The correct URL is `/packages/mobile/index.bundle?platform=ios`. I verified this
by hand with `curl` — Expo Go and native builders should pass the right path
automatically via the `expo start` machinery, but I have **not** personally
verified the simulator / Expo Go round trip in this repo. If you find the mobile
app not loading in a simulator with a monorepo-path resolution error, issue
[expo#33013](https://github.com/expo/expo/issues/33013) is the place to start —
it's specifically about the iOS native build's Shell Script phase passing the
wrong entry path in a monorepo.

### 3. Gotcha: `AppEntry.js` and the `main` field

This one trips people up because it looks like a Metro bug but is actually a
choice you make in `package.json` — specifically, whatever you put in the `main`
field. Metro just reads `main`, finds the file it points to, and starts bundling
from there. Everything downstream of that is your code (or someone else's code
you pointed at).

**The three common values of `main` for Expo apps:**

1. `"main": "index.ts"` — **what we use.** You write your own `index.ts` that
   imports `App` (a sibling file) and calls `registerRootComponent(App)`. Both
   files live inside `packages/mobile/`, so Metro's resolution stays within the
   package and works fine in any layout.

2. `"main": "expo-router/entry"` — used by apps that have adopted expo-router.
   It's a wrapper shipped by the `expo-router` package that sets up file-based
   routing and eventually renders your `app/` directory. We're not on
   expo-router, so this doesn't apply to us today — but it's what the canonical
   [byCedric/expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example)
   uses, and it's what you'd adopt if we ever migrate.

3. `"main": "expo/AppEntry.js"` — **the legacy pattern, do not use in a monorepo.**
   This was the default in Expo's blank template for many SDK versions and is
   still the first thing a lot of older tutorials tell you to write. The file
   itself (at `node_modules/expo/AppEntry.js`) contains:
   ```js
   import registerRootComponent from 'expo/src/launch/registerRootComponent';
   import App from '../../App';
   registerRootComponent(App);
   ```
   That `../../App` is a **hardcoded relative import inside Expo's source** —
   not something Metro or your config can intercept. In a non-monorepo layout
   where `node_modules/` lives next to your `App.tsx`, the relative path
   resolves to `<repo>/App.tsx` and everything works. In our monorepo,
   `App.tsx` lives at `packages/mobile/App.tsx`, and under pnpm isolated mode
   Expo's `AppEntry.js` is physically located at
   `node_modules/.pnpm/expo@<hash>/node_modules/expo/AppEntry.js`, so `../../App`
   resolves to somewhere inside the pnpm store, not our package. Metro reports
   `Unable to resolve module '../../App' from '.../expo/AppEntry.js'` and the
   bundle fails.

   There is no way to fix this short of not pointing `main` at `AppEntry.js`,
   because the broken import is inside Expo's own file. Metro does its job
   correctly — you just gave it a file that was never designed for monorepos.

**Takeaway:** if you find yourself staring at an `Unable to resolve '../../App'`
error, check `packages/mobile/package.json` first. If the `main` field is
`expo/AppEntry.js`, that's the bug — change it to `index.ts` and make sure
`packages/mobile/index.ts` exists with the three-line `registerRootComponent`
call.

## When to upgrade / downgrade linker mode

**Stay on isolated (the default).** Only set `nodeLinker: hoisted` in
`pnpm-workspace.yaml` if:
- You hit a specific package that genuinely cannot work under isolated (rare on
  SDK 54+), AND
- You've verified the issue isn't "I'm using a deprecated metro.config.js" or
  "my Expo SDK is too old."

The cost of hoisted: you lose pnpm's strict dep isolation for the **entire**
workspace (web and server too), because `nodeLinker` is workspace-scoped. A bug
where web accidentally `require`s an undeclared transitive dep will work under
hoisted and blow up the day you switch back to isolated.

## How I research Expo/RN version pins

Whenever upgrading, don't guess versions. Two authoritative paths:

**Path A — `expo install --fix` (the officially supported workflow).**
From inside `packages/mobile/`, run `pnpm dlx expo install --fix`. Expo's CLI
reads the current `expo` version, consults Expo's compatibility matrix, and
rewrites every Expo-related dep in `package.json` to the version pinned for
that SDK. This is the blessed way to upgrade. Do this first.

**Path B — read npm directly (what I used for MUS-5).**
Good for research / scripting / understanding *why* a version is what it is
without mutating anything:
```
npm view expo dist-tags                                          # which SDK is current
npm view expo@<version> dependencies                             # deps Expo declares
npm view expo@<version> peerDependencies                         # peer constraints
npm view expo-template-blank-typescript@sdk-<N> dependencies     # canonical pins per SDK
npm view expo-template-blank-typescript@sdk-<N> devDependencies
```
The `expo-template-blank-typescript` npm package is maintained by the Expo team
and is the source of truth for what versions of `react`, `react-native`,
`expo-status-bar`, `@types/react`, etc. the current SDK expects. Copy those exact
specifiers into `packages/mobile/package.json` and you're aligned with upstream.

Either path is fine; Path A is less typing and less likely to drift, Path B
gives you a paper trail and doesn't touch the working tree.

## Reference

**Official docs — start here:**
- [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/) — the primary
  source for everything in this doc. Read this first if it disagrees with me.
- [Expo SDK changelog / release notes](https://expo.dev/changelog) — check which
  SDK is current and what changed between SDKs.
- [Expo CLI `install` command](https://docs.expo.dev/more/expo-cli/#install) —
  covers `expo install --fix` for SDK-consistent version bumps.
- [Expo customizing Metro](https://docs.expo.dev/guides/customizing-metro/) —
  when and how to extend `getDefaultConfig` (e.g. transformers, resolver tweaks).
- [Metro bundler configuration](https://metrobundler.dev/docs/configuration/) —
  especially the `projectRoot` / `watchFolders` / `resolver.nodeModulesPaths`
  sections. The upstream Metro docs, not Expo-flavoured.
- [`@react-native/metro-config` README](https://www.npmjs.com/package/@react-native/metro-config)
  — what Expo's `expo/metro-config` wraps. Useful if you're debugging Metro
  behaviour that looks non-Expo-specific.

**Version / template sources:**
- [`expo` on npm](https://www.npmjs.com/package/expo) — `dist-tags` lists the
  current SDK and per-SDK tags.
- [`expo-template-blank-typescript` on npm](https://www.npmjs.com/package/expo-template-blank-typescript)
  — canonical per-SDK version pins. `npm view expo-template-blank-typescript@sdk-<N> dependencies`.

**pnpm:**
- [pnpm `node-linker` setting](https://pnpm.io/settings#node-linker) — isolated
  vs hoisted vs pnp. Also [pnpm's symlinked `node_modules` structure](https://pnpm.io/symlinked-node-modules-structure)
  if you want to understand what's actually on disk.
- [pnpm workspaces](https://pnpm.io/workspaces) — general workspace reference.

**Canonical working example:**
- [byCedric/expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example)
  — the reference pnpm + Expo monorepo maintained by an Expo team member. When
  in doubt, compare against this.

**Known-relevant issues:**
- [expo#33013](https://github.com/expo/expo/issues/33013) — "[Expo52] Can't build
  release or debug iOS app in a monorepo." The original bug that sent this doc
  down the rabbit hole. Specifically about iOS native builds (Xcode Shell Script
  phase), not the dev server.
- [expo#30143](https://github.com/expo/expo/issues/30143) — "Expo issues with npm
  workspaces / monorepos." Broader monorepo tracker, useful for pattern matching
  on new errors.
