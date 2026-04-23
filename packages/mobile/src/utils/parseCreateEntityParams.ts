// MUS-92: parses the URL params handed to the name-first create screen
// into a typed shape, or `null` when the combination is invalid.
//
// Valid combinations (the four onboarding wizard branches):
//   - entityType=band, memberMode=band       — "Create a new band"
//   - entityType=band, memberMode=solo       — "I'm a solo artist"
//   - entityType=promoterGroup, memberMode=promoterGroup — "Create a promoter group"
//   - entityType=promoterGroup, memberMode=solo — "I'm a solo promoter"
//
// Anything else (mismatched memberMode, missing param, unknown value) maps
// to `null` so the screen can render a clear error rather than firing a
// mutation that the server would reject anyway.

export type EntityType = 'band' | 'promoterGroup';
export type MemberMode = 'band' | 'solo' | 'promoterGroup';

export interface CreateEntityParams {
  entityType: EntityType;
  memberMode: MemberMode;
}

const ENTITY_TYPES: ReadonlySet<EntityType> = new Set(['band', 'promoterGroup']);
const MEMBER_MODES: ReadonlySet<MemberMode> = new Set([
  'band',
  'solo',
  'promoterGroup',
]);

// Per-entity allowed memberMode values. Encoded explicitly rather than
// inferred so a future fifth onboarding branch (e.g. recording_studio) only
// has to add a row to this table to be type-safe.
const ALLOWED: Record<EntityType, ReadonlySet<MemberMode>> = {
  band: new Set(['band', 'solo']),
  promoterGroup: new Set(['promoterGroup', 'solo']),
};

export function parseCreateEntityParams(params: {
  entityType?: string | string[];
  memberMode?: string | string[];
}): CreateEntityParams | null {
  const entityType = firstString(params.entityType);
  const memberMode = firstString(params.memberMode);

  if (!entityType || !memberMode) return null;
  if (!ENTITY_TYPES.has(entityType as EntityType)) return null;
  if (!MEMBER_MODES.has(memberMode as MemberMode)) return null;

  const entity = entityType as EntityType;
  const mode = memberMode as MemberMode;

  if (!ALLOWED[entity].has(mode)) return null;

  return { entityType: entity, memberMode: mode };
}

// Expo-router's `useLocalSearchParams` types each value as `string |
// string[] | undefined` because URLs can repeat keys. We always want the
// first occurrence as a string — repeated keys are user error here.
function firstString(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  return null;
}
