export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  mode: "standard" | "crucible" | "chronicle" | "agent";
  provider: string;
  model?: string;
}

export interface ArbConfig {
  provider: string;        // "openrouter" | "ollama" | "ollama-cloud"
  model: string;
  mode: "standard" | "crucible" | "chronicle" | "agent";
  apiKey: string;
  baseUrl?: string;
  autoTune: boolean;
  stmEnabled: boolean;
  telemetry: boolean;
  godmode: boolean;        // jailbreak system prompt + combos
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  context?: number;
  pricing?: { input: number; output: number };
  jailbreakable: boolean;
}

export interface UsageStats {
  prompts: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  sessionCount: number;
}

export interface RaceResult {
  model: string;
  alias: string;
  content: string;
  score: number;
  rank: number;
  latencyMs: number;
  tokensUsed?: number;
  error?: string;
}

export interface PromptCombo {
  id: string;
  model: string;
  alias: string;
  color: string;
  system: string;
  user: string;
  fast?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  baseURL: string;
  envKey?: string;
  apiKeyRequired: boolean;
  chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, void, unknown>;
  chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<string>;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
  stream?: boolean;
  system?: string;
  signal?: AbortSignal;
  apiKey?: string;
}
