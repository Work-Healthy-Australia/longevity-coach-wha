import { describe, it, expect } from "vitest";
import {
  selectLatestPerUser,
  filterAlreadyOpen,
} from "@/app/api/cron/repeat-tests/route";
import type { AlertDraft } from "@/lib/alerts";

describe("selectLatestPerUser", () => {
  it("returns one row per user, picking the latest by computed_at", () => {
    const rows = [
      { user_uuid: "u1", recommended_screenings: ["a"], computed_at: "2026-01-01T00:00:00Z" },
      { user_uuid: "u1", recommended_screenings: ["b"], computed_at: "2026-04-01T00:00:00Z" },
      { user_uuid: "u2", recommended_screenings: ["c"], computed_at: "2026-03-01T00:00:00Z" },
    ];
    const result = selectLatestPerUser(rows);
    expect(result).toHaveLength(2);
    const u1 = result.find((r) => r.user_uuid === "u1")!;
    expect(u1.recommended_screenings).toEqual(["b"]);
    const u2 = result.find((r) => r.user_uuid === "u2")!;
    expect(u2.computed_at).toBe("2026-03-01T00:00:00Z");
  });

  it("returns [] for empty input", () => {
    expect(selectLatestPerUser([])).toEqual([]);
  });
});

describe("filterAlreadyOpen", () => {
  const draft = (source_id: string): AlertDraft => ({
    alert_type: "repeat_test",
    severity: "info",
    source_id,
    title: `t-${source_id}`,
    body: `b-${source_id}`,
    link_href: "/uploads",
  });

  it("drops drafts whose source_id is already open", () => {
    const drafts = [draft("lipid panel"), draft("colonoscopy"), draft("hba1c")];
    const open = new Set(["lipid panel", "hba1c"]);
    const result = filterAlreadyOpen(drafts, open);
    expect(result).toHaveLength(1);
    expect(result[0].source_id).toBe("colonoscopy");
  });

  it("returns all drafts when none are open", () => {
    const drafts = [draft("a"), draft("b")];
    const result = filterAlreadyOpen(drafts, new Set());
    expect(result).toHaveLength(2);
  });
});
