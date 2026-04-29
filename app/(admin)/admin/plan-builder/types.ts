// Shared types for Plan Builder — page.tsx and PlanBuilderClient.tsx

export type Org = { id: string; name: string; b2b_plan_id: string | null };

export type B2BPlan = {
  id: string;
  org_id: string;
  name: string;
  billing_basis: string;
  negotiated_discount_pct: number;
  setup_fee_cents: number;
  contract_start_date: string | null;
  contract_end_date: string | null;
  minimum_commitment_months: number;
  max_seats_per_tier: number | null;
  status: string;
  is_flagged_suspicious: boolean;
  internal_notes: string | null;
};

export type Allocation = {
  id: string;
  b2b_plan_id: string;
  plan_id: string;
  seat_count: number;
};

export type ProductInclusion = {
  id: string;
  b2b_plan_id: string;
  allocation_id: string;
  product_id: string;
  quantity: number;
  frequency: string;
  wholesale_cost_cents: number;
  client_price_cents: number;
  is_visible_to_client: boolean;
};

export type TierPlan = {
  id: string;
  name: string;
  tier: string;
  base_price_cents: number;
};

export type Product = {
  id: string;
  name: string;
  product_code: string;
  category: string;
  supplier_id: string;
  retail_cents: number;
  wholesale_cents: number;
  subscription_type: string;
};

export type AuditRow = {
  id: string;
  b2b_plan_id: string;
  allocation_id: string;
  plan_id: string;
  old_seat_count: number | null;
  new_seat_count: number;
  delta: number;
  is_flagged: boolean;
  flag_reason: string | null;
};

export type OrgMember = {
  org_id: string;
  user_uuid: string;
  role: string;
  tier_allocation_id: string | null;
};

export type OrgMemberProduct = {
  id: string;
  org_id: string;
  user_uuid: string;
  inclusion_id: string;
  is_enabled: boolean;
};

export type PlatformSetting = {
  key: string;
  value: unknown;
};
