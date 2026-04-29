# Pricing System — UI/UX & API Design
**Date:** 2026-04-29
**Status:** Draft
**Relates to:** `feature-proposal.md`, `database-design.md`

---

## User journeys

### Journey 1 — Standalone user (B2C)
```
/pricing page → compare Core / Clinical / Elite
                    → select tier + billing interval (monthly / annual)
                    → pick add-ons from live product catalog (optional)
                    → order summary → Stripe checkout
                                           → success → /dashboard

/account/billing → view current tier + renewal date
                 → manage recurring add-ons (add / remove)
                 → order a one-time test (DEXA, blood panel, etc.)
                 → view order history
```

### Journey 2 — Employer / Health Manager (B2B)
```
Admin creates B2B plan → selects Core / Clinical / Elite seat counts
                             → sets contract terms + annual discount
                             → activates plan → org goes live

Health Manager logs in → /employer dashboard
                              → sees tier allocation breakdown + live cost
                              → invites employees + assigns tier
                              → employees access features for their tier
```

### Journey 3 — Platform Admin (back-office)
```
/admin/tiers         → Core / Clinical / Elite tier cards
                          → expand to edit pricing, inclusions, feature flags, margin

/admin/suppliers     → supplier directory
                          → expand supplier row → full contact/billing/contract detail
                                              → nested products table for that supplier
                                              → + Add Product button per supplier

/admin/plan-builder  → B2B only
                          → select org, set Core/Clinical/Elite seat allocations
                          → configure contract terms + negotiated annual discount
                          → review/approve suspicious seat change flags
```

---

## Screen Designs (wireframes)

---

### Screen 1 — Public Pricing Page `/pricing`

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Janet                                          [Login]  [Get Started]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                     Choose your plan                                      │
│                                                                           │
│                [  Monthly  |  Annual  Save 20%  ]                        │
│                                                                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │
│  │      Core       │  │    Clinical      │  │        Elite          │   │
│  │─────────────────│  │──────────────────│  │───────────────────────│   │
│  │   $XX / mo      │  │   $YY / mo       │  │     $ZZ / mo          │   │
│  │ $XXX billed/yr  │  │ $YYY billed/yr   │  │   $ZZZ billed/yr      │   │
│  │─────────────────│  │──────────────────│  │───────────────────────│   │
│  │ ✓ Janet AI Coach│  │ ✓ All Core       │  │ ✓ All Clinical        │   │
│  │ ✓ Monthly check-│  │ ✓ Human coaching │  │ ✓ DEXA scan (1/yr)    │   │
│  │   in            │  │   session (1/mo) │  │ ✓ Full blood panel    │   │
│  │ ✓ Health risk   │  │ ✓ GP review      │  │   (1/yr)              │   │
│  │   report        │  │   coordination   │  │ ✓ Genomics analysis   │   │
│  │ ✓ Supplement    │  │ ✓ Advanced risk  │  │ ✓ Elite coaching      │   │
│  │   protocol      │  │   report         │  │   (2/mo)              │   │
│  │ ✓ PDF export    │  │ ✓ PDF export     │  │ ✓ Priority access     │   │
│  │                 │  │                  │  │                       │   │
│  │  [Get started]  │  │  [Get started]   │  │    [Get started]      │   │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘   │
│                                                                           │
│  ─── Available Add-ons  (not included in your selected tier) ─────────  │
│                                                                           │
│  [ ] DEXA Scan — HealthPath Labs         $350  one-time  [+ Add]        │
│  [ ] Full Blood Panel — HealthPath Labs  $120  one-time  [+ Add]        │
│  [ ] Genetic Test — GenomicsCo           $499  one-time  [+ Add]        │
│  [ ] Monthly Supplement Delivery         +$45/mo         [+ Add]        │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│  Estimated total:  $XX / mo      [Continue to checkout →]               │
│  (updates live as tier and add-ons are selected)                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Monthly/Annual toggle recalculates all tier prices and the running total. Annual price read from `plans.annual_price_cents` (pre-stored).
- Inclusions list is rendered from `tier_inclusions` where `is_visible_to_customer = true`.
- Add-ons section shows `products WHERE is_active = true` filtered to exclude products already in the selected tier's `tier_inclusions`.
- Add-ons greyed out if tier's `min_tier` requirement is not met.
- "Continue to checkout" carries `plan_id` + `selected_product_ids[]` + `billing_interval`.

---

### Screen 2 — Checkout `/checkout`

```
┌──────────────────────────────────────────────────────────────────┐
│  Your order summary                                               │
│                                                                   │
│  Plan:       Clinical (Annual)         $YYY / yr                 │
│  Add-on:     Monthly Supplement Delivery  $45 × 12 = $540 / yr   │
│  ─────────────────────────────────────────────────────────────── │
│  Total today:                               $TOTAL / yr          │
│  (Billed annually. Cancel any time.)                              │
│                                                                   │
│  ── Stripe Checkout ────────────────────────────────────────────  │
│  (Stripe Elements embedded here)                                  │
│                                                                   │
│  [← Back to plans]                [Pay $TOTAL and start →]       │
└──────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Summary rendered server-side from DB — `plan_id` + `product_ids[]` validated against live plans/products. Query params are untrusted.
- Stripe checkout session created server-side: base plan price + recurring add-on prices as subscription items.
- On `checkout.session.completed`: webhook writes `subscriptions` row + `subscription_addons` rows (one per recurring product).

---

### Screen 3 — Account / Billing `/account/billing`

```
┌──────────────────────────────────────────────────────────────────┐
│  Billing & Add-ons                                                │
│                                                                   │
│  Current plan:   Clinical (Annual)                                │
│  Renews:         2027-04-29                                       │
│  [Upgrade plan]  [Cancel subscription]                            │
│                                                                   │
│  ─── Active Add-ons (recurring) ────────────────────────────────  │
│                                                                   │
│  ✓ Monthly Supplement Delivery   $45/mo    [Remove]              │
│                                                                   │
│  ─── Available Add-ons ─────────────────────────────────────────  │
│  (products not included in your Clinical tier)                    │
│                                                                   │
│  + DEXA Scan               $350  one-time  [Order]               │
│  + Full Blood Panel        $120  one-time  [Order]               │
│  + Genetic Test            $499  one-time  [Order]               │
│  + Monthly PT Session      +$99/mo         [Add]                 │
│                                                                   │
│  ─── Order History ─────────────────────────────────────────────  │
│                                                                   │
│  2026-03-12   Full Blood Panel    $120   ✓ Completed             │
│  2025-11-04   DEXA Scan           $350   ✓ Completed             │
└──────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Active add-ons: `subscription_addons WHERE user_uuid = current AND status = 'active'` joined to `products`.
- Available add-ons: `products WHERE is_active = true` minus products already in `tier_inclusions` for the user's tier.
- [Remove] → `DELETE /api/subscription/addons/:id` → Stripe subscription item delete → row marked `cancelled`.
- [Add] for recurring → `POST /api/subscription/addons` → Stripe subscription item create → `subscription_addons` row.
- [Order] for one-time → confirmation modal → `POST /api/test-orders` → Stripe payment intent.

---

### Screen 4 — Health Manager Dashboard `/employer`

```
┌──────────────────────────────────────────────────────────────────┐
│  Acme Corp — Health Package              Health Manager view      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ─── Plan Breakdown ────────────────────────────────────────────  │
│                                                                   │
│  Tier        Seats    $/seat/mo   Monthly cost                   │
│  ──────────────────────────────────────────────────────────────  │
│  Core          80      $XX         $X,XXX                        │
│  Clinical      15      $YY         $X,XXX                        │
│  Elite          5      $ZZ         $X,XXX                        │
│  ─────────────────────────────────────────────────────────────── │
│  Total monthly                     $XX,XXX                       │
│  Annual (20% discount)             $XXX,XXX / yr                 │
│                                                                   │
│  Contract:  2026-05-01 → 2027-04-30  |  Status: Active           │
│                                                                   │
│  ─── Employees ─────────────────────────────────────────────────  │
│                                                                   │
│  [+ Invite employee]   [Import CSV]   Search: [______________]   │
│                                                                   │
│  Name           Email                Tier       Role      Status │
│  ──────────────────────────────────────────────────────────────  │
│  Jane Smith     jane@acme.com        Clinical   Member    Active │
│  Bob Lee        bob@acme.com         Core       Manager   Active │
│  Sarah Chen     sarah@acme.com       Elite      Member    Active │
│  Tom Wells      tom@acme.com         Core       Member    Invited│
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Plan breakdown reads from `b2b_plan_tier_allocations` joined to `plans` for pricing.
- Monthly cost = `sum(tier.base_price_cents × allocation.seat_count)` across all rows.
- Annual cost applies `b2b_plans.negotiated_discount_pct`.
- Employee list from `organisation_members` joined to `b2b_plan_tier_allocations` for tier label.
- Invite → `POST /api/org/invites` with `{ email, role, tier_allocation_id }`.

---

### Screen 5 — Admin Plan Builder `/admin/plan-builder`

Top-level page. Four collapsible sections, no sub-tabs.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Plan Builder                                                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ▼ Tiers  ─────────────────────────────────────────────────────────  │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Core           │  │  Clinical        │  │  Elite           │    │
│  │  $XX/mo         │  │  $YY/mo          │  │  $ZZ/mo          │    │
│  │  8 inclusions   │  │  12 inclusions   │  │  16 inclusions   │    │
│  │  Active ●       │  │  Active ●        │  │  Active ●        │    │
│  │  [Edit tier]    │  │  [Edit tier]     │  │  [Edit tier]     │    │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                       │
│  ▶ Janet Services  ─────────────────────────────────────────────────  │
│  ▶ Suppliers  ──────────────────────────────────────────────────────  │
│  ▶ Products  ───────────────────────────────────────────────────────  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Each section collapses/expands. All four are on the same page — no navigation away.
- "Edit tier" opens the Tier Editor inline (Screen 6).

---

### Screen 6 — Tier Editor (inline expansion of a tier card)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Clinical  ─ Tier Editor                             [Save]  [Cancel] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── Pricing ───────────────────────────────────────────────────────  │
│                                                                       │
│  Name:               [Clinical__________]                            │
│  Monthly price:      [$  ___________]  AUD                          │
│  Annual discount:    [20___]  %                                      │
│  Annual price:       $YYY / yr  (read-only — auto-calculated)        │
│  Setup fee:          [$  ___________]                                │
│  Min. commitment:    [12___]  months                                 │
│  Public description: [___________________________________]           │
│                                                                       │
│  ── Included Janet Services ───────────────────────────────────────  │
│                                                                       │
│  Service                        Qty  Frequency   Wholesale  Retail   │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Janet AI Coach Access         1    monthly     $0        $0       │
│  ✓ Monthly AI Check-in           1    monthly     $0        $0       │
│  ✓ Human Coaching Session        1    monthly     $XX       $YY      │
│  ✓ GP Review Coordination        1    quarterly   $XX       $YY      │
│  ✓ Advanced Risk Report          1    annually    $XX       $YY      │
│  ○ Onboarding                    —    —            —         —       │
│  ○ Corporate Dashboard Access    —    —            —         —       │
│                          [+ Add service]                              │
│                                                                       │
│  ── Included Supplier Products ────────────────────────────────────  │
│                                                                       │
│  Product                Supplier        Qty  Freq    Wholesale Retail│
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Full Blood Panel     HealthPath       1   annually  $65     $120  │
│  ○ DEXA Scan            HealthPath       —   —          —       —    │
│  ○ Genetic Test         GenomicsCo       —   —          —       —    │
│                          [+ Add product]                              │
│                                                                       │
│  ── Feature Flags (software access) ──────────────────────────────   │
│                                                                       │
│  ✓ PDF Export           ✓ Advanced Risk Report                       │
│  ○ Genome Access        ○ DEXA Ordering                              │
│                                                                       │
│  ── Margin Summary (live) ─────────────────────────────────────────  │
│                                                                       │
│  Total wholesale cost / mo:    $XXX                                  │
│  Total retail value / mo:      $YYY                                  │
│  Monthly price:                $ZZZ                                  │
│  Gross margin:                 $MMM  (MM%)                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Annual price field is read-only — recomputes on every keystroke in monthly price or discount fields.
- Janet Services and Supplier Products show all active options; checkboxes add/remove `tier_inclusions` rows.
- Checking a service/product opens an inline quantity + frequency picker.
- Wholesale/retail columns snapshot from the source record on save.
- Margin summary recalculates live as inclusions change.
- [Save] → `PUT /api/admin/plans/:id` + bulk upsert of `tier_inclusions`.

---

### Screen 7 — Janet Services Section (expanded)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▼ Janet Services                          [+ Add Service]           │
│                                                                       │
│  Name                        Unit         Internal $  Retail $  Status│
│  ──────────────────────────────────────────────────────────────────  │
│  Janet AI Coach Access        per_month    $0          $0       Active│
│  Monthly AI Check-in          per_month    $0          $0       Active│
│  Human Health Check-in        per_session  $XX         $YY      Active│
│  Health Coaching Session      per_session  $XX         $YY      Active│
│  GP Review Coordination       per_session  $XX         $YY      Active│
│  Health Risk Report           once_off     $XX         $YY      Active│
│  Advanced Risk Report         once_off     $XX         $YY      Active│
│  Corporate Dashboard Access   per_month    $0          $0       Active│
│  Onboarding                   once_off     $XX         $YY      Active│
│  Employer Cohort Reporting    per_month    $XX         $YY      Active│
│                                                               [Edit]  │
└──────────────────────────────────────────────────────────────────────┘

Add / Edit Service panel (slide-in):
┌──────────────────────────────────────────────┐
│  Service name:       [____________________]  │
│  Description:        [____________________]  │
│  Unit type:          [per_month ▾]           │
│  Internal cost ($):  [____________________]  │
│  Retail value ($):   [____________________]  │
│  Delivery owner:     [Janet AI ▾]            │
│  Internal notes:     [____________________]  │
│  Status:             [Active ▾]              │
│                      [Cancel]  [Save]        │
└──────────────────────────────────────────────┘
```

---

### Screen 8 — Suppliers Section (expanded)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▼ Suppliers                                  [+ Add Supplier]       │
│                                                                       │
│  Name              Type         ABN        Products  Status  Actions │
│  ──────────────────────────────────────────────────────────────────  │
│  HealthPath Labs   Pathology    51 xxx xxx   8        Active  [Edit] │
│  GenomicsCo        Genomics     83 xxx xxx   3        Active  [Edit] │
│  ImagingPlus       Imaging      72 xxx xxx   5        Inactive[Edit] │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

Add / Edit Supplier panel (slide-in, full detail):
┌─────────────────────────────────────────────────────────┐
│  CONTACT DETAILS                                         │
│  Supplier name:       [____________________________]    │
│  Supplier type:       [Pathology ▾]                     │
│  Legal entity:        [____________________________]    │
│  ABN:                 [____________________________]    │
│  Website:             [____________________________]    │
│  Address:             [____________________________]    │
│  Status:              [Active ▾]                        │
│                                                          │
│  PRIMARY CONTACT                                         │
│  Name:                [____________________________]    │
│  Email:               [____________________________]    │
│  Phone:               [____________________________]    │
│                                                          │
│  BILLING & ACCOUNTS                                      │
│  Billing email:       [____________________________]    │
│  Accounts contact:    [____________________________]    │
│  Accounts email:      [____________________________]    │
│  Invoice terms:       [____________________________]    │
│  Payment terms:       [Net 30 ▾]                        │
│  Preferred payment:   [EFT ▾]                           │
│                                                          │
│  BANK DETAILS                                            │
│  Account name:        [____________________________]    │
│  BSB:                 [______]                          │
│  Account number:      [____________________________]    │
│                                                          │
│  CONTRACT                                                │
│  Contract start:      [__/__/____]                      │
│  Contract end:        [__/__/____]                      │
│  Contract status:     [Active ▾]                        │
│  Notes:               [____________________________]    │
│                                                          │
│                       [Cancel]  [Save]                  │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 9 — Products Section (expanded)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▼ Products     Supplier: [All ▾]  Category: [All ▾]  [+ Add Product]│
│                                                                       │
│  Code     Name               Supplier     Cat.   Type  Retail WS  Sub│
│  ──────────────────────────────────────────────────────────────────  │
│  DEX-001  DEXA Scan          HealthPath   IMG    Scan  $350   $200 1x │
│  BLD-001  Full Blood Panel   HealthPath   PATH   Test  $120   $65  1x │
│  GEN-001  Genetic Test       GenomicsCo   GEN    Test  $499   $300 1x │
│  SUP-001  Supplement Bundle  NutriCo      SUPP   Prod  $45    $28  ↻  │
│                                                   [Edit]  [Deactivate]│
│                                                                       │
│  Sub column: 1x = one_time,  ↻ = recurring                           │
└──────────────────────────────────────────────────────────────────────┘

Add / Edit Product panel (slide-in):
┌─────────────────────────────────────────────────────────┐
│  Supplier:            [HealthPath ▾]                    │
│  Product code:        [____________________________]    │
│  Name:                [____________________________]    │
│  Description:         [____________________________]    │
│  Category:            [Imaging ▾]                       │
│  Product type:        [Scan ▾]                          │
│  Unit type:           [per_scan ▾]                      │
│  Subscription type:   [ One-time  |  Recurring  ]       │
│  Delivery method:     [In-person ▾]                     │
│  Wholesale cost ($):  [____________________________]    │
│  Retail price ($):    [____________________________]    │
│  Default markup (%):  [____________________________]    │
│  GST applicable:      [✓]                               │
│  Min. order qty:      [1_____]                          │
│  Lead time (days):    [____________________________]    │
│  Stripe Price ID:     [____________________________]    │
│  Location notes:      [____________________________]    │
│  Eligibility notes:   [____________________________]    │
│  Internal notes:      [____________________________]    │
│  Status:              [Active ▾]                        │
│                       [Cancel]  [Save]                  │
└─────────────────────────────────────────────────────────┘
```

**Notes:**
- Wholesale column visible in admin only — hidden from all non-admin roles via `products_public` view.
- Stripe Price ID entered manually after creating the price in Stripe dashboard.

---

### Screen 10 — B2B Plan Builder `/admin/b2b-clients`

```
┌──────────────────────────────────────────────────────────────────────┐
│  B2B Clients                              [+ New Client]             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Client          Plan            Seats  Status   Monthly   Actions   │
│  ────────────────────────────────────────────────────────────────    │
│  Acme Corp       Acme 2026       100    Active   $XX,XXX   [Edit]   │
│  HealthFirst Co  HealthFirst Q1  50     Draft    $X,XXX    [Edit]   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

B2B Plan Editor (click Edit):
┌──────────────────────────────────────────────────────────────────────┐
│  Acme Corp — Plan Editor                        [Save]  [Activate]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Plan name:          [Acme 2026_________________]                    │
│  Billing basis:      [Per seat monthly ▾]                            │
│  Annual discount:    [20___]  %                                      │
│  Contract start:     [01/05/2026]                                    │
│  Contract end:       [30/04/2027]                                    │
│  Min. commitment:    [12___]  months                                 │
│  Currency:           [AUD ▾]                                         │
│                                                                       │
│  ── Tier Allocations ──────────────────────────────────────────────  │
│                                                                       │
│  Tier       Seats (1–10,000)    $/seat/mo    Monthly subtotal        │
│  ─────────────────────────────────────────────────────────────────   │
│  Core       [80__________]       $XX          $X,XXX                 │
│  Clinical   [15__________]       $YY          $X,XXX                 │
│  Elite      [5___________]       $ZZ          $X,XXX                 │
│  ─────────────────────────────────────────────────────────────────   │
│  Monthly total:      $XX,XXX                                         │
│  Annual total (−20%): $XXX,XXX / yr                                  │
│                                                                       │
│  Internal notes:     [____________________________________]          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Seat count fields update the monthly subtotal and totals live on every keystroke.
- Setting a tier to 0 or clearing the field removes that allocation row.
- [Activate] sets `b2b_plans.status = 'active'` and links the plan to the org.
- Seat counts are validated 1–10,000; values outside range show inline error.

---

## API Layer

### Public

| Method | Route | Description |
|---|---|---|
| GET | `/api/plans` | List active tiers with pricing, inclusions (customer-visible), and feature flags |
| GET | `/api/products` | List active products (retail price only, via `products_public` view) |

---

### Authenticated — Standalone User

| Method | Route | Description |
|---|---|---|
| POST | `/api/stripe/checkout` | Create Stripe checkout session: `{ plan_id, product_ids[], billing_interval }` |
| GET | `/api/subscription` | Current subscription status + active add-ons |
| POST | `/api/subscription/addons` | Add recurring product: Stripe subscription item + `subscription_addons` row |
| DELETE | `/api/subscription/addons/:id` | Remove recurring product: delete Stripe item + mark row `cancelled` |
| GET | `/api/test-orders` | User's test order history |
| POST | `/api/test-orders` | Create test order: `{ product_id }` → Stripe payment intent |

---

### Employer / Health Manager

| Method | Route | Description |
|---|---|---|
| GET | `/api/org` | Org details + B2B plan + tier allocation breakdown |
| GET | `/api/org/members` | List org members with tier assignment |
| POST | `/api/org/invites` | Invite employee: `{ email, role, tier_allocation_id }` |
| PUT | `/api/org/members/:id` | Update member tier assignment |

---

### Platform Admin

| Method | Route | Description |
|---|---|---|
| GET/PUT | `/api/admin/plans/:id` | Get / update a tier (pricing, description) |
| GET/PUT/DELETE | `/api/admin/tier-inclusions` | Bulk upsert inclusions for a tier |
| GET/POST | `/api/admin/feature-keys` | List / create feature keys |
| PUT/DELETE | `/api/admin/feature-keys/:key` | Update / deactivate a feature key |
| GET/POST | `/api/admin/janet-services` | List / create Janet services |
| PUT/DELETE | `/api/admin/janet-services/:id` | Update / deactivate a Janet service |
| GET/POST | `/api/admin/suppliers` | List / create suppliers |
| PUT | `/api/admin/suppliers/:id` | Update a supplier |
| GET/POST | `/api/admin/products` | List / create products |
| PUT | `/api/admin/products/:id` | Update / deactivate a product |
| GET | `/api/admin/test-orders` | All test orders with supplier + user info |
| PUT | `/api/admin/test-orders/:id` | Update test order status |
| GET/POST | `/api/admin/b2b-plans` | List / create B2B plans |
| PUT | `/api/admin/b2b-plans/:id` | Update a B2B plan |
| GET/POST | `/api/admin/b2b-plans/:id/allocations` | List / upsert tier allocations |

---

## Pricing Calculation Logic

### Standalone user — pricing page (client-side, real-time)

```typescript
function calculateStandaloneTotal(
  plan: Plan,
  selectedProducts: Product[],
  interval: 'month' | 'year'
): number {
  const planPrice = interval === 'year'
    ? plan.annual_price_cents          // pre-stored, no recalc needed
    : plan.base_price_cents;

  const addonTotal = selectedProducts
    .filter(p => p.subscription_type === 'recurring')
    .reduce((sum, p) => sum + p.retail_cents, 0);

  const addonsAnnualised = interval === 'year' ? addonTotal * 12 : addonTotal;

  return planPrice + addonsAnnualised;
}
```

### B2B plan total (admin and employer dashboard, real-time)

```typescript
function calculateB2BTotal(
  allocations: Array<{ plan: Plan; seat_count: number }>,
  negotiated_discount_pct: number,
  interval: 'month' | 'year'
): number {
  const monthly = allocations.reduce(
    (sum, a) => sum + a.plan.base_price_cents * a.seat_count, 0
  );
  if (interval === 'month') return monthly;
  return Math.floor(monthly * 12 * (1 - negotiated_discount_pct / 100));
}
```

### Tier margin summary (admin Plan Builder, real-time)

```typescript
function calculateTierMargin(inclusions: TierInclusion[], monthly_price_cents: number) {
  const wholesale = inclusions.reduce((s, i) => s + i.wholesale_cost_cents * i.quantity, 0);
  const retail    = inclusions.reduce((s, i) => s + i.retail_value_cents  * i.quantity, 0);
  const margin    = monthly_price_cents - wholesale;
  return { wholesale, retail, margin, margin_pct: margin / monthly_price_cents };
}
```

---

## Stripe integration points

| Trigger | Stripe call | DB effect |
|---|---|---|
| User completes checkout | `checkout.session.completed` webhook | Write `subscriptions` + `subscription_addons` rows |
| User adds recurring product | `subscriptionItems.create` | Write `subscription_addons` row |
| User removes recurring product | `subscriptionItems.del` | Mark `subscription_addons.status = 'cancelled'` |
| User orders a one-time test | `paymentIntents.create` | Write `test_orders` row `pending` |
| Test payment confirmed | `payment_intent.succeeded` webhook | Update `test_orders.status = 'paid'` |
| Subscription cancelled | `customer.subscription.deleted` webhook | Update `subscriptions.status` |

---

## File structure (new files)

```
app/
  (public)/
    pricing/page.tsx              ← public pricing page (B2C tier comparison + add-ons)
  (app)/
    account/billing/page.tsx      ← manage recurring add-ons + test orders
    employer/page.tsx             ← Health Manager dashboard (B2B)
  (admin)/
    tiers/page.tsx                ← B2C tier config (Core / Clinical / Elite)
    suppliers/page.tsx            ← supplier directory; products nested per supplier
    plan-builder/page.tsx         ← B2B plan builder + org management

  api/
    plans/route.ts
    products/route.ts
    subscription/addons/route.ts
    subscription/addons/[id]/route.ts
    test-orders/route.ts
    org/route.ts
    org/members/route.ts
    org/members/[id]/route.ts
    org/invites/route.ts
    admin/plans/[id]/route.ts
    admin/tier-inclusions/route.ts
    admin/feature-keys/route.ts
    admin/feature-keys/[key]/route.ts
    admin/janet-services/route.ts
    admin/janet-services/[id]/route.ts
    admin/suppliers/route.ts
    admin/suppliers/[id]/route.ts
    admin/products/route.ts
    admin/products/[id]/route.ts
    admin/test-orders/route.ts
    admin/test-orders/[id]/route.ts
    admin/b2b-plans/route.ts
    admin/b2b-plans/[id]/route.ts
    admin/b2b-plans/[id]/allocations/route.ts

lib/
  features/resolve.ts             ← feature flag + inclusion access resolver
  pricing/calculate.ts            ← calculateStandaloneTotal, calculateB2BTotal, calculateTierMargin
  stripe/addons.ts                ← subscription item helpers
  stripe/test-orders.ts           ← payment intent helpers
```
