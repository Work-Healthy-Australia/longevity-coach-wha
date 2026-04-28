import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/uploads/janet";

describe("Janet SYSTEM_PROMPT", () => {
  it("describes the biomarkers extraction field", () => {
    expect(SYSTEM_PROMPT).toContain("biomarkers");
  });

  it("instructs the model that status is computed server-side", () => {
    expect(SYSTEM_PROMPT).toContain("computed server-side");
  });
});
