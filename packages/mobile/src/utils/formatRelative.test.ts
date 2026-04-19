import { describe, it, expect } from "vitest";
import { formatRelative } from "./formatRelative";

describe("formatRelative", () => {
  const now = new Date("2026-04-19T12:00:00Z");

  it("returns 'just now' for the exact present moment", () => {
    expect(formatRelative(now, now)).toBe("just now");
  });

  it("returns 'just now' for future dates (defensive)", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(formatRelative(future, now)).toBe("just now");
  });

  it("formats seconds under a minute", () => {
    const date = new Date(now.getTime() - 30_000);
    expect(formatRelative(date, now)).toBe("30s ago");
  });

  it("formats minutes under an hour", () => {
    const date = new Date(now.getTime() - 5 * 60_000);
    expect(formatRelative(date, now)).toBe("5m ago");
  });

  it("formats the boundary at 60 seconds as 1m ago", () => {
    const date = new Date(now.getTime() - 60_000);
    expect(formatRelative(date, now)).toBe("1m ago");
  });

  it("formats hours under a day", () => {
    const date = new Date(now.getTime() - 2 * 60 * 60_000);
    expect(formatRelative(date, now)).toBe("2h ago");
  });

  it("formats the boundary at 60 minutes as 1h ago", () => {
    const date = new Date(now.getTime() - 60 * 60_000);
    expect(formatRelative(date, now)).toBe("1h ago");
  });

  it("formats days for values over 24 hours", () => {
    const date = new Date(now.getTime() - 3 * 24 * 60 * 60_000);
    expect(formatRelative(date, now)).toBe("3d ago");
  });

  it("formats the boundary at 24 hours as 1d ago", () => {
    const date = new Date(now.getTime() - 24 * 60 * 60_000);
    expect(formatRelative(date, now)).toBe("1d ago");
  });

  it("truncates fractional units (59.9s stays in seconds range)", () => {
    const date = new Date(now.getTime() - 59_900);
    expect(formatRelative(date, now)).toBe("59s ago");
  });
});
