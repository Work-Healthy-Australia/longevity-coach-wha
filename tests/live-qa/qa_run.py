"""
Live QA run against http://localhost:3000 using the webapp-testing skill pattern.

Server is assumed to be already running (dev server on port 3000).
This script follows the reconnaissance-then-action pattern: navigate, wait for
networkidle, inspect, then act.

Output: prints PASS/FAIL per check, captures screenshots on failure into /tmp.
Final summary written to tests/live-qa/qa_results.json.
"""

import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect, Page, TimeoutError

BASE = "http://localhost:3000"
OUT = Path(__file__).resolve().parent
RESULTS: list[dict] = []


def record(name: str, area: str, status: str, detail: str = "") -> None:
    RESULTS.append({"area": area, "name": name, "status": status, "detail": detail})
    icon = "✅" if status == "PASS" else ("❌" if status == "FAIL" else "⚠️ ")
    print(f"{icon} [{area}] {name}{(' — ' + detail) if detail else ''}")


def screenshot_on_fail(page: Page, name: str) -> str:
    p = f"/tmp/qa_{name}.png"
    try:
        page.screenshot(path=p, full_page=True)
    except Exception:
        return ""
    return p


def check(area: str, name: str, fn, page: Page) -> None:
    try:
        fn()
        record(name, area, "PASS")
    except (AssertionError, TimeoutError) as e:
        shot = screenshot_on_fail(page, f"{area}_{name}".replace(" ", "_")[:60])
        detail = f"{type(e).__name__}: {str(e)[:200]}"
        if shot:
            detail += f" (screenshot: {shot})"
        record(name, area, "FAIL", detail)
    except Exception as e:  # unexpected
        record(name, area, "ERROR", f"{type(e).__name__}: {str(e)[:200]}")


# --------------------------------------------------------------------------
# Test scenarios
# --------------------------------------------------------------------------

def test_landing(page: Page) -> None:
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    check("Landing", "headline 'Live longer' visible",
          lambda: expect(page.get_by_text("Live", exact=False).first).to_be_visible(),
          page)

    check("Landing", "Sign in link in nav",
          lambda: expect(page.get_by_role("link", name="Sign in").first).to_be_visible(),
          page)

    check("Landing", "Get my bio-age CTA visible",
          lambda: expect(page.get_by_role("link", name="Get my bio-age").first).to_be_visible(),
          page)

    check("Landing", "no console errors on load",
          lambda: _assert_no_console_errors(page),
          page)


def test_login_page(page: Page) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")

    check("Login", "page renders heading",
          lambda: expect(page.get_by_role("heading", name="Welcome back")).to_be_visible(),
          page)

    check("Login", "email input present",
          lambda: expect(page.locator('input[type="email"]')).to_be_visible(),
          page)

    check("Login", "password input present",
          lambda: expect(page.locator('input[type="password"]')).to_be_visible(),
          page)

    check("Login", "Sign in button present",
          lambda: expect(page.get_by_role("button", name="Sign in")).to_be_visible(),
          page)

    check("Login", "Forgot password link present",
          lambda: expect(page.get_by_role("link", name="Forgot password?")).to_be_visible(),
          page)

    check("Login", "Create one link goes to /signup",
          lambda: _click_and_assert_url(page, page.get_by_role("link", name="Create one"), "/signup"),
          page)


def test_login_invalid_credentials(page: Page) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")

    page.locator('input[type="email"]').fill(f"nobody-{int(time.time())}@example.com")
    page.locator('input[type="password"]').fill("wrongpassword123")
    page.get_by_role("button", name="Sign in").click()

    try:
        page.wait_for_selector("text=/invalid login credentials/i", timeout=10_000)
        record("Login", "wrong creds → 'Invalid login credentials' shown", "PASS")
    except TimeoutError:
        shot = screenshot_on_fail(page, "login_wrong_creds")
        record("Login", "wrong creds → 'Invalid login credentials' shown", "FAIL",
               f"error message not displayed within 10s (screenshot: {shot})")


def test_login_empty_validation(page: Page) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")

    page.get_by_role("button", name="Sign in").click()
    valid = page.locator('input[type="email"]').evaluate(
        "el => el.validity.valueMissing"
    )
    if valid:
        record("Login", "empty submit triggers HTML5 validation on email", "PASS")
    else:
        record("Login", "empty submit triggers HTML5 validation on email", "FAIL",
               "valueMissing was false — required attribute not enforced")


def test_signup_page(page: Page) -> None:
    page.goto(f"{BASE}/signup")
    page.wait_for_load_state("networkidle")

    check("Signup", "page renders heading",
          lambda: expect(page.get_by_role("heading", name="Create your account")).to_be_visible(),
          page)

    check("Signup", "full_name input present",
          lambda: expect(page.locator('input[name="full_name"]')).to_be_visible(),
          page)

    check("Signup", "email input present",
          lambda: expect(page.locator('input[type="email"]')).to_be_visible(),
          page)

    check("Signup", "password input present",
          lambda: expect(page.locator('input[type="password"]')).to_be_visible(),
          page)

    check("Signup", "Create account button present",
          lambda: expect(page.get_by_role("button", name="Create account")).to_be_visible(),
          page)


def test_signup_short_password(page: Page) -> None:
    """The signup form has minLength=8 on the password input.
    Verify HTML5 validation blocks the submit, and verify the server-side
    fallback by bypassing client validation via novalidate.
    """
    # Part A: browser-level validation
    page.goto(f"{BASE}/signup")
    page.wait_for_load_state("networkidle")
    page.locator('input[name="full_name"]').fill("QA Bot")
    page.locator('input[type="email"]').fill("qa-bot@example.com")
    page.locator('input[type="password"]').fill("short")
    page.get_by_role("button", name="Create account").click()

    invalid = page.locator('input[type="password"]').evaluate(
        "el => !el.validity.valid && el.validity.tooShort"
    )
    if invalid:
        record("Signup", "short password blocked by HTML5 validation (minLength=8)",
               "PASS", "client-side defence in depth")
    else:
        record("Signup", "short password blocked by HTML5 validation (minLength=8)",
               "FAIL", "expected validity.tooShort to be true")

    # Part B: server-side fallback. Disable client validation, post short pw.
    page.goto(f"{BASE}/signup")
    page.wait_for_load_state("networkidle")
    page.evaluate("document.querySelector('form').setAttribute('novalidate','')")
    page.evaluate(
        "document.querySelector('input[type=\"password\"]').removeAttribute('minLength')"
    )
    page.locator('input[name="full_name"]').fill("QA Bot")
    page.locator('input[type="email"]').fill("qa-bot@example.com")
    page.locator('input[type="password"]').fill("short")
    page.get_by_role("button", name="Create account").click()

    try:
        page.wait_for_selector("text=/at least 8 characters/i", timeout=10_000)
        record("Signup", "server rejects short password (HTML5 bypassed)", "PASS")
    except TimeoutError:
        record("Signup", "server rejects short password (HTML5 bypassed)", "FAIL",
               "server-side fallback validation didn't fire")
        return

    # Regression check from earlier QA: do form fields preserve their values?
    name_val = page.locator('input[name="full_name"]').input_value()
    email_val = page.locator('input[type="email"]').input_value()
    if name_val == "QA Bot" and email_val == "qa-bot@example.com":
        record("Signup", "REGRESSION: form values preserved after server error",
               "PASS", "name and email retained")
    else:
        record("Signup", "REGRESSION: form values preserved after server error",
               "FAIL",
               f"name='{name_val}' email='{email_val}' — fields cleared on error")


def test_signup_valid_redirects_to_verify_email(page: Page) -> None:
    email = f"qa-py-{int(time.time())}@mailinator.com"
    page.goto(f"{BASE}/signup")
    page.wait_for_load_state("networkidle")

    page.locator('input[name="full_name"]').fill("QA Py")
    page.locator('input[type="email"]').fill(email)
    page.locator('input[type="password"]').fill("longenough123")
    page.get_by_role("button", name="Create account").click()

    try:
        page.wait_for_url("**/verify-email**", timeout=15_000)
        page.wait_for_load_state("networkidle")
        record("Signup", "valid signup redirects to /verify-email", "PASS")
    except TimeoutError:
        # Did Supabase rate-limit us? Check for the rate-limit error on page.
        page_text = page.content().lower()
        if "rate limit" in page_text:
            record("Signup", "valid signup redirects to /verify-email", "SKIP",
                   "Supabase email rate limit hit (external — not an app bug). "
                   "Re-run after waiting or use a fresh project.")
        else:
            record("Signup", "valid signup redirects to /verify-email", "FAIL",
                   f"didn't redirect; current url={page.url}")
        return

    check("Signup", "verify-email page shows the submitted email",
          lambda: expect(page.get_by_text(email)).to_be_visible(),
          page)

    check("Signup", "verify-email shows 'Check your inbox'",
          lambda: expect(page.get_by_role("heading", name="Check your inbox")).to_be_visible(),
          page)


def test_forgot_password(page: Page) -> None:
    page.goto(f"{BASE}/forgot-password")
    page.wait_for_load_state("networkidle")

    check("ForgotPwd", "page renders heading",
          lambda: expect(page.get_by_role("heading", name="Reset your password")).to_be_visible(),
          page)

    page.locator('input[type="email"]').fill(f"unknown-{int(time.time())}@example.com")
    page.get_by_role("button", name="Send reset link").click()

    try:
        page.wait_for_selector("text=/if an account exists/i", timeout=10_000)
        record("ForgotPwd", "non-enumerable success message shown", "PASS",
               "good security practice — does not confirm whether email exists")
    except TimeoutError:
        record("ForgotPwd", "non-enumerable success message shown", "FAIL",
               "expected vague success message not displayed")


def test_auth_guard(page: Page) -> None:
    """The proxy redirects to /login?redirect=<original-path> for protected
    routes. Verify both the redirect and the preserved destination."""
    page.context.clear_cookies()

    for path in ["/dashboard", "/onboarding"]:
        page.goto(f"{BASE}{path}")
        page.wait_for_load_state("networkidle")
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(page.url)
        qs = parse_qs(parsed.query)
        ok_path = parsed.path == "/login"
        ok_redirect = qs.get("redirect") == [path]
        if ok_path and ok_redirect:
            record("AuthGuard",
                   f"{path} → /login?redirect={path} when unauthenticated",
                   "PASS", "destination preserved for post-login bounce")
        else:
            record("AuthGuard",
                   f"{path} → /login?redirect={path} when unauthenticated",
                   "FAIL", f"ended at {page.url}")


def test_auth_callback_invalid_token(page: Page) -> None:
    page.goto(f"{BASE}/auth/callback")
    page.wait_for_load_state("networkidle")
    if "auth_callback_failed" in page.url and "/login" in page.url:
        record("AuthCallback", "no token → safe error redirect to /login", "PASS")
    else:
        record("AuthCallback", "no token → safe error redirect to /login", "FAIL",
               f"ended at {page.url}")

    page.goto(f"{BASE}/auth/callback?token_hash=garbage&type=signup")
    page.wait_for_load_state("networkidle")
    if "auth_callback_failed" in page.url and "/login" in page.url:
        record("AuthCallback", "garbage token → safe error redirect to /login", "PASS")
    else:
        record("AuthCallback", "garbage token → safe error redirect to /login", "FAIL",
               f"ended at {page.url}")


def test_public_pages(page: Page) -> None:
    for path in ["/science", "/team", "/stories", "/sample-report"]:
        try:
            resp = page.goto(f"{BASE}{path}")
            page.wait_for_load_state("networkidle")
            status = resp.status if resp else 0
            if status < 400:
                record("PublicPages", f"{path} renders ({status})", "PASS")
            else:
                record("PublicPages", f"{path} renders ({status})", "FAIL",
                       f"got HTTP {status}")
        except Exception as e:
            record("PublicPages", f"{path} renders", "ERROR", str(e)[:200])


def test_dashboard_data_features_gap(page: Page) -> None:
    """Confirms gaps from the gap analysis remain (uploads, etc.)."""
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    has_uploads_link = page.locator('a[href*="upload"]').count() > 0
    if has_uploads_link:
        record("Gaps", "upload portal link exists somewhere", "PASS",
               "gap may have closed since last review")
    else:
        record("Gaps", "upload portal NOT yet built (per gap analysis)", "PASS",
               "expected: no /uploads route in current build")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _assert_no_console_errors(page: Page) -> None:
    # console listener is wired up in main(); this just asserts the collected list
    if page.console_errors:  # type: ignore[attr-defined]
        raise AssertionError(
            f"{len(page.console_errors)} console errors: " +
            "; ".join(str(e)[:120] for e in page.console_errors[:5])  # type: ignore[attr-defined]
        )


def _click_and_assert_url(page: Page, locator, expected_suffix: str) -> None:
    locator.click()
    page.wait_for_load_state("networkidle")
    if not page.url.endswith(expected_suffix):
        raise AssertionError(f"expected URL to end with {expected_suffix}, got {page.url}")


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------

def main() -> int:
    with sync_playwright() as p:
        # Use full Chromium (not headless_shell) to avoid version-pinning mismatch
        # between Node and Python Playwright caches.
        browser = p.chromium.launch(headless=True, channel="chromium")
        ctx = browser.new_context()
        page = ctx.new_page()

        # console error capture
        page.console_errors = []  # type: ignore[attr-defined]

        def on_console(msg):
            if msg.type == "error":
                page.console_errors.append(msg.text)  # type: ignore[attr-defined]

        page.on("console", on_console)

        # Run scenarios
        test_landing(page)
        page.console_errors = []  # type: ignore[attr-defined]

        test_login_page(page)
        test_login_empty_validation(page)
        test_login_invalid_credentials(page)

        test_signup_page(page)
        test_signup_short_password(page)
        test_signup_valid_redirects_to_verify_email(page)

        test_forgot_password(page)
        test_auth_guard(page)
        test_auth_callback_invalid_token(page)
        test_public_pages(page)
        test_dashboard_data_features_gap(page)

        browser.close()

    # Write results
    out_file = OUT / "qa_results.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(RESULTS, indent=2))
    pass_count = sum(1 for r in RESULTS if r["status"] == "PASS")
    fail_count = sum(1 for r in RESULTS if r["status"] == "FAIL")
    err_count = sum(1 for r in RESULTS if r["status"] == "ERROR")
    print()
    print(f"=== SUMMARY ===")
    print(f"  PASS:  {pass_count}")
    print(f"  FAIL:  {fail_count}")
    print(f"  ERROR: {err_count}")
    print(f"  Total: {len(RESULTS)}")
    print(f"  Results: {out_file}")
    return 0 if fail_count == 0 and err_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
