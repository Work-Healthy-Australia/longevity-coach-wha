import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runJanetTurn } from "@/lib/ai/agents/janet";

export async function POST(request: NextRequest): Promise<Response> {
  // Authenticate via Supabase session
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

  let message: string;
  try {
    const body = await request.json();
    message = body.message;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new Error("Missing message");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = await runJanetTurn(user.id, message.trim());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
