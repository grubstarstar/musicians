# Mobile App Plan

A focused roadmap to get the app moving on **mobile only** while doing the backend work that mobile depends on. Drives toward shipping the [MUS-44](https://richard-garner.atlassian.net/browse/MUS-44) Requests / Opportunities Epic on mobile as the first real product surface.

## Constraints

- **Mobile is the only client for now.** No new web work. Existing web app stays running but doesn't get features.
- **Backend work is in scope** wherever mobile depends on it.
- **Build vertically.** Don't model all of MUS-44 at once. Ship one request kind end-to-end first; let the abstractions emerge from real use.
- **Defer aggressively.** Anything not on the path to a working MUS-44 mobile slice is deferred (see § Deferred).

## Phase 1 — Foundation that unblocks MUS-44

These are hard prerequisites. Do them in this order; each unblocks the next.

1. **[MUS-1](https://richard-garner.atlassian.net/browse/MUS-1) — Move from SQLite to Postgres.** MUS-44 leans on typed JSON for `details` (per-request-kind shape), discriminated-union storage, and indexed JSON queries. Postgres is materially better here. Cheap to switch now while there's almost no data; painful later.
2. **[MUS-6](https://richard-garner.atlassian.net/browse/MUS-6) — Build out DB entities and relations.** MUS-44 needs Musicians, Promoters, Venues, and Events as first-class entities — none exist yet. This is a hard blocker. Worth checking the MUS-6 ticket scope matches what MUS-44 needs and expanding it if not.
3. **[MUS-45](https://richard-garner.atlassian.net/browse/MUS-45) — Set up tRPC + shared DTO module.** All MUS-44 procedures will live on tRPC per the API approach decision. Sets up the shared DTO module that mobile will consume.
4. **[MUS-3](https://richard-garner.atlassian.net/browse/MUS-3) — Set up STAGE env var.** Tiny; lump it in.
5. **(New ticket needed) — Mobile auth wiring.** Currently there is no auth code on mobile (no fetch, no JWT handling). HttpOnly cookies don't work the same on mobile — likely need to switch to bearer tokens stored in `expo-secure-store`, or use a cookie manager. Whichever approach, it must share the JWT verification helper on the server (per the MUS-44 hybrid coexistence rules).

## Phase 2 — Mobile ↔ backend baseline

With auth wired and tRPC live, replace mocks with real data on the existing screens. This proves the stack end-to-end before MUS-44 work starts.

6. **[MUS-33](https://richard-garner.atlassian.net/browse/MUS-33) — Connect mobile band screen to real API.** First real consumption of the tRPC client + shared DTOs from mobile. Replaces the mocked band detail data introduced in MUS-23.
7. **(New ticket needed) — Mobile form conventions.** MUS-44 will introduce many forms (request creation, EoI submission, accept/reject with notes). Settle on RHF + Zod (Zod schemas live in the shared DTO module — same schema validates client and server). Decide on the UI primitive layer (raw RN components vs NativeWind vs Tamagui vs Gluestack) — small but worth a deliberate decision before five forms accumulate.

## Phase 3 — Decompose and ship MUS-44 vertically

8. **Decompose MUS-44 into child tickets.** Suggested breakdown (one ticket each):
   - DB schema for Request, Expression of Interest, Anchor object reference
   - tRPC procedures: `requests.create`, `requests.list`, `requests.getDetail`, `requests.close`
   - tRPC procedures: `eoi.create`, `eoi.list`, `eoi.withdraw`, `eoi.accept`, `eoi.reject`
   - Anchor object integration for the first request kind (e.g. attaching to an Event)
   - Slot-count handling and auto-close on full
   - First request kind (Band-for-event-slot): kind registration, details schema, EoI details schema
   - Mobile UI: request creation form
   - Mobile UI: discovery feed (list of open requests filtered to me as a target entity)
   - Mobile UI: request detail screen with EoI list and accept/reject actions
   - Mobile UI: EoI submission form
   - Counterpart kind support (Gig-for-band) and the match rule
   - Match surfacing as suggestions in the mobile UI
9. **Ship the first vertical slice mobile-only**: one request kind, one entity type, one anchor object integration. Suggested first slice: **Band-for-event-slot** (promoter creates request → bands see it in their feed → band submits EoI → promoter accepts/rejects → slot allocated on the Event). This forces every architectural decision through real code before it has to generalise.
10. **Iterate**: add more request kinds, add the counterpart pair (Gig-for-band ↔ Band-for-event-slot), add match suggestions. Each addition should require less new infrastructure than the last — that's the test that the abstractions are right.

## Deferred (explicit, not forgotten)

- **All web migration work** ([MUS-17](https://richard-garner.atlassian.net/browse/MUS-17), [MUS-18](https://richard-garner.atlassian.net/browse/MUS-18), [MUS-19](https://richard-garner.atlassian.net/browse/MUS-19), [MUS-20](https://richard-garner.atlassian.net/browse/MUS-20), [MUS-21](https://richard-garner.atlassian.net/browse/MUS-21)) — web is paused.
- **[MUS-32](https://richard-garner.atlassian.net/browse/MUS-32) — Mobile "upload via web app" nudge** — depends on web upload flow being live. Drop or defer.
- **[MUS-2](https://richard-garner.atlassian.net/browse/MUS-2) — Zustand for global state** — only if context-based auth state becomes painful on mobile. Revisit during Phase 1 step 5.
- **[MUS-14](https://richard-garner.atlassian.net/browse/MUS-14) — E2E framework (Playwright)** — defer until the first MUS-44 slice is in users' hands. Note: Playwright is web-only; for mobile E2E we'd need Detox or Maestro. Worth re-scoping the ticket when we revisit it.
- **[MUS-16](https://richard-garner.atlassian.net/browse/MUS-16) — CI/CD** — useful once features exist that need protecting.
- **Tracks / Recording / Embeds Epics** ([MUS-24](https://richard-garner.atlassian.net/browse/MUS-24), [MUS-25](https://richard-garner.atlassian.net/browse/MUS-25), [MUS-26](https://richard-garner.atlassian.net/browse/MUS-26) and their children MUS-27–43) — orthogonal product work. Sequence by product priority, not by MUS-44 enablement. MUS-25 (Mobile Recording) is the only one of the three with mobile reach; the rest are web-flavoured.
- **Neo4j + LLM stack** ([MUS-7](https://richard-garner.atlassian.net/browse/MUS-7), [MUS-8](https://richard-garner.atlassian.net/browse/MUS-8), [MUS-9](https://richard-garner.atlassian.net/browse/MUS-9), [MUS-10](https://richard-garner.atlassian.net/browse/MUS-10), [MUS-11](https://richard-garner.atlassian.net/browse/MUS-11), [MUS-12](https://richard-garner.atlassian.net/browse/MUS-12)) — premature. Notably, [MUS-9](https://richard-garner.atlassian.net/browse/MUS-9) (Promoter matchmaking) substantially overlaps MUS-44's matching section; deliver matching in Postgres first, revisit graph-traversal queries only if relationship-traversal performance becomes a real problem.
- **[MUS-4](https://richard-garner.atlassian.net/browse/MUS-4) — Set up local stack** — depends on what "local stack" means; not on critical path. Revisit once Phase 1 is done.

## Open questions to resolve before Phase 1 starts

- **Mobile auth strategy.** HttpOnly cookies don't work cleanly in React Native — need to decide between cookie management (e.g. via `react-native-cookies`) or bearer tokens (likely cleaner, stored in `expo-secure-store`). This affects the shape of the auth helper that both REST and tRPC will share.
- **MUS-6 scope.** Does the existing ticket cover Musicians, Promoters, Venues, Events? If not, expand it (or split). MUS-44 needs all four.
- **Mobile UI primitive layer.** Raw RN components, NativeWind, Tamagui, Gluestack? Decide before forms multiply. Lightweight question; just needs answering once.

## Tickets to create

- ~~tRPC + shared DTO module setup~~ — done as [MUS-45](https://richard-garner.atlassian.net/browse/MUS-45).
- Mobile auth wiring (Phase 1, step 5).
- Mobile form conventions (Phase 2, step 7).
- MUS-44 child tickets (Phase 3, step 8).
