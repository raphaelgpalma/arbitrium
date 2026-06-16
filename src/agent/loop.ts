import type { Provider } from "../types.js";
import type { AgentMessage, ToolContext } from "./types.js";
import { getTool, toolsToOpenAIFormat } from "./registry.js";
import { evaluatePermission } from "./permissions.js";
import { FULL_PROMPT } from "../engine/prompts.js";
import { AGENT_SYSTEM_PROMPT } from "./prompt.js";
import { computeAutoTuneParams } from "../engine/autotune.js";
import { closeAllShellBridges, setShellProgressCallback } from "./tools/bash.js";
import { resolveSystemPrompt } from "../engine/core.js";

const MAX_STEPS = 25;

export interface AgentConfig {
  provider: Provider;
  model: string;
  apiKey?: string;
  cwd: string;
  autoApprove: boolean;
  godmode?: boolean;
  onShellProgress?: (data: { type: "stdout" | "stderr"; data: string }) => void;
}

export async function* agentLoop(
  userMessage: string,
  history: AgentMessage[],
  config: AgentConfig
): AsyncGenerator<{ type: "text" | "tool_start" | "tool_end" | "permission" | "done"; content?: string; tool?: string; args?: Record<string, unknown>; result?: string }, void, unknown> {
  const params = computeAutoTuneParams(userMessage);

  // Agent mode with tools is always used in chat so the model can act on the
  // very first user message (e.g. "list the current directory").
  const systemPrompt = config.godmode
    ? resolveSystemPrompt(config.model, true)
    : AGENT_SYSTEM_PROMPT;
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const allTools = toolsToOpenAIFormat();
  setShellProgressCallback(config.onShellProgress);

  let step = 0;
  let toolsActive = true;

  while (step < MAX_STEPS) {
    step++;

    const tools = toolsActive ? allTools : undefined;
    const response = await callLLM(config.provider, messages, config.model, tools, config.apiKey);

    const choice = response.choices?.[0];
    if (!choice) {
      yield { type: "text", content: "(No response)" };
      break;
    }

    const msg = choice.message;
    if (!msg) {
      yield { type: "text", content: "(Empty message)" };
      break;
    }

    if (msg.content && !msg.tool_calls?.length) {
      yield { type: "text", content: msg.content };
      messages.push({ role: "assistant", content: msg.content });
      break;
    }

    if (msg.tool_calls?.length) {
      toolsActive = true;
      const assistantMsg: AgentMessage = {
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
      messages.push(assistantMsg);

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        const tool = getTool(toolName);

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          yield { type: "tool_end", tool: toolName, result: `Error: Invalid JSON arguments` };
          messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: Invalid JSON arguments` });
          continue;
        }

        yield { type: "tool_start", tool: toolName, args };

        if (!tool) {
          const err = `Unknown tool: ${toolName}`;
          yield { type: "tool_end", tool: toolName, result: err };
          messages.push({ role: "tool", tool_call_id: tc.id, content: err });
          continue;
        }

        const ctx: ToolContext = {
          cwd: config.cwd,
          ask: async (permission, pattern) => {
            const action = evaluatePermission(permission, pattern);
            if (action === "deny") return "deny";
            if (action === "allow" || config.autoApprove) return "allow";
            // In a truly interactive agent UI, 'ask' would prompt the user. In
            // the current non-interactive CLI flow we default to deny unless
            // autoApprove is enabled.
            return "deny";
          },
        };

        try {
          const result = await tool.execute(args, ctx);
          const output = result.error || result.content;
          yield { type: "tool_end", tool: toolName, result: output };
          messages.push({ role: "tool", tool_call_id: tc.id, content: output });
        } catch (e: any) {
          const err = `Tool error: ${e.message}`;
          yield { type: "tool_end", tool: toolName, result: err };
          messages.push({ role: "tool", tool_call_id: tc.id, content: err });
        }
      }
      continue;
    }

    break;
  }

  closeAllShellBridges();
  yield { type: "done" };
}

async function callLLM(
  provider: Provider,
  messages: AgentMessage[],
  model: string,
  tools: any[] | undefined,
  apiKey?: string
): Promise<any> {
  const openaiMessages = messages.map((m) => {
    const out: any = { role: m.role, content: m.content };
    if (m.tool_calls) out.tool_calls = m.tool_calls;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });

  const body: any = {
    model,
    messages: openaiMessages,
    temperature: 0.7,
    max_tokens: 8192,
    stream: false,
  };
  if (tools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const apiKeyFinal = apiKey || process.env.OPENROUTER_API_KEY || "";
  const baseURL = provider.baseURL;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKeyFinal}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://arbitrium.local",
      "X-Title": "Arbitrium Agent",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}
