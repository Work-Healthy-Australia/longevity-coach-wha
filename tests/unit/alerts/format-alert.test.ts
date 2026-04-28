import { describe, expect, it } from "vitest";
import { chipPayload } from "@/lib/alerts/format-alert";
import type { AlertDraft } from "@/lib/alerts";

describe("chipPayload", () => {
  it("maps a lab_out_of_range alert onto the chip payload", () => {
    const alert: AlertDraft = {
      alert_type: "lab_out_of_range",
      severity: "urgent",
      source_id: "Potassium",
      title: "Potassium is at a critical level",
      body: "Speak with your clinician.",
      link_href: "/labs/Potassium",
    };
    expect(chipPayload(alert)).toEqual({
      tone: "urgent",
      title: "Potassium is at a critical level",
      body: "Speak with your clinician.",
      link_href: "/labs/Potassium",
    });
  });

  it("maps a repeat_test alert and preserves a null link_href", () => {
    const alert: AlertDraft = {
      alert_type: "repeat_test",
      severity: "info",
      source_id: "colonoscopy",
      title: "You're due for colonoscopy",
      body: "Atlas recommended colonoscopy.",
      link_href: null,
    };
    expect(chipPayload(alert)).toEqual({
      tone: "info",
      title: "You're due for colonoscopy",
      body: "Atlas recommended colonoscopy.",
      link_href: null,
    });
  });
});
