# Design System Misalignment Report

**Date:** 2026-04-29  
**Reference:** `DESIGN.md` at project root  
**Source of truth:** `app/(app)/dashboard/dashboard.css`

---

## Severity legend

| Level | Meaning |
|---|---|
| **P1 — Critical** | Breaks visual consistency on a user-facing route; visible to members |
| **P2 — Moderate** | Hardcoded values that work today but will drift when tokens change |
| **P3 — Minor** | Naming/structural issues with no immediate visual impact |

---

## P1 — Critical misalignments

### 1. `app/(app)/report/report.css` — No design system at all

**Impact:** The `/report` route renders completely outside the design language.

Specific issues:

| Issue | File | Detail |
|---|---|---|
| Zero CSS custom properties | report.css | Every value is a hardcoded hex — not a single `var(--lc-*)` used anywhere |
| No `.lc-report` root scope | report.css | All classes are global bare names (`.card`, `.badge`, `.narrative`, `.section-note`) — name collisions with `admin.css` |
| Wrong ink tone | report.css | `#1a2332`, `#2c3e50`, `#4a5568` used for text — none of these are in the design system |
| Wrong grey | report.css | `#6b7c93` used as secondary text — design system grey is `#8A9AA5` |
| Wrong card radius | report.css | `.card { border-radius: 12px }` — design system uses 14px |
| Wrong success green | report.css | `.risk-optimal { color: #00875a }` — design system success is `#2A7A5C` |
| Unrecognised dark blue | report.css | `#1a4a6b` used for chat avatar bg and user bubble — not in design system |
| Duplicate animation name | report.css | `.chat-chunk` animation named `chat-token-in` (opacity only) — `globals.css` defines `chat-chunk` as `chat-unfold` (opacity + blur). Same class, different effect |
| Font family not referenced | report.css | No `var(--font-lc-serif)` or `var(--font-lc-sans)` — system fonts implied |
| `.badge` global collision | report.css:169 | `.badge` defined globally; admin.css defines its own `.badge` with different values |

---

## P2 — Moderate misalignments

### 2. `app/(app)/check-in/check-in.css` — Incomplete token set

The root scope `.lc-checkin` defines only a subset of the design system tokens. Missing tokens lead to hardcoded fallbacks.

| Issue | Line | Detail |
|---|---|---|
| Missing `--lc-success` | — | `.checkin-banner-success` uses raw `#D1FAE5` / `#065F46` instead |
| Missing `--lc-danger` | — | `.checkin-banner-error` uses raw `#FEE2E2` / `#991B1B` instead |
| Missing `--lc-canvas` | — | Not declared; `.checkin-recent-row` uses `var(--lc-line-soft)` as a workaround |
| Missing `--lc-surface` | — | Not declared |
| Missing `--lc-sage`, `--lc-sage-50` | — | Not declared (not used currently, but omission means any future Janet elements here will hardcode) |
| `.checkin-recent h2` | L82 | `font-size: 16px; font-weight: 600` using sans — should use serif at 18px per section-head pattern |

### 3. `app/(auth)/auth.css` — Token gaps and radius inconsistency

| Issue | Line | Detail |
|---|---|---|
| `--lc-error` vs `--lc-danger` | L11 | Auth defines `--lc-error: #C0392B`; dashboard/design system uses `--lc-danger: #B5452F`. Same semantic role, different name and value |
| `.auth-card border-radius` | L37 | `16px` — design system card standard is `14px` |
| `.auth-error` hardcoded | L95–101 | Uses `#FDECEA`, `#F5C6C0` directly — no token |
| `.auth-success` hardcoded | L103–110 | Uses `#E6F4EE`, `#B8DBC9` directly — no token |
| Missing `--lc-canvas`, `--lc-sage*`, `--lc-warning`, `--lc-success` | — | Subset-only token declaration (lower risk as auth pages are simple) |

### 4. `app/(admin)/admin.css` — Parallel design language

The admin shell uses the same primary blue (`#2F6F8F`) but otherwise operates on a separate token set. This is partially intentional (admin is a CRM, not a patient-facing surface), but the divergence is undocumented and uncontrolled.

| Issue | Detail |
|---|---|
| Background `#F0F4F7` | Design system bg is `#F4F7F9` — visually close but inconsistent |
| Dark text `#1A3A4A` | Not in design system — used pervasively for headings and data |
| Secondary text `#6B7C85` | Design system grey is `#8A9AA5` — different hue and lightness |
| Border `#D4E0E8` | Design system line is `#E3E8EC` — slightly darker |
| No CSS custom properties | Every value hardcoded — any token change requires a full audit |
| `.badge` global bare class | Defined at L231 with `border-radius: 4px`; report.css defines same class with `border-radius: 20px` — whichever loads last wins |
| `.status-active` / `.status-canceled` etc | Defined in admin.css — same class names as needed in the member-facing app. Currently only used in admin context but will collide if ever shared |

### 5. `app/(app)/labs/labs.css` — Unverified (flag for review)

Labs was flagged in the initial scan as 25 CSS files total; the labs CSS was not fully read. Given the pattern of partial token declarations seen in other routes, labs is likely missing the same tokens. **Recommend auditing before Phase 2 biomarker work begins.**

### 6. `app/(app)/trends/trends.css` — Unverified (flag for review)

Same caveat as labs. Trends renders charts and data grids — high risk of hardcoded colours for chart elements that bypass the token system entirely.

### 7. `app/(app)/simulator/simulator.css` — Unverified (flag for review)

Simulator uses range sliders and score visualisations. Slider thumb and track colours are frequently hardcoded in custom CSS. Flag for audit.

---

## P3 — Minor / structural issues

### 8. Token re-declaration on every page scope

Every page CSS file declares the same 8–14 CSS custom property values inside its own root class (`.lc-dash`, `.lc-auth`, `.lc-checkin`, etc.). This means:

- Token values are duplicated 10+ times across the codebase
- A color change (e.g. primary from `#2F6F8F` to a new brand value) requires editing every CSS file
- Pages can silently override tokens with wrong values — this is how `auth.css` ended up with `--lc-error` instead of `--lc-danger`

**Recommended fix:** Extract tokens to a single `:root {}` block in `globals.css`, then remove local redeclarations.

### 9. `globals.css` is nearly empty

`globals.css` currently only sets `body` background/color, defines markdown rendering classes, and imports Tailwind. It does not define any design tokens. The design system has no single canonical source of truth for tokens in code.

### 10. Missing `--lc-accent` token

The orange accent (`#F28C38`) appears in:
- `admin.css` — admin nav brand label
- `home.css` — public marketing CTAs and highlights

It is used but never declared as a token. If the brand accent changes, there is no way to find all usages.

### 11. `report.css` chat animation conflicts with `globals.css`

`globals.css` defines:
```css
.chat-chunk { animation: chat-unfold 0.08s ease-out both; }
```

`report.css` redefines:
```css
.chat-chunk { animation: chat-token-in 0.15s ease-out both; }
```

The `report.css` version wins for the report page (it loads later), but the `globals.css` definition is the intended standard. The report page's chat experience uses a simpler fade-only animation vs. the blur-fade defined in globals.

---

## File inventory by alignment status

| File | Status | Primary issue |
|---|---|---|
| `dashboard/dashboard.css` | ✅ Reference | Source of truth |
| `auth.css` | ⚠️ Moderate | Wrong error token name, card radius, hardcoded alert colours |
| `check-in.css` | ⚠️ Moderate | Incomplete token set, hardcoded semantic colours, wrong section-head h2 style |
| `onboarding.css` | 🔲 Unaudited | Large file (13.5KB) — needs review |
| `account.css` | 🔲 Unaudited | Needs review |
| `account/billing.css` | 🔲 Unaudited | Needs review |
| `labs.css` | 🔲 Unaudited | Likely partial token set; high priority before Phase 2 |
| `report.css` | 🚨 Critical | No tokens, global class names, wrong colours throughout |
| `simulator.css` | 🔲 Unaudited | Slider/chart colours likely hardcoded |
| `trends.css` | 🔲 Unaudited | Chart colours likely hardcoded |
| `uploads.css` | 🔲 Unaudited | Needs review |
| `org/members/members.css` | 🔲 Unaudited | Needs review |
| `support-fab.css` | 🔲 Unaudited | Needs review |
| `admin.css` | ⚠️ Moderate | Parallel token set — intentional divergence but uncontrolled |
| `admin/crud.css` | 🔲 Unaudited | Needs review |
| `admin/plan-builder.css` | 🔲 Unaudited | Large file (11.5KB) — needs review |
| `admin/suppliers.css` | 🔲 Unaudited | Needs review |
| `admin/tiers.css` | 🔲 Unaudited | Needs review |
| `clinician.css` | 🔲 Unaudited | Separate surface, needs review |
| `home.css` | ✅ Intentional | Public marketing — orange accent theming is by design |
| `pricing.css` | 🔲 Unaudited | Needs review |
| `legal.css` | 🔲 Unaudited | Low risk (static content) |
| `sample-report.css` | 🔲 Unaudited | Needs review |

---

## Recommended fix order

1. **Immediately** — Fix `report.css`: scope to `.lc-report`, replace all hardcoded hex with `var(--lc-*)`, align card radius to 14px, remove `.badge` and `.card` global bare selectors, normalise chat animation to `chat-unfold`.

2. **Before Phase 2 ships** — Extract all token declarations from page-scope classes into a single `:root {}` block in `globals.css`. Remove the redundant per-page redeclarations. This unblocks safe token-level rebranding.

3. **Before Phase 2 ships** — Complete the token audit on `labs.css`, `trends.css`, `simulator.css` — these are Phase 2 surfaces.

4. **Housekeeping** — Align `auth.css`: rename `--lc-error` → `--lc-danger`, align card radius to 14px, replace hardcoded alert background colours with tokens.

5. **Housekeeping** — Add `--lc-accent: #F28C38` to the design token set; replace hardcoded usages in admin nav and home.css.
