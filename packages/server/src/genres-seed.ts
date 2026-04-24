// MUS-103: canonical genres taxonomy.
//
// Inlined as a constant here rather than a JSON file so the build pipeline
// doesn't need to bundle a separate asset. Both the migration-time INSERT
// and the ongoing `pnpm seed` idempotent path read from this list — keeping
// one source of truth prevents drift between the two.
//
// Naming rules (be opinionated to minimise fragmentation):
//   - Use the most common international name for each genre.
//   - Lowercase, hyphenated slugs — stable identifier for URLs/clients.
//   - Title-cased display names.
//
// `sort_order` drives the canonical UI list order (smaller first). Gaps of
// 10 leave room for inserts without renumbering every row.

export interface GenreSeedRow {
  slug: string;
  name: string;
  sort_order: number;
}

export const genreSeed: GenreSeedRow[] = [
  { slug: 'rock', name: 'Rock', sort_order: 10 },
  { slug: 'pop', name: 'Pop', sort_order: 20 },
  { slug: 'jazz', name: 'Jazz', sort_order: 30 },
  { slug: 'folk', name: 'Folk', sort_order: 40 },
  { slug: 'punk', name: 'Punk', sort_order: 50 },
  { slug: 'electronic', name: 'Electronic', sort_order: 60 },
  { slug: 'hip-hop', name: 'Hip-Hop', sort_order: 70 },
  { slug: 'classical', name: 'Classical', sort_order: 80 },
  { slug: 'country', name: 'Country', sort_order: 90 },
  { slug: 'metal', name: 'Metal', sort_order: 100 },
];
