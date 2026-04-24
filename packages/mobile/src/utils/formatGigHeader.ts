// MUS-104: display helpers for the mobile gig detail screen header.
//
// Pure functions only — no imports from react/expo. Keeps the screen's JSX
// readable and lets us test the formatting rules (status casing, organiser
// fallback chain, 12-hour datetime) without rendering the tree.

const SHORT_DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats a gig datetime as e.g. "Sat, May 2 · 7:30 PM". Mirrors the visual
 * language of `TimelineList` (same short-day/short-month tokens) while
 * appending the clock time — the detail screen has room for it and the AC
 * calls for a "formatted" datetime in the header.
 */
export function formatGigDatetime(d: Date): string {
  const day = SHORT_DAYS[d.getDay()];
  const month = SHORT_MONTHS[d.getMonth()];
  const date = d.getDate();

  const hour24 = d.getHours();
  const minute = d.getMinutes();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  const minuteStr = minute.toString().padStart(2, "0");

  return `${day}, ${month} ${date} · ${hour12}:${minuteStr} ${meridiem}`;
}

export type GigStatus = "draft" | "open" | "confirmed" | "cancelled";

/**
 * Title-cases the discrete gig status values the server returns. Matches the
 * `gig_status` pgEnum in `packages/server/src/schema.ts` — if a new value is
 * added there, TS will flag the exhaustiveness check below.
 */
export function formatGigStatusLabel(status: GigStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Open";
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
  }
}

/**
 * Picks the organiser's display name using the same fallback chain the band
 * members list uses (`memberDisplayName` in `band/[id].tsx`): prefer
 * `firstName lastName` when at least one is set, otherwise fall back to
 * `username`. Keeps Home + detail screens consistent.
 */
export function organiserDisplayName(organiser: {
  username: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const full = [organiser.firstName, organiser.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();
  return full || organiser.username;
}

/**
 * Human label for a slot row. The AC asks for "Set 1", "Set 2", etc. The
 * server sorts slots by `set_order` asc before returning them, and the
 * `set_order` column's zero-point is not defined at the schema level — the
 * MUS-56 seed uses 0-based, but there's no DB constraint preventing a gig
 * from storing 1-based values either. Rather than guess from the integer,
 * we pass the slot's 1-based *position in the sorted list* (zero-free, always
 * contiguous) so the UI reads "Set 1", "Set 2", ... regardless of the
 * underlying storage convention.
 */
export function formatSetLabel(position: number): string {
  return `Set ${position}`;
}
