import { describe, expect, it } from 'vitest';
import {
  hasAnyStep2Complete,
  resolveResumeStep,
  resolveStep2Route,
  type OnboardingEvidence,
} from './resumeStep.js';

// Helper: build an evidence record with everything zeroed so each test can
// override just the bits it cares about. Keeps the test cases focused on
// the single fact they're asserting.
function evidence(overrides: Partial<OnboardingEvidence> = {}): OnboardingEvidence {
  return {
    roles: [],
    bandMemberCount: 0,
    availableForSessionWork: false,
    pendingBandJoinCount: 0,
    promoterGroupMemberCount: 0,
    pendingPromoterGroupJoinCount: 0,
    ...overrides,
  };
}

describe('hasAnyStep2Complete', () => {
  it('is false when every counter is zero', () => {
    expect(hasAnyStep2Complete(evidence())).toBe(false);
  });

  it('is true when bandMemberCount is positive', () => {
    expect(hasAnyStep2Complete(evidence({ bandMemberCount: 1 }))).toBe(true);
  });

  it('is true when availableForSessionWork is set', () => {
    expect(hasAnyStep2Complete(evidence({ availableForSessionWork: true }))).toBe(
      true,
    );
  });

  it('is true when pendingBandJoinCount is positive', () => {
    expect(hasAnyStep2Complete(evidence({ pendingBandJoinCount: 1 }))).toBe(true);
  });

  it('is true when promoterGroupMemberCount is positive', () => {
    expect(
      hasAnyStep2Complete(evidence({ promoterGroupMemberCount: 1 })),
    ).toBe(true);
  });

  it('is true when pendingPromoterGroupJoinCount is positive', () => {
    expect(
      hasAnyStep2Complete(evidence({ pendingPromoterGroupJoinCount: 1 })),
    ).toBe(true);
  });

  it('ignores roles — completion is role-agnostic', () => {
    // A user with no roles but (improbably) a band_member row is still
    // "done". The AC says ANY step-2 route counts; roles only gate which
    // step-2 to resume AT, not whether done-ness is recognised.
    expect(
      hasAnyStep2Complete(evidence({ roles: [], bandMemberCount: 1 })),
    ).toBe(true);
  });
});

describe('resolveStep2Route', () => {
  it('returns null for an empty roles array', () => {
    expect(resolveStep2Route([])).toBeNull();
  });

  it('returns musician for a musician-only user', () => {
    expect(resolveStep2Route(['musician'])).toBe('musician');
  });

  it('returns promoter for a promoter-only user', () => {
    expect(resolveStep2Route(['promoter'])).toBe('promoter');
  });

  it('picks the first recognised role when both are present', () => {
    // The onboarding role-picker is single-pick today, but MUS-95 adds
    // more roles later via settings. The test locks in the tie-breaker
    // (first role wins) so future users can trust the resume-routing
    // is deterministic.
    expect(resolveStep2Route(['musician', 'promoter'])).toBe('musician');
    expect(resolveStep2Route(['promoter', 'musician'])).toBe('promoter');
  });

  it('skips unrecognised roles and falls back to the next match', () => {
    // Future-proofing: a role like 'engineer' would land here once
    // ONBOARDING_ROLES grows. Today it should fall through to the
    // recognised role after it.
    expect(resolveStep2Route(['engineer', 'musician'])).toBe('musician');
  });

  it('returns null when no roles are recognised', () => {
    expect(resolveStep2Route(['engineer'])).toBeNull();
  });
});

describe('resolveResumeStep', () => {
  it('returns role-picker when roles is empty', () => {
    expect(resolveResumeStep(evidence())).toBe('role-picker');
  });

  it('returns musician step-2 for a musician with no step-2 evidence', () => {
    expect(resolveResumeStep(evidence({ roles: ['musician'] }))).toBe('musician');
  });

  it('returns promoter step-2 for a promoter with no step-2 evidence', () => {
    expect(resolveResumeStep(evidence({ roles: ['promoter'] }))).toBe('promoter');
  });

  it('returns complete when the musician has a band membership', () => {
    expect(
      resolveResumeStep(evidence({ roles: ['musician'], bandMemberCount: 1 })),
    ).toBe('complete');
  });

  it('returns complete when the musician is available for session work', () => {
    expect(
      resolveResumeStep(
        evidence({ roles: ['musician'], availableForSessionWork: true }),
      ),
    ).toBe('complete');
  });

  it('returns complete when the musician has a pending band_join request', () => {
    expect(
      resolveResumeStep(
        evidence({ roles: ['musician'], pendingBandJoinCount: 1 }),
      ),
    ).toBe('complete');
  });

  it('returns complete when the promoter has a group membership', () => {
    expect(
      resolveResumeStep(
        evidence({ roles: ['promoter'], promoterGroupMemberCount: 1 }),
      ),
    ).toBe('complete');
  });

  it('returns complete when the promoter has a pending promoter_group_join', () => {
    expect(
      resolveResumeStep(
        evidence({ roles: ['promoter'], pendingPromoterGroupJoinCount: 1 }),
      ),
    ).toBe('complete');
  });

  it('returns complete when ANY role has step-2 evidence (MUS-95 cross-role)', () => {
    // A user with both roles, a band (musician step-2 done), but no
    // promoter group yet, should NOT be re-gated to promoter step-2.
    // This locks in the "any step-2 route for any role" rule.
    expect(
      resolveResumeStep(
        evidence({
          roles: ['musician', 'promoter'],
          bandMemberCount: 1,
        }),
      ),
    ).toBe('complete');
  });

  it('falls back to role-picker when roles has only unrecognised entries', () => {
    // Defensive: if a future data path writes an unknown role without the
    // picker running, the user still lands somewhere sane.
    expect(resolveResumeStep(evidence({ roles: ['engineer'] }))).toBe('role-picker');
  });
});
