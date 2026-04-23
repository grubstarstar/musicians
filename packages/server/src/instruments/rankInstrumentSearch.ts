// Pure ranking helper for MUS-68 instruments autocomplete.
//
// Given the raw rows returned by the SQL ILIKE search, apply an in-memory
// ordering:
//   1. exact case-insensitive match (e.g. query "drums" → "Drums" first)
//   2. prefix match (starts with the query, case-insensitive)
//   3. contains-only match (query appears mid-string)
// Within each tier rows are sorted by category alphabetically (null last),
// then by name alphabetically — a stable order that surfaces the most
// likely candidate at the top and keeps the long tail predictable.
//
// Kept dependency-free so it can be unit-tested without a DB: the ILIKE
// filter lives in the SQL layer but the ranking rule above is ours.

export interface InstrumentRankInput {
  id: number;
  name: string;
  category: string | null;
}

export function rankInstrumentSearch<T extends InstrumentRankInput>(
  rows: T[],
  query: string,
): T[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return rows.slice().sort(compareByCategoryThenName);

  const q = trimmed.toLowerCase();

  const tiered = rows.map((row) => {
    const nameLower = row.name.toLowerCase();
    let tier = 2; // contains-only
    if (nameLower === q) tier = 0;
    else if (nameLower.startsWith(q)) tier = 1;
    return { row, tier };
  });

  tiered.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return compareByCategoryThenName(a.row, b.row);
  });

  return tiered.map((t) => t.row);
}

function compareByCategoryThenName(
  a: InstrumentRankInput,
  b: InstrumentRankInput,
): number {
  // Null categories sort last so uncategorised rows don't bubble above named
  // ones with the same name prefix.
  if (a.category === null && b.category !== null) return 1;
  if (a.category !== null && b.category === null) return -1;
  if (a.category !== null && b.category !== null && a.category !== b.category) {
    return a.category < b.category ? -1 : 1;
  }
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
