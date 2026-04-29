"use client";

import { useState, useTransition, useCallback } from "react";

export type Plan = {
  id: string;
  name: string;
  tier: string;
  base_price_cents: number;
  annual_discount_pct: number;
  annual_price_cents: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  setup_fee_cents: number;
  minimum_commitment_months: number;
  public_description: string | null;
  is_active: boolean;
};

export type JanetService = {
  id: string;
  name: string;
  unit_type: string;
  internal_cost_cents: number;
  retail_value_cents: number;
  delivery_owner: string | null;
  is_active: boolean;
};

export type FeatureKey = {
  key: string;
  label: string;
  tier_affinity: string;
  is_active: boolean;
};

export type TierInclusion = {
  id: string;
  plan_id: string;
  janet_service_id: string;
  quantity: number;
  frequency: string;
  wholesale_cost_cents: number;
  retail_value_cents: number;
  is_visible_to_customer: boolean;
};

type Props = {
  plans: Plan[];
  janetServices: JanetService[];
  tierInclusions: TierInclusion[];
  featureKeys: FeatureKey[];
};

const FREQ_MULTIPLIER: Record<string, number> = {
  monthly: 1,
  quarterly: 1 / 3,
  annually: 1 / 12,
  once_off: 1 / 12,
  per_participant: 1,
};

function tierColor(tier: string): string {
  if (tier === "core") return "#1A3A4A";
  if (tier === "clinical") return "#2F6F8F";
  if (tier === "elite") return "#5B21B6";
  return "#2B7A2B";
}

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function calcAnnualPrice(baseMonthly: number, discountPct: number): string {
  return `$${((baseMonthly * 12 * (1 - discountPct / 100)) / 100).toFixed(2)}/yr`;
}

async function apiPut(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  }
}

async function apiPost(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  }
}

export function TiersClient({ plans, janetServices, tierInclusions, featureKeys }: Props) {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [localPlans, setLocalPlans] = useState<Plan[]>(plans);
  const [localInclusions, setLocalInclusions] = useState<TierInclusion[]>(tierInclusions);
  const [localFeatureKeys, setLocalFeatureKeys] = useState<FeatureKey[]>(featureKeys);
  const [localServices, setLocalServices] = useState<JanetService[]>(janetServices);
  const [showJanetPanel, setShowJanetPanel] = useState(false);
  const [showFlagsPanel, setShowFlagsPanel] = useState(false);
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [newTierName, setNewTierName] = useState("");
  const [newTierSlug, setNewTierSlug] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");
  const [newTierDiscount, setNewTierDiscount] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const getPlan = (tier: string) => localPlans.find((p) => p.tier === tier);

  const getInclusions = (planId: string) =>
    localInclusions.filter((i) => i.plan_id === planId);

  const handleToggleExpand = (tier: string) => {
    setExpandedTier((prev) => (prev === tier ? null : tier));
    setError(null);
  };

  const handlePlanChange = (tier: string, field: keyof Plan, value: unknown) => {
    setLocalPlans((prev) =>
      prev.map((p) => (p.tier === tier ? { ...p, [field]: value } : p)),
    );
  };

  const handleInclusionChange = (
    planId: string,
    serviceId: string,
    field: keyof TierInclusion,
    value: unknown,
  ) => {
    setLocalInclusions((prev) =>
      prev.map((inc) =>
        inc.plan_id === planId && inc.janet_service_id === serviceId
          ? { ...inc, [field]: value }
          : inc,
      ),
    );
  };

  const handleToggleInclusion = (planId: string, serviceId: string, checked: boolean) => {
    if (checked) {
      const existing = localInclusions.find(
        (i) => i.plan_id === planId && i.janet_service_id === serviceId,
      );
      if (!existing) {
        setLocalInclusions((prev) => [
          ...prev,
          {
            id: `new-${Date.now()}`,
            plan_id: planId,
            janet_service_id: serviceId,
            quantity: 1,
            frequency: "monthly",
            wholesale_cost_cents: 0,
            retail_value_cents: 0,
            is_visible_to_customer: true,
          },
        ]);
      }
    } else {
      setLocalInclusions((prev) =>
        prev.filter(
          (i) => !(i.plan_id === planId && i.janet_service_id === serviceId),
        ),
      );
    }
  };

  const handleSave = useCallback(
    (tier: string) => {
      const plan = getPlan(tier);
      if (!plan) return;

      startTransition(async () => {
        try {
          setError(null);
          await apiPut(`/api/admin/tiers/${plan.id}`, {
            name: plan.name,
            base_price_cents: plan.base_price_cents,
            annual_discount_pct: plan.annual_discount_pct,
            annual_price_cents: plan.annual_price_cents,
            stripe_price_id_monthly: plan.stripe_price_id_monthly,
            stripe_price_id_annual: plan.stripe_price_id_annual,
            setup_fee_cents: plan.setup_fee_cents,
            minimum_commitment_months: plan.minimum_commitment_months,
            public_description: plan.public_description,
            is_active: plan.is_active,
          });

          const planInclusions = getInclusions(plan.id);
          for (const inc of planInclusions) {
            await apiPost("/api/admin/tier-inclusions", {
              plan_id: inc.plan_id,
              janet_service_id: inc.janet_service_id,
              quantity: inc.quantity,
              frequency: inc.frequency,
              wholesale_cost_cents: inc.wholesale_cost_cents,
              retail_value_cents: inc.retail_value_cents,
              is_visible_to_customer: inc.is_visible_to_customer,
            });
          }

          setExpandedTier(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localPlans, localInclusions],
  );

  const handleServiceSave = useCallback((svc: JanetService) => {
    startTransition(async () => {
      try {
        await apiPut(`/api/admin/janet-services/${svc.id}`, {
          name: svc.name,
          unit_type: svc.unit_type,
          internal_cost_cents: svc.internal_cost_cents,
          retail_value_cents: svc.retail_value_cents,
          delivery_owner: svc.delivery_owner,
          is_active: svc.is_active,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }, []);

  const handleAddService = useCallback(() => {
    startTransition(async () => {
      try {
        const result = (await apiPost("/api/admin/janet-services", {
          name: "New Service",
          unit_type: "per_session",
          internal_cost_cents: 0,
          retail_value_cents: 0,
          delivery_owner: null,
          is_active: true,
        })) as JanetService;
        setLocalServices((prev) => [...prev, result]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }, []);

  const handleDeleteService = useCallback((id: string) => {
    startTransition(async () => {
      try {
        await apiDelete(`/api/admin/janet-services/${id}`);
        setLocalServices((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: false } : s)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }, []);

  const handleAddFeatureKey = useCallback((key: string, label: string, tierAffinity: string) => {
    startTransition(async () => {
      try {
        const result = (await apiPost("/api/admin/feature-keys", {
          key,
          label,
          tier_affinity: tierAffinity,
          is_active: true,
        })) as FeatureKey;
        setLocalFeatureKeys((prev) => [...prev, result]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }, []);

  const handleDeactivateFlag = useCallback((key: string) => {
    startTransition(async () => {
      try {
        await apiDelete(`/api/admin/feature-keys/${key}`);
        setLocalFeatureKeys((prev) =>
          prev.map((f) => (f.key === key ? { ...f, is_active: false } : f)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Deactivate failed");
      }
    });
  }, []);

  const handleDeleteTier = useCallback((planId: string) => {
    startTransition(async () => {
      try {
        setError(null);
        await apiDelete(`/api/admin/tiers/${planId}`);
        setLocalPlans((prev) => prev.filter((p) => p.id !== planId));
        setLocalInclusions((prev) => prev.filter((i) => i.plan_id !== planId));
        setExpandedTier(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }, []);

  const handleAddTier = useCallback(() => {
    if (!newTierName.trim() || !newTierSlug.trim()) return;
    startTransition(async () => {
      try {
        setError(null);
        const slug = newTierSlug.trim().toLowerCase().replace(/\s+/g, "_");
        const result = (await apiPost("/api/admin/tiers", {
          name: newTierName.trim(),
          tier: slug,
          base_price_cents: Math.round(Number(newTierPrice || 0) * 100),
          annual_discount_pct: Number(newTierDiscount || 0),
        })) as Plan;
        setLocalPlans((prev) => [...prev, result]);
        setShowAddTierModal(false);
        setNewTierName("");
        setNewTierSlug("");
        setNewTierPrice("");
        setNewTierDiscount("20");
        setExpandedTier(result.tier);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }, [newTierName, newTierSlug, newTierPrice, newTierDiscount]);

  return (
    <>
      <div className="tiers-header">
        <div className="tiers-header-left">
          <h1>Tiers</h1>
          <p>/admin/tiers — configure subscription tiers (B2C)</p>
        </div>
        <div className="tiers-header-actions">
          <button className="btn-outline btn-sm" onClick={() => setShowFlagsPanel(true)}>
            Feature Keys
          </button>
          <button className="btn-outline btn-sm" onClick={() => setShowJanetPanel(true)}>
            Janet Services
          </button>
          <button className="btn-primary btn-sm" onClick={() => setShowAddTierModal(true)}>
            + Add Tier
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Horizontal tier card row */}
      <div className="tier-cards">
        {localPlans.map((plan) => {
          const inclCount = getInclusions(plan.id).length;
          const annualDisplay = calcAnnualPrice(plan.base_price_cents, plan.annual_discount_pct);
          const isEditing = expandedTier === plan.tier;
          return (
            <div key={plan.id} className={`tier-card${isEditing ? " editing" : ""}`}>
              <div className="tier-card-name">{plan.name}</div>
              <div className="tier-card-price" style={{ color: tierColor(plan.tier) }}>
                {centsToDisplay(plan.base_price_cents)}
                <span style={{ fontSize: 14, fontWeight: 400, color: "#9AABBA" }}>/mo</span>
              </div>
              <div className="tier-card-meta">
                {inclCount} inclusion{inclCount !== 1 ? "s" : ""} · Annual: {annualDisplay}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span className={`pill ${plan.is_active ? "pill-green" : "pill-grey"}`}>
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className={isEditing ? "btn-primary btn-xs" : "btn-outline btn-xs"}
                    onClick={() => handleToggleExpand(plan.tier)}
                  >
                    {isEditing ? "Editing ▾" : "Edit"}
                  </button>
                  <button
                    className="btn-danger-xs"
                    title="Delete tier"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm(`Delete "${plan.name}" tier? This removes all its service inclusions too.`)) {
                        handleDeleteTier(plan.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor below the card row */}
      {expandedTier && (() => {
        const plan = getPlan(expandedTier);
        return (
          <TierEditor
            tier={expandedTier}
            plan={plan}
            allServices={localServices}
            inclusions={plan ? getInclusions(plan.id) : []}
            featureKeys={localFeatureKeys}
            isPending={isPending}
            onPlanChange={(field, value) => handlePlanChange(expandedTier, field, value)}
            onInclusionChange={handleInclusionChange}
            onToggleInclusion={handleToggleInclusion}
            onSave={() => handleSave(expandedTier)}
            onCancel={() => setExpandedTier(null)}
            onAddCustomFlag={handleAddFeatureKey}
            error={error}
          />
        );
      })()}

      {/* Add Tier modal */}
      {showAddTierModal && (
        <>
          <div className="panel-overlay" onClick={() => setShowAddTierModal(false)} />
          <div className="tier-modal">
            <div className="panel-header">
              <div className="panel-title">Add New Tier</div>
              <button
                className="panel-close"
                onClick={() => setShowAddTierModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="form-field">
              <label>Display name</label>
              <input
                type="text"
                value={newTierName}
                placeholder="e.g. Premium"
                onChange={(e) => setNewTierName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Tier slug</label>
              <input
                type="text"
                value={newTierSlug}
                placeholder="e.g. premium"
                onChange={(e) => setNewTierSlug(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Monthly price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newTierPrice}
                placeholder="0.00"
                onChange={(e) => setNewTierPrice(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Annual discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={newTierDiscount}
                onChange={(e) => setNewTierDiscount(e.target.value)}
              />
            </div>
            <div className="editor-actions" style={{ marginTop: 20 }}>
              <button
                className="btn-outline btn-sm"
                onClick={() => setShowAddTierModal(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                disabled={isPending || !newTierName.trim() || !newTierSlug.trim()}
                onClick={handleAddTier}
              >
                {isPending ? "Creating…" : "Create tier"}
              </button>
            </div>
          </div>
        </>
      )}

      {showJanetPanel && (
        <>
          <div className="panel-overlay" onClick={() => setShowJanetPanel(false)} />
          <JanetServicesPanel
            services={localServices}
            onClose={() => setShowJanetPanel(false)}
            onSave={handleServiceSave}
            onAdd={handleAddService}
            onDelete={handleDeleteService}
            onUpdate={(id, field, value) =>
              setLocalServices((prev) =>
                prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
              )
            }
          />
        </>
      )}

      {showFlagsPanel && (
        <>
          <div className="panel-overlay" onClick={() => setShowFlagsPanel(false)} />
          <FeatureKeysPanel
            featureKeys={localFeatureKeys}
            onClose={() => setShowFlagsPanel(false)}
            onAdd={handleAddFeatureKey}
            onDeactivate={handleDeactivateFlag}
          />
        </>
      )}
    </>
  );
}

// ─── TierEditor ──────────────────────────────────────────────────────────────

type TierEditorProps = {
  tier: string;
  plan: Plan | undefined;
  allServices: JanetService[];
  inclusions: TierInclusion[];
  featureKeys: FeatureKey[];
  isPending: boolean;
  onPlanChange: (field: keyof Plan, value: unknown) => void;
  onInclusionChange: (
    planId: string,
    serviceId: string,
    field: keyof TierInclusion,
    value: unknown,
  ) => void;
  onToggleInclusion: (planId: string, serviceId: string, checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddCustomFlag: (key: string, label: string, tierAffinity: string) => void;
  error: string | null;
};

function TierEditor({
  tier,
  plan,
  allServices,
  inclusions,
  featureKeys,
  isPending,
  onPlanChange,
  onInclusionChange,
  onToggleInclusion,
  onSave,
  onCancel,
  onAddCustomFlag,
  error,
}: TierEditorProps) {
  const [showCustomFlagForm, setShowCustomFlagForm] = useState(false);
  const [customFlagKey, setCustomFlagKey] = useState("");
  const [customFlagLabel, setCustomFlagLabel] = useState("");

  const coreFlags = featureKeys.filter((f) => f.tier_affinity === "core" && f.is_active);
  const clinicalFlags = featureKeys.filter((f) => f.tier_affinity === "clinical" && f.is_active);
  const eliteFlags = featureKeys.filter((f) => f.tier_affinity === "elite" && f.is_active);

  const totalInternalCostCentsPerMo = inclusions.reduce((sum, inc) => {
    const mult = FREQ_MULTIPLIER[inc.frequency] ?? 1;
    return sum + inc.wholesale_cost_cents * inc.quantity * mult;
  }, 0);

  const totalRetailValueCentsPerMo = inclusions.reduce((sum, inc) => {
    const mult = FREQ_MULTIPLIER[inc.frequency] ?? 1;
    return sum + inc.retail_value_cents * inc.quantity * mult;
  }, 0);

  const monthlyPriceCents = plan?.base_price_cents ?? 0;
  const grossMarginCents = monthlyPriceCents - totalInternalCostCentsPerMo;
  const grossMarginPct =
    monthlyPriceCents > 0
      ? ((grossMarginCents / monthlyPriceCents) * 100).toFixed(0)
      : "0";

  if (!plan) {
    return (
      <div className="tier-editor" style={{ color: "#9AABBA", fontSize: 13 }}>
        No plan found for tier <strong>{tier}</strong>. Seed the plans table first.
      </div>
    );
  }

  const displayName = plan.name;
  const isKnownTier = tier === "core" || tier === "clinical" || tier === "elite";

  return (
    <div className="tier-editor">
      <div className="editor-title">Editing: {displayName} tier</div>

      {error && <div className="error-banner crud-error">{error}</div>}

      {/* Pricing */}
      <div className="editor-section">
        <div className="editor-section-title">Pricing</div>
        <div className="pricing-grid">
          <div className="form-field">
            <label>Monthly price ($)</label>
            <input
              type="number"
              min="0"
              value={plan.base_price_cents / 100}
              onChange={(e) =>
                onPlanChange("base_price_cents", Math.round(Number(e.target.value) * 100))
              }
            />
          </div>
          <div className="form-field">
            <label>Annual discount %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={plan.annual_discount_pct}
              onChange={(e) => onPlanChange("annual_discount_pct", Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label>Annual price (calc)</label>
            <input
              type="text"
              value={calcAnnualPrice(plan.base_price_cents, plan.annual_discount_pct)}
              readOnly
            />
          </div>
          <div className="form-field">
            <label>Setup fee ($)</label>
            <input
              type="number"
              min="0"
              value={plan.setup_fee_cents / 100}
              onChange={(e) =>
                onPlanChange("setup_fee_cents", Math.round(Number(e.target.value) * 100))
              }
            />
          </div>
          <div className="form-field">
            <label>Min commitment (mo)</label>
            <input
              type="number"
              min="0"
              value={plan.minimum_commitment_months}
              onChange={(e) =>
                onPlanChange("minimum_commitment_months", Number(e.target.value))
              }
            />
          </div>
        </div>

        <div className="form-field">
          <label>Stripe Monthly Price ID</label>
          <input
            type="text"
            value={plan.stripe_price_id_monthly ?? ""}
            onChange={(e) => onPlanChange("stripe_price_id_monthly", e.target.value)}
          />
        </div>
        <div className="form-field" style={{ marginTop: 10 }}>
          <label>Stripe Annual Price ID</label>
          <input
            type="text"
            value={plan.stripe_price_id_annual ?? ""}
            onChange={(e) => onPlanChange("stripe_price_id_annual", e.target.value)}
          />
        </div>
        <div className="form-field wide" style={{ marginTop: 10 }}>
          <label>Public description</label>
          <textarea
            value={plan.public_description ?? ""}
            onChange={(e) => onPlanChange("public_description", e.target.value)}
          />
        </div>
      </div>

      <hr className="editor-divider" />

      {/* Included Janet Services */}
      <div className="editor-section">
        <div className="editor-section-title">Included Janet services</div>
        <table className="inclusion-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Service name</th>
              <th>Qty</th>
              <th>Frequency</th>
              <th>Wholesale $</th>
              <th>Retail $</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {allServices.map((svc) => {
              const inc = inclusions.find((i) => i.janet_service_id === svc.id);
              const isChecked = !!inc;
              return (
                <tr key={svc.id} className={isChecked ? "" : "disabled-row"}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onToggleInclusion(plan.id, svc.id, e.target.checked)}
                    />
                  </td>
                  <td>{svc.name}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={inc?.quantity ?? 1}
                      disabled={!isChecked}
                      onChange={(e) =>
                        onInclusionChange(plan.id, svc.id, "quantity", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>
                    <select
                      disabled={!isChecked}
                      value={inc?.frequency ?? "monthly"}
                      onChange={(e) =>
                        onInclusionChange(plan.id, svc.id, "frequency", e.target.value)
                      }
                    >
                      <option value="monthly">monthly</option>
                      <option value="quarterly">quarterly</option>
                      <option value="annually">annually</option>
                      <option value="once_off">once off</option>
                      <option value="per_participant">per participant</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={inc ? inc.wholesale_cost_cents / 100 : 0}
                      disabled={!isChecked}
                      onChange={(e) =>
                        onInclusionChange(
                          plan.id,
                          svc.id,
                          "wholesale_cost_cents",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={inc ? inc.retail_value_cents / 100 : 0}
                      disabled={!isChecked}
                      onChange={(e) =>
                        onInclusionChange(
                          plan.id,
                          svc.id,
                          "retail_value_cents",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={inc?.is_visible_to_customer ?? true}
                      disabled={!isChecked}
                      onChange={(e) =>
                        onInclusionChange(
                          plan.id,
                          svc.id,
                          "is_visible_to_customer",
                          e.target.checked,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <hr className="editor-divider" />

      {/* Feature Flags */}
      <div className="editor-section">
        <div className="editor-section-title">Feature flags</div>

        {isKnownTier ? (
          <>
            <p style={{ fontSize: 13, color: "#6B7C85", margin: "0 0 14px" }}>
              Access is granted by tier hierarchy. Clinical users inherit all Core flags.{" "}
              <strong style={{ color: "#1A3A4A" }}>
                Elite flags are freely configurable by admin.
              </strong>
            </p>

            {/* Core — always inherited */}
            <div className="flag-grid-group">
              <div className="editor-section-title inherited">Core — inherited ✓</div>
              <div className="flag-grid" style={{ opacity: 0.65 }}>
                {coreFlags.map((f) => (
                  <label key={f.key} className="flag-item disabled">
                    <input type="checkbox" checked disabled readOnly /> {f.label}
                  </label>
                ))}
              </div>
            </div>

            {tier === "core" && (
              <>
                <div className="flag-grid-group">
                  <div className="editor-section-title not-available">
                    Clinical — not available on this tier
                  </div>
                  <div className="flag-grid" style={{ opacity: 0.4 }}>
                    {clinicalFlags.map((f) => (
                      <label key={f.key} className="flag-item disabled">
                        <input type="checkbox" disabled readOnly /> {f.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flag-grid-group">
                  <div className="editor-section-title not-available">
                    Elite — not available on this tier
                  </div>
                  <div className="flag-grid" style={{ opacity: 0.4 }}>
                    {eliteFlags.map((f) => (
                      <label key={f.key} className="flag-item disabled">
                        <input type="checkbox" disabled readOnly /> {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tier === "clinical" && (
              <div className="flag-grid-group">
                <div className="editor-section-title this-tier">Clinical — this tier</div>
                <div className="flag-grid" style={{ opacity: 0.65 }}>
                  {clinicalFlags.map((f) => (
                    <label key={f.key} className="flag-item disabled">
                      <input type="checkbox" checked disabled readOnly /> {f.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {tier === "elite" && (
              <>
                <div className="flag-grid-group">
                  <div className="editor-section-title inherited">Clinical — inherited ✓</div>
                  <div className="flag-grid" style={{ opacity: 0.65 }}>
                    {clinicalFlags.map((f) => (
                      <label key={f.key} className="flag-item disabled">
                        <input type="checkbox" checked disabled readOnly /> {f.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flag-grid-group">
                  <div className="editor-section-title this-tier">Elite — this tier</div>
                  <div className="flag-grid">
                    {eliteFlags.map((f) => (
                      <label key={f.key} className="flag-item">
                        <input type="checkbox" checked readOnly /> {f.label}
                      </label>
                    ))}
                  </div>
                  {!showCustomFlagForm && (
                    <button
                      className="btn-outline btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => setShowCustomFlagForm(true)}
                    >
                      + Add custom Elite flag
                    </button>
                  )}
                  {showCustomFlagForm && (
                    <div className="custom-flag-form">
                      <input
                        placeholder="key (e.g. genome_access)"
                        value={customFlagKey}
                        onChange={(e) => setCustomFlagKey(e.target.value)}
                      />
                      <input
                        placeholder="Label"
                        value={customFlagLabel}
                        onChange={(e) => setCustomFlagLabel(e.target.value)}
                      />
                      <button
                        className="btn-primary btn-xs"
                        onClick={() => {
                          if (customFlagKey && customFlagLabel) {
                            onAddCustomFlag(customFlagKey, customFlagLabel, "elite");
                            setCustomFlagKey("");
                            setCustomFlagLabel("");
                            setShowCustomFlagForm(false);
                          }
                        }}
                      >
                        Add
                      </button>
                      <button
                        className="btn-outline btn-xs"
                        onClick={() => setShowCustomFlagForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#6B7C85", margin: "0 0 14px" }}>
            Feature flag hierarchy is defined for Core, Clinical, and Elite tiers.{" "}
            Custom tiers inherit no flags by default — use the Feature Keys panel to
            assign flags to this tier.
          </p>
        )}
      </div>

      {/* Margin summary */}
      <div className="margin-card">
        <div className="margin-card-title">Margin summary — {displayName} tier</div>
        <div className="margin-row">
          <span className="label">Janet services internal cost/mo</span>
          <span className="val">{centsToDisplay(totalInternalCostCentsPerMo)}</span>
        </div>
        <div className="margin-row">
          <span className="label">Janet services retail value/mo</span>
          <span className="val">{centsToDisplay(totalRetailValueCentsPerMo)}</span>
        </div>
        <div className="margin-row">
          <span className="label">Monthly price</span>
          <span className="val">{centsToDisplay(monthlyPriceCents)}</span>
        </div>
        <div className="margin-row">
          <span className="label">Gross margin</span>
          <span className={`val${grossMarginCents >= 0 ? " success" : ""}`}>
            {centsToDisplay(grossMarginCents)} ({grossMarginPct}%)
          </span>
        </div>
        <div className="margin-row note">
          <span>
            Supplier products are not bundled into tiers — available a la carte to patients
            or via B2B plan inclusions.
          </span>
        </div>
      </div>

      <div className="editor-actions">
        <button className="btn-outline btn-sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── JanetServicesPanel ───────────────────────────────────────────────────────

type JanetServicesPanelProps = {
  services: JanetService[];
  onClose: () => void;
  onSave: (svc: JanetService) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof JanetService, value: unknown) => void;
};

function JanetServicesPanel({
  services,
  onClose,
  onSave,
  onAdd,
  onDelete,
  onUpdate,
}: JanetServicesPanelProps) {
  return (
    <div className="janet-panel">
      <div className="panel-header">
        <div className="panel-title">Janet Services</div>
        <button className="panel-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <button className="btn-primary btn-sm" style={{ marginBottom: 16 }} onClick={onAdd}>
        + Add Service
      </button>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Unit type</th>
            <th>Internal $</th>
            <th>Retail $</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.id}>
              <td>
                <input
                  className="panel-input"
                  value={svc.name}
                  onChange={(e) => onUpdate(svc.id, "name", e.target.value)}
                  onBlur={() => onSave(svc)}
                />
              </td>
              <td>
                <select
                  className="panel-input"
                  value={svc.unit_type}
                  onChange={(e) => {
                    onUpdate(svc.id, "unit_type", e.target.value);
                    onSave({ ...svc, unit_type: e.target.value });
                  }}
                >
                  <option value="per_month">per_month</option>
                  <option value="per_session">per_session</option>
                  <option value="per_year">per_year</option>
                  <option value="once_off">once_off</option>
                  <option value="per_patient">per_patient</option>
                </select>
              </td>
              <td>
                <input
                  className="panel-input"
                  type="number"
                  min="0"
                  value={svc.internal_cost_cents / 100}
                  onChange={(e) =>
                    onUpdate(svc.id, "internal_cost_cents", Math.round(Number(e.target.value) * 100))
                  }
                  onBlur={() => onSave(svc)}
                  style={{ width: 70 }}
                />
              </td>
              <td>
                <input
                  className="panel-input"
                  type="number"
                  min="0"
                  value={svc.retail_value_cents / 100}
                  onChange={(e) =>
                    onUpdate(svc.id, "retail_value_cents", Math.round(Number(e.target.value) * 100))
                  }
                  onBlur={() => onSave(svc)}
                  style={{ width: 70 }}
                />
              </td>
              <td>
                <button
                  className={`toggle-btn ${svc.is_active ? "toggle-active" : "toggle-inactive"}`}
                  onClick={() => {
                    onUpdate(svc.id, "is_active", !svc.is_active);
                    onSave({ ...svc, is_active: !svc.is_active });
                  }}
                >
                  {svc.is_active ? "Active" : "Inactive"}
                </button>
              </td>
              <td>
                {svc.is_active && (
                  <button
                    className="btn-outline btn-xs"
                    onClick={() => onDelete(svc.id)}
                    style={{ color: "#C0392B", borderColor: "#C0392B" }}
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── FeatureKeysPanel ─────────────────────────────────────────────────────────

type FeatureKeysPanelProps = {
  featureKeys: FeatureKey[];
  onClose: () => void;
  onAdd: (key: string, label: string, tierAffinity: string) => void;
  onDeactivate: (key: string) => void;
};

function FeatureKeysPanel({ featureKeys, onClose, onAdd, onDeactivate }: FeatureKeysPanelProps) {
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAffinity, setNewAffinity] = useState("core");

  const grouped: Record<string, FeatureKey[]> = { core: [], clinical: [], elite: [] };
  for (const fk of featureKeys) {
    if (grouped[fk.tier_affinity]) {
      grouped[fk.tier_affinity].push(fk);
    }
  }

  return (
    <div className="janet-panel">
      <div className="panel-header">
        <div className="panel-title">Feature Keys</div>
        <button className="panel-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="custom-flag-form" style={{ marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <input
          placeholder="key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          style={{ flex: "1 1 120px" }}
        />
        <input
          placeholder="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          style={{ flex: "2 1 160px" }}
        />
        <select
          value={newAffinity}
          onChange={(e) => setNewAffinity(e.target.value)}
          style={{ padding: "6px 8px", border: "1px solid #D4E0E8", borderRadius: 5, fontSize: 13 }}
        >
          <option value="core">core</option>
          <option value="clinical">clinical</option>
          <option value="elite">elite</option>
        </select>
        <button
          className="btn-primary btn-xs"
          onClick={() => {
            if (newKey && newLabel) {
              onAdd(newKey, newLabel, newAffinity);
              setNewKey("");
              setNewLabel("");
            }
          }}
        >
          Add
        </button>
      </div>

      {(["core", "clinical", "elite"] as const).map((affinityTier) => (
        <div key={affinityTier} style={{ marginBottom: 20 }}>
          <div
            className="editor-section-title this-tier"
            style={{ marginBottom: 8 }}
          >
            {affinityTier.charAt(0).toUpperCase() + affinityTier.slice(1)}
          </div>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(grouped[affinityTier] ?? []).map((fk) => (
                <tr key={fk.key}>
                  <td>
                    <code style={{ fontSize: 11 }}>{fk.key}</code>
                  </td>
                  <td>{fk.label}</td>
                  <td>
                    <span
                      className={`toggle-btn ${fk.is_active ? "toggle-active" : "toggle-inactive"}`}
                    >
                      {fk.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {fk.is_active && (
                      <button
                        className="btn-outline btn-xs"
                        onClick={() => onDeactivate(fk.key)}
                        style={{ color: "#C0392B", borderColor: "#C0392B" }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(grouped[affinityTier] ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "#9AABBA", fontSize: 12, padding: "12px 8px" }}>
                    No keys yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
