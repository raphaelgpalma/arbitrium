export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolParam {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required?: boolean;
  items?: { type: string };
  enum?: string[];
}

export interface ToolResult {
  title?: string;
  content: string;
  error?: string;
}

export interface ToolContext {
  cwd: string;
  ask: (permission: string, pattern: string) => Promise<"allow" | "deny">;
  signal?: AbortSignal;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface PermissionRule {
  permission: string;
  pattern: string;
  action: "allow" | "ask" | "deny";
}
