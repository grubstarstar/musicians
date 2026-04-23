import { describe, expect, it } from 'vitest';
import { ADDABLE_ROLES, computeAddableRoles } from './computeAddableRoles';

describe('computeAddableRoles', () => {
  it('returns all addable roles when the user has none of them', () => {
    expect(computeAddableRoles([])).toEqual(['musician', 'promoter']);
  });

  it('excludes roles the user already has', () => {
    expect(computeAddableRoles(['promoter'])).toEqual(['musician']);
    expect(computeAddableRoles(['musician'])).toEqual(['promoter']);
  });

  it('returns an empty array when the user has every addable role', () => {
    expect(computeAddableRoles(['musician', 'promoter'])).toEqual([]);
  });

  it('ignores roles that are not on the addable-role master list', () => {
    // A user with, say, a legacy `venue_rep` role still sees both addable
    // roles because venue_rep isn't in ADDABLE_ROLES — it's simply "other".
    expect(computeAddableRoles(['venue_rep'])).toEqual([
      'musician',
      'promoter',
    ]);
  });

  it('preserves the declaration order from ADDABLE_ROLES', () => {
    // ADDABLE_ROLES lists musician before promoter. Even if the caller's
    // roles array is in a different order, the output must match the master
    // list's order so the picker's visual layout is stable.
    const result = computeAddableRoles([]);
    expect(result).toEqual([...ADDABLE_ROLES]);
  });

  it('returns a disjoint slice when called twice with the same input', () => {
    // Defensive check: consumers call this from React render — the helper
    // must not return the same array reference tied to an internal cache
    // that would mutate state. Confirm the returned arrays are independent
    // values even if pointing at the same declaration order.
    const a = computeAddableRoles(['musician']);
    const b = computeAddableRoles(['musician']);
    expect(a).toEqual(b);
    expect(a).toEqual(['promoter']);
  });
});
