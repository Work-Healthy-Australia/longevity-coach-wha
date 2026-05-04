// Single source of truth for which roles are assignable through the admin UI.
//
// The DB enum (public.app_role from migration 0068) also contains
// `corp_health_manager`, but its source-of-truth lives in
// billing.organisation_members — granting it via grant_role() would split the
// model. CHM is managed via Organisations, not here.

export const ASSIGNABLE_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "clinician",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AssignableRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager (clinical, requires AHPRA)",
  clinician: "Clinician",
};

export const CHM_NOTE =
  "Corporate Health Manager is managed via Organisations." as const;

// Roles that cannot be self-granted by the actor — defence against lateral
// admin escalation (admin granting admin to themselves). Migration 0068 has no
// DB-side self-escalation check; the action enforces this.
export const SELF_GRANT_BLOCKED: ReadonlySet<AssignableRole> = new Set([
  "super_admin",
  "admin",
]);
