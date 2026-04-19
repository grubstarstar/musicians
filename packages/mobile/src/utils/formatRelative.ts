// Formats a Date as a short relative time string (e.g. "2h ago", "3d ago").
// Kept simple on purpose — we don't need date-fns or dayjs just for this.
// Granularity thresholds:
//   < 60s   → "Xs ago"
//   < 60m   → "Xm ago"
//   < 24h   → "Xh ago"
//   otherwise → "Xd ago"
// Future dates and the exact present moment both return "just now" — the
// list surfaces "open" requests that shouldn't have future timestamps in
// normal use, but guarding against negatives keeps the output sane.
export function formatRelative(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return seconds <= 0 ? "just now" : `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
