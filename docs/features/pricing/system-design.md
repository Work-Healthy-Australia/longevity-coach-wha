# Pricing System — UI/UX & API Design
**Date:** 2026-04-27
**Status:** Draft
**Relates to:** `2026-04-27-pricing-feature-proposal.md`, `2026-04-27-pricing-database-design.md`

---

## User journeys

### Journey 1 — Standalone user
```
Landing page → Pricing page (compare tiers)
                    → select tier + billing interval
                    → pick add-ons (optional)
                    → pricing summary → Stripe checkout
                                            → success → dashboard
Account page → Manage add-ons → add/remove → Stripe subscription item update
             → Order a test   → test catalog → Stripe payment intent → confirmation
```

### Journey 2 — Employer / Health Manager
```
Corporate signup → Admin assigns org to corporate plan
                        → Health Manager invited
                                → Employer dashboard
                                    → toggle feature add-ons (cost impact shown)
                                    → invite employees
                                    → employees see enabled features automatically
```

### Journey 3 — Platform Admin (back-office)
```
Admin panel → Manage plans → create/edit tier + Stripe price ID
           → Manage add-ons → create/edit feature add-ons
           → Manage suppliers → add supplier + contact details
           → Manage products → add product (code, category, prices, Stripe price ID)
```

---

## Screen Designs (wireframes)

---

### Screen 1 — Public Pricing Page `/pricing`

```
┌──────────────────────────────────────────────────────────────────────┐
│  Longevity Coach                               [Login]  [Get Started] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│              Choose your plan                                         │
│                                                                       │
│              [  Monthly  |  Annual  -20% ]   ← billing toggle        │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Individual  │  │ Professional │  │       Corporate          │   │
│  │              │  │              │  │                          │   │
│  │  $X / mo     │  │  $Y / mo     │  │  $Z / seat / mo          │   │
│  │              │  │              │  │  (min 5 seats)           │   │
│  │  ✓ Feature A │  │  ✓ All Indiv │  │  ✓ All Professional      │   │
│  │  ✓ Feature B │  │  ✓ Feature C │  │  ✓ Health Manager portal │   │
│  │              │  │  ✓ Feature D │  │  ✓ Bulk invites          │   │
│  │              │  │              │  │  ✓ Custom feature toggles│   │
│  │  [Get started│  │  [Get started│  │  [Contact sales]         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│                                                                       │
│  ──── Optional Add-ons ────────────────────────────────────────────  │
│                                                                       │
│  [ ] Advanced Supplement Protocol    +$A/mo  (Professional+)         │
│  [ ] Branded PDF Export              +$B/mo  (All plans)             │
│  [ ] Genome Analysis Access          +$C/mo  (Professional+)         │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────   │
│  Estimated total:  $X/mo             [Continue to checkout →]        │
│  (updates live as add-ons are toggled)                                │
└──────────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Monthly/Annual toggle recalculates all displayed prices and the running total
- Add-on checkboxes are gated — greyed out if the selected tier is below `min_tier`
- "Estimated total" updates on every toggle without a page reload
- "Continue to checkout" carries `plan_id` + `addon_ids[]` + `billing_interval` as query params into the checkout route

---

### Screen 2 — Checkout Flow `/checkout`

```
┌──────────────────────────────────────────────────────────────┐
│  Your order summary                                           │
│                                                               │
│  Plan:         Professional (Annual)       $Y × 12 = $YY     │
│  Add-on:       Supplement Protocol         $A × 12 = $AA     │
│  Add-on:       Branded PDF Export          $B × 12 = $BB     │
│  ─────────────────────────────────────────────────────────── │
│  Total today:                                      $TOTAL/yr  │
│  (Billed annually. Cancel any time.)                          │
│                                                               │
│  ── Stripe payment form ──────────────────────────────────── │
│  Card number: [____________________]                          │
│  Expiry: [__/__]   CVC: [___]                                 │
│                                                               │
│  [← Back to plans]              [Pay $TOTAL and start →]     │
└──────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Summary is rendered server-side from DB (not query params — validated against `plans` + `plan_addons`)
- Stripe checkout session created server-side with base plan price + add-on prices as line items
- On `checkout.session.completed`: webhook writes `subscriptions` row + `subscription_addons` rows

---

### Screen 3 — Account / Billing Page `/account/billing`

```
┌──────────────────────────────────────────────────────────────┐
│  Billing & Add-ons                                            │
│                                                               │
│  Current plan:   Professional (Annual)                        │
│  Renews:         2027-04-27                                   │
│  [Upgrade plan]  [Cancel subscription]                        │
│                                                               │
│  ─── Active Add-ons ─────────────────────────────────────── │
│                                                               │
│  ✓ Supplement Protocol         $A/yr    [Remove]             │
│  ✓ Branded PDF Export          $B/yr    [Remove]             │
│                                                               │
│  ─── Available Add-ons ──────────────────────────────────── │
│                                                               │
│  + Genome Analysis Access      $C/yr    [Add]                │
│                                                               │
│  ─── Order a Test ───────────────────────────────────────── │
│                                                               │
│  Category: [All ▾]    Search: [__________]                   │
│                                                               │
│  DEXA Scan              $XXX    [Order]                      │
│  Full Blood Panel       $XXX    [Order]                      │
│  Genetic Test           $XXX    [Order]                      │
│                                                               │
│  ─── Order History ──────────────────────────────────────── │
│  2026-03-12  DEXA Scan      $XXX   ✓ Completed               │
└──────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- "Add" → calls `POST /api/subscription/addons` → creates Stripe subscription item → `subscription_addons` row
- "Remove" → calls `DELETE /api/subscription/addons/:id` → deletes Stripe subscription item → marks row `cancelled`
- "Order" → opens test order confirmation modal → `POST /api/test-orders` → Stripe payment intent → redirect to Stripe

---

### Screen 4 — Employer Dashboard `/employer`

```
┌──────────────────────────────────────────────────────────────┐
│  Acme Corp — Health Package                                   │
│  Plan: Corporate Annual  |  12 employees  |  Health Manager  │
│                                                               │
│  ─── Employee Features ─────────────────────────────────── │
│                                                               │
│  Feature                     Status   Cost/seat   Impact     │
│  ────────────────────────────────────────────────────────── │
│  Risk Report (included)      ON  ●    included    —          │
│  Supplement Protocol         ON  ●    +$A/mo      $A×12/yr   │
│  Branded PDF Export          OFF ○    +$B/mo      [Enable]   │
│  Genome Analysis Access      OFF ○    +$C/mo      [Enable]   │
│                                                               │
│  Current monthly cost:  ($Z × 12) + ($A × 12) = $TOTAL/yr   │
│                                                               │
│  ─── Employees ─────────────────────────────────────────── │
│                                                               │
│  [+ Invite employee]   [Import CSV]                          │
│                                                               │
│  Name              Email                Role        Status   │
│  Jane Smith        jane@acme.com        Member      Active   │
│  Bob Lee           bob@acme.com         Manager     Active   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Each feature toggle row shows cost per seat and real-time total impact before confirming
- Toggling ON → confirmation modal ("This will add $X/yr to your plan. Confirm?") → `POST /api/org/addons`
- Toggling OFF → `DELETE /api/org/addons/:addon_id`
- Employee list shows org members from `organisation_members`; "Invite" sends email invite

---

### Screen 5 — Admin: Supplier Management `/admin/suppliers`

```
┌──────────────────────────────────────────────────────────────┐
│  Suppliers                              [+ Add Supplier]     │
│                                                               │
│  Name                  ABN / ID    Status   Products  Actions│
│  ─────────────────────────────────────────────────────────── │
│  HealthPath Labs       51 xxx      Active   8         [Edit] │
│  GenomicsCo            83 xxx      Active   3         [Edit] │
│  ImagingPlus           72 xxx      Inactive 5         [Edit] │
│                                                               │
└──────────────────────────────────────────────────────────────┘

Add / Edit Supplier modal:
┌──────────────────────────────────────┐
│  Supplier name:   [________________] │
│  Contact email:   [________________] │
│  Contact phone:   [________________] │
│  Address:         [________________] │
│  ABN / Provider:  [________________] │
│  Status:          [Active ▾]         │
│                   [Cancel] [Save]    │
└──────────────────────────────────────┘
```

---

### Screen 6 — Admin: Product Catalog `/admin/products`

```
┌──────────────────────────────────────────────────────────────┐
│  Products                  Supplier: [All ▾]  [+ Add Product]│
│                                                               │
│  Code     Name              Supplier       Cat.  Retail  WS  │
│  ────────────────────────────────────────────────────────── │
│  DEX-001  DEXA Scan         HealthPath      IMG   $350   $200 │
│  BLD-001  Full Blood Panel  HealthPath      PATH  $120   $65  │
│  GEN-001  Genetic Test      GenomicsCo      GEN   $499   $300 │
│                                             [Edit] [Deactivate]│
│                                                               │
└──────────────────────────────────────────────────────────────┘

Add / Edit Product modal:
┌──────────────────────────────────────┐
│  Supplier:        [HealthPath ▾]     │
│  Product code:    [________________] │
│  Name:            [________________] │
│  Description:     [________________] │
│  Category:        [Imaging ▾]        │
│  Wholesale ($):   [________________] │
│  Retail ($):      [________________] │
│  Stripe Price ID: [________________] │
│  Status:          [Active ▾]         │
│                   [Cancel] [Save]    │
└──────────────────────────────────────┘
```

**Notes:**
- Wholesale column is only visible in the admin UI — hidden from all other roles
- "Stripe Price ID" is entered manually by admin after creating the price in the Stripe dashboard

---

## API Layer

### Public

| Method | Route | Description |
|---|---|---|
| GET | `/api/plans` | List active plans with pricing and features |
| GET | `/api/plan-addons` | List active add-ons (with tier gating info) |
| GET | `/api/products` | List active products (retail price only, via `products_public` view) |

---

### Authenticated — Standalone User

| Method | Route | Description |
|---|---|---|
| POST | `/api/stripe/checkout` | Create Stripe checkout session: `{ plan_id, addon_ids[], billing_interval }` |
| GET | `/api/subscription` | Get current subscription status + active add-ons |
| POST | `/api/subscription/addons` | Add a recurring add-on: creates Stripe subscription item + DB row |
| DELETE | `/api/subscription/addons/:id` | Remove a recurring add-on: deletes Stripe subscription item + marks row cancelled |
| GET | `/api/test-orders` | List user's test order history |
| POST | `/api/test-orders` | Create a test order: `{ product_id }` → Stripe payment intent |

---

### Employer / Health Manager

| Method | Route | Description |
|---|---|---|
| GET | `/api/org` | Get org details + plan + seat count |
| GET | `/api/org/addons` | List org-enabled add-ons |
| POST | `/api/org/addons` | Enable an add-on for all org members: `{ plan_addon_id }` |
| DELETE | `/api/org/addons/:id` | Disable an add-on for all org members |
| GET | `/api/org/members` | List org members |
| POST | `/api/org/invites` | Invite employee by email: `{ email, role }` |

---

### Platform Admin

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/admin/plans` | List / create plans |
| PUT/DELETE | `/api/admin/plans/:id` | Update / deactivate a plan |
| GET/POST | `/api/admin/plan-addons` | List / create plan add-ons |
| PUT/DELETE | `/api/admin/plan-addons/:id` | Update / deactivate an add-on |
| GET/POST | `/api/admin/suppliers` | List / create suppliers |
| PUT | `/api/admin/suppliers/:id` | Update a supplier |
| GET/POST | `/api/admin/products` | List / create products |
| PUT | `/api/admin/products/:id` | Update a product |
| GET | `/api/admin/test-orders` | List all test orders (with supplier + user info) |
| PUT | `/api/admin/test-orders/:id` | Update test order status (e.g. mark `fulfilling`, `completed`) |

---

## Pricing Calculation Logic

### Standalone user total (front-end, real-time)

```typescript
function calculateTotal(
  plan: Plan,
  addons: PlanAddon[],
  interval: 'month' | 'year'
): number {
  const planPrice = interval === 'year'
    ? plan.base_price_cents * 12 * (1 - plan.annual_discount_pct / 100)
    : plan.base_price_cents;

  const addonTotal = addons.reduce((sum, a) =>
    sum + (interval === 'year' ? a.price_annual_cents : a.price_monthly_cents), 0);

  return planPrice + addonTotal;
}
```

### Employer total (employer dashboard)

```typescript
function calculateOrgTotal(
  plan: Plan,
  enabledAddons: PlanAddon[],
  seatCount: number,
  interval: 'month' | 'year'
): number {
  const basePerSeat = interval === 'year'
    ? plan.base_price_cents * 12 * (1 - plan.annual_discount_pct / 100)
    : plan.base_price_cents;

  const addonPerSeat = enabledAddons.reduce((sum, a) =>
    sum + (interval === 'year' ? a.price_annual_cents : a.price_monthly_cents), 0);

  return (basePerSeat + addonPerSeat) * seatCount;
}
```

---

## Stripe integration points

| Trigger | Stripe call | DB effect |
|---|---|---|
| User completes checkout | `checkout.session.completed` webhook | Write `subscriptions` + `subscription_addons` rows |
| User adds recurring add-on | `subscriptionItems.create` | Write `subscription_addons` row |
| User removes recurring add-on | `subscriptionItems.del` | Mark `subscription_addons.status = 'cancelled'` |
| User orders a test | `paymentIntents.create` | Write `test_orders` row with `pending` status |
| Test payment confirmed | `payment_intent.succeeded` webhook | Update `test_orders.status = 'paid'` |
| Plan cancelled | `customer.subscription.deleted` webhook | Update `subscriptions.status` |

---

## Feature flag resolution (runtime)

When determining what a user can access, resolve in this priority order:

```
1. Is the user a platform admin?              → all features unlocked
2. Is the user an org member?
   a. Is the feature enabled in org_addons?   → unlocked for this user
   b. Is it included in the org's plan tier?  → unlocked
   c. Otherwise                               → locked
3. Is the user a standalone subscriber?
   a. Is there a subscription_addon row?      → unlocked
   b. Is it included in their plan tier?      → unlocked
   c. Otherwise                               → locked (show upsell)
```

Implement as `lib/features/resolve.ts` — a single function called from server components and API route guards.

---

## File structure (new files)

```
app/
  (app)/
    pricing/page.tsx                  ← public pricing page (S1 + S2)
    account/billing/page.tsx          ← manage add-ons + test orders (S2)
    employer/page.tsx                 ← employer dashboard (S3)
  (admin)/
    plans/page.tsx                    ← plan management (S1)
    addons/page.tsx                   ← add-on management (S1/S2)
    suppliers/page.tsx                ← supplier management (S4)
    products/page.tsx                 ← product catalog (S4)
  api/
    plans/route.ts
    plan-addons/route.ts
    products/route.ts
    subscription/addons/route.ts
    test-orders/route.ts
    org/route.ts
    org/addons/route.ts
    org/members/route.ts
    org/invites/route.ts
    admin/plans/route.ts
    admin/plan-addons/route.ts
    admin/suppliers/route.ts
    admin/products/route.ts
    admin/test-orders/route.ts

lib/
  features/resolve.ts                 ← feature flag resolution
  pricing/calculate.ts                ← calculateTotal, calculateOrgTotal
  stripe/addons.ts                    ← subscription item helpers
  stripe/test-orders.ts               ← payment intent helpers
```
