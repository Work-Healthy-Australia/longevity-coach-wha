import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EmailConfirmedPage from "@/app/(auth)/email-confirmed/page";

async function renderHref(next: string | undefined): Promise<string> {
  const element = await EmailConfirmedPage({
    searchParams: Promise.resolve(next === undefined ? {} : { next }),
  });
  const html = renderToStaticMarkup(element);
  const match = html.match(/href="([^"]+)"/);
  if (!match) throw new Error("no href in rendered output");
  return match[1];
}

describe("/email-confirmed — Continue link href", () => {
  it("valid next → href is /<next>", async () => {
    expect(await renderHref("/insights")).toBe("/insights");
  });

  it("open-redirect attempt → href falls back to /dashboard", async () => {
    expect(await renderHref("//evil.com")).toBe("/dashboard");
  });

  it("auth-loop blocked (next=/login) → href falls back to /dashboard", async () => {
    expect(await renderHref("/login")).toBe("/dashboard");
  });

  it("missing next → href falls back to /dashboard", async () => {
    expect(await renderHref(undefined)).toBe("/dashboard");
  });
});
