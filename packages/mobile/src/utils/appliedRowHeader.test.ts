import { describe, expect, it } from "vitest";
import { deriveAppliedRowHeader } from "./appliedRowHeader";

// Stub the locale-dependent date formatter so the test matches independent of
// the machine running it.
const fmt = (d: Date) => d.toISOString().slice(0, 10);

describe("deriveAppliedRowHeader", () => {
  it("uses the band anchor for musician-for-band requests", () => {
    const result = deriveAppliedRowHeader(
      {
        id: 1,
        kind: "musician-for-band",
        status: "open",
        details: {
          kind: "musician-for-band",
          instrumentId: 42,
          instrumentName: "Bass",
        },
        anchorBand: { id: 7, name: "The Wavelengths", imageUrl: "x.png" },
        anchorGig: null,
      },
      fmt,
    );

    expect(result).toEqual({
      title: "The Wavelengths",
      subtitle: "Bass",
      imageUrl: "x.png",
    });
  });

  it("preserves a null band image", () => {
    const result = deriveAppliedRowHeader(
      {
        id: 1,
        kind: "musician-for-band",
        status: "open",
        details: {
          kind: "musician-for-band",
          instrumentId: 43,
          instrumentName: "Drums",
        },
        anchorBand: { id: 8, name: "No Image", imageUrl: null },
        anchorGig: null,
      },
      fmt,
    );

    expect(result.imageUrl).toBeNull();
  });

  it("uses the gig anchor for band-for-gig-slot requests", () => {
    const result = deriveAppliedRowHeader(
      {
        id: 2,
        kind: "band-for-gig-slot",
        status: "open",
        details: { kind: "band-for-gig-slot", gigId: 5 },
        anchorBand: null,
        anchorGig: {
          id: 5,
          // Serialized-over-the-wire shape: tRPC without a transformer yields
          // strings for Dates on the client; the helper normalises via
          // `new Date(...)` before handing it to the injected formatter.
          datetime: "2026-06-01T20:00:00.000Z",
          venue: { id: 11, name: "The Corner" },
        },
      },
      fmt,
    );

    expect(result).toEqual({
      title: "The Corner",
      subtitle: "Gig slot · 2026-06-01",
      imageUrl: null,
    });
  });

  it("falls back to a safe placeholder when the expected anchor is missing", () => {
    // Defensive: a musician-for-band row without a band anchor is malformed,
    // but the helper must stay crash-free.
    const result = deriveAppliedRowHeader(
      {
        id: 3,
        kind: "musician-for-band",
        status: "open",
        details: {
          kind: "musician-for-band",
          instrumentId: 44,
          instrumentName: "Vocals",
        },
        anchorBand: null,
        anchorGig: null,
      },
      fmt,
    );

    expect(result).toEqual({
      title: "Untitled request",
      subtitle: null,
      imageUrl: null,
    });
  });

  it("falls back when a gig row has no gig anchor", () => {
    const result = deriveAppliedRowHeader(
      {
        id: 4,
        kind: "band-for-gig-slot",
        status: "open",
        details: { kind: "band-for-gig-slot", gigId: 9 },
        anchorBand: null,
        anchorGig: null,
      },
      fmt,
    );

    expect(result).toEqual({
      title: "Untitled request",
      subtitle: null,
      imageUrl: null,
    });
  });
});
