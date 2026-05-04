-- ============================================================================
-- 0071_suppliers_add_supplier_type.sql
--
-- Adds the missing supplier_type column to billing.suppliers. The /admin/
-- suppliers New-Supplier form has been writing this field since the suppliers
-- UI shipped, but no migration ever created the column — every Create attempt
-- failed with PostgREST's "Could not find the 'supplier_type' column of
-- 'suppliers' in the schema cache".
--
-- Allowed values mirror the dropdown in
-- app/(admin)/admin/suppliers/SuppliersClient.tsx (Pathology, Imaging,
-- Genomics, Supplements, Fitness, Technology, Other). Constraint matches
-- the contract_status pattern from migration 0055 — admin-managed values
-- are constrained at the DB layer for safety and parity with billing.products
-- .category.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DO block for the constraint.
-- ============================================================================

alter table billing.suppliers
  add column if not exists supplier_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_supplier_type_check'
  ) then
    alter table billing.suppliers
      add constraint suppliers_supplier_type_check
      check (
        supplier_type is null
        or supplier_type in (
          'Pathology', 'Imaging', 'Genomics', 'Supplements',
          'Fitness', 'Technology', 'Other'
        )
      );
  end if;
end$$;
