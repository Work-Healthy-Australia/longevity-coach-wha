import { type UIMessage } from "ai";

import { streamClinicianTurn } from "@/lib/ai/agents/janet-clinician";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { reviewId?: string; messages?: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { reviewId, messages } = body;
  if (!reviewId || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Missing reviewId or messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Authorisation: caller must be admin OR the assigned clinician for this review.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  const isClinician = profile?.role === "clinician";
  if (!isAdmin && !isClinician) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAdmin) {
    const { data: review } = await admin
      .from("periodic_reviews")
      .select("patient_uuid, clinician_uuid")
      .eq("id", reviewId)
      .maybeSingle();

    if (!review) {
      return new Response(JSON.stringify({ error: "Review not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    let allowed = review.clinician_uuid === user.id;
    if (!allowed) {
      const { data: assignment } = await admin
        .from("patient_assignments")
        .select("id")
        .eq("patient_uuid", review.patient_uuid)
        .eq("clinician_uuid", user.id)
        .eq("status", "active")
        .maybeSingle();
      allowed = Boolean(assignment);
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Not assigned to this patient" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const result = await streamClinicianTurn(reviewId, messages);
  return result.toUIMessageStreamResponse();
}
