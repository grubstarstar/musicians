// MUS-94: onboarding resume-step derivation.
//
// The client gates the app behind onboarding by asking the server which step
// the user should resume at on launch. The server computes this from real
// state (roles + step-2 evidence rows) rather than trusting a client flag so
// the answer is consistent across devices and preserved across logouts.
//
// The business rule is: a user has "completed onboarding" once they have
// taken ANY step-2 route for ANY of their roles. Even if they later gain
// additional roles (e.g. a musician adds 'promoter' via settings in MUS-95),
// they are NOT re-gated — having progressed once is enough.
//
// The four possible steps we can resume at:
//   - `role-picker` — users.roles is empty (signup ran but no role picked).
//   - `musician`    — roles contains 'musician' and no step-2 is done.
//   - `promoter`    — roles contains 'promoter' and no step-2 is done.
//   - `complete`    — at least one step-2 route has been taken.
//
// A user with both roles and no step-2 done resumes at the step-2 of their
// FIRST role (preserves the order in which they added roles). In practice
// today only one role is present at this point since MUS-89's role-picker is
// single-pick — but we future-proof for MUS-95's multi-role-add path.

export type OnboardingStep = 'role-picker' | 'musician' | 'promoter' | 'complete';

/**
 * Per-role step-2 evidence. Each flag maps 1:1 to one of the routes listed in
 * the ticket AC:
 *   - musician:
 *       bandMemberCount >= 1          (Create / Solo / accepted Join)
 *       availableForSessionWork === true
 *       pendingBandJoinCount >= 1     (pending Join)
 *   - promoter:
 *       promoterGroupMemberCount >= 1 (Create / Solo / accepted Join)
 *       pendingPromoterGroupJoinCount >= 1 (pending Join)
 */
export interface OnboardingEvidence {
  roles: string[];
  bandMemberCount: number;
  availableForSessionWork: boolean;
  pendingBandJoinCount: number;
  promoterGroupMemberCount: number;
  pendingPromoterGroupJoinCount: number;
}

/**
 * Returns true when the user has taken ANY step-2 route across ANY of their
 * roles. This is the "is onboarding done" predicate — deliberately permissive
 * so a user who added a second role later isn't re-gated.
 */
export function hasAnyStep2Complete(evidence: OnboardingEvidence): boolean {
  return (
    evidence.bandMemberCount > 0 ||
    evidence.availableForSessionWork ||
    evidence.pendingBandJoinCount > 0 ||
    evidence.promoterGroupMemberCount > 0 ||
    evidence.pendingPromoterGroupJoinCount > 0
  );
}

/**
 * Maps a roles array to the matching step-2 route name. Returns null when
 * the roles array is empty. When both 'musician' and 'promoter' are present,
 * we pick the FIRST one in the array — the roles column is ordered by
 * insertion so the first element is the role the user picked earliest. A
 * role we don't recognise (e.g. a future 'engineer') is skipped; if no
 * recognised role is present we return null so the caller can fall back to
 * the role-picker rather than hard-crash.
 */
export function resolveStep2Route(roles: string[]): 'musician' | 'promoter' | null {
  for (const role of roles) {
    if (role === 'musician' || role === 'promoter') {
      return role;
    }
  }
  return null;
}

/**
 * Top-level derivation. Given the user's roles and the evidence counts, pick
 * the step the client should resume at. Pure — no DB, no context. Kept
 * separate from the query layer so the logic is unit-testable and the server
 * surface can change without rewriting the rule.
 */
export function resolveResumeStep(evidence: OnboardingEvidence): OnboardingStep {
  if (evidence.roles.length === 0) {
    return 'role-picker';
  }
  if (hasAnyStep2Complete(evidence)) {
    return 'complete';
  }
  const step2 = resolveStep2Route(evidence.roles);
  // No recognised role + no completion evidence — fall back to the picker so
  // the user can re-select. This protects future-us: if a user somehow winds
  // up with only an unrecognised role (data migration, bug), they land on
  // the wizard rather than a broken home screen.
  return step2 ?? 'role-picker';
}
