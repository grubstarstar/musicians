import { describe, it, expect } from "vitest";
import {
  formatGigDatetime,
  formatGigStatusLabel,
  formatSetLabel,
  organiserDisplayName,
} from "./formatGigHeader";

describe("formatGigDatetime", () => {
  it("formats a weekday evening datetime with 12-hour clock", () => {
    // Sat 2026-05-02 19:30 local time.
    const d = new Date(2026, 4, 2, 19, 30);
    expect(formatGigDatetime(d)).toBe("Sat, May 2 · 7:30 PM");
  });

  it("zero-pads minutes", () => {
    const d = new Date(2026, 4, 2, 19, 5);
    expect(formatGigDatetime(d)).toBe("Sat, May 2 · 7:05 PM");
  });

  it("handles midnight as 12 AM", () => {
    const d = new Date(2026, 4, 2, 0, 0);
    expect(formatGigDatetime(d)).toBe("Sat, May 2 · 12:00 AM");
  });

  it("handles noon as 12 PM", () => {
    const d = new Date(2026, 4, 2, 12, 0);
    expect(formatGigDatetime(d)).toBe("Sat, May 2 · 12:00 PM");
  });

  it("formats early hours as single-digit AM", () => {
    const d = new Date(2026, 0, 4, 1, 7);
    expect(formatGigDatetime(d)).toBe("Sun, Jan 4 · 1:07 AM");
  });
});

describe("formatGigStatusLabel", () => {
  it("title-cases every enum value", () => {
    expect(formatGigStatusLabel("draft")).toBe("Draft");
    expect(formatGigStatusLabel("open")).toBe("Open");
    expect(formatGigStatusLabel("confirmed")).toBe("Confirmed");
    expect(formatGigStatusLabel("cancelled")).toBe("Cancelled");
  });
});

describe("organiserDisplayName", () => {
  it("uses first + last when both set", () => {
    expect(
      organiserDisplayName({
        username: "alice_p",
        firstName: "Alice",
        lastName: "Promoter",
      }),
    ).toBe("Alice Promoter");
  });

  it("falls back to first only when last is null", () => {
    expect(
      organiserDisplayName({
        username: "alice_p",
        firstName: "Alice",
        lastName: null,
      }),
    ).toBe("Alice");
  });

  it("falls back to last only when first is null", () => {
    expect(
      organiserDisplayName({
        username: "alice_p",
        firstName: null,
        lastName: "Promoter",
      }),
    ).toBe("Promoter");
  });

  it("falls back to username when neither name is set", () => {
    expect(
      organiserDisplayName({
        username: "alice_p",
        firstName: null,
        lastName: null,
      }),
    ).toBe("alice_p");
  });

  it("falls back to username when names are empty strings", () => {
    // Defensive: a db row could carry "" instead of null if seeded loosely.
    expect(
      organiserDisplayName({
        username: "alice_p",
        firstName: "",
        lastName: "",
      }),
    ).toBe("alice_p");
  });
});

describe("formatSetLabel", () => {
  it("renders the 1-based position as a Set label", () => {
    expect(formatSetLabel(1)).toBe("Set 1");
    expect(formatSetLabel(2)).toBe("Set 2");
    expect(formatSetLabel(10)).toBe("Set 10");
  });
});
