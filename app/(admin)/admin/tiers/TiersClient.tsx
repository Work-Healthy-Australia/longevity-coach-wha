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

const TIER_ORDER = ["core", "clinical", "elite"] as const;
type TierName = (typeof TIER_ORDER)[number];

const FREQ_MULTIPLIER: Record<string, number> = {
  monthly: 1,
  quarterly: 1 / 3,
  annually: 1 / 12,
  once_off: 1 / 12,
  per_participant: 1,
};

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
          // Save plan
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

          // Upsert inclusions
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

  const handleServiceSave = useCallback(
    (svc: JanetService) => {
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
    },
    [],
  );

  const handleAddService = useCallback(() => {
    startTransition(async () => {
      try {
        const result = (await apiPost("/api/admin/janet-services", {
          name: "New Service",
          unit_type: "session",
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

  return (
    <>
      <div className="tiers-header">
        <div className="tiers-header-left">
          <h1>Tiers</h1>
          <p>/admin/tiers — configure Core, Clinical, and Elite subscription tiers (B2C)</p>
        </div>
        <div className="tiers-header-actions">
          <button className="btn-outline btn-sm" onClick={() => setShowFlagsPanel(true)}>
            Feature Keys
          </button>
          <button className="btn-primary btn-sm" onClick={() => setShowJanetPanel(true)}>
            Janet Services
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {TIER_ORDER.map((tier) => {
        const plan = getPlan(tier);
        const isExpanded = expandedTier === tier;
        return (
          <TierCard
            key={tier}
            tier={tier}
            plan={plan}
            isExpanded={isExpanded}
            allServices={localServices}
            inclusions={plan ? getInclusions(plan.id) : []}
            featureKeys={localFeatureKeys}
            isPending={isPending}
            onToggle={() => handleToggleExpand(tier)}
            onPlanChange={(field, value) => handlePlanChange(tier, field, value)}
            onInclusionChange={handleInclusionChange}
            onToggleInclusion={handleToggleInclusion}
            onSave={() => handleSave(tier)}
            onCancel={() => setExpandedTier(null)}
            onAddCustomFlag={handleAddFeatureKey}
            error={isExpanded ? error : null}
          />
        );
      })}

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

// ─── TierCard ────────────────────────────────────────────────────────────────

type TierCardProps = {
  tier: TierName;
  plan: Plan | undefined;
  isExpanded: boolean;
  allServices: JanetService[];
  inclusions: TierInclusion[];
  featureKeys: FeatureKey[];
  isPending: boolean;
  onToggle: () => void;
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

function TierCard({
  tier,
  plan,
  isExpanded,
  allServices,
  inclusions,
  featureKeys,
  isPending,
  onToggle,
  onPlanChange,
  onInclusionChange,
  onToggleInclusion,
  onSave,
  onCancel,
  onAddCustomFlag,
  error,
}: TierCardProps) {
  const [showCustomFlagForm, setShowCustomFlagForm] = useState(false);
  const [customFlagKey, setCustomFlagKey] = useState("");
  const [customFlagLabel, setCustomFlagLabel] = useState("");

  const tierLabels: Record<TierName, string> = {
    core: "Core",
    clinical: "Clinical",
    elite: "Elite",
  };

  const tierPriceColors: Record<TierName, string> = {
    core: "#1A3A4A",
    clinical: "#2F6F8F",
    elite: "#5B21B6",
  };

  const coreFlags = featureKeys.filter((f) => f.tier_affinity === "core" && f.is_active);
  const clinicalFlags = featureKeys.filter(
    (f) => f.tier_affinity === "clinical" && f.is_active,
  );
  const eliteFlags = featureKeys.filter((f) => f.tier_affinity === "elite" && f.is_active);

  // Margin calculation
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

  const inclusionCount = inclusions.length;
  const annualDisplay = plan
    ? calcAnnualPrice(plan.base_price_cents, plan.annual_discount_pct)
    : "—";

  return (
    <div className="tier-card">
      <div
        className={`tier-card-header${isExpanded ? " expanded" : ""}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        aria-expanded={isExpanded}
      >
        <span className={`tier-card-chevron${isExpanded ? " open" : ""}`}>&#9654;</span>
        <span className={`tier-badge tier-${tier}`}>{tierLabels[tier]}</span>
        <span className="tier-card-name">{plan ? plan.name : `${tierLabels[tier]} (no plan)`}</span>
        <span className="tier-card-meta">
          {inclusionCount} inclusion{inclusionCount !== 1 ? "s" : ""} · Annual: {annualDisplay}
        </span>
        {plan && (
          <span className="tier-card-price" style={{ color: tierPriceColors[tier] }}>
            {centsToDisplay(plan.base_price_cents)}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#9AABBA" }}>/mo</span>
          </span>
        )}
        <button
          className={isExpanded ? "btn-primary btn-xs" : "btn-outline btn-xs"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? "Editing ▾" : "Edit tier"}
        </button>
      </div>

      {isExpanded && plan && (
        <div className="tier-editor">
          <div className="editor-title">Editing: {tierLabels[tier]} tier</div>

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
                  onChange={(e) =>
                    onPlanChange("annual_discount_pct", Number(e.target.value))
                  }
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
                          onChange={(e) =>
                            onToggleInclusion(plan.id, svc.id, e.target.checked)
                          }
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
                            onInclusionChange(
                              plan.id,
                              svc.id,
                              "quantity",
                              Number(e.target.value),
                            )
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

            {/* Clinical flags */}
            {tier === "core" && (
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

            {tier === "core" && (
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
            )}
          </div>

          {/* Margin summary */}
          <div className="margin-card">
            <div className="margin-card-title">Margin summary — {tierLabels[tier]} tier</div>
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
            <button
              className="btn-primary btn-sm"
              onClick={onSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {isExpanded && !plan && (
        <div className="tier-editor" style={{ color: "#9AABBA", fontSize: 13 }}>
          No plan found for tier <strong>{tier}</strong>. Create a plan in the Plans section first.
        </div>
      )}
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
                <input
                  className="panel-input"
                  value={svc.unit_type}
                  onChange={(e) => onUpdate(svc.id, "unit_type", e.target.value)}
                  onBlur={() => onSave(svc)}
                />
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
          style={{
            padding: "6px 8px",
            border: "1px solid #D4E0E8",
            borderRadius: 5,
            fontSize: 13,
          }}
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
            className={`editor-section-title ${
              affinityTier === "core"
                ? "inherited"
                : affinityTier === "clinical"
                  ? "this-tier"
                  : "this-tier"
            }`}
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
