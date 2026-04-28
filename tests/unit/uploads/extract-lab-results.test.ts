import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractLabResults } from "@/lib/uploads/persist-lab-results";
import {
  BLOOD_WORK_TWO_BIOMARKERS,
  BLOOD_WORK_NO_BIOMARKERS,
  IMAGING,
  BLOOD_WORK_CRITICAL,
  BLOOD_WORK_NAN_VALUE,
  BLOOD_WORK_ZERO_VALUE,
  BLOOD_WORK_TEST_DATE_FROM_FINDINGS,
  BLOOD_WORK_NO_DATE,
} from "@/tests/fixtures/janet-results";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const UPLOAD_ID = "00000000-0000-0000-0000-000000000002";

describe("extractLabResults", () => {
  it("returns [] for imaging category", () => {
    expect(extractLabResults(IMAGING, USER_ID, UPLOAD_ID)).toEqual([]);
  });

  it("returns [] when blood_work has no biomarkers", () => {
    expect(extractLabResults(BLOOD_WORK_NO_BIOMARKERS, USER_ID, UPLOAD_ID)).toEqual([]);
  });

  it("produces one row per valid biomarker with derived status", () => {
    const rows = extractLabResults(BLOOD_WORK_TWO_BIOMARKERS, USER_ID, UPLOAD_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0].biomarker).toBe("HDL Cholesterol");
    expect(rows[0].status).toBe("optimal");
    expect(rows[0].user_uuid).toBe(USER_ID);
    expect(rows[0].upload_id).toBe(UPLOAD_ID);
    expect(rows[0].test_date).toBe("2026-04-28");
    expect(rows[0].panel_name).toBe("Lipid Panel");
    expect(rows[0].optimal_min).toBeNull();
    expect(rows[0].category).toBeNull();
    expect(rows[1].biomarker).toBe("LDL Cholesterol");
    expect(rows[1].status).toBe("high");
  });

  it("skips biomarkers with NaN value", () => {
    const rows = extractLabResults(BLOOD_WORK_NAN_VALUE, USER_ID, UPLOAD_ID);
    expect(rows).toEqual([]);
  });

  it("keeps biomarkers with value === 0 (legitimate detection-limit reading)", () => {
    const rows = extractLabResults(BLOOD_WORK_ZERO_VALUE, USER_ID, UPLOAD_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(0);
    expect(rows[0].status).toBe("optimal");
  });

  it("falls back to findings.date_of_test when biomarker test_date is null", () => {
    const rows = extractLabResults(BLOOD_WORK_TEST_DATE_FROM_FINDINGS, USER_ID, UPLOAD_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].test_date).toBe("2026-01-15");
  });

  describe("with mocked clock", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-28T10:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("falls back to today's UTC date when no date is available", () => {
      const rows = extractLabResults(BLOOD_WORK_NO_DATE, USER_ID, UPLOAD_ID);
      expect(rows).toHaveLength(1);
      expect(rows[0].test_date).toBe("2026-04-28");
    });
  });

  it("derives 'critical' status correctly", () => {
    const rows = extractLabResults(BLOOD_WORK_CRITICAL, USER_ID, UPLOAD_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("critical");
  });
});
