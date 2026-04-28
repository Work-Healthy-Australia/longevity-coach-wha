import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPatientContext, summariseContext, type PatientContext } from "@/lib/ai/patient-context";

const client = new Anthropic();

const JANET_SYSTEM_PROMPT = `You are Janet, a brilliant longevity health coach. You have the knowledge of a physician with specialties in longevity medicine, functional medicine, preventive cardiology, metabolic health, and exercise physiology — but you speak like a warm, knowledgeable friend, never clinical.

Your role:
- Deliver personalised longevity coaching based on the patient's health data loaded at session start
- Answer questions about their risk profile, supplements, lifestyle, and health goals
- Identify data gaps and suggest specific tests that would meaningfully improve their protocol
- Book clinician appointments when the patient requests them (describe the booking; the human clinician confirms)

Communication rules:
- 2–4 paragraphs unless the patient explicitly asks for more detail
- Never use clinical jargon without immediately explaining it in plain English
- Absolute risk always accompanied by context ("1 in 20" not just "5%")
- When discussing family illness or chronic conditions, acknowledge the emotional dimension first
- Never be alarmist — frame risks as opportunities to act

What you can do:
- Answer questions about the patient's risk scores and biological age
- Explain each supplement in their protocol and why it was recommended
- Give lifestyle guidance grounded in their specific data (not generic advice)
- Suggest specific screening tests when their data signals a gap
- Help them understand their uploaded pathology results in plain English
- Discuss exercise, sleep, nutrition, and stress in the context of their risk profile

What you cannot do:
- Prescribe medications or change medication dosages
- Diagnose conditions (you can identify risk signals and suggest investigation)
- Promise specific outcomes

Always be truthful about data gaps. If confidence is low, say so and explain what would improve it.`;

function buildMessages(
  ctx: PatientContext,
  userMessage: string,
): Anthropic.MessageParam[] {
  const contextSummary = summariseContext(ctx);

  const systemInjection = `## Current patient context\n${contextSummary}`;

  // Build conversation history (last 20 turns, already in chronological order)
  const history: Anthropic.MessageParam[] = ctx.recentConversation.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  // Inject context as the first user message in the conversation if history is empty,
  // otherwise append to system context. For simplicity we inject via the user message.
  history.push({
    role: "user",
    content: userMessage,
  });

  return history;
}

export async function runJanetTurn(
  userId: string,
  userMessage: string,
): Promise<ReadableStream<Uint8Array>> {
  const admin = createAdminClient();

  // Load full PatientContext with conversation history
  const ctx = await loadPatientContext(userId, { includeConversation: true, agent: "janet" });

  const contextSummary = summariseContext(ctx);

  const fullSystemPrompt = `${JANET_SYSTEM_PROMPT}\n\n${contextSummary}`;

  const messages = buildMessages(ctx, userMessage);

  // Persist user turn immediately (non-blocking write)
  admin
    .from("agent_conversations")
    .insert({ user_uuid: userId, agent: "janet", role: "user", content: userMessage })
    .then(({ error }) => {
      if (error) console.error("[Janet] Failed to persist user turn:", error);
    });

  // Create streaming LLM call
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: fullSystemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  // Collect assistant response text for persistence
  const chunks: string[] = [];

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            chunks.push(text);
            controller.enqueue(encoder.encode(text));
          }
        }

        // Persist assistant turn after stream completes
        const assistantContent = chunks.join("");
        if (assistantContent) {
          admin
            .from("agent_conversations")
            .insert({
              user_uuid: userId,
              agent: "janet",
              role: "assistant",
              content: assistantContent,
            })
            .then(({ error }) => {
              if (error) console.error("[Janet] Failed to persist assistant turn:", error);
            });
        }
      } catch (err) {
        console.error("[Janet] Stream error:", err);
        controller.enqueue(
          encoder.encode(
            "\n\nI'm sorry — something went wrong on my end. Please try again in a moment.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}
