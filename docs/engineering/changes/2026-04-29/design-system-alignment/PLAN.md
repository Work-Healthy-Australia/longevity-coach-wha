# Plan: Design System Alignment
Date: 2026-04-29
Phase: Cross-cutting (technical quality, no product phase gating)
Status: Draft

## Objective

Bring all 25 CSS files into conformance with the design system documented in `DESIGN.md`. The dashboard (`app/(app)/dashboard/dashboard.css`) is the reference implementation. This is pure CSS work — no database, no server actions, no migrations, no product-phase sign-off required.

## Scope

- In scope: all CSS files that have hardcoded hex values, wrong card radii, wrong typography, missing token declarations, bare global class names, or wrong semantic token names
- In scope: adding a `:root {}` token block to `globals.css` as a canonical source
- Out of scope: changing any visual design decisions — this aligns existing styles to the already-agreed token values; no color, spacing, or typography values change
- Out of scope: admin shell visual design (admin uses intentionally different ink/grey tones — those are preserved; we only add CSS var declarations)
- Out of scope: public marketing pages (home.css, pricing.css) — different visual context, not patient-facing app shell

## Already clean (no changes needed)

- `app/(app)/dashboard/dashboard.css` — reference implementation
- `app/(app)/labs/labs.css` ✅
- `app/(app)/simulator/simulator.css` ✅
- `app/(app)/trends/trends.css` ✅
- `app/(app)/uploads/uploads.css` ✅

## Waves

---

### Wave 1 — Token Foundation (globals.css)

**What James can see after this wave merges:** Nothing visible changes. This wave establishes the `:root {}` canonical token block that subsequent waves will rely on. It is non-breaking because per-page redeclarations in the CSS cascade still shadow the root values exactly.

#### Task 1.1 — Add root token block to globals.css

Files affected:
- `app/globals.css`

What to build:
Add a `:root {}` block to `globals.css` after the `@import "tailwindcss"` line that declares all canonical design system tokens. Include all tokens used across the app, including the missing `--lc-accent`, `--lc-success-50`, `--lc-warning-50`, `--lc-danger-50` tokens.

Token set to declare:
```css
:root {
  /* Brand */
  --lc-primary: #2F6F8F;
  --lc-primary-700: #245672;
  --lc-primary-50: #EEF3F6;
  --lc-sage: #6B8E83;
  --lc-sage-50: #F0F4F2;
  --lc-accent: #F28C38;

  /* Semantic */
  --lc-success: #2A7A5C;
  --lc-success-50: #E6F4EE;
  --lc-warning: #B5722F;
  --lc-warning-50: #FAEFE0;
  --lc-danger: #B5452F;
  --lc-danger-50: #FBEAE5;

  /* Neutral */
  --lc-ink: #2B2B2B;
  --lc-ink-soft: #4B4B4B;
  --lc-grey: #8A9AA5;
  --lc-line: #E3E8EC;
  --lc-line-soft: #EDF1F4;
  --lc-surface: #FFFFFF;
  --lc-canvas: #FAFAF7;
  --lc-bg: #F4F7F9;
}
```

Acceptance criteria:
- `:root {}` block is present in `globals.css` immediately after `@import "tailwindcss"`
- All 22 tokens are declared with the exact values above
- `pnpm build` passes with no errors
- No existing visual output changes (verified by the fact that per-page scope redeclarations continue to shadow root values)

---

### Wave 2 — Fix report.css (P1 Critical)

**What James can see after this wave merges:** The `/report` page now uses the correct card radii, ink tones, font families, and the chat interface matches the rest of the app.

#### Task 2.1 — Rewrite report.css to use design system

Files affected:
- `app/(app)/report/report.css`

What to build:
Complete rewrite of `report.css`. All visual output must remain identical — only the CSS approach changes.

Rules:
1. Add a `.lc-report` root scope class that declares the full token set (same pattern as dashboard.css).
2. Scope ALL class names under `.lc-report`. No bare global class names (`.card`, `.badge`, `.narrative`, etc.)
3. Rename classes to follow `.lc-report-*` or descriptive `.lc-*` pattern scoped inside `.lc-report`.
4. Replace every hardcoded hex with the correct `var(--lc-*)` token.
5. Fix all card radii: 12px → 14px.
6. Add font family declarations using `var(--font-lc-serif)` and `var(--font-lc-sans)` where appropriate.
7. Fix chat animation: remove local `chat-token-in` keyframe; use the global `chat-unfold` animation from `globals.css` (0.08s ease-out both).
8. The `.chat-chunk` class already has a global definition in `globals.css` — do NOT redefine it in report.css. Remove the duplicate.

Color mappings for the rewrite:
- `#1a2332` (text) → `var(--lc-ink)` (#2B2B2B) — slightly different but correct
- `#2c3e50` (text) → `var(--lc-ink)` or `var(--lc-ink-soft)`
- `#4a5568` (text) → `var(--lc-ink-soft)`
- `#6b7c93` (secondary) → `var(--lc-grey)`
- `#1a4a6b` (dark blue) → `var(--lc-primary-700)` (#245672)
- `#00875a` (success/optimal) → `var(--lc-success)` (#2A7A5C)
- `#2f8f5e` (success low) → `var(--lc-success)`
- `#d97706` (moderate risk) → `var(--lc-warning)`
- `#dc6c1e` (high risk) → `#DC6C1E` — keep as hardcoded (between warning and danger, no token exists)
- `#c0392b` (critical/danger) → `var(--lc-danger)`
- `#F0F4F7` (surface tint) → `var(--lc-primary-50)` or `var(--lc-line-soft)` depending on context
- `#F8FAFB` (supplement item bg) → `var(--lc-canvas)`
- `#fef3c7` (warning note bg) → `var(--lc-warning-50)`
- `#92400e` (warning note text) → same amber, keep as inline for now
- Border `#E3E8EC` → `var(--lc-line)`

The page layout renders inside the `(app)` layout, which applies the page container. The `.lc-report` class goes on the root div of the report page — check `app/(app)/report/page.tsx` to find the root element to confirm the scope class.

Acceptance criteria:
- No bare global class names (`.card`, `.badge`, `.narrative`, `.section-note`, `.two-col`, `.muted-text`, `.pending-state` etc.)
- All classes scoped under `.lc-report`
- Card radius 14px throughout
- No local `chat-token-in` keyframe
- No local `.chat-chunk` redefinition
- `var(--lc-*)` tokens used for all colors that have a token equivalent
- Font families reference `var(--font-lc-serif)` and `var(--font-lc-sans)`
- `pnpm build` passes

---

### Wave 3 — App Member Routes: auth, check-in, onboarding, account, billing

**What James can see after this wave merges:** Auth pages, onboarding flow, check-in, account settings, and billing all render correctly with aligned card radii, consistent typography, and proper semantic colours for errors and success states.

#### Task 3.1 — Fix auth.css

Files affected:
- `app/(auth)/auth.css`

Changes:
1. Rename `--lc-error: #C0392B` → `--lc-danger: #B5452F` in the root scope declaration.
2. Add missing tokens: `--lc-success: #2A7A5C`, `--lc-success-50: #E6F4EE`, `--lc-danger-50: #FBEAE5`, `--lc-canvas: #FAFAF7`, `--lc-sage: #6B8E83`, `--lc-sage-50: #F0F4F2`, `--lc-warning: #B5722F`, `--lc-warning-50: #FAEFE0`.
3. Fix `.auth-card { border-radius: 16px }` → `14px`.
4. Replace hardcoded `.auth-error` background (`#FDECEA`) → `var(--lc-danger-50)`, border (`#F5C6C0`) → `var(--lc-danger)` at reduced opacity (keep as `#F5C6C0` or use the token), text color (`var(--lc-error)`) → `var(--lc-danger)`.
5. Replace hardcoded `.auth-success` background (`#E6F4EE`) → `var(--lc-success-50)`, border (`#B8DBC9`) → keep, text color → `var(--lc-success)`.
6. All references to `var(--lc-error)` → `var(--lc-danger)`.

Acceptance criteria:
- No `--lc-error` token anywhere in the file
- `.auth-card` has `border-radius: 14px`
- `.auth-error` and `.auth-success` use `var(--lc-danger)` and `var(--lc-success)` for text colors
- `pnpm build` passes

#### Task 3.2 — Fix check-in.css

Files affected:
- `app/(app)/check-in/check-in.css`

Changes:
1. Add missing tokens to `.lc-checkin` scope: `--lc-primary-50: #EEF3F6`, `--lc-canvas: #FAFAF7`, `--lc-surface: #FFFFFF`, `--lc-sage: #6B8E83`, `--lc-sage-50: #F0F4F2`, `--lc-success: #2A7A5C`, `--lc-warning: #B5722F`, `--lc-danger: #B5452F`.
2. Replace `.checkin-banner-success { background: #D1FAE5; color: #065F46; }` → use `--lc-success-50` bg (add token: `--lc-success-50: #E6F4EE`) and `var(--lc-success)` text. Note: `#D1FAE5` and `#E6F4EE` are both acceptable success-tinted greens — standardise on `var(--lc-success-50)` / `var(--lc-success)`.
3. Replace `.checkin-banner-error { background: #FEE2E2; color: #991B1B; }` → `--lc-danger-50` bg, `var(--lc-danger)` text (add `--lc-danger-50: #FBEAE5` to scope).
4. Fix `.checkin-recent h2`: `font-size: 16px; font-weight: 600` using implied sans → `font-family: var(--font-lc-serif), Georgia, serif; font-weight: 500; font-size: 18px` to match `.lc-section-head h2` pattern.

Acceptance criteria:
- `.lc-checkin` scope declares all tokens including success/danger
- Banner colours use `var(--lc-success)` and `var(--lc-danger)` for text
- `.checkin-recent h2` uses serif font at 18px weight 500
- `pnpm build` passes

#### Task 3.3 — Fix onboarding.css

Files affected:
- `app/(app)/onboarding/onboarding.css`

Changes:
1. Rename `--lc-error: #C0392B` → `--lc-danger: #B5452F` in `.lc-onboarding` scope.
2. Add missing tokens: `--lc-primary-50: #EEF3F6`, `--lc-canvas: #FAFAF7`, `--lc-sage: #6B8E83`, `--lc-sage-50: #F0F4F2`, `--lc-success: #2A7A5C`, `--lc-success-50: #E6F4EE`, `--lc-warning: #B5722F`, `--lc-warning-50: #FAEFE0`, `--lc-danger-50: #FBEAE5`.
3. Find all references to `var(--lc-error)` in the file and replace with `var(--lc-danger)`.
4. Find any hardcoded hex for `#C0392B` and replace with `var(--lc-danger)`.

Acceptance criteria:
- No `--lc-error` token anywhere in the file
- All error-state colours use `var(--lc-danger)`
- `pnpm build` passes

#### Task 3.4 — Fix account.css

Files affected:
- `app/(app)/account/account.css`

Changes:
1. Add missing tokens to `.lc-account` scope: `--lc-primary-50: #EEF3F6`, `--lc-line-soft: #EDF1F4`, `--lc-grey: #8A9AA5`, `--lc-canvas: #FAFAF7`, `--lc-success: #2A7A5C`, `--lc-success-50: #E6F4EE`, `--lc-warning: #B5722F`, `--lc-warning-50: #FAEFE0`, `--lc-danger: #B5452F`, `--lc-danger-50: #FBEAE5`.
2. Fix `.lc-account-card { border-radius: 12px }` → `14px`.
3. Fix `.lc-account h1`: change to `font-family: var(--font-lc-serif), Georgia, serif; font-weight: 400; font-size: 28px; color: var(--lc-ink)` (remove `color: var(--lc-primary-700)` — headings use `--lc-ink` per design system).
4. Fix `.lc-account-card h2`: change to `font-family: var(--font-lc-serif), Georgia, serif; font-weight: 500; font-size: 18px; color: var(--lc-ink)`.
5. Replace `.lc-account-error` hardcoded colours: bg `#ffefef` → `var(--lc-danger-50)`, border `#f4a4a4` → `var(--lc-danger)` (0.4 opacity inline or keep hex), text `#a02020` → `var(--lc-danger)`.
6. Replace `.lc-account-success` hardcoded colours: bg `#eaf7ee` → `var(--lc-success-50)`, border `#9bd1ad` → keep, text `#1d6e3a` → `var(--lc-success)`.
7. Replace `.lc-paused-banner` hardcoded colours: bg `#fff8e1` → `var(--lc-warning-50)`, border `#f9c74f` → keep as inline amber (no token for border specifically).
8. Replace `.lc-delete-confirm` hardcoded colours: bg `#fdf6f6` → `var(--lc-danger-50)`, border `#f4a4a4` → keep inline, heading `#a02020` → `var(--lc-danger)`.
9. Replace `.lc-delete-error` hardcoded colours same way.
10. Fix focus ring on delete input: `outline: 2px solid #f4a4a4` → `outline: 2px solid var(--lc-danger)`.
11. Remove bare `.btn-link` and `.muted` class definitions — they are too generic. Rename to `.lc-account-btn-link` and `.lc-account-muted` and check if `page.tsx` uses them (if so, update the tsx too).

Acceptance criteria:
- `.lc-account-card` has `border-radius: 14px`
- `h1` and `h2` use serif font at correct sizes
- All error/success/warning states use `var(--lc-danger)`, `var(--lc-success)`, `var(--lc-warning)` tokens
- No bare `.btn-link` or `.muted` global class (or scoped properly)
- `pnpm build` passes

#### Task 3.5 — Rewrite billing.css

Files affected:
- `app/(app)/account/billing/billing.css`

What to build:
Full rewrite of `billing.css`. Currently zero tokens, fully hardcoded, wrong card radius (10px), no font refs, global `.muted` class.

Add token declarations to `.account-billing` root scope (full set matching the rest of the app). Replace all hardcoded values with tokens. Key changes:
1. Add full token block to `.account-billing`.
2. `.billing-section { border-radius: 10px }` → `14px`; border `#e0ddd2` → `var(--lc-line)`.
3. `.billing-error` → use `var(--lc-danger-50)` bg, `var(--lc-danger)` text.
4. `.billing-section button` → use `var(--lc-primary)` bg, `var(--lc-primary-700)` hover (not `#1a1a1a`).
5. `.muted { color: #777 }` → rename `.billing-muted { color: var(--lc-grey) }` and update `page.tsx` class reference.
6. Table borders `#f3f0e5` → `var(--lc-line-soft)`.
7. Add `font-family: var(--font-lc-sans), system-ui, sans-serif` to `.account-billing`.

Acceptance criteria:
- Full token block on `.account-billing`
- Card radius 14px
- No `#1a1a1a` button (use `var(--lc-primary)`)
- No bare `.muted` global class
- `pnpm build` passes

---

### Wave 4 — Components and Org: support-fab, members

**What James can see after this wave merges:** The floating support button and org members portal use consistent colours with the rest of the app.

#### Task 4.1 — Fix support-fab.css

Files affected:
- `app/(app)/_components/support-fab.css`

Changes:
1. The `.support-fab` component renders in a global context, not inside a page scope class — so it needs its own token declarations or must rely on `:root` tokens (which will exist after Wave 1).
2. Replace `background: #2F6F8F` with `background: var(--lc-primary)`.
3. Fix hover: `background: #235872` → `background: var(--lc-primary-700)` (current value `#235872` is slightly off from the correct `#245672`).
4. Find `.support-badge` background `#e03e3e` → `var(--lc-danger)`.
5. Scan the rest of the file for any hardcoded hex values and replace with their token equivalents.

Acceptance criteria:
- `var(--lc-primary)` used for FAB background
- `var(--lc-primary-700)` used for hover
- `var(--lc-danger)` used for the notification badge
- `pnpm build` passes

#### Task 4.2 — Fix members.css

Files affected:
- `app/(app)/org/members/members.css`

Changes:
The `.hm-*` namespace is an old prefix — keep it rather than renaming (to avoid tsx changes). But add CSS custom properties.

1. Add a token block to `.hm-page` scope using the standard app tokens (not admin tokens).
2. Replace `color: #1A3A4A` (dark admin text) → `var(--lc-ink)`.
3. Replace `color: #6B7C85` (admin grey) → `var(--lc-grey)`.
4. Replace `border: 1px solid #E8EDF2` → `border: 1px solid var(--lc-line)`.
5. `.hm-card { border-radius: 10px }` → `14px`.
6. Scan remainder of file and replace hardcoded hex with tokens.

Acceptance criteria:
- Token block on `.hm-page`
- Card radius 14px
- Admin-palette `#1A3A4A`/`#6B7C85` not used
- `pnpm build` passes

---

### Wave 5 — Admin and Clinician Shells

**What James can see after this wave merges:** Admin and clinician pages are internally consistent — values that were hardcoded inline are now declared as CSS variables, making future maintenance easier. No visual change is intended.

Note: Admin intentionally uses a different visual palette (darker ink `#1A3A4A`, tighter grey `#6B7C85`, slightly cooler border `#D4E0E8`). These values are preserved as admin-specific tokens, NOT replaced with the app-shell tokens.

#### Task 5.1 — Add CSS vars to admin.css

Files affected:
- `app/(admin)/admin.css`

Changes:
1. Add an `:admin-shell` scoped token block at the top of `.admin-shell` (or as a comment-delimited block at the top of the file):
```css
.admin-shell {
  --adm-ink: #1A3A4A;
  --adm-ink-soft: #6B7C85;
  --adm-ink-muted: #9AABBA;
  --adm-line: #D4E0E8;
  --adm-line-soft: #E8EFF4;
  --adm-surface: #FFFFFF;
  --adm-bg: #F0F4F7;
  --adm-primary: #2F6F8F;        /* shared with app */
  --adm-primary-dark: #1A3A4A;
  --adm-accent: #F28C38;         /* brand orange */
  ...
}
```
2. Replace hardcoded `#1A3A4A`, `#6B7C85`, `#9AABBA`, `#D4E0E8`, `#E8EFF4`, `#2F6F8F`, `#F28C38` throughout the file with these vars.
3. Fix the `.badge` / `.status-badge` class names: prefix with `.admin-` to avoid global collision. Rename:
   - `.badge` → `.admin-tag` (generic admin badge)
   - `.status-active`, `.status-canceled`, etc. — these are fine as-is because they're inside `.admin-main` implicitly, BUT add a comment noting the collision risk.
   - Actually, check whether status classes are used anywhere outside of admin. If they're only used inside admin templates, leave them but add a scoping comment.
4. DO NOT change any visual values — this is token extraction only.

Acceptance criteria:
- `--adm-*` token variables declared on `.admin-shell`
- Hardcoded hex values replaced with vars throughout admin.css
- `pnpm build` passes
- No visual change to admin UI

#### Task 5.2 — Add CSS vars to plan-builder.css, tiers.css, suppliers.css

Files affected:
- `app/(admin)/admin/plan-builder/plan-builder.css`
- `app/(admin)/admin/tiers/tiers.css`
- `app/(admin)/admin/suppliers/suppliers.css`

For each file:
1. Read the file's root scope class and identify the primary color references.
2. Add a compact token block at the top of the root scope with the admin tokens (`--adm-primary: #2F6F8F`, `--adm-ink: #1A3A4A`, `--adm-line: #D4E0E8`, etc.).
3. Replace hardcoded hex with vars where they appear.
4. Do not change any visual values — token extraction only.

Acceptance criteria:
- Each file has a token block in its root scope
- Hardcoded hex for primary colors replaced with vars
- `pnpm build` passes

#### Task 5.3 — Fix clinician.css and add CSS vars

Files affected:
- `app/clinician/clinician.css`

The clinician shell is a separate surface (not admin, not patient app). It currently has no tokens.

Changes:
1. The clinician nav uses `background: #1a1a1a` — this is inconsistent with admin's `#2B2B2B` nav. Standardise to `#2B2B2B` (same as the admin nav) since clinician is an internal tool surface. Add a token `--clin-nav: #2B2B2B`.
2. Add a token block to `.clinician-shell`:
```css
.clinician-shell {
  --clin-primary: #2F6F8F;
  --clin-primary-700: #245672;
  --clin-nav: #2B2B2B;
  --clin-ink: #2B2B2B;
  --clin-ink-soft: #4B4B4B;
  --clin-grey: #8A9AA5;
  --clin-line: #E3E8EC;
  --clin-surface: #FFFFFF;
  --clin-canvas: #FAFAF7;
  --clin-success: #2A7A5C;
  --clin-danger: #B5452F;
}
```
3. Replace hardcoded hex values throughout with these vars.
4. The nav background: replace `#1a1a1a` → `var(--clin-nav)` (which is `#2B2B2B`). This is a minor visual nudge — the clinician nav goes from near-black to the same dark grey as admin. Acceptable.

Acceptance criteria:
- Token block on `.clinician-shell`
- Nav background uses `var(--clin-nav)`
- Hardcoded hex replaced with vars
- `pnpm build` passes
