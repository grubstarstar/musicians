// MUS-92: pure helper resolving the post-create navigation target for the
// name-first create flow.
//
// Routing rules (from the ticket AC):
//   - memberMode === 'solo' → land on the entity profile WITHOUT `?new=1`,
//     because the "Add members" CTA is suppressed for solo mode (the user
//     has explicitly said "it's just me").
//   - memberMode === 'band' / 'promoterGroup' → land on the entity profile
//     WITH `?new=1` so the profile renders the "Add members" CTA. The flag
//     is a one-shot UI hint — the band/promoter-group profile screens drop
//     it on first navigation away.
//
// Kept as a pure helper (no React, no router) so it's unit-testable and so
// the routing rule lives in one place rather than being inlined in the
// mutation success handlers.

import type { EntityType, MemberMode } from './parseCreateEntityParams';

export function resolvePostCreateRoute(args: {
  entityType: EntityType;
  id: number;
  memberMode: MemberMode;
}): string {
  const base =
    args.entityType === 'band'
      ? `/band/${args.id}`
      : `/promoter-group/${args.id}`;
  return args.memberMode === 'solo' ? base : `${base}?new=1`;
}
