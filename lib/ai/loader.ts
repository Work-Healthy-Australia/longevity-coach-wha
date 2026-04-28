import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AgentDefinition } from './types';

export const loadAgentDef = unstable_cache(
  async (slug: string): Promise<AgentDefinition> => {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .schema('agents')
      .from('agent_definitions')
      .select('*')
      .eq('slug', slug)
      .eq('enabled', true)
      .single();
    if (error || !data) throw new Error(`Agent '${slug}' not found or disabled`);
    return data as unknown as AgentDefinition;
  },
  ['agent-def'],
  { revalidate: 60 }
);

export { getAnthropicModel } from './providers';
