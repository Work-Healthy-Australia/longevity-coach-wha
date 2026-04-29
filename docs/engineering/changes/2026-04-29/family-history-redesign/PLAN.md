# Plan: Family history redesign — per-relative card model
**Date:** 2026-04-29
**Phase:** Epic 2 (The Intake) — closes the "Family-history sub-fields (age of onset, cancer types)" outstanding item; downstream personalisation hits Epic 3 (engine richer inputs) and Epic 8 (simulator unchanged but feeds richer FamilyHistory).
**Status:** Draft

## Objective

Replace the current onboarding's two-step family approach (`family` per-condition multiselects + `family_deaths` per-relative status/age/cause) with a single unified **per-relative card** step modelled on the wireframe at `docs/engineering/changes/2026-04-29-family-history-redesign/wireframes.html` (Option 2 panel) and the Base44 reference `src/components/onboarding/FamilyHistoryStep.jsx`. Each card collects: relationship, alive/dead, age (current OR at death), cause-of-death (when deceased), smoking status, alcohol use, and a list of conditions with per-condition age-of-onset.

The deterministic risk engine itself does **not** change. `assemble.ts::buildFamilyHistory()` aggregates the new per-relative data into the engine's existing `FamilyHistory` shape (`first_degree`, `second_degree`, `age_onset`, `multiple`). A hydration shim merges legacy responses into the new shape so existing members see their data already populated when the new UI appears.

Done = a member completes the family step in a single rich view; the engine receives strictly-richer aggregates (per-relative ages → accurate `age_onset`, fixes the broken `multiple` flag in `metabolic.ts`); the GP-panel-pack tests produce identical-or-improved scores.

## Scope

**In scope:**
- New typed FieldType `family_members` in `lib/questionnaire/schema.ts`.
- New value type `FamilyMemberCard[]` with relationship / vital / age / cause / smoking / alcohol / conditions[] shape.
- New `<FamilyMembersField>` client component in `onboarding-client.tsx` (same pattern as `<CancerHistoryField>`).
- Updated `assemble.ts::buildFamilyHistory()` reads from `family.family_members[]` first; falls back to legacy keys for old responses.
- Hydration shim `migrateLegacyFamily()` that maps the old per-condition + deaths-step keys into the new shape on form load.
- New CSS for the per-relative cards in `onboarding.css`.
- Schema-driven validation (cards are optional; required content within a card if added — see Wave 2 spec).
- Tests for: assemble aggregation, hydration shim, validation gate.
- Removal of `family_deaths` step from the questionnaire (Wave 3 only).
- Removal of `familyConditionFields()` per-condition fields from the `family` step (Wave 3 only).
- Documentation: change folder gets PLAN, QA reports per wave, CHANGELOG, EXECUTIVE_SUMMARY.

**Out of scope:**
- Database migration. Single source of truth remains `health_profiles.responses` JSONB.
- Backfilling existing rows in the DB. Hydration shim handles legacy data at read time; old keys remain orphaned in JSONB but are stripped by `stripUnknownKeys()` after Wave 3.
- Engine scoring changes (`cardiovascular.ts` etc. untouched).
- `cancer_history` field — kept as-is; remains separate from the per-relative cards (its per-type detail is richer than what fits in a card's conditions list).
- Free-text relative labels ("Aunt Mary"). Multiple aunts allowed via repeated `relationship: "aunt"` cards but no disambiguation label this round.
- Smoking / alcohol per relative is **stored** but not yet **consumed by the engine** — preserves Base44 parity, opens the door to a future engine extension (e.g. parental smoking → CV risk uplift).
- Animation library (`framer-motion`). Use CSS transitions only.
- Mobile-specific UX optimisations beyond the responsive grid.

## Data model changes

**No DB changes.** The new shape lives in `health_profiles.responses.family.family_members` JSONB. PII boundary unchanged (de-identified questionnaire data per Rule 2). Single writer remains the onboarding server action (Rule 4).

**New value shape (TypeScript):**

```ts
// lib/questionnaire/schema.ts — add to FieldType union
export type FieldType =
  | "text" | "textarea" | "number" | "date" | "select" | "multiselect"
  | "chips" | "toggle"
  | "allergy_list"
  | "cancer_history"
  | "family_members";  // NEW

// Relationship enum mirrors Base44; aligns with FIRST/SECOND_DEGREE_RELATIVES sets
export const FAMILY_RELATIONSHIPS = [
  "mother", "father", "sister", "brother",
  "maternal_grandmother", "maternal_grandfather",
  "paternal_grandmother", "paternal_grandfather",
  "aunt", "uncle",
] as const;
export type FamilyRelationship = typeof FAMILY_RELATIONSHIPS[number];

export const CAUSE_CATEGORIES = [
  "cardiovascular", "cancer", "neurovascular", "neurodegenerative",
  "trauma_accident", "suicide_mental_health", "other", "unknown",
] as const;
export type CauseCategory = typeof CAUSE_CATEGORIES[number];

export const SMOKING_VALUES = [
  "never", "former", "current_social", "current_light",
  "current_moderate", "current_heavy", "unknown",
] as const;
export type SmokingValue = typeof SMOKING_VALUES[number];

export const ALCOHOL_VALUES = ["never", "light", "moderate", "heavy", "unknown"] as const;
export type AlcoholValue = typeof ALCOHOL_VALUES[number];

export const CARD_CONDITIONS = [
  "cardiovascular", "neurodegenerative", "diabetes", "osteoporosis",
] as const;
export type CardConditionType = typeof CARD_CONDITIONS[number];

export type FamilyMemberConditionEntry = {
  type: CardConditionType;
  age_onset?: number;
};

export type FamilyMemberCard = {
  id: string;                            // local UUID for React keys
  relationship: FamilyRelationship | "";  // empty until user picks
  is_alive: boolean;
  current_age?: number;
  age_at_death?: number;
  cause_category?: CauseCategory;
  smoking_status?: SmokingValue;
  alcohol_use?: AlcoholValue;
  conditions: FamilyMemberConditionEntry[];
};
```

**Storage path:** `health_profiles.responses.family.family_members` (JSONB array).

**Why JSONB and not a typed table:** Rule 3 — typed columns are for fields the app filters/indexes on in SQL. The risk engine deserialises this JSONB into `PatientInput` at read time; no SQL filter ever touches it. Consistent with `cancer_history`, `allergy_list`, `priorities`, etc.

**Cancer kept separate:** The existing `cancer_history` field renders alongside the new `family_members` field in the same step. No interaction between the two; engine reads each independently via existing `adaptCancerHistory()`.

## Waves

Three waves. Each merges independently. The app is fully functional between waves — at every merge boundary, every existing user flow still works and existing data is still consumed correctly.

---

### Wave 1 — Engine plumbing + hydration shim (zero-UX-change ship)

**What James can see after this wave merges:** Nothing visually. But behind the scenes, the assemble layer is now ready to consume `family.family_members[]` data as soon as it appears in any response. The legacy path keeps working. GP-panel-pack tests run identically (or with stricter `multiple` flag where applicable). Pure backend prep that's mergeable on its own.

**Tasks**

#### Task 1.1 — Schema additions + types

**Files affected:**
- `lib/questionnaire/schema.ts` (modify — add `family_members` to `FieldType`; add the `FamilyMemberCard` types and the four enums per the Data model section above).

**What to build:** Pure type/enum additions. No renderer changes. No questions.ts change yet — Wave 2 wires the actual field. Export everything so tests and assemble.ts can import.

**Acceptance criteria:**
- New types compile cleanly.
- `pnpm build` passes.
- No runtime change to the form (the new field type isn't yet referenced from `questions.ts`).
- Constants exported: `FAMILY_RELATIONSHIPS`, `CAUSE_CATEGORIES`, `SMOKING_VALUES`, `ALCOHOL_VALUES`, `CARD_CONDITIONS`.

**Rules to apply:**
- `.claude/rules/data-management.md` — Rule 3 (JSONB acceptable for opaque-shape complex objects).

#### Task 1.2 — Assemble extension: read new shape with legacy fallback

**Files affected:**
- `lib/risk/assemble.ts` (modify — extend `buildFamilyHistory()` to read `family.family_members[]` first; fall back to existing per-condition fields if absent).
- `tests/unit/risk/family-aggregation.test.ts` (new — covers the new aggregation function).

**What to build:**

Add a new exported pure helper:

```ts
import type { FamilyMemberCard, CardConditionType } from "@/lib/questionnaire/schema";
import { FAMILY_RELATIONSHIPS } from "@/lib/questionnaire/schema";

const FIRST_DEGREE_REL_KEYS = new Set<string>(["mother", "father", "sister", "brother"]);
const SECOND_DEGREE_REL_KEYS = new Set<string>([
  "maternal_grandmother", "maternal_grandfather",
  "paternal_grandmother", "paternal_grandfather",
  "aunt", "uncle",
]);

export function aggregateConditionFromMembers(
  members: FamilyMemberCard[],
  type: CardConditionType,
): { first_degree: boolean; second_degree: boolean; age_onset?: number; multiple: boolean } | undefined {
  const matched = members.flatMap((m) => {
    const entry = m.conditions?.find((c) => c.type === type);
    if (!entry) return [];
    return [{ relationship: m.relationship, age_onset: entry.age_onset }];
  });
  if (matched.length === 0) return undefined;
  const firstDegreeCount = matched.filter((m) => FIRST_DEGREE_REL_KEYS.has(m.relationship)).length;
  const secondDegree = matched.some((m) => SECOND_DEGREE_REL_KEYS.has(m.relationship));
  const ages = matched.map((m) => m.age_onset).filter((a): a is number => Number.isFinite(a));
  return {
    first_degree: firstDegreeCount > 0,
    second_degree: secondDegree,
    age_onset: ages.length > 0 ? Math.min(...ages) : undefined,
    multiple: firstDegreeCount >= 2,
  };
}
```

In `buildFamilyHistory()`:

```ts
export function buildFamilyHistory(family: Record<string, unknown> | undefined): FamilyHistory {
  if (!family) return {};
  const fh: FamilyHistory = {};

  // Prefer new per-relative cards if present
  const membersRaw = (family as { family_members?: unknown }).family_members;
  const members: FamilyMemberCard[] = Array.isArray(membersRaw)
    ? (membersRaw as FamilyMemberCard[])
    : [];
  const hasNewShape = members.length > 0;

  if (hasNewShape) {
    const cv = aggregateConditionFromMembers(members, "cardiovascular");
    if (cv) fh.cardiovascular = cv;
    const neuro = aggregateConditionFromMembers(members, "neurodegenerative");
    if (neuro) fh.neurodegenerative = neuro;
    const dia = aggregateConditionFromMembers(members, "diabetes");
    if (dia) fh.diabetes = dia;
    const ost = aggregateConditionFromMembers(members, "osteoporosis");
    if (ost) fh.osteoporosis = ost;
  } else {
    // Legacy path — keep existing logic untouched
    const cv = familyConditionFromMultiselect(family.cardiovascular_relatives, family.cardiovascular_onset_age);
    if (cv) fh.cardiovascular = cv;
    // … same for neurodegenerative, diabetes, osteoporosis
  }

  // Cancer history is independent of the cards in either path
  const cancer = adaptCancerHistory(family.cancer_history);
  if (cancer) fh.cancer = cancer;
  return fh;
}
```

Note: relationship key strings in the new shape are lowercase (`"mother"`), distinct from the legacy multiselect (`"Mother"`). The set membership check is against the new lowercase keys.

**Acceptance criteria:**
- `aggregateConditionFromMembers` exported, pure, deterministic.
- ≥ 8 unit tests in `tests/unit/risk/family-aggregation.test.ts`:
  1. Empty members → `undefined`.
  2. One first-degree match → `{ first_degree: true, second_degree: false, age_onset, multiple: false }`.
  3. Two first-degree matches → `multiple: true` (fixes the metabolic.ts bug).
  4. Only second-degree matches → `{ first_degree: false, second_degree: true }`.
  5. Mixed first + second degree → both flags true.
  6. Missing `age_onset` on entry → result has no `age_onset` field.
  7. Multiple ages → min wins.
  8. Repeated relationship type ("aunt" twice) → counts each card.
- Existing `tests/unit/risk/_gp-panel-pack.test.ts` and `tests/unit/risk/assemble.test.ts` continue to pass unchanged (legacy path preserved).
- `pnpm build` clean.

**Rules to apply:**
- `.claude/rules/ai-agents.md` — engine remains pure, deterministic.
- `.claude/rules/nextjs-conventions.md` — pure helpers.

#### Task 1.3 — Hydration shim (legacy → new shape, read-only)

**Files affected:**
- `lib/questionnaire/migrate-family.ts` (new — pure function `migrateLegacyFamily(responses)`).
- `tests/unit/questionnaire/migrate-family.test.ts` (new).

**What to build:**

Pure function that takes a `ResponsesByStep` and produces a `FamilyMemberCard[]` from any combination of:
- Legacy per-condition keys: `family.cardiovascular_relatives[]`, `family.cardiovascular_onset_age`, plus same for neurodegenerative, diabetes, osteoporosis.
- Legacy deaths-step keys: `family_deaths.mother_status`, `family_deaths.mother_age`, `family_deaths.mother_cause_of_death`, plus the same trio for father + 4 grandparents.

Mapping rules:
- For each legacy relative who appears in any condition multiselect, create or update a card with that relationship.
- For each legacy deaths-step entry with `*_status === "Deceased"` or "Alive", create or update a card with the corresponding relationship and `is_alive` / `current_age` / `age_at_death` / `cause_category` (mapped from the free-text via simple regex: `/heart|cardiac|cardiovascular/i → "cardiovascular"`, `/cancer|tumor|tumour/i → "cancer"`, `/stroke/i → "neurovascular"`, `/alzheimer|dementia|parkinson/i → "neurodegenerative"`, `/accident|trauma/i → "trauma_accident"`, fallback `"unknown"`).
- The legacy `_onset_age` is the **earliest** age across the relatives in the multiselect — apply it to **all** matching cards' condition entries (best-faith approximation; member can edit).
- Relationship name mapping: `"Mother" → "mother"`, `"Father" → "father"`, `"Sister"`/`"Brother"` → singular cards (one each unless multiple are mentioned in a deaths step, but deaths step has no sister/brother slots, so always one each), `"Maternal grandmother" → "maternal_grandmother"`, etc. `"Aunt or uncle"` from the multiselect cannot be split → maps to a single card with `relationship: "aunt"` and a `notes`-style hint? **No** — keep it simple: maps to `"aunt"` always (member can edit to `"uncle"`).
- The function is pure and read-only. It does NOT write back to `responses` — it returns the `family_members` array, which the calling code uses or stores as it sees fit.
- If `responses.family.family_members` already exists and is non-empty, the function returns it as-is (no shim re-application).

**Acceptance criteria:**
- ≥ 7 unit tests:
  1. Empty input → `[]`.
  2. Existing `family_members` non-empty → returned unchanged.
  3. Only legacy `cardiovascular_relatives: ["Mother"]` + `cardiovascular_onset_age: 55` → one card `{ relationship: "mother", is_alive: true, conditions: [{ type: "cardiovascular", age_onset: 55 }] }`.
  4. Only legacy deaths-step data: `mother_status: "Deceased", mother_age: 78, mother_cause_of_death: "heart attack"` → one card `{ relationship: "mother", is_alive: false, age_at_death: 78, cause_category: "cardiovascular", conditions: [] }`.
  5. Both legacy paths populated for the same relative → merged into one card (conditions list from condition multiselect, vital data from deaths step).
  6. Mother in CV multiselect AND in diabetes multiselect → one card with two condition entries.
  7. Cause-of-death regex coverage: "stroke" → `neurovascular`, "lung cancer" → `cancer`, "Alzheimer's" → `neurodegenerative`, gibberish → `unknown`.

**Rules to apply:**
- `.claude/rules/data-management.md` — Rule 1 (no derived data stored: this returns a derived value at read time).
- `.claude/rules/nextjs-conventions.md` — pure helper.

#### Wave 1 closing checks

- `pnpm build` clean.
- `pnpm test` green; ≥ 15 new tests across the wave.
- Engine output for any existing seeded user is identical (legacy fallback path) — verify by running existing GP-panel-pack tests.
- Wave 1 PR title: **"Wave 1: family-history schema + assemble plumbing + hydration shim"**

---

### Wave 2 — UI: per-relative cards rendered alongside legacy fields

**What James can see after this wave merges:** A new "Family members" section appears at the top of the family-history step. Members can add/edit/remove cards using the rich per-relative UX. The legacy per-condition multiselects and the separate "Deaths in the family" step still exist (unchanged) — both UIs render side-by-side. Whichever the member fills, the engine reads correctly. This is the visible-progress wave; it deliberately does NOT remove the old fields yet so a member mid-onboarding doesn't lose their progress.

**Tasks**

#### Task 2.1 — `<FamilyMembersField>` client component

**Files affected:**
- `app/(app)/onboarding/onboarding-client.tsx` (modify — add `<FamilyMembersField>` component + add `case "family_members"` to the field-renderer switch around line 354).
- `app/(app)/onboarding/onboarding.css` (modify — new card styles, expand/collapse transitions, condition tick grid).

**What to build:**

Mirror `<CancerHistoryField>` (line 361 in onboarding-client.tsx) for shape and pattern. Component contract:

```tsx
function FamilyMembersField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
});
```

Internals:
- `cards: FamilyMemberCard[]` derived from `value` (default `[]` if not array).
- "Add family member" button at the bottom — appends a new card with `id: crypto.randomUUID()`, `relationship: ""`, `is_alive: true`, `conditions: []`.
- Each card:
  - **Header (always visible):** avatar icon, relationship label (or "Relative" if not yet picked), meta line ("Living · age 67" or "Deceased · died at 88"), expand chevron, remove ×.
  - **Body (expanded):**
    - Relationship select (8 options + "aunt" + "uncle"; allow same relationship to repeat).
    - Alive/Deceased toggle (custom-styled `<button role="switch">`).
    - Age input — `current_age` if alive, `age_at_death` if deceased.
    - Cause-of-death grid (8 buttons with category labels, only shown when deceased).
    - Smoking + Alcohol selects (use the `SMOKING_VALUES` / `ALCOHOL_VALUES` enums; show different option subsets when deceased per the wireframe).
    - Conditions checklist (4 items: cardiovascular, neurodegenerative, diabetes, osteoporosis). Each is a tick button; when ticked, an inline age-of-onset number input appears.
- Default expanded for cards with empty `relationship`; collapsed otherwise. Click header to toggle.
- Removing a card with one click; no confirmation modal (simple).
- All emit `onChange` with the full updated array.

**CSS contract** (in `onboarding.css`):
- `.family-members-list` (vertical stack, gap 12px).
- `.family-card` (border, rounded, white background).
- `.family-card-head` (flex row, padding, cursor pointer).
- `.family-card-body` (border-top, padding, hidden when collapsed via max-height transition).
- `.family-card-expanded .family-card-body` (max-height: 1200px or grid auto).
- `.family-card-vital-toggle` (highlighted background).
- `.family-card-cause-grid` (2-col grid of cause buttons).
- `.family-card-conditions` (vertical stack of condition rows).
- `.family-card-condition-row` (toggle button + age input revealed when ticked).
- `.family-card-add` (dashed border button matching existing `add-row` from wireframe).
- All colours via existing tokens in `onboarding.css` / `globals.css`. No new colour palette.

**Acceptance criteria:**
- New field type renders without errors when added to the schema (Task 2.2 wires it).
- Add → expand → fill all sub-fields → collapse → save flow works.
- Remove button clears a card.
- Multiple cards with the same `relationship` allowed (e.g. two `"aunt"` entries).
- Conditions list ticks correctly; age-of-onset input appears/hides as ticked.
- Cause-of-death grid only renders when `is_alive === false`.
- Component is fully controlled — no internal hidden state beyond expand/collapse UI.
- Mobile-friendly: cards stack on narrow screens; cause grid collapses to 1-col under 480px.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — client component for interactive form widget.
- `.claude/rules/data-management.md` — Rule 4 (single writer: onboarding action remains the only persister; component reads + emits via `onChange` only).

#### Task 2.2 — Schema wires `family_members` field; questions.ts adds it to the `family` step

**Files affected:**
- `lib/questionnaire/questions.ts` (modify — add `family_members` field at the **top** of the `family` step, BEFORE the existing per-condition fields).

**What to build:**

```ts
// In the `family` step, fields array — insert at index 0:
{
  id: "family_members",
  label: "Family members",
  type: "family_members",
  optional: true,
  helpText:
    "Add each family member you know about. Mark which conditions they had and at what age. The richest data feeds the most accurate risk picture.",
},
// existing per-condition fields and cancer_history remain unchanged below
```

Do NOT remove the old fields yet — they coexist for this wave.

Update the step `description` to acknowledge the dual-input reality:
> "Add family members below for the richest picture, or fill the per-condition fields further down."

**Acceptance criteria:**
- Form renders the new field at the top of the family step.
- Existing per-condition multiselects + cancer_history field still render below.
- `family_deaths` step still exists and works.
- Saving a draft preserves data from EITHER the new field or the old fields.
- Engine reads via the Wave 1 priority (new shape wins if present).
- `pnpm build` clean.
- `pnpm test` green; existing questionnaire tests pass.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — schema-driven; no UI changes outside the new component.

#### Task 2.3 — Apply hydration shim on form load

**Files affected:**
- `app/(app)/onboarding/page.tsx` (modify — call `migrateLegacyFamily` when initial responses are loaded; merge result into `responses.family.family_members` before passing to client).
- `tests/unit/onboarding/hydrate-on-load.test.ts` (new, optional — sanity check that the merge happens once).

**What to build:**

In the server component that fetches the existing `health_profiles.responses`:

```ts
import { migrateLegacyFamily } from "@/lib/questionnaire/migrate-family";

// after fetching responses:
const familyMembers = migrateLegacyFamily(responses);
const responsesWithMigration: ResponsesByStep = {
  ...responses,
  family: {
    ...(responses.family ?? {}),
    family_members:
      Array.isArray(responses.family?.family_members) && responses.family.family_members.length > 0
        ? responses.family.family_members
        : familyMembers,
  },
};
// pass responsesWithMigration to the client
```

This runs every page load. It's idempotent: once `family_members` is non-empty, the shim short-circuits.

**Acceptance criteria:**
- A user with only legacy data loads the form and sees their data populated as cards in the new field.
- A user with no data sees an empty cards list.
- A user who has saved cards before sees those cards (no re-migration).
- `pnpm build` clean.

**Rules to apply:**
- `.claude/rules/data-management.md` — Rule 1 (derived data: cards are computed at read time, not stored unless the user saves).

#### Wave 2 closing checks

- `pnpm build` clean.
- `pnpm test` green.
- Manual verification by James (per skill rule):
  1. Visit `/onboarding`, navigate to Family history step.
  2. See the new "Family members" section at the top.
  3. Add a Mother card → mark her alive at 67 with cardiovascular at 52 and diabetes at 58.
  4. Save → reload → cards appear with the data.
  5. The legacy per-condition multiselects below still work but are not required.
  6. Click "Continue", proceed through "Deaths in the family" step (still present).
- Wave 2 PR title: **"Wave 2: family-history per-relative cards UI"**

---

### Wave 3 — Collapse: remove the legacy per-condition fields and `family_deaths` step

**What James can see after this wave merges:** The family history step is now clean. The per-condition multiselects and `_onset_age` numbers are gone. The "Deaths in the family" step is removed entirely (the questionnaire is now 5 steps instead of 6 — basics, medical, family, lifestyle, goals + consent merging via the existing flow). Any member who had legacy data still sees it correctly because `migrateLegacyFamily` runs on every load and `stripUnknownKeys` drops the orphan keys at save time.

**Tasks**

#### Task 3.1 — Remove legacy fields + step from schema

**Files affected:**
- `lib/questionnaire/questions.ts` (modify):
  - Remove `familyConditionFields()` calls from the `family` step (4 conditions × 2 fields = 8 fields removed).
  - Remove the entire `family_deaths` step definition (and the `deceasedRelativeFields()` helper if no longer used).
  - Update the `family` step's `description` to drop the dual-input acknowledgement.

**What to build:** Pure deletion + description cleanup. The `cancer_history` field stays alongside `family_members`.

After Wave 3, the `family` step's fields array is:
```ts
fields: [
  { id: "family_members", … },
  { id: "cancer_history", … },
],
```

**Acceptance criteria:**
- Step count drops from 6 to 5.
- Step indicator updates automatically.
- `pnpm build` clean.
- `pnpm test` green.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — schema-driven.

#### Task 3.2 — Assemble: drop legacy fallback path

**Files affected:**
- `lib/risk/assemble.ts` (modify — `buildFamilyHistory()` now reads only `family_members[]`; drop the `familyConditionFromMultiselect` calls but **keep the helper** since it's still needed by `migrateLegacyFamily` indirectly through tests / read-time hydration of historical exports).

Actually — drop the helper too if no caller remains. Verify with grep before deletion.

**What to build:**

Simplify `buildFamilyHistory`:

```ts
export function buildFamilyHistory(family: Record<string, unknown> | undefined): FamilyHistory {
  if (!family) return {};
  const fh: FamilyHistory = {};
  const membersRaw = (family as { family_members?: unknown }).family_members;
  const members: FamilyMemberCard[] = Array.isArray(membersRaw) ? (membersRaw as FamilyMemberCard[]) : [];

  for (const type of ["cardiovascular", "neurodegenerative", "diabetes", "osteoporosis"] as const) {
    const agg = aggregateConditionFromMembers(members, type);
    if (agg) fh[type] = agg;
  }
  const cancer = adaptCancerHistory(family.cancer_history);
  if (cancer) fh.cancer = cancer;
  return fh;
}
```

The hydration shim now becomes the only path that reads legacy keys.

**Acceptance criteria:**
- All existing risk-engine tests pass (data flows through hydration shim → cards → assemble).
- `familyConditionFromMultiselect` removed if unused, OR retained with a comment that it's only invoked by `migrateLegacyFamily` (depends on the implementation choice).
- `pnpm build` clean.

**Rules to apply:**
- `.claude/rules/ai-agents.md` — engine pure, deterministic.

#### Task 3.3 — Final test sweep + add E2E onboarding test

**Files affected:**
- `tests/unit/risk/_gp-panel-pack.test.ts` (verify still passes — fixtures may need to be updated to use `family_members` shape if they currently use legacy keys).
- `tests/integration/onboarding/family-step.test.ts` (new, optional — Vitest with mocked Supabase to verify save → load → migrate → render flow).

**What to build:**

Audit every test that constructs `health_profiles.responses` with `family.cardiovascular_relatives` etc. Migrate them to use `family.family_members[]` directly, or pipe through `migrateLegacyFamily` to confirm parity. Don't keep tests that exercise dead code.

The optional integration test:
1. Mock Supabase returns a `responses` object with legacy data.
2. Call the page's hydration logic; assert the resulting form state has `family_members[]` populated.
3. Mock save; assert the persisted shape contains `family_members[]` and NOT the old keys (because `stripUnknownKeys` drops them).

**Acceptance criteria:**
- All existing tests green; updated fixtures use the new shape.
- `pnpm build` clean.
- `pnpm test` green.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md`.

#### Wave 3 closing checks

- `pnpm build` clean.
- `pnpm test` green.
- Manual verification by James:
  1. Visit `/onboarding` as a member with no prior data → 5-step flow; family step shows only the cards UI + cancer_history.
  2. Visit `/onboarding` as a seeded member with legacy data → cards appear pre-populated; click through, save, confirm DB now has `family_members[]` and old keys are gone.
  3. Verify the engine produces a sensible `composite_risk` for both fresh and migrated users.
- Wave 3 PR title: **"Wave 3: collapse legacy family-history fields and deaths step"**

---

## Wave-completion summary table

| Wave | What James sees | Code visibility | Migration risk |
|---|---|---|---|
| **1** | Nothing (backend only). Engine reads new shape if present, falls back to legacy. | New types + assemble extension + shim helper. No UI change. | None — strictly additive. |
| **2** | New rich per-relative cards section appears at the top of the family step. Old per-condition fields and deaths step still work. | New `<FamilyMembersField>` client component + schema entry + page-level hydration shim call. | None — old paths preserved. |
| **3** | Family step collapsed to cards + cancer_history only. `family_deaths` step removed. 5-step questionnaire. | Schema fields removed. Assemble simplified. Test fixtures migrated. | Members with legacy data: hydration shim runs on every load and writes the new shape on next save. Old JSONB keys orphan and are dropped by `stripUnknownKeys`. |

## Definition of done (whole change)

1. All three waves merged.
2. `pnpm build` clean and `pnpm test` green at every wave boundary.
3. ≥ 22 new tests across the change (15 in Wave 1; 0 mandatory in Wave 2 since UI; ≥ 7 in Wave 3 fixture migration).
4. CHANGELOG, EXECUTIVE_SUMMARY written after Wave 3 merges.
5. Epic 2 outstanding item "Family-history sub-fields (age of onset, cancer types)" closed.
6. `metabolic.ts` `multiple` flag now actually fires when both parents have diabetes — the silent-bug fix is part of Wave 1.

## Risks

- **Hydration shim's regex for cause-of-death is heuristic.** A free-text "passed in his sleep" → `unknown`. Acceptable; the cause field is informational; engine doesn't read it (yet).
- **Legacy `Aunt or uncle` multiselect entry collapses to "aunt"** in the hydration shim. Members can edit. Documented in the shim comment.
- **Multiple aunts pattern**: Wave 2 supports it via repeated cards but no free-text label to disambiguate ("Aunt Mary" vs "Aunt Susan"). Out of scope; tracked as future polish.
- **Cancer history is separate** — UX shows two visually different sections in the family step. Acceptable given cancer's per-type richness.
- **Smoking / alcohol per relative is stored but unused** by the current engine. Stored for future use (parental smoking → CV uplift). Documented in the change's EXECUTIVE_SUMMARY.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. Mandatory:

1. **Wave 2 — make tests mandatory.** Both `hydrate-on-load.test.ts` and a `<FamilyMembersField>` render-and-emit test (add card → set relationship + alive/dead + age + one condition → assert `onChange` payload) must ship. Removes Wave 2's "0 mandatory tests" gap.
2. **Wave 3 — make the integration test mandatory + explicit legacy-key grep gate.** Before declaring Wave 3 done, run `rg "cardiovascular_relatives|family_deaths|deceasedRelativeFields" tests/ lib/` and confirm zero hits outside the migrate-family shim itself. The integration test (load with legacy data → save → assert old keys gone) is no longer optional.
3. **Cause-of-death regex coverage** — add `infarct`/`MI` → cardiovascular; `ALS` / `motor neurone` → neurodegenerative. Test fixtures in `migrate-family.test.ts` exercise these.
4. **Wave 2 doc note** — call out explicitly that mid-onboarding drafts with partial `family_deaths` data remain intact during Wave 2 (engine reads new shape if cards exist; legacy keys harmlessly persist until Wave 3 strips them).
5. **Hydration shim per-card edit safety test** — add a test in `migrate-family.test.ts` asserting that a member who edits one card's age does NOT have other cards' ages re-derived from the legacy `_onset_age`. Re-running `migrateLegacyFamily` on a response that already has non-empty `family_members[]` returns the existing array unchanged (the shim is short-circuited).

## Out of scope (carried forward)

- Adding a free-text `relationship_label` ("Aunt Mary").
- Engine extension to consume per-relative smoking/alcohol.
- DB migration to a typed `family_members` table.
- Backfill script that rewrites existing JSONB at rest.
- Onboarding completeness tracker UI for the new field.
- Visual / interaction polish beyond the wireframe (animations, drag-to-reorder cards, etc.).
