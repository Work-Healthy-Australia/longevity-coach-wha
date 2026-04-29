# Longevity Coach — Design System

> Derived from the dashboard route (`app/(app)/dashboard/`), which is the most complete and intentional expression of the visual language. All other routes should conform to this system.

---

## Naming convention

All design-system classes use the `.lc-` prefix. Per-page root classes (`.lc-dash`, `.lc-auth`, `.lc-checkin`, etc.) scope CSS custom properties locally. This is the established pattern — do not introduce global utility classes or bare element selectors.

---

## Color tokens

Defined as CSS custom properties on each page's root scope class. The canonical values are:

### Brand

| Token | Value | Usage |
|---|---|---|
| `--lc-primary` | `#2F6F8F` | CTAs, links, focus rings, active states |
| `--lc-primary-700` | `#245672` | Hover state for primary |
| `--lc-primary-50` | `#EEF3F6` | Hover background, tinted surfaces |
| `--lc-sage` | `#6B8E83` | Secondary accent, Janet / coach identity |
| `--lc-sage-50` | `#F0F4F2` | Sage-tinted background |

### Semantic

| Token | Value | Usage |
|---|---|---|
| `--lc-success` | `#2A7A5C` | Positive states, completed indicators |
| `--lc-warning` | `#B5722F` | Attention states |
| `--lc-danger` | `#B5452F` | Error states, urgent alerts |

### Neutral

| Token | Value | Usage |
|---|---|---|
| `--lc-ink` | `#2B2B2B` | Primary text |
| `--lc-ink-soft` | `#4B4B4B` | Secondary text |
| `--lc-grey` | `#8A9AA5` | Tertiary text, labels, metadata |
| `--lc-line` | `#E3E8EC` | Borders |
| `--lc-line-soft` | `#EDF1F4` | Subtle dividers, inset backgrounds |
| `--lc-surface` | `#FFFFFF` | Card / panel background |
| `--lc-canvas` | `#FAFAF7` | Page-level warm off-white |
| `--lc-bg` | `#F4F7F9` | App shell background (set on `body`) |

### Status badge backgrounds (hardcoded, no token needed)

| Class | Background | Text |
|---|---|---|
| `.status-active` | `#D1FAE5` | `#065F46` |
| `.status-trialing` | `#DBEAFE` | `#1E40AF` |
| `.status-canceled` | `#FEE2E2` | `#991B1B` |
| `.status-past_due` | `#FEF3C7` | `#92400E` |

---

## Typography

### Fonts

Loaded in `app/layout.tsx` via `next/font/google` and exposed as CSS variables on `<html>`:

| Variable | Font | Weights | Usage |
|---|---|---|---|
| `--font-lc-serif` | NewsReader | 300, 400, 500 | Page headings, hero numbers, data values |
| `--font-lc-sans` | Instrument Sans | 400, 500, 600, 700 | All body text, UI labels, buttons |
| `--font-lc-mono` | JetBrains Mono | 400, 500 | Tier badges, pill labels, code |

Always reference these via CSS variable with a fallback:
```css
font-family: var(--font-lc-serif), Georgia, serif;
font-family: var(--font-lc-sans), system-ui, sans-serif;
font-family: var(--font-lc-mono), ui-monospace, monospace;
```

### Type scale

| Role | Size | Weight | Font | Notes |
|---|---|---|---|---|
| Page hero h1 | 30px | 400 | serif | Letter-spacing −0.01em |
| Card / section h2 | 18–22px | 400–500 | serif | Section heads use 18px |
| Large data number | 24–32px | 500 | serif | Today tiles, streak counter |
| Eyebrow / overline | 11–13px | 600 | sans | All-caps, 0.06–0.1em spacing |
| Body | 14px | 400 | sans | Line-height 1.5–1.55 |
| Small / metadata | 12–13px | 400–500 | sans | Descriptions, timestamps |
| Badge / pill | 10–11px | 500–600 | mono | All-caps, 0.06em spacing |

---

## Spacing

| Scale | Value | Usage |
|---|---|---|
| xs | 4px | Micro gaps (eyebrow → title, dot labels) |
| sm | 8–10px | Intra-component (icon → label, badge gap) |
| md | 12–14px | Tile padding, row gaps |
| lg | 16–20px | Card internal padding (smaller cards) |
| xl | 24–28px | Card internal padding (hero, full cards) |
| 2xl | 32px | Auth card padding, section padding |
| Section gap | 24px | Vertical gap between dashboard sections |
| Page padding | 24px 20px 80px | `.lc-dash` (bottom clears mobile nav) |

---

## Layout

### App shell

- Max-width: **1080px**, centred, applied on the root page container (`.lc-dash`)
- Admin max-width: **1200px** (wider for tables)
- Narrow pages (check-in, auth forms): **600px** / **400px**

### Grid patterns

| Pattern | Columns | Gap | Usage |
|---|---|---|---|
| Today strip | 4 → 2 (mobile) | 12px | Metric tiles (sleep/energy/steps/water) |
| Numbers row | 3 → 1 (mobile) | 12px | Bio-age, risk score, key stats |
| What's new | 2 → 1 (mobile) | 12px | Janet card + health update |
| Quick links | 6 → 3 → 2 (mobile) | 10px | Navigation shortcuts |
| Coming soon | 4 → 2 → 1 (mobile) | 12px | Locked feature cards |

### Responsive breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≤ 900px | 3-column grids collapse; numbers go 1-column |
| ≤ 640px | `.lc-dash` padding tightens; hero row stacks; 2-up grids go 1-up |

---

## Components

### Card

The base surface unit. Use for any grouped content block.

```css
background: var(--lc-surface);    /* #FFFFFF */
border: 1px solid var(--lc-line); /* #E3E8EC */
border-radius: 14px;
padding: 18px 20px;               /* scale up to 24px 28px for larger cards */
```

Variations:
- **Canvas card** — `background: var(--lc-canvas)` for slightly warm inset areas
- **Accent-left** — `border-left: 4px solid var(--lc-primary)` for action cards
- **Dashed** — `border: 1px dashed var(--lc-line)` for "coming soon" / placeholder sections

### Section head

Used above every major content group:

```html
<div class="lc-section-head">
  <h2>Section title</h2>
  <a class="lc-section-link" href="…">See all</a>
</div>
```

```css
/* h2 */
font-family: var(--font-lc-serif), Georgia, serif;
font-weight: 500;
font-size: 18px;
color: var(--lc-ink);
```

### Primary button / CTA

```css
background: var(--lc-primary);
color: #fff;
font-weight: 600;
font-size: 14px;
padding: 10px 18px;
border-radius: 8px;
border: none;
transition: background 0.15s;
```
Hover: `background: var(--lc-primary-700)`
Disabled: `opacity: 0.6; cursor: not-allowed`

### Form input

```css
font: inherit;
padding: 10px 12px;
border: 1px solid var(--lc-line);
border-radius: 8px;
background: #fff;
color: var(--lc-ink);
outline: none;
transition: border-color 0.15s, box-shadow 0.15s;
```
Focus: `border-color: var(--lc-primary); box-shadow: 0 0 0 3px var(--lc-primary-50)`

### Pill / tier badge

```css
font-family: var(--font-lc-mono), ui-monospace, monospace;
font-size: 10–11px;
letter-spacing: 0.06em;
text-transform: uppercase;
padding: 2px 8px;
border-radius: 999px;
font-weight: 500;
```

Tier colours (for supplement protocol):

| Tier | Background | Text |
|---|---|---|
| Critical | `#FEE2E2` | `#991B1B` |
| High | `#FEF3C7` | `#92400E` |
| Recommended | `#D1FAE5` | `#065F46` |
| Performance | `#DBEAFE` | `#1E40AF` |

### Alert chip

Three severity variants, all sharing:
- White or tinted surface
- `border-left: 4px solid <severity-colour>`
- `border-radius: 12px`
- `padding: 14px 18px`

| Variant | Left border | Background |
|---|---|---|
| Info | `--lc-sage` | `--lc-sage-50` |
| Attention | `--lc-warning` | `#FBF1E5` |
| Urgent | `--lc-danger` | `#FBE7E2` |

### Hero banner

```css
background: linear-gradient(135deg, #2F6F8F 0%, #245672 100%);
color: #fff;
border-radius: 20px;
padding: 28px 32px;
```

- H1: serif 30px, weight 400
- Eyebrow: 13px, 75% white opacity, 0.02em tracking
- Summary: 14px, 85% white opacity

### Link style

```css
color: var(--lc-primary);
text-decoration: none;
font-weight: 500;
font-size: 13px;
```
Hover: `text-decoration: underline`

---

## Animation

| Name | Duration | Usage |
|---|---|---|
| `chat-unfold` | 0.08s ease-out | Chat token reveal (globals.css) |
| `chat-dot` | 1.2s infinite | Typing indicator dots |

```css
@keyframes chat-unfold {
  from { opacity: 0; filter: blur(3px); }
  to   { opacity: 1; filter: blur(0); }
}
```

---

## Public site (marketing)

`app/(public)/` uses the same color foundation but with a heavier accent presence (`#F28C38` orange) and larger hero typography. The public pages target a marketing/sales context and intentionally diverge from the app shell in layout and density. The `--lc-primary`, `--lc-ink`, and neutral tokens are shared; the accent-orange theming is public-only.

---

## Admin shell

`app/(admin)/` uses the same primary blue (`#2F6F8F`) but with a distinct nav (`background: #2B2B2B`), a wider max-width (1200px), and a darker ink tone (`#1A3A4A`) suited to data-dense CRM views. The admin shell is intentionally a different visual context; these divergences are by design.

---

## What this system is NOT

- Not Tailwind utility classes — all styling is scoped custom CSS
- Not a component library — components are page-local `.lc-*` classes
- No design tokens file — tokens are declared inline on each page scope class
- No shared CSS import for tokens — each page redeclares the same vars (technical debt, see misalignment doc)
