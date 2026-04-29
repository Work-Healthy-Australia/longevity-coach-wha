/**
 * Right-to-erasure cascade executor.
 *
 * Consumes ERASURE_PLAN and runs the SQL via the admin Supabase client.
 * Sequential per-table execution; per-table failures are logged and the
 * cascade continues. Auth/network throws bubble up.
 *
 * Pure orchestration — no Stripe, storage, or audit log writes happen here.
 * Those live in the calling server action so this function can be unit-tested
 * with a fake admin client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ERASED_SENTINEL,
  ERASURE_PLAN,
  type ErasurePlanEntry,
  type ScrubField,
} from "./plan";

type CountRow = { table: string; count: number };

function scrubPayload(fields: ScrubField[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.mode) {
      case "null":
        payload[field.column] = null;
        break;
      case "erased_sentinel":
        payload[field.column] = ERASED_SENTINEL;
        break;
      case "empty_jsonb":
        // Supabase JS serialises plain objects as JSONB.
        payload[field.column] = {};
        break;
    }
  }
  return payload;
}

function tableRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  entry: ErasurePlanEntry,
) {
  // The Supabase JS client supports cross-schema queries via .schema().
  // For `public` we use the default `.from()` to keep the typed Database
  // surface area; for non-public schemas we go via the untyped escape hatch.
  if (entry.schema === "public") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (admin as any).from(entry.table);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).schema(entry.schema).from(entry.table);
}

async function runEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  entry: ErasurePlanEntry,
  userId: string,
): Promise<CountRow> {
  const fqName = `${entry.schema}.${entry.table}`;
  const ref = tableRef(admin, entry);

  if (entry.strategy === "delete") {
    const { error, count } = await ref
      .delete({ count: "exact" })
      .eq(entry.userColumn, userId);
    if (error) {
      console.error(`[erasure] delete ${fqName} failed:`, error.message);
      return { table: fqName, count: 0 };
    }
    return { table: fqName, count: count ?? 0 };
  }

  // scrub | retain_anonymised — both are UPDATE operations.
  // Special-case patient_assignments: status flip rather than column scrub.
  if (entry.table === "patient_assignments") {
    const { error, count } = await ref
      .update({ status: "patient_erased" }, { count: "exact" })
      .eq(entry.userColumn, userId);
    if (error) {
      console.error(`[erasure] status-flip ${fqName} failed:`, error.message);
      return { table: fqName, count: 0 };
    }
    return { table: fqName, count: count ?? 0 };
  }

  const fields = entry.scrubFields ?? [];
  if (fields.length === 0) {
    // No-op entry that isn't the patient_assignments special case — skip.
    return { table: fqName, count: 0 };
  }

  const payload = scrubPayload(fields);
  const { error, count } = await ref
    .update(payload, { count: "exact" })
    .eq(entry.userColumn, userId);
  if (error) {
    console.error(`[erasure] scrub ${fqName} failed:`, error.message);
    return { table: fqName, count: 0 };
  }
  return { table: fqName, count: count ?? 0 };
}

export async function executeErasure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  userId: string,
): Promise<{ counts: CountRow[] }> {
  const counts: CountRow[] = [];
  for (const entry of ERASURE_PLAN) {
    const row = await runEntry(admin, entry, userId);
    counts.push(row);
  }
  return { counts };
}
