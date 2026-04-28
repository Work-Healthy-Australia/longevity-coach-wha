import { describe, expect, it } from "vitest";
import { evaluateRepeatTests } from "@/lib/alerts/evaluate-repeat-tests";

describe("evaluateRepeatTests", () => {
  it("returns empty array when no screenings are recommended", () => {
    expect(
      evaluateRepeatTests({
        recommendedScreenings: [],
        recentLabBiomarkers: ["TSH"],
      }),
    ).toEqual([]);
  });

  it("treats a thyroid panel as covered when TSH is recent", () => {
    expect(
      evaluateRepeatTests({
        recommendedScreenings: ["thyroid panel"],
        recentLabBiomarkers: ["TSH"],
      }),
    ).toEqual([]);
  });

  it("emits an info alert for an unrelated screening like colonoscopy", () => {
    const result = evaluateRepeatTests({
      recommendedScreenings: ["colonoscopy"],
      recentLabBiomarkers: ["LDL Cholesterol"],
    });
    expect(result).toHaveLength(1);
    const [alert] = result;
    expect(alert.alert_type).toBe("repeat_test");
    expect(alert.severity).toBe("info");
    expect(alert.source_id).toBe("colonoscopy");
    expect(alert.title).toBe("You're due for colonoscopy");
    expect(alert.body).toContain("Atlas recommended colonoscopy.");
    expect(alert.link_href).toBe("/uploads");
  });

  it("treats a lipid panel as covered when LDL Cholesterol is recent", () => {
    expect(
      evaluateRepeatTests({
        recommendedScreenings: ["lipid panel"],
        recentLabBiomarkers: ["LDL Cholesterol"],
      }),
    ).toEqual([]);
  });

  it("does not false-positive via substring (thyroid keyword must be a whole token, not 'thyroglobulin')", () => {
    const result = evaluateRepeatTests({
      recommendedScreenings: ["thyroid panel"],
      recentLabBiomarkers: ["thyroglobulin"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].source_id).toBe("thyroid panel");
  });

  it("trims and lowercases the screening string before matching and dedupe", () => {
    const a = evaluateRepeatTests({
      recommendedScreenings: ["  Lipid Panel  "],
      recentLabBiomarkers: ["LDL"],
    });
    const b = evaluateRepeatTests({
      recommendedScreenings: ["lipid panel"],
      recentLabBiomarkers: ["LDL"],
    });
    expect(a).toEqual(b);
    expect(a).toEqual([]);
  });
});
