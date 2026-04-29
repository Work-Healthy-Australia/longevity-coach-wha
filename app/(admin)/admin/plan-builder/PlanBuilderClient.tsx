"use client";

import { useState, useCallback } from "react";
import type {
  Org,
  B2BPlan,
  Allocation,
  ProductInclusion,
  TierPlan,
  Product,
  AuditRow,
  OrgMember,
  OrgMemberProduct,
  PlatformSetting,
} from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  orgs: Org[];
  b2bPlans: B2BPlan[];
  allocations: Allocation[];
  productInclusions: ProductInclusion[];
  tierPlans: TierPlan[];
  products: Product[];
  platformSettings: PlatformSetting[];
  flaggedAudit: AuditRow[];
  orgMembers: OrgMember[];
  orgMemberProducts: OrgMemberProduct[];
  userEmails: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`;
}

function getSetting(
  settings: PlatformSetting[],
  key: string,
  fallback: number
): number {
  const row = settings.find((s) => s.key === key);
  if (!row) return fallback;
  const v = row.value;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "value" in v)
    return Number((v as { value: unknown }).value) || fallback;
  return Number(v) || fallback;
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider" />
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanBuilderClient({
  orgs,
  b2bPlans: initialPlans,
  allocations: initialAllocations,
  productInclusions: initialInclusions,
  tierPlans,
  products,
  platformSettings,
  flaggedAudit: initialFlagged,
  orgMembers,
  orgMemberProducts: initialMemberProducts,
  userEmails,
}: Props) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    orgs[0]?.id ?? null
  );
  const [b2bPlans, setB2bPlans] = useState<B2BPlan[]>(initialPlans);
  const [allocations, setAllocations] =
    useState<Allocation[]>(initialAllocations);
  const [productInclusions, setProductInclusions] =
    useState<ProductInclusion[]>(initialInclusions);
  const [flaggedAudit, setFlaggedAudit] = useState<AuditRow[]>(initialFlagged);
  const [memberProducts, setMemberProducts] =
    useState<OrgMemberProduct[]>(initialMemberProducts);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMembersFor, setShowMembersFor] = useState<string | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);

  // New client form state
  const [newClientName, setNewClientName] = useState("");
  const [localOrgs, setLocalOrgs] = useState<Org[]>(orgs);

  const thresholdAbs = getSetting(platformSettings, "suspicion_seat_threshold", 500);
  const thresholdPct = getSetting(platformSettings, "suspicion_pct_threshold", 50);
  const maxSeatsDefault = getSetting(platformSettings, "max_seats_per_tier_default", 10000);

  const selectedOrg = localOrgs.find((o) => o.id === selectedOrgId) ?? null;
  const selectedPlan = b2bPlans.find((p) => p.org_id === selectedOrgId) ?? null;
  const planAllocations = allocations.filter(
    (a) => a.b2b_plan_id === selectedPlan?.id
  );
  const planInclusions = productInclusions.filter(
    (i) => i.b2b_plan_id === selectedPlan?.id
  );

  // Editor form state — initialised from selectedPlan
  const [formName, setFormName] = useState(selectedPlan?.name ?? "");
  const [formBilling, setFormBilling] = useState(
    selectedPlan?.billing_basis ?? "per_seat_monthly"
  );
  const [formDiscount, setFormDiscount] = useState(
    selectedPlan?.negotiated_discount_pct ?? 0
  );
  const [formStart, setFormStart] = useState(
    selectedPlan?.contract_start_date ?? ""
  );
  const [formEnd, setFormEnd] = useState(
    selectedPlan?.contract_end_date ?? ""
  );
  const [formMinMonths, setFormMinMonths] = useState(
    selectedPlan?.minimum_commitment_months ?? 12
  );
  const [formMaxSeats, setFormMaxSeats] = useState<number | "">(
    selectedPlan?.max_seats_per_tier ?? ""
  );
  const [formNotes, setFormNotes] = useState(
    selectedPlan?.internal_notes ?? ""
  );

  // Seat count overrides per tier (plan_id → seat_count)
  const [seatOverrides, setSeatOverrides] = useState<Record<string, number>>(
    () => {
      const map: Record<string, number> = {};
      for (const a of initialAllocations) {
        map[`${a.b2b_plan_id}:${a.plan_id}`] = a.seat_count;
      }
      return map;
    }
  );

  // Product add form
  const [addProductId, setAddProductId] = useState("");
  const [addAllocationId, setAddAllocationId] = useState("");

  const handleSelectOrg = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId);
      setError(null);
      setInlineWarning(null);
      const plan = b2bPlans.find((p) => p.org_id === orgId) ?? null;
      setFormName(plan?.name ?? "");
      setFormBilling(plan?.billing_basis ?? "per_seat_monthly");
      setFormDiscount(plan?.negotiated_discount_pct ?? 0);
      setFormStart(plan?.contract_start_date ?? "");
      setFormEnd(plan?.contract_end_date ?? "");
      setFormMinMonths(plan?.minimum_commitment_months ?? 12);
      setFormMaxSeats(plan?.max_seats_per_tier ?? "");
      setFormNotes(plan?.internal_notes ?? "");
      setShowMembersFor(null);
    },
    [b2bPlans]
  );

  // Compute monthly total from seat overrides
  function computeMonthly(): number {
    if (!selectedPlan) return 0;
    return tierPlans.reduce((sum, tp) => {
      const seats =
        seatOverrides[`${selectedPlan.id}:${tp.id}`] ?? 0;
      return sum + seats * (tp.base_price_cents / 100);
    }, 0);
  }

  const monthly = computeMonthly();
  const annual = monthly * 12 * (1 - formDiscount / 100);

  // Compute cost for left panel row
  function orgMonthly(plan: B2BPlan | undefined): number {
    if (!plan) return 0;
    return tierPlans.reduce((sum, tp) => {
      const alloc = allocations.find(
        (a) => a.b2b_plan_id === plan.id && a.plan_id === tp.id
      );
      return sum + (alloc?.seat_count ?? 0) * (tp.base_price_cents / 100);
    }, 0);
  }

  // ── Save plan details ──────────────────────────────────────────────────────

  async function handleSavePlan(status: string) {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);

    // Check seat thresholds before saving allocations
    let hasThresholdWarning = false;
    let warningMsg = "";
    for (const tp of tierPlans) {
      const key = `${selectedPlan.id}:${tp.id}`;
      const newSeats = seatOverrides[key] ?? 0;
      const existing =
        allocations.find(
          (a) => a.b2b_plan_id === selectedPlan.id && a.plan_id === tp.id
        )?.seat_count ?? 0;
      const delta = newSeats - existing;
      if (delta > 0) {
        const pctIncrease = existing > 0 ? (delta / existing) * 100 : Infinity;
        if (delta > thresholdAbs || pctIncrease > thresholdPct) {
          hasThresholdWarning = true;
          warningMsg = `This increases ${tp.name} seats by +${delta}${existing > 0 ? ` (${Math.round(pctIncrease)}%)` : ""}. Exceeds the suspicion threshold — will require admin approval.`;
          break;
        }
      }
    }

    if (hasThresholdWarning && !inlineWarning) {
      setInlineWarning(warningMsg + " Save anyway?");
      setSaving(false);
      return;
    }
    setInlineWarning(null);

    try {
      // Update plan details
      const detailsRes = await fetch(
        `/api/admin/b2b-plans/${selectedPlan.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            billing_basis: formBilling,
            negotiated_discount_pct: formDiscount,
            contract_start_date: formStart || null,
            contract_end_date: formEnd || null,
            minimum_commitment_months: formMinMonths,
            max_seats_per_tier: formMaxSeats === "" ? null : formMaxSeats,
            status,
            internal_notes: formNotes || null,
          }),
        }
      );
      if (!detailsRes.ok) {
        const j = await detailsRes.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Save failed");
      }
      const updatedPlan = (await detailsRes.json()) as B2BPlan;
      setB2bPlans((prev) =>
        prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
      );

      // Save allocations
      const allocPayload = tierPlans.map((tp) => ({
        plan_id: tp.id,
        seat_count: seatOverrides[`${selectedPlan.id}:${tp.id}`] ?? 0,
      }));
      const allocRes = await fetch(
        `/api/admin/b2b-plans/${selectedPlan.id}/allocations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allocations: allocPayload }),
        }
      );
      if (!allocRes.ok) {
        const j = await allocRes.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Allocation save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ── Create plan ────────────────────────────────────────────────────────────

  async function handleCreatePlan() {
    if (!newClientName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Always create a new org
      const orgRes = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      if (!orgRes.ok) {
        const j = await orgRes.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Create org failed");
      }
      const newOrg = (await orgRes.json()) as Org;
      setLocalOrgs((prev) => [...prev, newOrg]);

      // Then create the plan for it (name defaults to org name)
      const res = await fetch("/api/admin/b2b-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: newOrg.id, name: newClientName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Create plan failed");
      }
      const created = (await res.json()) as B2BPlan;
      setB2bPlans((prev) => [created, ...prev]);
      setShowNewClientForm(false);
      setNewClientName("");
      handleSelectOrg(newOrg.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ── Remove product inclusion ───────────────────────────────────────────────

  async function handleRemoveInclusion(inclusionId: string) {
    if (!selectedPlan) return;
    try {
      const res = await fetch(
        `/api/admin/b2b-plans/${selectedPlan.id}/product-inclusions?inclusion_id=${inclusionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Remove failed");
      setProductInclusions((prev) => prev.filter((i) => i.id !== inclusionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  // ── Add product inclusion ──────────────────────────────────────────────────

  async function handleAddInclusion() {
    if (!selectedPlan || !addProductId || !addAllocationId) return;
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/b2b-plans/${selectedPlan.id}/product-inclusions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allocation_id: addAllocationId,
            product_id: addProductId,
            quantity: 1,
            frequency: "annually",
            wholesale_cost_cents: product.wholesale_cents,
            client_price_cents: 0,
          }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Add failed");
      }
      const created = (await res.json()) as ProductInclusion;
      setProductInclusions((prev) => [...prev, created]);
      setAddProductId("");
      setAddAllocationId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ── Review audit row ───────────────────────────────────────────────────────

  async function handleReviewAudit(
    planId: string,
    auditId: string,
    approved: boolean
  ) {
    try {
      const res = await fetch(
        `/api/admin/b2b-plans/${planId}/seat-audit/${auditId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }
      );
      if (!res.ok) throw new Error("Review failed");
      setFlaggedAudit((prev) => prev.filter((a) => a.id !== auditId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  // ── Member product toggle ─────────────────────────────────────────────────

  async function handleMemberToggle(
    userUuid: string,
    inclusionId: string,
    enabled: boolean
  ) {
    try {
      await fetch("/api/org/member-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uuid: userUuid,
          inclusion_id: inclusionId,
          is_enabled: enabled,
        }),
      });
      setMemberProducts((prev) => {
        const existing = prev.find(
          (mp) => mp.user_uuid === userUuid && mp.inclusion_id === inclusionId
        );
        if (existing) {
          return prev.map((mp) =>
            mp.user_uuid === userUuid && mp.inclusion_id === inclusionId
              ? { ...mp, is_enabled: enabled }
              : mp
          );
        }
        return [
          ...prev,
          {
            id: `${userUuid}:${inclusionId}`,
            org_id: selectedOrg?.id ?? "",
            user_uuid: userUuid,
            inclusion_id: inclusionId,
            is_enabled: enabled,
          },
        ];
      });
    } catch {
      // Fail silently — toggle will revert on next load
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const orgMemebersForPlan = selectedPlan
    ? orgMembers.filter((m) => m.org_id === selectedPlan.org_id)
    : [];

  return (
    <div className="pb-page">
      {/* Header */}
      <div className="pb-header">
        <h1>Plan Builder</h1>
      </div>

      {/* Warning banners for flagged audit rows */}
      {flaggedAudit.map((audit) => {
        const plan = b2bPlans.find((p) => p.id === audit.b2b_plan_id);
        const org = orgs.find((o) => o.id === plan?.org_id);
        const tier = tierPlans.find((tp) => tp.id === audit.plan_id);
        return (
          <div key={audit.id} className="warning-banner">
            <span className="warning-icon">⚠</span>
            <div className="warning-text">
              <strong>
                Suspicious seat change — {org?.name ?? "Unknown org"}
              </strong>
              {tier?.name} tier: +{audit.delta} seats
              {audit.old_seat_count != null && audit.old_seat_count > 0
                ? ` (${Math.round((audit.delta / audit.old_seat_count) * 100)}% increase)`
                : ""}
              .{audit.flag_reason ? ` ${audit.flag_reason}` : ""}
            </div>
            <div className="warning-actions">
              <button
                className="btn-approve"
                onClick={() =>
                  handleReviewAudit(audit.b2b_plan_id, audit.id, true)
                }
              >
                Approve
              </button>
              <button
                className="btn-reject"
                onClick={() =>
                  handleReviewAudit(audit.b2b_plan_id, audit.id, false)
                }
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}

      {error && <div className="pb-error">{error}</div>}

      {/* Main layout */}
      <div className="pb-layout">
        {/* Left panel */}
        <div className="pb-client-list">
          <div className="pb-list-header">
            Clients
            <button
              className="pb-new-client-btn"
              onClick={() => setShowNewClientForm(true)}
            >
              + New Client
            </button>
          </div>
          {localOrgs.map((org) => {
            const plan = b2bPlans.find((p) => p.org_id === org.id);
            const mo = orgMonthly(plan);
            return (
              <div
                key={org.id}
                className={`pb-client-row${selectedOrgId === org.id ? " active" : ""}`}
                onClick={() => handleSelectOrg(org.id)}
              >
                <div className="pb-client-name">{org.name}</div>
                <div className="pb-client-meta">
                  {plan ? (
                    <>
                      <span
                        className={`status-badge status-${plan.status}`}
                      >
                        {plan.status.charAt(0).toUpperCase() +
                          plan.status.slice(1)}
                      </span>
                      <span>${mo.toLocaleString("en-AU")}/mo</span>
                    </>
                  ) : (
                    <span className="status-badge status-no-plan">
                      No plan
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {localOrgs.length === 0 && (
            <div style={{ padding: "20px", color: "#9AABBA", fontSize: 13 }}>
              No organisations yet. Click <strong>+ New Client</strong> to create one.
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="pb-editor">
          {!selectedOrg ? (
            <div className="pb-no-plan">Select an organisation to edit.</div>
          ) : !selectedPlan ? (
            <div className="pb-no-plan">
              <p>No plan yet for {selectedOrg.name}.</p>
              <button
                className="pb-create-plan-btn"
                onClick={() => {
                  setNewOrgId(selectedOrg.id);
                  setShowNewClientForm(true);
                }}
              >
                Create Plan
              </button>
            </div>
          ) : (
            <>
              {/* Title */}
              <div className="pb-editor-title">
                {selectedOrg.name}
                <span className={`status-badge status-${selectedPlan.status}`}>
                  {selectedPlan.status.charAt(0).toUpperCase() +
                    selectedPlan.status.slice(1)}
                </span>
              </div>

              {/* Inline warning */}
              {inlineWarning && (
                <div className="pb-warning-inline">
                  {inlineWarning}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      className="btn-approve"
                      disabled={saving}
                      onClick={() => {
                        setInlineWarning(null);
                        handleSavePlan(selectedPlan.status);
                      }}
                    >
                      Save anyway
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={() => setInlineWarning(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Plan details */}
              <div className="sub-section-title">Plan details</div>
              <div className="pb-form-grid">
                <div className="form-field">
                  <label>Plan name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Billing basis</label>
                  <select
                    value={formBilling}
                    onChange={(e) => setFormBilling(e.target.value)}
                  >
                    <option value="per_seat_monthly">Per seat monthly</option>
                    <option value="per_seat_annual">Per seat annual</option>
                    <option value="flat_monthly">Flat monthly</option>
                    <option value="flat_annual">Flat annual</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Annual discount (%)</label>
                  <input
                    type="number"
                    value={formDiscount}
                    min={0}
                    max={100}
                    onChange={(e) => setFormDiscount(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="pb-form-2col" style={{ marginTop: 12 }}>
                <div className="form-field">
                  <label>Contract start</label>
                  <input
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Contract end</label>
                  <input
                    type="date"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="pb-form-2col" style={{ marginTop: 12, marginBottom: 0 }}>
                <div className="form-field">
                  <label>Min commitment (months)</label>
                  <input
                    type="number"
                    value={formMinMonths}
                    min={1}
                    onChange={(e) => setFormMinMonths(Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label>Max seats per tier (this client)</label>
                  <input
                    type="number"
                    value={formMaxSeats}
                    placeholder={String(maxSeatsDefault)}
                    onChange={(e) =>
                      setFormMaxSeats(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                  <div className="note-text">
                    Platform default: {maxSeatsDefault.toLocaleString()} — override here for this client
                  </div>
                </div>
              </div>

              <div className="suspicion-info" style={{ marginTop: 12 }}>
                <strong>Suspicion check settings:</strong> Suspicious changes
                flagged at &gt;{thresholdPct}% increase or &gt;{thresholdAbs}{" "}
                seats per update (platform defaults — configurable in
                platform_settings).
              </div>

              <hr className="divider" style={{ margin: "0 0 18px" }} />

              {/* Tier allocations */}
              <div className="sub-section-title">Tier allocations</div>
              <table className="tier-alloc-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Seats</th>
                    <th>Price/seat</th>
                    <th>Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {tierPlans.map((tp) => {
                    const key = `${selectedPlan.id}:${tp.id}`;
                    const seats = seatOverrides[key] ?? 0;
                    const subtotal = seats * (tp.base_price_cents / 100);
                    return (
                      <tr key={tp.id}>
                        <td>
                          <span
                            className={`tier-badge tier-${tp.tier.toLowerCase()}`}
                          >
                            {tp.name}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={seats}
                            onChange={(e) =>
                              setSeatOverrides((prev) => ({
                                ...prev,
                                [key]: Number(e.target.value),
                              }))
                            }
                          />
                        </td>
                        <td>{centsToDisplay(tp.base_price_cents)}</td>
                        <td>${subtotal.toLocaleString("en-AU")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="totals-bar">
                <div>
                  <div className="label">Monthly total</div>
                  <div className="val">
                    ${monthly.toLocaleString("en-AU")}
                  </div>
                </div>
                <div>
                  <div className="label">Annual (−{formDiscount}%)</div>
                  <div className="val">
                    ${annual.toLocaleString("en-AU", { maximumFractionDigits: 0 })}/yr
                  </div>
                </div>
              </div>

              <hr className="divider" style={{ margin: "0 0 18px" }} />

              {/* Bundled products */}
              <div className="sub-section-title">Bundled products</div>
              <p
                style={{
                  fontSize: 13,
                  color: "#6B7C85",
                  margin: "0 0 14px",
                }}
              >
                Add supplier products to include in this plan for a specific
                tier allocation.
              </p>

              <table className="inclusion-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Tier</th>
                    <th>Qty</th>
                    <th>Frequency</th>
                    <th>Wholesale $</th>
                    <th>Client price $</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {planInclusions.map((inc) => {
                    const product = products.find(
                      (p) => p.id === inc.product_id
                    );
                    const alloc = planAllocations.find(
                      (a) => a.id === inc.allocation_id
                    );
                    const tier = tierPlans.find(
                      (tp) => tp.id === alloc?.plan_id
                    );
                    return (
                      <tr key={inc.id}>
                        <td>
                          <strong>
                            {product?.name ?? inc.product_id}
                          </strong>
                        </td>
                        <td>{product?.category ?? "—"}</td>
                        <td>
                          {tier ? (
                            <span
                              className={`tier-badge tier-${tier.tier.toLowerCase()}`}
                            >
                              {tier.name}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            defaultValue={inc.quantity}
                            min={1}
                          />
                        </td>
                        <td>
                          <select defaultValue={inc.frequency}>
                            <option value="annually">annually</option>
                            <option value="quarterly">quarterly</option>
                            <option value="monthly">monthly</option>
                          </select>
                        </td>
                        <td>
                          {centsToDisplay(inc.wholesale_cost_cents)}
                        </td>
                        <td>
                          {centsToDisplay(inc.client_price_cents)}
                        </td>
                        <td>
                          <button
                            className="btn-remove"
                            onClick={() => handleRemoveInclusion(inc.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {planInclusions.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ color: "#9AABBA", fontStyle: "italic" }}
                      >
                        No products added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add product row */}
              <div className="product-add-row">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                >
                  <option value="">— Select a product to add —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category} · {centsToDisplay(p.wholesale_cents)}{" "}
                      wholesale)
                    </option>
                  ))}
                </select>
                <select
                  value={addAllocationId}
                  onChange={(e) => setAddAllocationId(e.target.value)}
                >
                  <option value="">— Tier —</option>
                  {planAllocations.map((a) => {
                    const tp = tierPlans.find((t) => t.id === a.plan_id);
                    return (
                      <option key={a.id} value={a.id}>
                        {tp?.name ?? a.plan_id} tier
                      </option>
                    );
                  })}
                </select>
                <button
                  className="btn-add"
                  onClick={handleAddInclusion}
                  disabled={!addProductId || !addAllocationId || saving}
                >
                  + Add
                </button>
              </div>

              {/* Internal notes */}
              <div className="form-field" style={{ marginBottom: 18 }}>
                <label>Internal notes</label>
                <textarea
                  style={{ minHeight: 72 }}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <hr className="divider" />

              {/* Members section */}
              <div className="members-section">
                <button
                  className="members-toggle-btn"
                  onClick={() =>
                    setShowMembersFor(
                      showMembersFor === selectedPlan.id
                        ? null
                        : selectedPlan.id
                    )
                  }
                >
                  {showMembersFor === selectedPlan.id
                    ? "▲ Hide members"
                    : "▼ Show members"}{" "}
                  ({orgMemebersForPlan.length})
                </button>

                {showMembersFor === selectedPlan.id && (
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Tier</th>
                        <th>Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgMemebersForPlan.map((member) => {
                        const email =
                          userEmails[member.user_uuid] ?? member.user_uuid;
                        const alloc = allocations.find(
                          (a) => a.id === member.tier_allocation_id
                        );
                        const tier = tierPlans.find(
                          (tp) => tp.id === alloc?.plan_id
                        );
                        const memberInclusions = planInclusions.filter(
                          (i) => i.allocation_id === alloc?.id
                        );
                        return (
                          <tr key={member.user_uuid}>
                            <td>{email}</td>
                            <td>{member.role}</td>
                            <td>
                              {tier ? (
                                <span
                                  className={`tier-badge tier-${tier.tier.toLowerCase()}`}
                                >
                                  {tier.name}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <div className="toggle-wrap">
                                {memberInclusions.map((inc) => {
                                  const product = products.find(
                                    (p) => p.id === inc.product_id
                                  );
                                  const mp = memberProducts.find(
                                    (mp) =>
                                      mp.user_uuid === member.user_uuid &&
                                      mp.inclusion_id === inc.id
                                  );
                                  const isEnabled = mp?.is_enabled ?? true;
                                  return (
                                    <div
                                      key={inc.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        marginRight: 12,
                                      }}
                                    >
                                      <ToggleSwitch
                                        checked={isEnabled}
                                        onChange={(v) =>
                                          handleMemberToggle(
                                            member.user_uuid,
                                            inc.id,
                                            v
                                          )
                                        }
                                      />
                                      <span style={{ fontSize: 11, color: "#6B7C85" }}>
                                        {product?.name ?? inc.product_id}
                                      </span>
                                    </div>
                                  );
                                })}
                                {memberInclusions.length === 0 && (
                                  <span style={{ fontSize: 12, color: "#9AABBA" }}>
                                    No products
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {orgMemebersForPlan.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{ color: "#9AABBA", fontStyle: "italic" }}
                          >
                            No members in this org.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Action buttons */}
              <div className="pb-actions">
                <button
                  className="btn-cancel"
                  onClick={() => handleSelectOrg(selectedOrgId!)}
                >
                  Cancel
                </button>
                <button
                  className="btn-save-draft"
                  disabled={saving}
                  onClick={() => handleSavePlan("draft")}
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button
                  className="btn-activate"
                  disabled={saving}
                  onClick={() => handleSavePlan("active")}
                >
                  Activate plan
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New client modal */}
      {showNewClientForm && (
        <div
          className="pb-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewClientForm(false);
              setNewClientName("");
            }
          }}
        >
          <div className="pb-modal">
            <h2>New B2B Client</h2>
            <div className="form-field">
              <label>Client / organisation name</label>
              <input
                type="text"
                value={newClientName}
                placeholder="e.g. Acme Corp"
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlan()}
                autoFocus
              />
            </div>
            <div className="pb-modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowNewClientForm(false);
                  setNewClientName("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn-activate"
                disabled={saving || !newClientName.trim()}
                onClick={handleCreatePlan}
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
