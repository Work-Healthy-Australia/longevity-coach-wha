import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loose } from '@/lib/supabase/loose-table';
import { OrgNav } from '../_components/org-nav';
import '../org.css';
import './dashboard.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation dashboard' };

export default async function OrgDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const db = loose(admin);

  const { data: managerRaw } = await db
    .schema('billing')
    .from('organisation_members')
    .select('org_id')
    .eq('user_uuid', user.id)
    .eq('role', 'health_manager')
    .maybeSingle();

  if (!managerRaw) redirect('/dashboard');
  const orgId = (managerRaw as { org_id: string }).org_id;

  const [orgResult, membersResult, invitesResult, b2bPlanResult] = await Promise.all([
    db.schema('billing').from('organisations').select('name, seat_count, b2b_plan_id').eq('id', orgId).single(),
    db.schema('billing').from('organisation_members').select('user_uuid, role').eq('org_id', orgId),
    db.schema('billing').from('org_invites').select('id, email, status, created_at').eq('org_id', orgId),
    db.schema('billing').from('b2b_plans').select('name, status, billing_basis, contract_start_date, contract_end_date, negotiated_discount_pct').eq('org_id', orgId).eq('status', 'active').maybeSingle(),
  ]);

  const org = orgResult.data as { name: string; seat_count: number; b2b_plan_id: string | null } | null;
  if (!org) redirect('/dashboard');

  type Member = { user_uuid: string; role: string };
  type Invite = { id: string; email: string; status: string; created_at: string };
  type B2BPlan = { name: string; status: string; billing_basis: string; contract_start_date: string | null; contract_end_date: string | null; negotiated_discount_pct: number };

  const members = (membersResult.data ?? []) as Member[];
  const invites = (invitesResult.data ?? []) as Invite[];
  const b2bPlan = b2bPlanResult.data as B2BPlan | null;

  const totalMembers = members.length;
  const managers = members.filter(m => m.role === 'health_manager').length;
  const pendingInvites = invites.filter(i => i.status === 'pending').length;
  const acceptedInvites = invites.filter(i => i.status === 'accepted').length;
  const seatUtilPct = org.seat_count > 0 ? Math.round((totalMembers / org.seat_count) * 100) : 0;

  const allMemberUuids = members.map(m => m.user_uuid);
  let onboardedCount = 0;
  if (allMemberUuids.length > 0) {
    const { count } = await admin
      .from('health_profiles')
      .select('*', { count: 'exact', head: true })
      .in('user_uuid', allMemberUuids)
      .not('completed_at', 'is', null);
    onboardedCount = count ?? 0;
  }

  return (
    <div className="org-dashboard">
      <OrgNav orgName={org.name} />

      <h1 className="org-dash-title">Dashboard</h1>

      {/* KPI cards */}
      <div className="org-kpi-grid">
        <div className="org-kpi">
          <span className="org-kpi-value">{totalMembers}</span>
          <span className="org-kpi-label">Members</span>
          {org.seat_count > 0 && (
            <span className="org-kpi-sub">of {org.seat_count} seats ({seatUtilPct}%)</span>
          )}
        </div>
        <div className="org-kpi">
          <span className="org-kpi-value">{onboardedCount}</span>
          <span className="org-kpi-label">Onboarded</span>
          {totalMembers > 0 && (
            <span className="org-kpi-sub">{Math.round((onboardedCount / totalMembers) * 100)}% completion</span>
          )}
        </div>
        <div className="org-kpi">
          <span className="org-kpi-value">{pendingInvites}</span>
          <span className="org-kpi-label">Pending invites</span>
          {acceptedInvites > 0 && (
            <span className="org-kpi-sub">{acceptedInvites} accepted</span>
          )}
        </div>
        <div className="org-kpi">
          <span className="org-kpi-value">{managers}</span>
          <span className="org-kpi-label">Managers</span>
        </div>
      </div>

      {/* Plan details */}
      {b2bPlan && (
        <section className="org-card">
          <h2 className="org-card-title">Plan</h2>
          <dl className="org-plan-details">
            <div className="org-plan-row">
              <dt>Plan name</dt>
              <dd>{b2bPlan.name}</dd>
            </div>
            <div className="org-plan-row">
              <dt>Billing</dt>
              <dd>{formatBilling(b2bPlan.billing_basis)}</dd>
            </div>
            {b2bPlan.negotiated_discount_pct > 0 && (
              <div className="org-plan-row">
                <dt>Discount</dt>
                <dd>{b2bPlan.negotiated_discount_pct}%</dd>
              </div>
            )}
            {b2bPlan.contract_start_date && (
              <div className="org-plan-row">
                <dt>Contract period</dt>
                <dd>
                  {formatDate(b2bPlan.contract_start_date)}
                  {b2bPlan.contract_end_date && ` — ${formatDate(b2bPlan.contract_end_date)}`}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Seat utilisation bar */}
      {org.seat_count > 0 && (
        <section className="org-card">
          <h2 className="org-card-title">Seat utilisation</h2>
          <div className="org-seat-bar-container">
            <div className="org-seat-bar">
              <div
                className={`org-seat-bar-fill ${seatUtilPct >= 90 ? 'org-seat-bar-fill--high' : ''}`}
                style={{ width: `${Math.min(seatUtilPct, 100)}%` }}
              />
            </div>
            <span className="org-seat-bar-label">
              {totalMembers} / {org.seat_count} seats used
            </span>
          </div>
        </section>
      )}

      {/* Recent invites */}
      {invites.length > 0 && (
        <section className="org-card">
          <h2 className="org-card-title">Recent invites</h2>
          <table className="org-invite-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {invites.slice(0, 10).map(inv => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>
                    <span className={`org-status-badge org-status-${inv.status}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="org-invite-date">{formatDate(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function formatBilling(basis: string): string {
  const labels: Record<string, string> = {
    per_seat_monthly: 'Per seat / month',
    per_seat_annual: 'Per seat / year',
    flat_monthly: 'Flat rate / month',
    flat_annual: 'Flat rate / year',
  };
  return labels[basis] ?? basis;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
