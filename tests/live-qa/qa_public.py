"""
Non-auth QA pass — landing page, public marketing pages, navigation,
content checks. Auth flows skipped (rate-limit risk + covered by vitest).
"""

import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect, Page, TimeoutError

BASE = "http://localhost:3000"
OUT = Path(__file__).resolve().parent
RESULTS: list[dict] = []


def record(name: str, area: str, status: str, detail: str = "") -> None:
    RESULTS.append({"area": area, "name": name, "status": status, "detail": detail})
    icon = {"PASS": "✅", "FAIL": "❌", "ERROR": "💥", "WARN": "⚠️ "}.get(status, "·")
    print(f"{icon} [{area}] {name}{(' — ' + detail) if detail else ''}")


def check(area: str, name: str, fn, page: Page) -> None:
    try:
        fn()
        record(name, area, "PASS")
    except (AssertionError, TimeoutError) as e:
        record(name, area, "FAIL", f"{type(e).__name__}: {str(e)[:200]}")
    except Exception as e:
        record(name, area, "ERROR", f"{type(e).__name__}: {str(e)[:200]}")


# --------------------------------------------------------------------------
# Landing page
# --------------------------------------------------------------------------

def test_landing(page: Page) -> None:
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    check("Landing", "headline 'Live longer' visible",
          lambda: expect(page.get_by_text("Live", exact=False).first).to_be_visible(),
          page)

    check("Landing", "logo image renders",
          lambda: expect(page.locator('img[alt*="Longevity"]').first).to_be_visible(),
          page)

    check("Landing", "Sign in CTA present in nav",
          lambda: expect(page.get_by_role("link", name="Sign in").first).to_be_visible(),
          page)

    check("Landing", "primary CTA 'Get my bio-age' present",
          lambda: expect(page.get_by_role("link", name="Get my bio-age").first).to_be_visible(),
          page)

    import re
    check("Landing", "secondary CTA 'See a sample report' present",
          lambda: expect(page.get_by_role("link", name=re.compile(r"sample", re.I)).first).to_be_visible(),
          page)

    check("Landing", "trust line: 'No credit card to start'",
          lambda: expect(page.get_by_text("No credit card to start", exact=False).first).to_be_visible(),
          page)

    check("Landing", "trust line: 'GMC-registered clinicians'",
          lambda: expect(page.get_by_text("GMC-registered clinicians", exact=False).first).to_be_visible(),
          page)


def test_landing_navigation(page: Page) -> None:
    """Verify hrefs resolve to the correct routes (more deterministic than
    clicking through with race conditions on Next.js soft-nav)."""
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    # The nav 'Get my bio-age' link
    nav_cta = page.locator('nav a[href="/signup"]').first
    if nav_cta.count() > 0:
        record("Nav", "nav 'Get my bio-age' link points to /signup", "PASS")
    else:
        record("Nav", "nav 'Get my bio-age' link points to /signup", "FAIL")

    nav_signin = page.locator('nav a[href="/login"]').first
    if nav_signin.count() > 0:
        record("Nav", "nav 'Sign in' link points to /login", "PASS")
    else:
        record("Nav", "nav 'Sign in' link points to /login", "FAIL")

    # Hero CTA — actually navigates and verifies destination
    hero_cta = page.locator('a[href="/signup"]:has-text("Get my bio-age")').first
    try:
        with page.expect_navigation(url="**/signup", timeout=5_000):
            hero_cta.click()
        record("Nav", "hero 'Get my bio-age' navigates to /signup", "PASS")
    except TimeoutError:
        record("Nav", "hero 'Get my bio-age' navigates to /signup",
               "FAIL", f"ended at {page.url}")

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    sample_link = page.locator('a[href="/sample-report"]').first
    if sample_link.count() > 0:
        record("Nav", "'See a sample report' link points to /sample-report", "PASS")
    else:
        record("Nav", "'See a sample report' link points to /sample-report", "FAIL")


# --------------------------------------------------------------------------
# Public marketing pages
# --------------------------------------------------------------------------

PUBLIC_PAGES = [
    ("/science", "Science"),
    ("/team", "Team"),
    ("/stories", "Stories"),
    ("/sample-report", "Sample Report"),
]


def test_public_pages(page: Page) -> None:
    for path, label in PUBLIC_PAGES:
        try:
            resp = page.goto(f"{BASE}{path}")
            page.wait_for_load_state("networkidle")
            status = resp.status if resp else 0
            if status == 200:
                record("PublicPages", f"{label} ({path}) renders 200", "PASS")
            else:
                record("PublicPages", f"{label} ({path}) renders 200", "FAIL",
                       f"got HTTP {status}")
                continue

            # Each public page should have at least one heading and link back
            has_h = page.locator("h1, h2").count() > 0
            if has_h:
                record("PublicPages", f"{label} has at least one heading", "PASS")
            else:
                record("PublicPages", f"{label} has at least one heading", "FAIL")

            has_logo = page.locator('img[alt*="Longevity"]').count() > 0
            if has_logo:
                record("PublicPages", f"{label} renders the brand logo", "PASS")
            else:
                record("PublicPages", f"{label} renders the brand logo", "FAIL")

        except Exception as e:
            record("PublicPages", f"{label} ({path}) renders", "ERROR", str(e)[:200])


# --------------------------------------------------------------------------
# Auth pages render check (no submission — avoids rate limit)
# --------------------------------------------------------------------------

def test_auth_pages_render(page: Page) -> None:
    for path, heading_pattern in [
        ("/login", r"Welcome back"),
        ("/signup", r"Create your account"),
        ("/forgot-password", r"Reset your password"),
    ]:
        page.goto(f"{BASE}{path}")
        page.wait_for_load_state("networkidle")
        try:
            page.wait_for_selector(f"h1:has-text('{heading_pattern}'), h2:has-text('{heading_pattern}')", timeout=5_000)
            record("AuthPages", f"{path} renders heading '{heading_pattern}'", "PASS")
        except TimeoutError:
            record("AuthPages", f"{path} renders heading '{heading_pattern}'", "FAIL")


# --------------------------------------------------------------------------
# Auth guard / proxy redirect (no credentials needed)
# --------------------------------------------------------------------------

def test_auth_guard(page: Page) -> None:
    from urllib.parse import urlparse, parse_qs
    page.context.clear_cookies()

    for path in ["/dashboard", "/onboarding"]:
        page.goto(f"{BASE}{path}")
        page.wait_for_load_state("networkidle")
        parsed = urlparse(page.url)
        qs = parse_qs(parsed.query)
        if parsed.path == "/login" and qs.get("redirect") == [path]:
            record("AuthGuard",
                   f"{path} → /login?redirect={path} when unauthenticated",
                   "PASS", "destination preserved by proxy.ts for post-login bounce")
        else:
            record("AuthGuard",
                   f"{path} → /login?redirect={path}",
                   "FAIL", f"ended at {page.url}")

    page.goto(f"{BASE}/auth/callback")
    page.wait_for_load_state("networkidle")
    if "auth_callback_failed" in page.url and "/login" in page.url:
        record("AuthGuard", "/auth/callback (no token) → safe error redirect", "PASS")
    else:
        record("AuthGuard", "/auth/callback (no token) → safe error redirect",
               "FAIL", f"ended at {page.url}")


# --------------------------------------------------------------------------
# Console / network sanity
# --------------------------------------------------------------------------

def test_console_clean(page: Page) -> None:
    errors: list[str] = []
    failed_requests: list[str] = []

    def on_console(msg):
        if msg.type == "error":
            errors.append(msg.text)

    def on_failed(req):
        failed_requests.append(f"{req.method} {req.url}")

    page.on("console", on_console)
    page.on("requestfailed", on_failed)

    for path, _ in [("/", "")] + PUBLIC_PAGES:
        page.goto(f"{BASE}{path}")
        page.wait_for_load_state("networkidle")

    if not errors:
        record("Console", "no JS console errors across landing + public pages", "PASS")
    else:
        record("Console", "no JS console errors across landing + public pages",
               "FAIL", f"{len(errors)} error(s): " + "; ".join(e[:80] for e in errors[:3]))

    if not failed_requests:
        record("Network", "no failed requests across landing + public pages", "PASS")
    else:
        record("Network", "no failed requests",
               "FAIL", f"{len(failed_requests)}: " + "; ".join(failed_requests[:3]))


# --------------------------------------------------------------------------
# Static asset / SEO sanity
# --------------------------------------------------------------------------

def test_meta_and_assets(page: Page) -> None:
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    title = page.title()
    if title and "Longevity" in title:
        record("SEO", "landing page <title> contains 'Longevity'", "PASS",
               f"actual: {title}")
    else:
        record("SEO", "landing page <title> contains 'Longevity'",
               "FAIL", f"actual: {title!r}")

    favicon_status = page.evaluate("""
        async () => {
            const r = await fetch('/favicon.ico', { method: 'HEAD' });
            return r.status;
        }
    """)
    if favicon_status == 200:
        record("Assets", "/favicon.ico responds 200", "PASS")
    else:
        record("Assets", "/favicon.ico responds 200", "FAIL",
               f"status {favicon_status}")


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------

def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chromium")
        ctx = browser.new_context()
        page = ctx.new_page()

        test_landing(page)
        test_landing_navigation(page)
        test_public_pages(page)
        test_auth_pages_render(page)
        test_auth_guard(page)
        test_console_clean(page)
        test_meta_and_assets(page)

        browser.close()

    out_file = OUT / "qa_public_results.json"
    out_file.write_text(json.dumps(RESULTS, indent=2))

    pass_count = sum(1 for r in RESULTS if r["status"] == "PASS")
    fail_count = sum(1 for r in RESULTS if r["status"] == "FAIL")
    err_count = sum(1 for r in RESULTS if r["status"] == "ERROR")
    print()
    print("=== SUMMARY (non-auth QA) ===")
    print(f"  PASS:  {pass_count}")
    print(f"  FAIL:  {fail_count}")
    print(f"  ERROR: {err_count}")
    print(f"  Total: {len(RESULTS)}")
    print(f"  Results: {out_file}")
    return 0 if (fail_count + err_count) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
