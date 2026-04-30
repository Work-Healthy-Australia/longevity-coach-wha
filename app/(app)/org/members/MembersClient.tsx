"use client";

import Link from "next/link";
import { useState } from "react";

type TierPlan = { id: string; name: string; tier: string };

type Allocation = { id: string; b2b_plan_id: string; plan_id: string; seat_count: number };

type ProductInclusion = {
  id: string;
  b2b_plan_id: string;
  allocation_id: string;
  product_id: string;
  quantity: number;
  frequency: string;
};

type Product = { id: string; name: string };

type OrgMember = {
  org_id: string;
  user_uuid: string;
  role: string;
  tier_allocation_id: string | null;
};

type MemberProduct = {
  id: string;
  org_id: string;
  user_uuid: string;
  inclusion_id: string;
  is_enabled: boolean;
};

interface Props {
  orgName: string;
  members: OrgMember[];
  allocations: Allocation[];
  productInclusions: ProductInclusion[];
  products: Product[];
  tierPlans: TierPlan[];
  memberProducts: MemberProduct[];
  memberNames: Record<string, string>;
  userEmails: Record<string, string>;
}

function HMToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="hm-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="hm-toggle-slider" />
    </label>
  );
}

export function MembersClient({
  orgName,
  members,
  allocations,
  productInclusions,
  products,
  tierPlans,
  memberProducts: initialMemberProducts,
  memberNames,
  userEmails,
}: Props) {
  const [memberProducts, setMemberProducts] =
    useState<MemberProduct[]>(initialMemberProducts);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // tracks which toggle is in flight

  async function handleToggle(
    userUuid: string,
    inclusionId: string,
    enabled: boolean
  ) {
    const key = `${userUuid}:${inclusionId}`;
    setSaving(key);
    setError(null);

    // Optimistic update
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
          id: key,
          org_id: members[0]?.org_id ?? "",
          user_uuid: userUuid,
          inclusion_id: inclusionId,
          is_enabled: enabled,
        },
      ];
    });

    try {
      const res = await fetch("/api/org/member-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uuid: userUuid, inclusion_id: inclusionId, is_enabled: enabled }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Save failed");
      }
    } catch (e) {
      // Revert optimistic update
      setMemberProducts((prev) => {
        return prev.map((mp) =>
          mp.user_uuid === userUuid && mp.inclusion_id === inclusionId
            ? { ...mp, is_enabled: !enabled }
            : mp
        );
      });
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="hm-page">
      <div className="hm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="hm-title">Team Members</h1>
            <p className="hm-subtitle">{orgName}</p>
          </div>
          <Link
            href="/org/invite"
            style={{
              display: "inline-block",
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 8,
              background: "#2F6F8F",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Invite members
          </Link>
        </div>
      </div>

      {error && <div className="hm-error">{error}</div>}

      <div className="hm-card">
        <div className="hm-card-title">
          Employees ({members.length})
        </div>

        {members.length === 0 ? (
          <div className="hm-empty">No members found for your organisation.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Tier</th>
                <th>Products</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const name = memberNames[member.user_uuid];
                const email = userEmails[member.user_uuid];
                const alloc = allocations.find(
                  (a) => a.id === member.tier_allocation_id
                );
                const tier = tierPlans.find((tp) => tp.id === alloc?.plan_id);
                const memberInclusions = productInclusions.filter(
                  (i) => i.allocation_id === alloc?.id
                );

                return (
                  <tr key={member.user_uuid}>
                    <td>
                      {name && <div className="hm-member-name">{name}</div>}
                      {email && (
                        <div className="hm-member-email">{email}</div>
                      )}
                      {!name && !email && (
                        <div className="hm-member-name">{member.user_uuid}</div>
                      )}
                    </td>
                    <td>
                      {tier ? (
                        <span
                          className={`hm-tier-badge hm-tier-${tier.tier.toLowerCase()}`}
                        >
                          {tier.name}
                        </span>
                      ) : (
                        <span className="hm-tier-badge hm-tier-unknown">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      {memberInclusions.length === 0 ? (
                        <span className="hm-no-products">No products</span>
                      ) : (
                        <div className="hm-products-row">
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
                            const toggleKey = `${member.user_uuid}:${inc.id}`;
                            return (
                              <div key={inc.id} className="hm-product-item">
                                <HMToggle
                                  checked={isEnabled}
                                  disabled={saving === toggleKey}
                                  onChange={(v) =>
                                    handleToggle(member.user_uuid, inc.id, v)
                                  }
                                />
                                <span className="hm-product-label">
                                  {product?.name ?? inc.product_id}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
