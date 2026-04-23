// MUS-94: pure helpers used by the (app)/_layout.tsx onboarding gate.
//
// The gate redirects wizard-incomplete users into their resume step before
// the post-login shell mounts. A handful of routes that live inside the
// (app) segment are legitimately used as wizard continuations (today: just
// `/create-entity`), so they need an explicit allow-list — otherwise the
// user loops between step-2 and the create form.
//
// Centralising the check here keeps the layout thin and makes the rule
// unit-testable without dragging Expo Router into the test harness.

const WIZARD_COMPANION_ROUTES: readonly string[] = [
  // Name-first create flow (MUS-92). Musician / promoter step-2 push here
  // with `?entityType=...&memberMode=...`. Matches regardless of query
  // params because `usePathname()` returns the path component only.
  "/create-entity",
];

/**
 * Returns true when `pathname` is one of the routes that a pre-"complete"
 * user is allowed to render inside the (app) shell. Pathname must be the
 * expo-router `usePathname()` return value (leading slash, no query string).
 *
 * Matching is path-prefix-free: we don't want `/create-entity-foo` to
 * accidentally fall through, so we use straight equality.
 */
export function isWizardCompanionRoute(pathname: string): boolean {
  return WIZARD_COMPANION_ROUTES.includes(pathname);
}
