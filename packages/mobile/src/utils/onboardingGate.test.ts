import { describe, expect, it } from "vitest";
import { isWizardCompanionRoute } from "./onboardingGate";

describe("isWizardCompanionRoute", () => {
  it("allows /create-entity", () => {
    expect(isWizardCompanionRoute("/create-entity")).toBe(true);
  });

  it("rejects the home route", () => {
    expect(isWizardCompanionRoute("/")).toBe(false);
  });

  it("rejects sibling routes under (app)", () => {
    // These are inside the (app) group but aren't part of the wizard —
    // wizard-incomplete users must be bounced back to step-2 for them.
    expect(isWizardCompanionRoute("/band/42")).toBe(false);
    expect(isWizardCompanionRoute("/promoter-group/7")).toBe(false);
    expect(isWizardCompanionRoute("/post-request")).toBe(false);
    expect(isWizardCompanionRoute("/ai-chat")).toBe(false);
  });

  it("rejects strings that only superficially look like /create-entity", () => {
    // Guard against a future path like `/create-entity-foo` accidentally
    // slipping through. Equality-based matching is deliberate.
    expect(isWizardCompanionRoute("/create-entity-foo")).toBe(false);
    expect(isWizardCompanionRoute("/create-entity/")).toBe(false);
    expect(isWizardCompanionRoute("create-entity")).toBe(false);
  });
});
