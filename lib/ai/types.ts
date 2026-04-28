export type AgentProvider = 'anthropic' | 'openrouter';

export interface AgentDefinition {
  id: string;
  slug: string;
  display_name: string;
  model: string;
  provider: AgentProvider;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  mcp_servers: MCPServerConfig[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'sse' | 'http';
  url: string;
  enabled: boolean;
}
