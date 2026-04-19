import { describe, expect, it } from "vitest";
import {
  formatEoiStateLabel,
  formatRequestStatusLabel,
  formatUserDisplayName,
  getEoiStateColor,
  getRequestStatusColor,
} from "./eoiLabels";

describe("formatEoiStateLabel", () => {
  it("labels each EoI state", () => {
    expect(formatEoiStateLabel("pending")).toBe("Pending");
    expect(formatEoiStateLabel("accepted")).toBe("Accepted");
    expect(formatEoiStateLabel("rejected")).toBe("Rejected");
    expect(formatEoiStateLabel("auto_rejected")).toBe("Auto-rejected");
    expect(formatEoiStateLabel("withdrawn")).toBe("Withdrawn");
  });
});

describe("getEoiStateColor", () => {
  it("returns the primary accent for pending", () => {
    expect(getEoiStateColor("pending")).toBe("#6c63ff");
  });

  it("returns a green for accepted", () => {
    expect(getEoiStateColor("accepted")).toBe("#3fa66a");
  });

  it("returns a muted red for rejected and auto_rejected", () => {
    expect(getEoiStateColor("rejected")).toBe("#b04b4b");
    expect(getEoiStateColor("auto_rejected")).toBe("#b04b4b");
  });

  it("returns a neutral grey for withdrawn", () => {
    expect(getEoiStateColor("withdrawn")).toBe("#4a4a52");
  });
});

describe("formatUserDisplayName", () => {
  it("prefers a full first + last name", () => {
    expect(
      formatUserDisplayName({
        username: "ana",
        firstName: "Ana",
        lastName: "Silva",
      }),
    ).toBe("Ana Silva");
  });

  it("falls back to just the first name if last is missing", () => {
    expect(
      formatUserDisplayName({
        username: "ana",
        firstName: "Ana",
        lastName: null,
      }),
    ).toBe("Ana");
  });

  it("falls back to just the last name if first is missing", () => {
    // Consistency check: the "full" branch handles one-part names cleanly.
    expect(
      formatUserDisplayName({
        username: "silva",
        firstName: null,
        lastName: "Silva",
      }),
    ).toBe("Silva");
  });

  it("falls back to @username when no names are set", () => {
    expect(
      formatUserDisplayName({
        username: "ghost",
        firstName: null,
        lastName: null,
      }),
    ).toBe("@ghost");
  });

  it("treats blank names as missing", () => {
    expect(
      formatUserDisplayName({
        username: "ghost",
        firstName: "   ",
        lastName: "   ",
      }),
    ).toBe("@ghost");
  });
});

describe("formatRequestStatusLabel", () => {
  it("labels each status", () => {
    expect(formatRequestStatusLabel("open")).toBe("Open");
    expect(formatRequestStatusLabel("closed")).toBe("Closed");
    expect(formatRequestStatusLabel("cancelled")).toBe("Cancelled");
  });
});

describe("getRequestStatusColor", () => {
  it("returns the primary accent for open", () => {
    expect(getRequestStatusColor("open")).toBe("#6c63ff");
  });

  it("returns a green for closed", () => {
    expect(getRequestStatusColor("closed")).toBe("#3fa66a");
  });

  it("returns a neutral grey for cancelled", () => {
    expect(getRequestStatusColor("cancelled")).toBe("#4a4a52");
  });
});
