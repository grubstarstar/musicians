// MUS-92: shape of the response returned by `bands.create` and
// `promoterGroups.create`.
//
// The shared shape lets the mobile name-first create screen route to the
// right profile (`/band/<id>` vs `/promoter-group/<id>`) regardless of which
// procedure ran. `memberMode` is echoed back so the caller can decide whether
// to append `?new=1` (band/promoterGroup) or land directly on the profile
// (solo).

export type CreateEntityMemberMode = 'band' | 'solo' | 'promoterGroup';

export interface CreateEntityResult {
  id: number;
  memberMode: CreateEntityMemberMode;
}
