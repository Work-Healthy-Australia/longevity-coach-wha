import { type UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { streamAlexTurn } from '@/lib/ai/agents/alex';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let messages: UIMessage[];
  let currentPath: string;
  try {
    const body = await req.json();
    messages = body.messages;
    currentPath = body.currentPath ?? '/';
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Missing messages');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await streamAlexTurn(messages, currentPath);
  return result.toUIMessageStreamResponse();
}
