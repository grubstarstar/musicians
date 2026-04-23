import type { AppRouter } from "@musicians/shared";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MyEoiRequest =
  RouterOutputs["expressionsOfInterest"]["listMine"][number]["request"];

/**
 * Narrows the polymorphic request shape returned by
 * `expressionsOfInterest.listMine` into the display strings the Applied row
 * needs. Kept pure so it's easy to test every branch (musician-for-band,
 * band-for-gig-slot, and the defensive fallback for malformed rows).
 *
 * The `datetime` is formatted via an injectable `formatDate` so callers in
 * tests can pass a deterministic stub instead of `Date.toLocaleDateString`.
 */
export function deriveAppliedRowHeader(
  request: MyEoiRequest,
  formatDate: (d: Date) => string = (d) => d.toLocaleDateString(),
): {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
} {
  if (request.details.kind === "musician-for-band" && request.anchorBand) {
    return {
      title: request.anchorBand.name,
      subtitle: request.details.instrumentName ?? "Instrument",
      imageUrl: request.anchorBand.imageUrl,
    };
  }
  if (request.details.kind === "band-for-gig-slot" && request.anchorGig) {
    const when = formatDate(new Date(request.anchorGig.datetime));
    return {
      title: request.anchorGig.venue.name,
      subtitle: `Gig slot · ${when}`,
      imageUrl: null,
    };
  }
  // A request with neither anchor matching its kind is a data issue, but
  // we shouldn't crash the list over it — render a safe placeholder.
  return { title: "Untitled request", subtitle: null, imageUrl: null };
}
