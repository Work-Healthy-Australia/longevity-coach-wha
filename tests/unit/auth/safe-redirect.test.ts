import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/auth/safe-redirect";

describe("safeRedirect", () => {
  describe("valid same-origin paths pass through", () => {
    it("returns plain path", () => {
      expect(safeRedirect("/dashboard")).toBe("/dashboard");
    });

    it("returns path with query string", () => {
      expect(safeRedirect("/insights?tab=heart")).toBe("/insights?tab=heart");
    });

    it("returns path with hash", () => {
      expect(safeRedirect("/care-team#booking")).toBe("/care-team#booking");
    });

    it("returns nested path", () => {
      expect(safeRedirect("/account/sync")).toBe("/account/sync");
    });
  });

  describe("rejects invalid input → fallback", () => {
    it("rejects protocol-relative //", () => {
      expect(safeRedirect("//evil.com")).toBe("/dashboard");
    });

    it("rejects backslash escape /\\evil.com", () => {
      expect(safeRedirect("/\\evil.com")).toBe("/dashboard");
    });

    it("rejects absolute URL", () => {
      expect(safeRedirect("https://evil.com")).toBe("/dashboard");
    });

    it("rejects javascript: scheme", () => {
      expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
    });

    it("rejects empty string", () => {
      expect(safeRedirect("")).toBe("/dashboard");
    });

    it("rejects null", () => {
      expect(safeRedirect(null)).toBe("/dashboard");
    });

    it("rejects undefined", () => {
      expect(safeRedirect(undefined)).toBe("/dashboard");
    });

    it("rejects path without leading slash", () => {
      expect(safeRedirect("dashboard")).toBe("/dashboard");
    });
  });

  describe("auth-loop block-list", () => {
    it("blocks /login", () => {
      expect(safeRedirect("/login")).toBe("/dashboard");
    });

    it("blocks /login with query (path portion only)", () => {
      expect(safeRedirect("/login?next=/foo")).toBe("/dashboard");
    });

    it("blocks /signup", () => {
      expect(safeRedirect("/signup")).toBe("/dashboard");
    });

    it("blocks /forgot-password", () => {
      expect(safeRedirect("/forgot-password")).toBe("/dashboard");
    });

    it("blocks /reset-password", () => {
      expect(safeRedirect("/reset-password")).toBe("/dashboard");
    });

    it("blocks /verify-email", () => {
      expect(safeRedirect("/verify-email")).toBe("/dashboard");
    });

    it("blocks /auth/callback even with query", () => {
      expect(safeRedirect("/auth/callback?code=x")).toBe("/dashboard");
    });
  });

  describe("control characters rejected (CRLF / header injection)", () => {
    it("rejects CRLF", () => {
      expect(safeRedirect("/insights\r\nSet-Cookie: x=y")).toBe("/dashboard");
    });

    it("rejects bare LF", () => {
      expect(safeRedirect("/insights\n")).toBe("/dashboard");
    });

    it("rejects tab", () => {
      expect(safeRedirect("/insights\t")).toBe("/dashboard");
    });

    it("rejects DEL (0x7f)", () => {
      expect(safeRedirect("/insights\x7f")).toBe("/dashboard");
    });

    it("rejects null byte (0x00)", () => {
      expect(safeRedirect("/insights\x00")).toBe("/dashboard");
    });
  });

  describe("custom fallback", () => {
    it("honours custom fallback when target invalid", () => {
      expect(safeRedirect(null, "/onboarding")).toBe("/onboarding");
    });

    it("honours custom fallback for blocked auth route", () => {
      expect(safeRedirect("/login", "/onboarding")).toBe("/onboarding");
    });

    it("ignores fallback when target valid", () => {
      expect(safeRedirect("/insights", "/onboarding")).toBe("/insights");
    });
  });
});
