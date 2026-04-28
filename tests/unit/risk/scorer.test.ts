import { describe, it, expect } from "vitest";
import { scoreRisk } from "@/lib/risk/scorer";
import { allFixtures } from "@/tests/fixtures/risk-profiles";

describe("scoreRisk (snapshots)", () => {
  for (const [name, patient] of Object.entries(allFixtures)) {
    it(`stable output for fixture: ${name}`, () => {
      const out = scoreRisk(patient);
      expect(JSON.stringify(out, null, 2)).toMatchSnapshot();
    });
  }

  it("lowData fixture yields confidence_level === 'insufficient'", () => {
    const out = scoreRisk(allFixtures.lowData);
    expect(out.score_confidence).toBe("insufficient");
  });

  it("pristine fixture yields high or moderate confidence", () => {
    const out = scoreRisk(allFixtures.pristine);
    expect(["high", "moderate"]).toContain(out.score_confidence);
  });
});
