import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

const AllocSchema = z.object({
  allocations: z.array(
    z.object({
      plan_id: z.string().uuid(),
      seat_count: z.number().int().min(0),
    })
  ),
});

type ExistingAlloc = {
  id: string;
  b2b_plan_id: string;
  plan_id: string;
  seat_count: number;
};

// POST /api/admin/b2b-plans/[id]/allocations — upsert tier allocations with suspicion check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: b2bPlanId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = AllocSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const db = loose(admin);

  // Read platform thresholds
  const { data: settings } = await db
    .schema("billing")
    .from("platform_settings")
    .select("key, value");

  function getSetting(key: string, fallback: number): number {
    const row = ((settings ?? []) as Array<{ key: string; value: unknown }>).find(
      (s) => s.key === key
    );
    if (!row) return fallback;
    const v = row.value;
    if (typeof v === "number") return v;
    if (typeof v === "object" && v !== null && "value" in v)
      return Number((v as { value: unknown }).value) || fallback;
    return Number(v) || fallback;
  }

  const thresholdAbs = getSetting("suspicion_seat_threshold", 500);
  const thresholdPct = getSetting("suspicion_pct_threshold", 50);

  // Read existing allocations for this plan
  const { data: existingRaw } = await db
    .schema("billing")
    .from("b2b_plan_tier_allocations")
    .select("id, b2b_plan_id, plan_id, seat_count")
    .eq("b2b_plan_id", b2bPlanId);

  const existing = (existingRaw ?? []) as ExistingAlloc[];

  const results: Array<{ plan_id: string; flagged: boolean; auditId?: string }> = [];
  let anyFlagged = false;

  for (const item of parsed.data.allocations) {
    const existingAlloc = existing.find((a) => a.plan_id === item.plan_id);
    const oldSeats = existingAlloc?.seat_count ?? 0;
    const delta = item.seat_count - oldSeats;

    let isFlagged = false;
    let flagReason: string | null = null;

    if (delta > 0) {
      const pctIncrease = oldSeats > 0 ? (delta / oldSeats) * 100 : Infinity;
      if (delta > thresholdAbs) {
        isFlagged = true;
        flagReason = `Seat increase of ${delta} exceeds absolute threshold of ${thresholdAbs}.`;
      } else if (oldSeats > 0 && pctIncrease > thresholdPct) {
        isFlagged = true;
        flagReason = `Seat increase of ${delta} (${Math.round(pctIncrease)}%) exceeds percentage threshold of ${thresholdPct}%.`;
      }
    }

    if (isFlagged) {
      anyFlagged = true;

      const { data: auditRow } = await db
        .schema("billing")
        .from("b2b_plan_seat_audit")
        .insert({
          b2b_plan_id: b2bPlanId,
          allocation_id: existingAlloc?.id ?? null,
          plan_id: item.plan_id,
          old_seat_count: oldSeats,
          new_seat_count: item.seat_count,
          delta,
          is_flagged: true,
          flag_reason: flagReason,
        })
        .select("id")
        .single();

      results.push({
        plan_id: item.plan_id,
        flagged: true,
        auditId: (auditRow as { id?: string } | null)?.id,
      });
    } else {
      if (existingAlloc) {
        await db
          .schema("billing")
          .from("b2b_plan_tier_allocations")
          .update({ seat_count: item.seat_count })
          .eq("id", existingAlloc.id);
      } else {
        await db
          .schema("billing")
          .from("b2b_plan_tier_allocations")
          .insert({
            b2b_plan_id: b2bPlanId,
            plan_id: item.plan_id,
            seat_count: item.seat_count,
          });
      }

      if (delta !== 0) {
        await db
          .schema("billing")
          .from("b2b_plan_seat_audit")
          .insert({
            b2b_plan_id: b2bPlanId,
            allocation_id: existingAlloc?.id ?? null,
            plan_id: item.plan_id,
            old_seat_count: oldSeats,
            new_seat_count: item.seat_count,
            delta,
            is_flagged: false,
            flag_reason: null,
          });
      }

      results.push({ plan_id: item.plan_id, flagged: false });
    }
  }

  if (anyFlagged) {
    await db
      .schema("billing")
      .from("b2b_plans")
      .update({ is_flagged_suspicious: true })
      .eq("id", b2bPlanId);
  }

  return NextResponse.json({ results, flagged: anyFlagged });
}
